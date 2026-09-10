-- Persist the administrator evidence used by ownership, scope review, and
-- migration apply operations.

ALTER TABLE sec_alert_index_ownership
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS verification JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE sec_alert_registrations
    ADD COLUMN IF NOT EXISTS action_configured BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS scope_review_fingerprint TEXT,
    ADD COLUMN IF NOT EXISTS scope_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scope_reviewed_by TEXT NOT NULL DEFAULT '';

UPDATE sec_alert_registrations
SET action_configured = TRUE
WHERE action_verified_at IS NOT NULL OR delivery_state = 'ready';

ALTER TABLE sec_alert_registration_review
    ADD COLUMN IF NOT EXISTS registration_id UUID
        REFERENCES sec_alert_registrations (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolved_by TEXT NOT NULL DEFAULT '';

ALTER TABLE sec_alert_delivery_review_actions
    DROP CONSTRAINT IF EXISTS sec_alert_delivery_review_actions_action_check;

ALTER TABLE sec_alert_delivery_review_actions
    ADD CONSTRAINT sec_alert_delivery_review_actions_action_check
    CHECK (action IN ('release', 'hold', 'relink', 'enable', 'disable', 'remove_policy_override'));

ALTER TABLE sec_alert_migration_runs
    ADD COLUMN IF NOT EXISTS source_preview_id UUID
        REFERENCES sec_alert_migration_runs (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS sec_alert_migration_preview_apply_uidx
    ON sec_alert_migration_runs (source_preview_id)
    WHERE source_preview_id IS NOT NULL;

COMMENT ON COLUMN sec_alert_index_ownership.verification IS
'Bounded metadata returned by the approved Splunk integration when the exact index was verified.';
COMMENT ON COLUMN sec_alert_registrations.scope_review_fingerprint IS
'Canonical definition fingerprint whose otherwise unresolved source scope was explicitly approved by an administrator.';

-- Verification-only refreshes must not invalidate alert registrations.  A
-- deployment/index/customer/status mapping change still invokes the existing
-- hold logic from migration 019.
CREATE OR REPLACE FUNCTION hold_changed_index_alert_delivery() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    affected_deployment TEXT;
    affected_index TEXT;
BEGIN
    IF TG_OP = 'UPDATE'
       AND ROW(NEW.splunk_deployment, NEW.index_name, NEW.customer_id, NEW.status)
           IS NOT DISTINCT FROM
           ROW(OLD.splunk_deployment, OLD.index_name, OLD.customer_id, OLD.status) THEN
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
            last_error = 'source index ownership changed; administrator review required',
            updated_at = NOW()
        WHERE registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes);
        UPDATE sec_event_email_outbox AS outbox
        SET status = 'held', next_attempt_at = NULL,
            last_error = 'source index ownership changed before send',
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
            last_error = CASE WHEN NEW.status <> 'active'
                THEN 'source index ownership is not active'
                ELSE 'source index ownership changed; administrator review required' END,
            updated_at = NOW()
        WHERE registration.splunk_deployment = affected_deployment
          AND affected_index = ANY(registration.source_indexes);
        UPDATE sec_event_email_outbox AS outbox
        SET status = 'held', next_attempt_at = NULL,
            last_error = 'source index ownership changed before send',
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
