-- Audited administrator review actions and the final historical-email guard.
-- This migration is additive and must run after 016.

CREATE TABLE IF NOT EXISTS sec_alert_delivery_review_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES sec_events (id) ON DELETE SET NULL,
    registration_id UUID REFERENCES sec_alert_registrations (id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('release', 'hold', 'relink', 'enable', 'disable')),
    actor TEXT NOT NULL DEFAULT '',
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sec_alert_delivery_review_actions_event_idx
    ON sec_alert_delivery_review_actions (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sec_alert_delivery_review_actions_registration_idx
    ON sec_alert_delivery_review_actions (registration_id, created_at DESC);

-- Mark pre-redesign events before replacing the trigger. This is intentionally
-- a one-way suppression marker: enabling a policy later cannot replay them.
UPDATE sec_events
SET historical_email_suppressed = TRUE
WHERE COALESCE(eid, '') = ''
  AND historical_email_suppressed = FALSE;

UPDATE sec_event_email_outbox AS outbox
SET status = 'disabled', next_attempt_at = NULL,
    last_error = 'historical migration event; email replay is suppressed',
    claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
FROM sec_events AS event
WHERE event.id = outbox.event_id
  AND event.historical_email_suppressed
  AND outbox.status IN ('pending', 'failed');

-- A migrated or explicitly historical event can never be queued by the new
-- event trigger, even if a later policy/recipient update occurs.
CREATE OR REPLACE FUNCTION enqueue_sec_event_email() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    eligible BOOLEAN := FALSE;
BEGIN
    IF COALESCE(NEW.historical_email_suppressed, FALSE) THEN
        RETURN NEW;
    END IF;

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
            SELECT NEW.id, NEW.customer_id, NEW.eid,
                   CASE WHEN jsonb_typeof(NEW.event_data -> 'recipient_snapshot') = 'object'
                        THEN NEW.event_data -> 'recipient_snapshot' ELSE customer.email_config END,
                   CASE WHEN jsonb_typeof(NEW.event_data -> 'email_policy') = 'object'
                        THEN NEW.event_data -> 'email_policy' ELSE '{}'::JSONB END
            FROM customers AS customer
            WHERE customer.id = NEW.customer_id
            ON CONFLICT (event_id) DO NOTHING;
        END IF;
        RETURN NEW;
    END IF;

    -- Legacy rules remain available only to the explicitly legacy ingestion
    -- path. A registered event always has an EID and uses the branch above.
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
