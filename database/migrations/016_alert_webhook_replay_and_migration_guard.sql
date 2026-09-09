-- Final additive guards for authenticated action delivery.
-- Do not edit migrations that may already have been applied.

CREATE TABLE IF NOT EXISTS sec_alert_webhook_replays (
    deployment TEXT NOT NULL,
    replay_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (deployment, replay_id),
    CONSTRAINT sec_alert_webhook_replay_deployment_check
        CHECK (length(btrim(deployment)) BETWEEN 1 AND 512),
    CONSTRAINT sec_alert_webhook_replay_id_check
        CHECK (length(btrim(replay_id)) BETWEEN 1 AND 256),
    CONSTRAINT sec_alert_webhook_replay_hash_check
        CHECK (payload_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS sec_alert_webhook_replays_seen_idx
    ON sec_alert_webhook_replays (last_seen_at);

-- Replayed action requests are accepted only as idempotent repeats.  The
-- table is bounded operationally by deleting rows older than the configured
-- replay window during maintenance; receipt/SID uniqueness remains the
-- authoritative lifetime deduplication record.
COMMENT ON TABLE sec_alert_webhook_replays IS
    'Authenticated alert-action replay keys; retain at least the webhook timestamp acceptance window.';

-- Historical migration rows must never become eligible just because a new
-- policy or recipient list is enabled.  The event trigger already only
-- queues INSERTs; this explicit marker makes that invariant queryable.
ALTER TABLE sec_events
    ADD COLUMN IF NOT EXISTS historical_email_suppressed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS sec_events_historical_email_idx
    ON sec_events (historical_email_suppressed, created_at)
    WHERE historical_email_suppressed;

