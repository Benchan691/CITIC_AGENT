-- Make approved Splunk verification evidence part of every active ownership
-- routing decision. Existing active rows are intentionally not backfilled:
-- they remain visible but unresolved until an administrator verifies them.

ALTER TABLE sec_alert_index_ownership
    DROP CONSTRAINT IF EXISTS sec_alert_index_active_verified_check;

ALTER TABLE sec_alert_index_ownership
    ADD CONSTRAINT sec_alert_index_active_verified_check
    CHECK (
        status <> 'active'
        OR (
            verified_at IS NOT NULL
            AND length(btrim(verified_by)) > 0
            AND verification ->> 'verified' = 'true'
            AND verification ->> 'deployment' = splunk_deployment
            AND verification ->> 'index_name' = index_name
        )
    ) NOT VALID;

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
                        AND ownership.verified_at IS NOT NULL
                        AND ownership.verification ->> 'verified' = 'true'
                        AND ownership.verification ->> 'deployment' = ownership.splunk_deployment
                        AND ownership.verification ->> 'index_name' = ownership.index_name
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

CREATE OR REPLACE FUNCTION hold_changed_index_alert_delivery() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    affected_deployment TEXT;
    affected_index TEXT;
    old_authorized BOOLEAN := FALSE;
    new_authorized BOOLEAN := FALSE;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        old_authorized := OLD.status = 'active'
            AND OLD.verified_at IS NOT NULL
            AND OLD.verification ->> 'verified' = 'true'
            AND OLD.verification ->> 'deployment' = OLD.splunk_deployment
            AND OLD.verification ->> 'index_name' = OLD.index_name;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        new_authorized := NEW.status = 'active'
            AND NEW.verified_at IS NOT NULL
            AND NEW.verification ->> 'verified' = 'true'
            AND NEW.verification ->> 'deployment' = NEW.splunk_deployment
            AND NEW.verification ->> 'index_name' = NEW.index_name;
    END IF;
    IF TG_OP = 'UPDATE'
       AND ROW(NEW.splunk_deployment, NEW.index_name, NEW.customer_id, new_authorized)
           IS NOT DISTINCT FROM
           ROW(OLD.splunk_deployment, OLD.index_name, OLD.customer_id, old_authorized) THEN
        RETURN NEW;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        affected_deployment := OLD.splunk_deployment;
        affected_index := OLD.index_name;
        UPDATE sec_alert_registrations AS registration
        SET registration_state = CASE
                WHEN registration.registration_state IN ('retired', 'inactive')
                    THEN registration.registration_state ELSE 'needs_review' END,
            delivery_state = 'blocked', scope_review_fingerprint = NULL,
            scope_reviewed_at = NULL, scope_reviewed_by = '',
            last_error = 'source index ownership or verification changed; administrator review required',
            updated_at = NOW()
        WHERE registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes);
        UPDATE sec_event_email_outbox AS outbox
        SET status = 'held', next_attempt_at = NULL,
            last_error = 'source index ownership or verification changed before send',
            claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
        FROM sec_events AS event
        JOIN sec_alert_registrations AS registration ON registration.id = event.alert_registration_id
        WHERE event.id = outbox.event_id
          AND registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes)
          AND outbox.status IN ('pending', 'processing', 'failed', 'uncertain');
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        affected_deployment := NEW.splunk_deployment;
        affected_index := NEW.index_name;
        UPDATE sec_alert_registrations AS registration
        SET registration_state = CASE
                WHEN registration.registration_state IN ('retired', 'inactive')
                    THEN registration.registration_state ELSE 'needs_review' END,
            delivery_state = 'blocked', scope_review_fingerprint = NULL,
            scope_reviewed_at = NULL, scope_reviewed_by = '',
            last_error = CASE WHEN NOT new_authorized
                THEN 'source index ownership is not verified and active'
                ELSE 'source index ownership or verification changed; administrator review required' END,
            updated_at = NOW()
        WHERE registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes);
        UPDATE sec_event_email_outbox AS outbox
        SET status = 'held', next_attempt_at = NULL,
            last_error = 'source index ownership or verification changed before send',
            claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
        FROM sec_events AS event
        JOIN sec_alert_registrations AS registration ON registration.id = event.alert_registration_id
        WHERE event.id = outbox.event_id
          AND registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes)
          AND outbox.status IN ('pending', 'processing', 'failed', 'uncertain');
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
