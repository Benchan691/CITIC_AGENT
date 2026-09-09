-- Complete the additive CID -> AID -> EID delivery contract.
--
-- 014 introduced the first registry and event path.  This migration keeps
-- those columns and identifiers, but makes delivery opt-in, binds receipts
-- to a deployment, records discovery completeness, and replaces the broad
-- outbox trigger with one that cannot enqueue a new event from legacy polling.

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS alert_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF to_regclass(current_schema() || '.soc_customer') IS NOT NULL THEN
        ALTER TABLE soc_customer
            ADD COLUMN IF NOT EXISTS alert_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END;
$$;

ALTER TABLE sec_alert_registrations
    ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS presence_state TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS publication_state TEXT NOT NULL DEFAULT 'unpublished',
    ADD COLUMN IF NOT EXISTS action_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_discovery_run_id UUID;

ALTER TABLE sec_alert_registrations
    DROP CONSTRAINT IF EXISTS sec_alert_registration_presence_state_check;

ALTER TABLE sec_alert_registrations
    ADD CONSTRAINT sec_alert_registration_presence_state_check
    CHECK (presence_state IN ('unknown', 'present', 'missing', 'incomplete'));

ALTER TABLE sec_alert_registrations
    DROP CONSTRAINT IF EXISTS sec_alert_registration_publication_state_check;

ALTER TABLE sec_alert_registrations
    ADD CONSTRAINT sec_alert_registration_publication_state_check
    CHECK (publication_state IN ('unpublished', 'pending', 'published', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS sec_alert_registration_customer_sequence_uidx
    ON sec_alert_registrations (customer_id, aid_sequence);

CREATE INDEX IF NOT EXISTS sec_alert_registration_presence_idx
    ON sec_alert_registrations (splunk_deployment, presence_state, registration_state);

CREATE TABLE IF NOT EXISTS sec_alert_ingest_deployments (
    deployment TEXT PRIMARY KEY,
    key_id TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sec_alert_ingest_deployment_name_check
        CHECK (length(btrim(deployment)) BETWEEN 1 AND 512)
);

CREATE TABLE IF NOT EXISTS sec_alert_discovery_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'incomplete', 'failed')),
    discovered_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
    page_count INTEGER NOT NULL DEFAULT 0 CHECK (page_count >= 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error TEXT,
    UNIQUE (deployment, id)
);

CREATE INDEX IF NOT EXISTS sec_alert_discovery_runs_latest_idx
    ON sec_alert_discovery_runs (deployment, started_at DESC);

ALTER TABLE sec_alert_run_receipts
    ADD COLUMN IF NOT EXISTS deployment TEXT,
    ADD COLUMN IF NOT EXISTS definition_revision INTEGER,
    ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES sec_alert_email_policies (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS policy_revision INTEGER,
    ADD COLUMN IF NOT EXISTS trigger_time_precision SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS conflict_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sec_events
    ADD COLUMN IF NOT EXISTS email_policy_id UUID REFERENCES sec_alert_email_policies (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS email_policy_revision INTEGER,
    ADD COLUMN IF NOT EXISTS source_result_count INTEGER,
    ADD COLUMN IF NOT EXISTS trigger_time_precision SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE sec_event_email_outbox
    DROP CONSTRAINT IF EXISTS sec_event_email_outbox_status_check;

ALTER TABLE sec_event_email_outbox
    ADD CONSTRAINT sec_event_email_outbox_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'accepted', 'failed', 'uncertain', 'disabled', 'held'));

CREATE TABLE IF NOT EXISTS sec_alert_delivery_reconciliation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES sec_alert_registrations (id) ON DELETE CASCADE,
    splunk_sid TEXT NOT NULL,
    trigger_time TIMESTAMPTZ,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'missing'
        CHECK (status IN ('missing', 'received', 'conflict', 'unregistered')),
    reason TEXT NOT NULL DEFAULT '',
    UNIQUE (registration_id, splunk_sid)
);

