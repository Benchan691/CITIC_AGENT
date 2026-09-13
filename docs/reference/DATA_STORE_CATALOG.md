# Data store catalog

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](../zh/reference/DATA_STORE_CATALOG.md)
> Sources: `unified_mcp_server/migrations/*.sql`, `unified_mcp_server/schema.py` (migration runner), `unified_mcp_server/postgres_store.py`, `apps/soc-agent/ownership.js` (`SocStateStore.ensureSchema` → Python migrations), `unified_mcp_server/account_store.py`, `host.js`/`ownership.js` (workspace paths), `.gitignore`. The retained SQLite evidence store was removed with the Splunk stack this round.

**Who this is for:** operators (backup/retention), developers (where state lives), and security reviewers (what is sensitive and how it is protected).

**What you will understand:** every store and transient state location, its owner process, schema, keying, encryption, and lifecycle — described structurally, without any runtime contents.

**Plain-language summary.** Nearly all durable state is PostgreSQL: users, app sessions (with the Zimbra token encrypted at rest), session revocations, first-class ownership claims for workspaces/sessions/folders, and Fernet-encrypted key/value configuration. Schema is owned by **versioned SQL migrations** applied under an advisory lock (Node contains no DDL). Per-user working files live under `.data/soc-workspaces/<userId>/`. Everything else is either transient (drafts live only in the tool result) or legacy.

---

## 1. PostgreSQL (`APP_POSTGRES_URI` → fallback chain)

Pool: Node `pg.Pool` max 10 (`SocStateStore`); Python `psycopg_pool.ConnectionPool` min 1 / max 4, `connect_timeout=5`, `statement_timeout=15000` (`postgres_store.create_connection_pool`); per-call connect when pooling disabled via `APP_POSTGRES_POOL`.

**Schema ownership (new this round):** versioned SQL migrations in `unified_mcp_server/migrations/*.sql`, applied by `schema.py apply_migrations` — a `pg_advisory_xact_lock(hashtext('soc-agent-schema'))` serializes startup, `soc_schema_migrations` records applied file names, and pending files execute inside the caller's transaction. `001_initial.sql` creates the tables below (`IF NOT EXISTS`); `002_remove_catalog.sql` drops the eight legacy catalog tables behind the `catalog-feature-removed-v1` marker. The Node `SocStateStore.ensureSchema` now just invokes `uv run python -m unified_mcp_server.schema migrate` with the URI on stdin; the admin `migrate` RPC does the same via `admin_cli`.

| Table | Owner module | Purpose | Sensitive fields |
|---|---|---|---|
| `soc_users` | migrations/Python | Local identity per Zimbra email | `zimbra_email` (identifier; low sensitivity) |
| `soc_app_sessions` | migrations/Python | App sessions: id (PK), user FK, **`zimbra_token_encrypted`**, `created_at`, `expires_at` (24 h TTL) + user/expiry indexes | Zimbra session token, Fernet-encrypted by Python; Node SELECTs deliberately omit the column (`SocStateStore.session`) |
| `soc_session_revocations` | migrations/Python | One-shot revocation records (`reason`, e.g. `new_device_login`; expiry-bounded; row deleted when consumed) | — |
| `soc_workspace_owners` | migrations/Python | Workspace → owner claim (`workspace_id` PK, `owner_user_id`, `workspace_path`) | paths (user-scoped) |
| `soc_session_owners` | migrations/Python | Session → owner claim; session must sit in an owned workspace (insert verified) + indexes | — |
| `soc_folder_owners` | migrations/Python | Folder → owner claim (first-claim-wins) | — |
| `soc_bootstrap` | migrations/Python | One-time markers (e.g. `catalog-feature-removed-v1` gates the legacy-table drop in `002_remove_catalog.sql`) | — |
| `soc_schema_migrations` | `schema.py` | Applied migration file names (version PK, `applied_at`) | — |
| `app_config` | migrations/Python | Encrypted key/value configuration (settings namespaces; keys listed in [CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md) §7) | `value_encrypted` (Fernet) |
| `zimbra_accounts` | migrations/Python | **Legacy** stored mailbox credentials (`password_encrypted`) | password (encrypted); not read by the normal runtime (`_EmptyAccountStore`) |

Tables **dropped** by `002_remove_catalog.sql`: `soc_catalog_staging`, `soc_catalog_import_batches`, `soc_catalog_publications`, `soc_catalog_history`, `soc_fix_source_type`, `soc_rule_catalog`, `soc_customer`, `soc_catalog_migrations`.

