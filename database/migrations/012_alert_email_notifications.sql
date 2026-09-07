-- Automatic alert email delivery.
-- This migration queues only events inserted after the trigger is installed.

CREATE TABLE IF NOT EXISTS sec_alert_email_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES customers (id) ON DELETE CASCADE,
    ruleset_id UUID REFERENCES rulesets (id) ON DELETE CASCADE,
    severities TEXT[] NOT NULL DEFAULT ARRAY['high', 'critical']::TEXT[],
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sec_alert_email_rules_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
    CONSTRAINT sec_alert_email_rules_severity_check CHECK (
        cardinality(severities) > 0
        AND severities <@ ARRAY['info', 'low', 'medium', 'high', 'critical']::TEXT[]
    )
);

CREATE INDEX IF NOT EXISTS sec_alert_email_rules_match_idx
    ON sec_alert_email_rules (customer_id, ruleset_id, enabled);

CREATE TABLE IF NOT EXISTS sec_event_email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE REFERENCES sec_events (id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    claimed_by TEXT,
    sent_at TIMESTAMPTZ,
    uncertain_at TIMESTAMPTZ,
    provider_message_id TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sec_event_email_outbox_status_check CHECK (
        status IN ('pending', 'processing', 'sent', 'failed', 'uncertain', 'disabled')
    ),
    CONSTRAINT sec_event_email_outbox_attempt_check CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS sec_event_email_outbox_claim_idx
    ON sec_event_email_outbox (next_attempt_at, created_at, id)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS sec_event_email_outbox_status_idx
    ON sec_event_email_outbox (status, updated_at);

CREATE OR REPLACE FUNCTION set_sec_alert_email_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_alert_email_rules_updated_at ON sec_alert_email_rules;

CREATE TRIGGER sec_alert_email_rules_updated_at
BEFORE UPDATE ON sec_alert_email_rules
FOR EACH ROW
EXECUTE FUNCTION set_sec_alert_email_updated_at();

DROP TRIGGER IF EXISTS sec_event_email_outbox_updated_at ON sec_event_email_outbox;

CREATE TRIGGER sec_event_email_outbox_updated_at
BEFORE UPDATE ON sec_event_email_outbox
FOR EACH ROW
EXECUTE FUNCTION set_sec_alert_email_updated_at();

CREATE OR REPLACE FUNCTION enqueue_sec_event_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO sec_event_email_outbox (event_id, customer_id)
    VALUES (NEW.id, NEW.customer_id)
    ON CONFLICT (event_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_events_email_outbox_insert ON sec_events;

CREATE TRIGGER sec_events_email_outbox_insert
AFTER INSERT ON sec_events
FOR EACH ROW
EXECUTE FUNCTION enqueue_sec_event_email();

CREATE TABLE IF NOT EXISTS sec_alert_email_status (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    worker_id TEXT,
    heartbeat_at TIMESTAMPTZ,
    last_started_at TIMESTAMPTZ,
    last_completed_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ,
    last_failed_at TIMESTAMPTZ,
    last_uncertain_at TIMESTAMPTZ,
    last_error TEXT,
    last_sent INTEGER NOT NULL DEFAULT 0,
    last_failed INTEGER NOT NULL DEFAULT 0,
    last_uncertain INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sec_alert_email_status (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS sec_alert_email_status_updated_at ON sec_alert_email_status;

CREATE TRIGGER sec_alert_email_status_updated_at
BEFORE UPDATE ON sec_alert_email_status
FOR EACH ROW
EXECUTE FUNCTION set_sec_alert_email_updated_at();
