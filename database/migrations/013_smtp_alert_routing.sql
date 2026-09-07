ALTER TABLE sec_event_email_outbox ALTER COLUMN next_attempt_at DROP NOT NULL;
ALTER TABLE sec_event_email_outbox
    ADD COLUMN accepted_recipients JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN rejected_recipients JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN delivery_snapshot JSONB,
    ADD COLUMN smtp_accepted_at TIMESTAMPTZ;
ALTER TABLE sec_alert_email_rules ADD COLUMN routing JSONB NOT NULL DEFAULT '{}';
ALTER TABLE rulesets ADD COLUMN email_content JSONB NOT NULL DEFAULT '{}';
-- Existing installations must explicitly re-enable their rules after review.
UPDATE sec_alert_email_rules SET enabled = FALSE;
UPDATE sec_event_email_outbox SET status = 'disabled', next_attempt_at = NULL,
    last_error = 'SMTP migration: historical delivery excluded'
    WHERE status IN ('pending', 'failed');

ALTER TABLE sec_event_email_outbox DROP CONSTRAINT sec_event_email_outbox_status_check;
ALTER TABLE sec_event_email_outbox ADD CONSTRAINT sec_event_email_outbox_status_check
    CHECK (status IN ('pending','processing','sent','accepted','failed','uncertain','disabled'));
COMMENT ON COLUMN sec_event_email_outbox.smtp_accepted_at IS 'Relay acceptance only; mailbox delivery is not confirmed';
-- Disabled rules do not build a historical queue to replay when enabled later.
CREATE OR REPLACE FUNCTION enqueue_sec_event_email() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM sec_alert_email_rules r WHERE r.enabled
        AND (r.customer_id IS NULL OR r.customer_id=NEW.customer_id)
        AND (r.ruleset_id IS NULL OR r.ruleset_id=NEW.ruleset_id)
        AND NEW.severity=ANY(r.severities)) THEN
        INSERT INTO sec_event_email_outbox(event_id,customer_id) VALUES(NEW.id,NEW.customer_id)
        ON CONFLICT(event_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