CREATE INDEX IF NOT EXISTS sec_alert_delivery_reconciliation_status_idx
    ON sec_alert_delivery_reconciliation (status, observed_at DESC);

CREATE TABLE IF NOT EXISTS sec_alert_migration_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT NOT NULL CHECK (mode IN ('preview', 'backfill')),
    actor TEXT NOT NULL DEFAULT '',
    report JSONB NOT NULL DEFAULT '{}'::JSONB,
    historical_email_suppressed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A payload assertion is useful for audit, but the deployment identity comes
-- from the authenticated webhook key and the registration row.  Backfill it
-- for existing receipts without changing their public identifiers.
UPDATE sec_alert_run_receipts AS receipt
SET deployment = registration.splunk_deployment
FROM sec_alert_registrations AS registration
WHERE registration.id = receipt.registration_id
  AND (receipt.deployment IS NULL OR receipt.deployment = '');

-- 014 used a generated legacy-* CID fallback for rows with no usable public
-- customer code.  Those rows must remain unresolved until an administrator
-- supplies a code; never expose the fallback as a new public CID.  Existing
-- allocated AIDs retain their original CID for historical compatibility.
UPDATE customers AS customer
SET cid = NULL
WHERE customer.cid LIKE 'legacy-%'
  AND NOT EXISTS (
      SELECT 1 FROM sec_alert_registrations AS registration
      WHERE registration.customer_id = customer.id
  );

