CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zimbra_accounts (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soc_users (
    id TEXT PRIMARY KEY,
    zimbra_email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS soc_app_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
    zimbra_token_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS soc_session_revocations (
    session_id TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS soc_workspace_owners (
    workspace_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
    workspace_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soc_session_owners (
    session_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soc_folder_owners (
    folder_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soc_bootstrap (
    key TEXT PRIMARY KEY,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soc_app_sessions_user_idx ON soc_app_sessions(user_id);

CREATE INDEX IF NOT EXISTS soc_app_sessions_expiry_idx ON soc_app_sessions(expires_at);

CREATE INDEX IF NOT EXISTS soc_session_owners_user_idx ON soc_session_owners(owner_user_id);

CREATE INDEX IF NOT EXISTS soc_session_owners_workspace_idx ON soc_session_owners(workspace_id);
