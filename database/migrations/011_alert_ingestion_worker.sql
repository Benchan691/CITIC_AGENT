-- Runtime state for the automatic, read-only Splunk fired-alert worker.

ALTER TABLE sec_event_quarantine
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_event_id UUID REFERENCES sec_events (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sec_event_quarantine_unresolved_idx
    ON sec_event_quarantine (created_at)
    WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION set_sec_event_quarantine_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_event_quarantine_updated_at ON sec_event_quarantine;

CREATE TRIGGER sec_event_quarantine_updated_at
BEFORE UPDATE ON sec_event_quarantine
FOR EACH ROW
EXECUTE FUNCTION set_sec_event_quarantine_updated_at();

CREATE TABLE IF NOT EXISTS sec_alert_ingestion_status (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    worker_id TEXT,
    last_started_at TIMESTAMPTZ,
    last_completed_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error TEXT,
    heartbeat_at TIMESTAMPTZ,
    last_found INTEGER NOT NULL DEFAULT 0,
    last_inserted INTEGER NOT NULL DEFAULT 0,
    last_skipped INTEGER NOT NULL DEFAULT 0,
    last_quarantined INTEGER NOT NULL DEFAULT 0,
    last_failed INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sec_alert_ingestion_status (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION set_sec_alert_ingestion_status_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_alert_ingestion_status_updated_at ON sec_alert_ingestion_status;

CREATE TRIGGER sec_alert_ingestion_status_updated_at
BEFORE UPDATE ON sec_alert_ingestion_status
FOR EACH ROW
EXECUTE FUNCTION set_sec_alert_ingestion_status_updated_at();
