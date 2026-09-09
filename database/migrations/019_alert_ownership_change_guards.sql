-- Invalidate registrations and queued delivery when an index ownership row is
-- renamed, moved between deployments/customers, retired, or otherwise edited.
-- This replaces the 015 trigger, which only inspected the NEW pair and could
-- leave registrations for an OLD index or deployment deliverable.

CREATE OR REPLACE FUNCTION hold_changed_index_alert_delivery() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    affected_deployment TEXT;
    affected_index TEXT;
BEGIN
    -- An UPDATE/DELETE removes or changes the old ownership assertion.  Any
    -- registration that still references it must be reviewed, even when the
    -- replacement row happens to have the same customer.
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        affected_deployment := OLD.splunk_deployment;
        affected_index := OLD.index_name;

        UPDATE sec_alert_registrations AS registration
        SET registration_state = CASE
                WHEN registration.registration_state IN ('retired', 'inactive')
                    THEN registration.registration_state
                ELSE 'needs_review'
            END,
            delivery_state = 'blocked',
            last_error = 'source index ownership changed; administrator review required',
            updated_at = NOW()
        WHERE registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes);

        UPDATE sec_event_email_outbox AS outbox
        SET status = 'held', next_attempt_at = NULL,
            last_error = 'source index ownership changed before send',
            claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
        FROM sec_events AS event
        JOIN sec_alert_registrations AS registration
          ON registration.id = event.alert_registration_id
        WHERE event.id = outbox.event_id
          AND COALESCE(event.eid, '') <> ''
          AND registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes)
          AND outbox.status IN ('pending', 'processing', 'failed', 'uncertain');
    END IF;

    -- An INSERT/UPDATE establishes or changes the new ownership assertion.
    -- Revalidation is deliberate: an ownership edit invalidates all affected
    -- registrations until an administrator confirms the new scope.
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        affected_deployment := NEW.splunk_deployment;
        affected_index := NEW.index_name;

        UPDATE sec_alert_registrations AS registration
        SET registration_state = CASE
                WHEN registration.registration_state IN ('retired', 'inactive')
                    THEN registration.registration_state
                ELSE 'needs_review'
            END,
            delivery_state = 'blocked',
            last_error = CASE
                WHEN NEW.status <> 'active'
                    THEN 'source index ownership is not active'
                ELSE 'source index ownership changed; administrator review required'
            END,
            updated_at = NOW()
        WHERE registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes);

        UPDATE sec_event_email_outbox AS outbox
        SET status = 'held', next_attempt_at = NULL,
            last_error = 'source index ownership changed before send',
            claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
        FROM sec_events AS event
        JOIN sec_alert_registrations AS registration
          ON registration.id = event.alert_registration_id
        WHERE event.id = outbox.event_id
          AND COALESCE(event.eid, '') <> ''
          AND registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes)
          AND outbox.status IN ('pending', 'processing', 'failed', 'uncertain');
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS sec_alert_index_ownership_hold ON sec_alert_index_ownership;

CREATE TRIGGER sec_alert_index_ownership_hold
AFTER INSERT OR UPDATE OR DELETE ON sec_alert_index_ownership
FOR EACH ROW
EXECUTE FUNCTION hold_changed_index_alert_delivery();

COMMENT ON FUNCTION hold_changed_index_alert_delivery() IS
'Invalidate alert registrations and queued EID delivery for both old and new index ownership pairs.';
