CREATE TABLE IF NOT EXISTS soc_two_factor_challenges (
    challenge_id_hash TEXT PRIMARY KEY,
    zimbra_email TEXT NOT NULL,
    temporary_token_encrypted TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS soc_two_factor_challenges_expiry_idx
    ON soc_two_factor_challenges(expires_at);