Lifecycle/concurrency: expired sessions deleted lazily on read; `claimSession`/`claimWorkspace` are owner-guarded upserts (`ON CONFLICT DO NOTHING` + verify); `deleteWorkspace` cascades session-owner rows; session ids validated against `^[A-Za-z0-9_-]+$` (≤128 chars) before any query. No background sweeper; no explicit retention beyond session TTL and revocation expiry.

Bootstrap/repair: schema is `IF NOT EXISTS` at startup (`ensureSchema`); one-time legacy catalog-table drop gated by marker `catalog-feature-removed-v1`. Backup implications: the database holds all durable identity/ownership/config state; `APP_SETTINGS_ENCRYPTION_KEY` must be backed up with it or encrypted rows are unrecoverable.

## 2. Per-user workspace directories

- **Root:** `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/` (general workspace `…/general`) — `ownership.js userWorkspaceRoot`. Owned by the authenticated user; creation validates a single directory name (no absolute/`..`/`\`/NUL), `mkdir` + `realpath` canonicalization, and `isWithinPath` containment (traversal/symlink escape → `workspace-invalid-path`).
- **Setup fingerprints:** `<root>/.data/harness-install.sha256`, `harness-build.sha256` (created by `setup.sh`).
- **Harness sessions/state:** `.data/`, `.state/` (gitignored) — owned by the harness session persistence; the ownership proxy restricts visibility per user.
- Contents are user-generated investigation artifacts; never read or published by documentation tooling.

## 3. Vendored/runtime locations outside the repo

| Location | Purpose | Notes |
|---|---|---|
| `$DSH_HOME` or `~/.dsh/` | Profile wiring: `profiles/web/pnpm-workspace.yaml`, `profiles/web/package.json` (direct local SOC package dependencies) | Managed by the setup matrix and the official `pnpm dsh plugin` add/remove mechanism; no third-party patch is copied |
| `$DSH_HOME` or `~/.dsh` `soc-evidence.sqlite3` | **No owner since this round** — the SQLite evidence store belonged to the deleted Splunk search implementation; stale files may remain on disk | Safe to archive/delete; nothing writes it |
| `apps/soc-agent/server/.env`, `spl_config.local.json` | Local secrets/config | gitignored (`server/.gitignore`); never read by docs |
| repository-root `.env` and `apps/soc-agent/server/.env` | Runtime secrets/configuration kept outside the tracked vendor snapshot | chmod 600; setup never writes a vendor `.env` |

## 4. Tracked generated output

| Path | Generated from | Consumer |
|---|---|---|
| `packages/soc-agent-*/lib/index.js` | each package's `src/index.ts` (tsdown) | Node half of each plugin (`main`) |
| `packages/soc-agent-*/lib/client.js` + `.map` | each package's browser `src/client/**` (tsdown closure-factory artifact) | Browser module loader; 26 independent browser faces, with the core contract shared through the `socClient` service |

Drift detection: `setup.sh` checks every literal `require()` in all 26 SOC browser faces against the allowlist and rebuilds on violation; `--rebuild` forces regeneration.

## 5. Transient state (deliberately not persisted)

| Thing | Where it lives | Lifetime |
|---|---|---|
| Email drafts created by `zimbra_send_email` / `zimbra_use_signature_on_email` | In the tool result JSON only (UI form state) | Until the conversation renders it; no store write |
| Session-scoped action mode | `ownership.js actionModes` Map (in memory) | Logout / revocation / host restart |
| Admin sessions | In-memory Map keyed by SHA-256 token | 8 h TTL or host restart |
| Attachment conversion cache | `AttachmentConverter` LRU (64 entries / 4 MB, in-memory) | Process lifetime |
| Per-request `Runtime` / mail service LRU (32) | `server.py` | Request scope |
| Subscription service login session | `httpx.AsyncClient` cookie jar in memory | Re-login on 401 |

## 6. Sensitive-data classification summary

| Class | Location | Protection |
|---|---|---|
| Zimbra session token | `soc_app_sessions.zimbra_token_encrypted` | Fernet (key from `APP_SETTINGS_ENCRYPTION_KEY`); never serialized publicly (`auth.py public_session`); Node queries omit the column |
| Settings secrets (provider keys) | `app_config` encrypted; provider keys via `credentials.set` (write-only; `credentials.describe` returns only configured/writable booleans) | Fernet + write-only UI |
| Admin secret | `SOC_ADMIN_PASSWORD` env only; in-memory hash | Stripped from child processes; timing-safe compare |
| Service secrets (Splunk token, subscription password, MarkItDown key) | Environment / `.env` files (chmod 600) | Never logged (`redact_endpoint`, redacted `public_status`); remote error bodies withheld |
| Customer data | Mailboxes, Splunk results | Never stored by this system; Splunk output sanitized + truncated at the projection boundary; AGENTS.md forbids cross-customer disclosure |
