-- Hold registered alert delivery when canonical customer authorization
-- changes.  Re-enabling a customer never releases a held run automatically;
-- an administrator must review and release it explicitly.

CREATE OR REPLACE FUNCTION hold_customer_delivery_authorization_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IS DISTINCT FROM 'active' THEN
        UPDATE sec_alert_registrations
        SET registration_state = CASE
                WHEN registration_state IN ('retired', 'inactive') THEN registration_state
                ELSE 'needs_review'
            END,
            delivery_state = 'blocked',
            last_error = 'customer authorization became inactive',
            updated_at = NOW()
        WHERE customer_id = NEW.id
          AND registration_state NOT IN ('retired', 'inactive');
    END IF;

    IF (NEW.status IS DISTINCT FROM OLD.status
        OR NEW.alert_delivery_enabled IS DISTINCT FROM OLD.alert_delivery_enabled)
       AND (NEW.status IS DISTINCT FROM 'active' OR NOT NEW.alert_delivery_enabled) THEN
        UPDATE sec_event_email_outbox AS outbox
        SET status = 'held',
            next_attempt_at = NULL,
            claimed_at = NULL,
            claimed_by = NULL,
            last_error = 'customer authorization or alert delivery was disabled'
        FROM sec_events AS event
        WHERE outbox.event_id = event.id
          AND event.customer_id = NEW.id
          AND COALESCE(event.eid, '') <> ''
          AND outbox.status IN ('pending', 'processing', 'failed', 'uncertain');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_delivery_authorization_guard ON customers;

CREATE TRIGGER customer_delivery_authorization_guard
AFTER UPDATE OF status, alert_delivery_enabled ON customers
FOR EACH ROW
EXECUTE FUNCTION hold_customer_delivery_authorization_change();

COMMENT ON FUNCTION hold_customer_delivery_authorization_change() IS
    'Invalidates registered alert delivery when customer authorization changes; release remains an audited administrator action.';
