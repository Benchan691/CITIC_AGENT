# Data store catalog

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.
> Sources: `unified_mcp_server/postgres_store.py` (`_ensure_schema`), `apps/soc-agent/ownership.js` (`SocStateStore.ensureSchema`), `unified_mcp_server/account_store.py`, `unified_mcp_server/search/evidence_store.py` (retained), `host.js`/`ownership.js` (workspace paths), `.gitignore`.

**Who this is for:** operators (backup/retention), developers (where state lives), and security reviewers (what is sensitive and how it is protected).

**What you will understand:** every store and transient state location, its owner process, schema, keying, encryption, and lifecycle — described structurally, without any runtime contents.

**Plain-language summary.** Nearly all durable state is PostgreSQL: users, app sessions (with the Zimbra token encrypted at rest), session revocations, and first-class ownership claims for workspaces/sessions/folders, plus Fernet-encrypted key/value configuration. Per-user working files live under `.data/soc-workspaces/<userId>/`. Everything else is either transient (drafts live only in the tool result) or retained/legacy.

---

## 1. PostgreSQL (`APP_POSTGRES_URI` → fallback chain)

Pool: Node `pg.Pool` max 10 (`SocStateStore`); Python `psycopg_pool.ConnectionPool` min 1 / max 4, `connect_timeout=5`, `statement_timeout=15000` (`postgres_store.create_connection_pool`); per-call connect when pooling disabled via `APP_POSTGRES_POOL`.

| Table | Owner module | Purpose | Sensitive fields |
|---|---|---|---|
| `soc_users` | both (identical DDL) | Local identity per Zimbra email | `zimbra_email` (identifier; low sensitivity) |
| `soc_app_sessions` | both | App sessions: id (PK), user FK, **`zimbra_token_encrypted`**, `created_at`, `expires_at` (24 h TTL) | Zimbra session token, Fernet-encrypted by Python; Node SELECTs deliberately omit the column (`SocStateStore.session`) |
| `soc_session_revocations` | both | One-shot revocation records (`reason`, e.g. `new_device_login`; expiry-bounded; row deleted when consumed) | — |
| `soc_workspace_owners` | both | Workspace → owner claim (`workspace_id` PK, `owner_user_id`, `workspace_path`) | paths (user-scoped) |
| `soc_session_owners` | both | Session → owner claim; session must sit in an owned workspace (insert verified) | — |
| `soc_folder_owners` | both | Folder → owner claim (first-claim-wins) | — |
| `soc_bootstrap` | both | One-time markers, e.g. `clearLegacyWorkspaceState` gate | — |
| `app_config` | `postgres_store.py` | Encrypted key/value configuration (settings namespaces; keys listed in [CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md) §7) | `value_encrypted` (Fernet) |
| `zimbra_accounts` | `postgres_store.py` | **Legacy** stored mailbox credentials (`password_encrypted`) | password (encrypted); not read by the normal runtime (`server.py EmptyAccountStore`) |

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
| `$DSH_HOME` or `~/.dsh/` | Profile wiring: `profiles/web/pnpm-workspace.yaml`, `profiles/web/package.json` (plugin manifest), `profiles/web/patches/dsh-auto-collapse@0.1.4.patch` | Managed by `setup.sh ensure_profile_patch` / `pnpm dsh plugin` |
| `$DSH_HOME` or `~/.dsh` `soc-evidence.sqlite3` | SQLite evidence store (`SOC_EVIDENCE_STORE`) | **Retained**: written only by the unregistered `splunk/search/evidence_store.py`; present as an empty/new file at most in current deployments |
| `apps/soc-agent/server/.env`, `spl_config.local.json` | Local secrets/config | gitignored (`server/.gitignore`); never read by docs |
| `vendor/deepseek-harness/.env` | Harness-tier secrets (only `APP_POSTGRES_URI`, `APP_SETTINGS_ENCRYPTION_KEY` written by setup) | chmod 600 |

## 4. Tracked generated output

| Path | Generated from | Consumer |
|---|---|---|
| `packages/soc-agent-client/lib/index.js` | `src/index.ts` (tsdown) | Node half of the plugin (`main`) |
| `packages/soc-agent-client/lib/client.js` + `.map` | `src/client/**` (tsdown, closure-factory artifact `window.__ModuleLoader__.load({id:"dsh-soc-agent-client", …})`) | Browser module loader |

Drift detection: `setup.sh` checks that every literal `require()` in `lib/client.js` is in an allowlist and rebuilds on violation; `--rebuild` forces regeneration.

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
