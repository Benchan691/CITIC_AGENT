CREATE TABLE IF NOT EXISTS soc_report_profiles (
    owner_user_id TEXT PRIMARY KEY REFERENCES soc_users(id) ON DELETE CASCADE,
    profiles_encrypted TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soc_report_artifacts (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES soc_session_owners(session_id) ON DELETE CASCADE,
    report_run_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    relative_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soc_report_artifacts_owner_session_idx
    ON soc_report_artifacts(owner_user_id, session_id);
