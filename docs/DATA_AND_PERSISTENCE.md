# Data and persistence

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](zh/DATA_AND_PERSISTENCE.md)

**Who this is for:** operators planning backup/retention, developers touching state, and reviewers tracking sensitive data.

**What you will understand:** every store and transient state location, who owns it, how it is keyed and encrypted, read/write paths, concurrency behavior, failure behavior, and what backup means here. Runtime directories are described structurally only — this documentation deliberately does not inspect their contents.

**Plain-language summary.** PostgreSQL is the only durable store that matters: identities, sessions (with encrypted Zimbra tokens), revocations, ownership claims, and encrypted settings — schema now owned by **versioned SQL migrations** applied under an advisory lock. Working files live in per-user directories under `.data/soc-workspaces/`. Email drafts exist only inside the conversation. The local account file is legacy; the old SQLite evidence store was removed with the Splunk stack (stale files may remain on disk).

**Prerequisites:** [ARCHITECTURE.md](ARCHITECTURE.md); details in [reference/DATA_STORE_CATALOG.md](reference/DATA_STORE_CATALOG.md).

---

## 1. Store catalog (verified)

| Store | Owner process | Schema/source | Contents | Keying | Encryption |
|---|---|---|---|---|---|
| **PostgreSQL** | Node (`SocStateStore`, pool max 10) + Python (`PostgresStore`, pool 1–4, `statement_timeout=15000`) | `migrations/*.sql` applied by `schema.py` (advisory lock; `soc_schema_migrations` ledger) | 10 tables — see below | `id` UUIDs / email uniqueness | `app_config.value_encrypted`, `zimbra_token_encrypted`, `password_encrypted` — Fernet (`APP_SETTINGS_ENCRYPTION_KEY`) |
| **Per-user workspace dirs** | Node host (ownership proxy) | `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/[general]` | User conversation/working artifacts | Directory = user id | None (fs permissions; user-scoped by proxy) |
| **Harness state** | Node host | `.data/`, `.state/` (gitignored) | Sessions, presets, telemetry-adjacent state | Harness-internal | Harness-internal |
| **Setup fingerprints** | `setup.sh` | `.data/harness-{install,build}.sha256` | Content hashes gating install/build | — | — |
| **Tracked SOC browser bundles** | build | `packages/soc-agent-*/lib/` | Browser bundles for the core, isolated surfaces, and optional features | — | — |
| **Local account file (legacy)** | Python admin/compat | `.data/zimbra_accounts.enc` + `.key` (Fernet; `0o600`; atomic replace) | Stored mailbox credentials | account id | Fernet |

**Postgres tables:** `soc_users`, `soc_app_sessions`, `soc_session_revocations`, `soc_workspace_owners`, `soc_session_owners`, `soc_folder_owners`, `soc_bootstrap` (created by *both* tiers, identical DDL), plus Python-managed `app_config` (encrypted settings) and `zimbra_accounts` (legacy).

![Data and trust boundaries diagram](site/assets/diagrams/data-trust-boundaries.svg)

Sensitive stores (red) are exactly the ones listed below; retrieved email and Splunk content are never persisted by this system. Editable source: [diagrams/data-trust-boundaries.mmd](diagrams/data-trust-boundaries.mmd).

## 2. Data ownership and keying

- **Users** are keyed by normalized Zimbra email (`casefold` + shape check; Zimbra remains the validity authority). One row per email; `last_login_at` maintained on login.
- **App sessions** are random opaque ids (validated `^[A-Za-z0-9_-]+$`), TTL 24 h, bound to a user row (FK cascade).
- **Ownership claims** bind harness object ids (workspace/session/folder) to user ids. A session's ownership is only valid while its parent workspace is also owned — the join in `userSessionIds`.
- **Settings** are namespaced keys (`soc-action-approval`, `soc-background`, `soc-agent-markitdown-attachments`, `time-context`, `llm-pi-ai`) with optimistic concurrency (`expectedRevision`).
- **Evidence scope** (retained code): sha256 over `[principal_id, investigation_id, customer_id]` — evidence is isolated per principal+investigation+customer tuple.

## 3. Read/write paths

