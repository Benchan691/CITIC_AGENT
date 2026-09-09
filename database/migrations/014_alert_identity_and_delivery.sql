-- Alert identity redesign.
--
-- This migration is additive.  GID/Event_GID/Event_Rulenum remain available
-- for legacy records and reconciliation, but new delivery is keyed by
-- customer CID -> alert AID -> triggered-run EID.

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS cid TEXT;

-- The catalog is authoritative when it is already installed.  A legacy GID
-- is only a bootstrap fallback for installations that have not run the
-- catalog compatibility bridge yet; the bridge replaces it with the catalog
-- customer_code before an alert can be registered.
DO $$
BEGIN
    IF to_regclass(current_schema() || '.soc_customer') IS NOT NULL THEN
        EXECUTE $sql$
            UPDATE customers AS c
            SET cid = s.customer_code
            FROM soc_customer AS s
            WHERE s.legacy_customer_id = c.id
              AND COALESCE(s.customer_code, '') <> ''
              AND (c.cid IS NULL OR c.cid = '')
        $sql$;
    END IF;
END;
$$;

UPDATE customers
SET cid = COALESCE(NULLIF(cid, ''), NULLIF(gid, ''), 'legacy-' || replace(id::text, '-', ''))
WHERE cid IS NULL OR cid = '';

CREATE UNIQUE INDEX IF NOT EXISTS customers_cid_uidx
    ON customers (cid)
    WHERE cid IS NOT NULL AND cid <> '';

CREATE TABLE IF NOT EXISTS sec_alert_aid_counters (
    customer_id UUID PRIMARY KEY REFERENCES customers (id) ON DELETE RESTRICT,
    next_sequence INTEGER NOT NULL DEFAULT 0
        CHECK (next_sequence BETWEEN 0 AND 10000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sec_alert_index_ownership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    splunk_deployment TEXT NOT NULL,
    index_name TEXT NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'review', 'retired')),
    created_by TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sec_alert_index_ownership_name_check
        CHECK (length(btrim(splunk_deployment)) BETWEEN 1 AND 512
           AND length(btrim(index_name)) BETWEEN 1 AND 255)
);

CREATE UNIQUE INDEX IF NOT EXISTS sec_alert_index_ownership_uidx
    ON sec_alert_index_ownership (splunk_deployment, index_name);

CREATE INDEX IF NOT EXISTS sec_alert_index_ownership_customer_idx
    ON sec_alert_index_ownership (customer_id, status, index_name);

CREATE TABLE IF NOT EXISTS sec_alert_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
    aid TEXT NOT NULL UNIQUE,
    aid_sequence INTEGER NOT NULL CHECK (aid_sequence BETWEEN 0 AND 9999),
    splunk_deployment TEXT NOT NULL,
    app TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    saved_search_name TEXT NOT NULL,
    stable_id TEXT,
    source_indexes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    definition_fingerprint TEXT NOT NULL DEFAULT '',
    definition_revision INTEGER NOT NULL DEFAULT 1 CHECK (definition_revision >= 1),
    next_run_sequence BIGINT NOT NULL DEFAULT 1 CHECK (next_run_sequence >= 1),
    registration_state TEXT NOT NULL DEFAULT 'needs_review'
        CHECK (registration_state IN ('pending', 'active', 'needs_review', 'failed', 'inactive', 'retired')),
    delivery_state TEXT NOT NULL DEFAULT 'action_missing'
        CHECK (delivery_state IN ('action_missing', 'ready', 'blocked')),
    origin TEXT NOT NULL DEFAULT 'unknown'
        CHECK (origin IN ('human', 'agent', 'discovery', 'unknown')),
    last_error TEXT,
    created_by TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sec_alert_registration_aid_format_check
        CHECK (aid ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}-[0-9]{4}$'),
    CONSTRAINT sec_alert_registration_name_check
        CHECK (length(btrim(saved_search_name)) BETWEEN 1 AND 255),
    CONSTRAINT sec_alert_registration_deployment_check
        CHECK (length(btrim(splunk_deployment)) BETWEEN 1 AND 512)
);

ALTER TABLE sec_alert_registrations
    ADD COLUMN IF NOT EXISTS last_discovered_at TIMESTAMPTZ;

