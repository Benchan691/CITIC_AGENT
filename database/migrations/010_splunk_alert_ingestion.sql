-- Alert-only ingestion metadata.  Keep 005_create_sec_events.sql immutable;
-- this migration upgrades databases where that migration is already applied.

ALTER TABLE sec_events
    ADD COLUMN IF NOT EXISTS splunk_sid TEXT,
    ADD COLUMN IF NOT EXISTS alert_name TEXT,
    ADD COLUMN IF NOT EXISTS trigger_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS result_count INTEGER,
    ADD COLUMN IF NOT EXISTS event_data JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE rulesets
    ADD COLUMN IF NOT EXISTS rule_number TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rulesets_rule_number_format_check'
          AND conrelid = 'rulesets'::regclass
    ) THEN
        ALTER TABLE rulesets
            ADD CONSTRAINT rulesets_rule_number_format_check
            CHECK (rule_number IS NULL OR rule_number ~ '^[0-9]{4}$');
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS sec_events_splunk_alert_dedup_idx
    ON sec_events (splunk_sid, alert_name, trigger_time)
    WHERE splunk_sid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rulesets_customer_rule_number_uidx
    ON rulesets (customer_id, rule_number)
    WHERE customer_id IS NOT NULL AND rule_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS sec_events_splunk_sid_idx
    ON sec_events (splunk_sid)
    WHERE splunk_sid IS NOT NULL;

CREATE OR REPLACE FUNCTION set_sec_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_events_updated_at ON sec_events;

CREATE TRIGGER sec_events_updated_at
BEFORE UPDATE ON sec_events
FOR EACH ROW
EXECUTE FUNCTION set_sec_events_updated_at();

CREATE TABLE IF NOT EXISTS sec_event_quarantine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dedup_key TEXT NOT NULL UNIQUE,
    splunk_sid TEXT,
    alert_name TEXT,
    trigger_time TIMESTAMPTZ,
    result_count INTEGER,
    event_gid TEXT,
    event_rulenum TEXT,
    event_data JSONB NOT NULL DEFAULT '{}'::JSONB,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sec_event_quarantine_splunk_sid_idx
    ON sec_event_quarantine (splunk_sid)
    WHERE splunk_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS sec_event_quarantine_created_at_idx
    ON sec_event_quarantine (created_at);