| Write | Path |
|---|---|
| Login | `auth_cli login` → `create_user_session` (upsert user; encrypt token; revoke other sessions; insert session) |
| Ownership claim | `claimWorkspace` / `claimSession` / `claimFolder` (owner-guarded upserts, `ON CONFLICT DO NOTHING` + verify) |
| Settings change | Admin console → `settings.mutate` (revision-checked) → encrypted `app_config` row |
| Session end | `delete_app_session` (logout, `zimbra_auth_error` cleanup) |
| Provider key | `credentials.set` → encrypted storage; `credentials.unset` to remove |
| Conversation artifacts | Harness session persistence → `.data`/`.state` + per-user workspace (server-selected paths only) |

Reads go through the same modules; **the Node tier never selects `zimbra_token_encrypted`** — session projections (`SocStateStore.session`, `auth.py public_session`) expose only id/user/email/expires.

## 4. Retention and cleanup

| Data | Retention |
|---|---|
| App sessions | 24 h TTL; expired rows deleted lazily on read; no background sweeper exists |
| Session revocations | Expiry-bounded; row deleted when consumed (one-shot) |
| Ownership claims | Deleted with the workspace (`deleteWorkspace` cascades session owners); folders unclaimed on delete |
| `app_config` | Until changed/deleted (no TTL) |
| Legacy `zimbra_accounts` | Untouched by the active path; one-time legacy-catalog drop is marker-gated (`catalog-feature-removed-v1`) |
| Conversations/workspaces | No automatic retention found in first-party code — **unknown**; deployment decides |
| SQLite evidence | Retained code only; no active writer |

## 5. Concurrency and locking

- `claimSession`/`claimWorkspace`: DB-level upsert guards with post-insert verification (race → the loser sees the claim belong to someone else and fails).
- Settings: revision-checked mutations (optimistic locking) — stale saves are rejected.
- Filter writes: SHA-256 fingerprint of the live Zimbra rule set (`expected_fingerprint`) — concurrent external change → `filter_rules_changed`, refresh and retry.
- Blocking work: global semaphore 8 / per-principal 2, shielded tasks (a cancelled waiter never frees a worker slot).
- Subscriptions: single in-process httpx client; login serialized by the one-login-per-batch design (tested).

## 6. Failure behavior and backup implications

- **Postgres unreachable at boot:** Node store degrades to no-ops (deny-by-default for ownership-dependent calls); Python server raises `authentication_required` per call — login is impossible, which is the intended fail-closed posture. Migrations apply on startup (`apply_migrations`) and can also be triggered by the admin `migrate` RPC (`schema migrate`, URI over stdin).
- **Encryption key mismatch:** decrypt failure raises a RuntimeError naming row count, database, and remediation — data is *not* silently lost or silently readable.
- **Backup:** back up PostgreSQL **and** `APP_SETTINGS_ENCRYPTION_KEY` together; without the key, `app_config`, tokens, and legacy account passwords are unrecoverable. `.env` files are deployment secrets (back up outside Git). Workspaces are ordinary directories (rsync-able) but contain user data — treat as sensitive.
- **Restore:** schema is `IF NOT EXISTS` at startup; restoring rows into an existing schema is sufficient; the `soc_bootstrap` markers make legacy migrations one-shot and idempotent.

## 7. Sensitive-field summary

| Field | Location | Handling |
|---|---|---|
| Zimbra token | `soc_app_sessions.zimbra_token_encrypted` | Fernet; excluded from Node reads and public serializers |
| Settings secrets | `app_config.value_encrypted` | Fernet |
| Provider keys | credentials store | Write-only API surface |
| Admin password | env only | Stripped from children; timing-safe compare; never stored |
| Mail/Splunk content | Not persisted | Transient; projected/sanitized before the model |

Related: [reference/DATA_STORE_CATALOG.md](reference/DATA_STORE_CATALOG.md) (full catalog), [CONFIGURATION.md](CONFIGURATION.md) (secrets), [SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md).

## Evidence in the repository

- `apps/soc-agent/server/unified_mcp_server/postgres_store.py` (`_ensure_schema`, `create_user_session`, `get_app_session`, encryption helpers), `account_store.py`
- `apps/soc-agent/ownership.js` (`SocStateStore.ensureSchema`, `session`, claim helpers, `userWorkspaceRoot`)
- `unified_mcp_server/request_context.py` (`evidence_scope` — retained evidence keying)
- Tests: `test_postgres_store.py`, `test_account_store.py`, `test_auth.py`

## Assumptions and unknowns

- Conversation/workspace retention policy is not defined in first-party code — deployment decision (unknown).
- Real-SQL concurrency behavior is validated by design review and doubles, not against a live server.