ALTER TABLE sec_alert_registrations
    DROP CONSTRAINT IF EXISTS sec_alert_registrations_registration_state_check;

ALTER TABLE sec_alert_registrations
    ADD CONSTRAINT sec_alert_registrations_registration_state_check
    CHECK (registration_state IN ('pending', 'active', 'needs_review', 'failed', 'inactive', 'retired'));

CREATE UNIQUE INDEX IF NOT EXISTS sec_alert_registration_stable_uidx
    ON sec_alert_registrations (splunk_deployment, stable_id)
    WHERE stable_id IS NOT NULL AND stable_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS sec_alert_registration_name_uidx
    ON sec_alert_registrations (splunk_deployment, app, owner, saved_search_name);

CREATE INDEX IF NOT EXISTS sec_alert_registration_customer_idx
    ON sec_alert_registrations (customer_id, registration_state, delivery_state);

CREATE OR REPLACE FUNCTION prevent_allocated_customer_cid_change() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.cid IS DISTINCT FROM OLD.cid
       AND EXISTS (
           SELECT 1 FROM sec_alert_registrations
           WHERE customer_id = OLD.id
       ) THEN
        RAISE EXCEPTION 'customer CID cannot change after an alert AID is allocated'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_cid_immutable_after_aid ON customers;

CREATE TRIGGER customers_cid_immutable_after_aid
BEFORE UPDATE OF cid ON customers
FOR EACH ROW
EXECUTE FUNCTION prevent_allocated_customer_cid_change();

CREATE TABLE IF NOT EXISTS sec_alert_registration_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES sec_alert_registrations (id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    definition_fingerprint TEXT NOT NULL DEFAULT '',
    definition JSONB NOT NULL DEFAULT '{}'::JSONB,
    actor TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (registration_id, revision)
);

CREATE TABLE IF NOT EXISTS sec_alert_registration_review (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_key TEXT NOT NULL UNIQUE,
    splunk_deployment TEXT NOT NULL,
    app TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    saved_search_name TEXT NOT NULL,
    stable_id TEXT,
    source_indexes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    definition JSONB NOT NULL DEFAULT '{}'::JSONB,
    reason TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sec_alert_registration_review_pending_idx
    ON sec_alert_registration_review (created_at, id)
    WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS sec_alert_email_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    registration_id UUID REFERENCES sec_alert_registrations (id) ON DELETE CASCADE,
    policy JSONB NOT NULL DEFAULT '{"detail_columns":[],"field_mappings":[],"required_columns":[],"optional_columns":[],"max_display_rows":50,"max_stored_rows":1000,"row_filters":[],"severity_fallback":"unknown"}'::JSONB,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    updated_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sec_alert_email_policy_customer_default_uidx
    ON sec_alert_email_policies (customer_id)
    WHERE registration_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sec_alert_email_policy_registration_uidx
    ON sec_alert_email_policies (registration_id)
    WHERE registration_id IS NOT NULL;

ALTER TABLE sec_events
    ADD COLUMN IF NOT EXISTS cid TEXT,
    ADD COLUMN IF NOT EXISTS aid TEXT,
    ADD COLUMN IF NOT EXISTS eid TEXT,
    ADD COLUMN IF NOT EXISTS alert_registration_id UUID
        REFERENCES sec_alert_registrations (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trigger_received_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS definition_revision INTEGER,
    ADD COLUMN IF NOT EXISTS detail_total INTEGER,
    ADD COLUMN IF NOT EXISTS detail_stored INTEGER,
    ADD COLUMN IF NOT EXISTS detail_displayed INTEGER,
    ADD COLUMN IF NOT EXISTS detail_truncated BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS delivery_completeness TEXT NOT NULL DEFAULT 'complete'
        CHECK (delivery_completeness IN ('complete', 'truncated', 'partial', 'unknown'));

-- The legacy uniqueness key did not include a registered alert or deployment.
-- Keep it for legacy polling rows only; the new receiver deduplicates by
-- registration plus the original Splunk SID.
DROP INDEX IF EXISTS sec_events_splunk_alert_dedup_idx;

CREATE UNIQUE INDEX IF NOT EXISTS sec_events_splunk_alert_legacy_dedup_idx
    ON sec_events (splunk_sid, alert_name, trigger_time)
    WHERE splunk_sid IS NOT NULL AND alert_registration_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sec_events_eid_uidx
    ON sec_events (eid)
    WHERE eid IS NOT NULL AND eid <> '';

CREATE UNIQUE INDEX IF NOT EXISTS sec_events_registration_sid_uidx
    ON sec_events (alert_registration_id, splunk_sid)
    WHERE alert_registration_id IS NOT NULL AND splunk_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS sec_events_aid_trigger_idx
    ON sec_events (aid, trigger_time, id)
    WHERE aid IS NOT NULL;

CREATE TABLE IF NOT EXISTS sec_event_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES sec_events (id) ON DELETE CASCADE,
    row_position INTEGER NOT NULL CHECK (row_position >= 0),
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, row_position)
);