CREATE OR REPLACE FUNCTION enqueue_sec_event_email() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    eligible BOOLEAN := FALSE;
BEGIN
    IF COALESCE(NEW.eid, '') <> '' THEN
        SELECT EXISTS (
            SELECT 1
            FROM customers AS customer
            JOIN sec_alert_registrations AS registration
              ON registration.id = NEW.alert_registration_id
             AND registration.customer_id = customer.id
            WHERE customer.id = NEW.customer_id
              AND customer.status = 'active'
              AND customer.alert_delivery_enabled
              AND registration.registration_state = 'active'
              AND registration.delivery_state = 'ready'
              AND registration.delivery_enabled
              AND registration.presence_state IN ('unknown', 'present')
              AND jsonb_typeof(customer.email_config -> 'recipients') = 'array'
              AND jsonb_array_length(customer.email_config -> 'recipients') > 0
              AND cardinality(registration.source_indexes) > 0
              AND NOT EXISTS (
                  SELECT 1
                  FROM unnest(registration.source_indexes) AS source(index_name)
                  WHERE NOT EXISTS (
                      SELECT 1
                      FROM sec_alert_index_ownership AS ownership
                      WHERE ownership.splunk_deployment = registration.splunk_deployment
                        AND ownership.index_name = source.index_name
                        AND ownership.customer_id = registration.customer_id
                        AND ownership.status = 'active'
                  )
              )
        ) INTO eligible;

        IF eligible AND COALESCE((NEW.event_data ->> 'email_held')::BOOLEAN, FALSE) = FALSE THEN
            INSERT INTO sec_event_email_outbox (
                event_id, customer_id, eid, recipient_snapshot, rendering_policy_snapshot
            )
            SELECT NEW.id, NEW.customer_id, NEW.eid, customer.email_config,
                   CASE WHEN jsonb_typeof(NEW.event_data -> 'email_policy') = 'object'
                        THEN NEW.event_data -> 'email_policy' ELSE '{}'::JSONB END
            FROM customers AS customer
            WHERE customer.id = NEW.customer_id
            ON CONFLICT (event_id) DO NOTHING;
        END IF;
        RETURN NEW;
    END IF;

    -- The old rules remain available only for events on the explicitly legacy
    -- path.  Polling never inserts such rows for a registered alert.
    IF COALESCE((NEW.event_data ->> 'email_held')::BOOLEAN, FALSE) = FALSE
       AND EXISTS (
           SELECT 1
           FROM sec_alert_email_rules AS rule
           WHERE rule.enabled
             AND (rule.customer_id IS NULL OR rule.customer_id = NEW.customer_id)
             AND (rule.ruleset_id IS NULL OR rule.ruleset_id = NEW.ruleset_id)
             AND NEW.severity = ANY(rule.severities)
       ) THEN
        INSERT INTO sec_event_email_outbox (event_id, customer_id)
        VALUES (NEW.id, NEW.customer_id)
        ON CONFLICT (event_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_events_email_outbox_insert ON sec_events;

CREATE TRIGGER sec_events_email_outbox_insert
AFTER INSERT ON sec_events
FOR EACH ROW
EXECUTE FUNCTION enqueue_sec_event_email();

CREATE OR REPLACE FUNCTION hold_customer_alert_delivery() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.alert_delivery_enabled IS DISTINCT FROM OLD.alert_delivery_enabled THEN
        UPDATE sec_event_email_outbox AS outbox
        SET status = 'held', next_attempt_at = NULL,
            last_error = 'customer authorization or lifecycle changed before send',
            claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
        FROM sec_events AS event
        WHERE event.id = outbox.event_id
          AND event.customer_id = NEW.id
          AND COALESCE(event.eid, '') <> ''
          AND outbox.status IN ('pending', 'failed');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_alert_delivery_hold ON customers;

CREATE TRIGGER customers_alert_delivery_hold
AFTER UPDATE OF status, alert_delivery_enabled ON customers
FOR EACH ROW
EXECUTE FUNCTION hold_customer_alert_delivery();

CREATE OR REPLACE FUNCTION hold_changed_index_alert_delivery() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    changed_deployment TEXT;
    changed_index TEXT;
    changed_customer UUID;
    changed_status TEXT;
BEGIN
    changed_deployment := CASE WHEN TG_OP = 'DELETE' THEN OLD.splunk_deployment ELSE NEW.splunk_deployment END;
    changed_index := CASE WHEN TG_OP = 'DELETE' THEN OLD.index_name ELSE NEW.index_name END;
    changed_customer := CASE WHEN TG_OP = 'DELETE' THEN OLD.customer_id ELSE NEW.customer_id END;
    changed_status := CASE WHEN TG_OP = 'DELETE' THEN 'retired' ELSE NEW.status END;

    IF changed_status <> 'active' THEN
        UPDATE sec_alert_registrations AS registration
        SET registration_state = CASE
                WHEN registration.registration_state = 'retired' THEN 'retired'
                ELSE 'needs_review'
            END,
            delivery_state = 'blocked',
            last_error = 'source index ownership is not active',
            updated_at = NOW()
        WHERE registration.splunk_deployment = changed_deployment
          AND changed_index = ANY(registration.source_indexes);
    ELSE
        UPDATE sec_alert_registrations AS registration
        SET registration_state = CASE
                WHEN registration.registration_state = 'retired' THEN 'retired'
                ELSE 'needs_review'
            END,
            delivery_state = 'blocked',
            last_error = 'source index ownership changed; administrator review required',
            updated_at = NOW()
        WHERE registration.splunk_deployment = changed_deployment
          AND changed_index = ANY(registration.source_indexes)
          AND registration.customer_id <> changed_customer;
    END IF;

    UPDATE sec_event_email_outbox AS outbox
    SET status = 'held', next_attempt_at = NULL,
        last_error = 'source index ownership changed before send',
        claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
    FROM sec_events AS event
    JOIN sec_alert_registrations AS registration ON registration.id = event.alert_registration_id
    WHERE event.id = outbox.event_id
      AND COALESCE(event.eid, '') <> ''
      AND registration.splunk_deployment = changed_deployment
      AND changed_index = ANY(registration.source_indexes);

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS sec_alert_index_ownership_hold ON sec_alert_index_ownership;

CREATE TRIGGER sec_alert_index_ownership_hold
AFTER INSERT OR UPDATE OR DELETE ON sec_alert_index_ownership
FOR EACH ROW
EXECUTE FUNCTION hold_changed_index_alert_delivery();
