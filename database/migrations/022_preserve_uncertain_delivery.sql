-- Authorization changes must not erase unresolved SMTP outcomes.
CREATE OR REPLACE FUNCTION preserve_uncertain_alert_delivery() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'uncertain' AND NEW.status = 'held' THEN
        NEW.status := 'uncertain';
        NEW.next_attempt_at := NULL;
        NEW.last_error := concat_ws('; ', OLD.last_error, NEW.last_error);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER sec_event_email_preserve_uncertain
BEFORE UPDATE ON sec_event_email_outbox
FOR EACH ROW EXECUTE FUNCTION preserve_uncertain_alert_delivery();