CREATE INDEX IF NOT EXISTS sec_event_details_event_idx
    ON sec_event_details (event_id, row_position);

CREATE TABLE IF NOT EXISTS sec_alert_run_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES sec_alert_registrations (id) ON DELETE RESTRICT,
    splunk_sid TEXT NOT NULL,
    trigger_time TIMESTAMPTZ NOT NULL,
    receipt_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    eid TEXT,
    event_id UUID REFERENCES sec_events (id) ON DELETE SET NULL,
    payload_hash TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processed', 'quarantined', 'failed')),
    last_error TEXT,
    UNIQUE (registration_id, splunk_sid)
);

CREATE INDEX IF NOT EXISTS sec_alert_run_receipts_trigger_idx
    ON sec_alert_run_receipts (registration_id, trigger_time, id);

CREATE TABLE IF NOT EXISTS sec_alert_run_quarantine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dedup_key TEXT NOT NULL UNIQUE,
    splunk_deployment TEXT NOT NULL,
    splunk_sid TEXT,
    alert_name TEXT,
    trigger_time TIMESTAMPTZ,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    reason TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_attempt_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sec_alert_run_quarantine_pending_idx
    ON sec_alert_run_quarantine (created_at, id)
    WHERE resolved_at IS NULL;

ALTER TABLE sec_event_email_outbox
    ADD COLUMN IF NOT EXISTS eid TEXT,
    ADD COLUMN IF NOT EXISTS recipient_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS rendering_policy_snapshot JSONB;

CREATE INDEX IF NOT EXISTS sec_event_email_outbox_eid_idx
    ON sec_event_email_outbox (eid)
    WHERE eid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sec_event_email_outbox_eid_uidx
    ON sec_event_email_outbox (eid)
    WHERE eid IS NOT NULL AND eid <> '';

-- Keep the one-outbox-row-per-event invariant, while retaining the existing
-- severity/rule gate used by the administrator dashboard.
CREATE OR REPLACE FUNCTION enqueue_sec_event_email() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF (
        COALESCE(NEW.eid, '') <> ''
        AND COALESCE((NEW.event_data ->> 'email_held')::BOOLEAN, FALSE) = FALSE
        AND EXISTS (
            SELECT 1
            FROM customers AS customer
            WHERE customer.id = NEW.customer_id
              AND jsonb_typeof(customer.email_config -> 'recipients') = 'array'
              AND jsonb_array_length(customer.email_config -> 'recipients') > 0
        )
    ) OR EXISTS (
        SELECT 1
        FROM sec_alert_email_rules AS r
        WHERE r.enabled
          AND (r.customer_id IS NULL OR r.customer_id = NEW.customer_id)
          AND (r.ruleset_id IS NULL OR r.ruleset_id = NEW.ruleset_id)
          AND NEW.severity = ANY(r.severities)
          AND COALESCE((NEW.event_data ->> 'email_held')::BOOLEAN, FALSE) = FALSE
    ) THEN
        INSERT INTO sec_event_email_outbox (
            event_id, customer_id, eid, recipient_snapshot, rendering_policy_snapshot
        )
        SELECT NEW.id, NEW.customer_id, NEW.eid, c.email_config, NEW.event_data -> 'email_policy'
        FROM customers AS c
        WHERE c.id = NEW.customer_id
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
