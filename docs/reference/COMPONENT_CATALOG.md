# Component catalog

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](../zh/reference/COMPONENT_CATALOG.md)

**Who this is for:** developers, reviewers, and security assessors who need each component's responsibility, boundaries, and test coverage at a glance.

**What you will understand:** every first-party component described with the same eleven fields — purpose, ownership, entry points, inputs/outputs, state, trust level, dependencies, tests, and runtime status — so components can be compared and change impact can be assessed.

**Plain-language summary.** The system is a set of cooperating components: a browser UI, a Node host running five product plugins over the vendored harness, a Python MCP server child process with Zimbra/subscription tools, a client bridge to an external Splunk MCP server, an authenticated control channel for mail operations, an admin CLI for service operations, and PostgreSQL persistence. Related pages: [REPOSITORY_MAP.md](REPOSITORY_MAP.md) (file classification), [ARCHITECTURE.md](../ARCHITECTURE.md) (how they connect), [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) (claim-level evidence).

**Prerequisites:** none.

---

Runtime-status legend: **Active** (always on) · **Conditional** (on when configured) · **Admin-only** · **Removed** (deleted this round; previously "retained") · **Generated** · **Operational tooling**.

---

## 1. Browser client (analyst UI)

- **Paths:** `packages/soc-agent-client/src/client/` (built into tracked `lib/client.js`)
- **Purpose:** present the chat workspace, login gate, action-mode menu, email draft editing, attachment UX, and branding inside the harness web surface.
- **Owner/responsibility:** rendering and client-side validation only; it owns no security decision.
- **Entry points:** mounted by the harness module loader when its `dsh.client` declaration is scanned (`src/client/index.ts` `apply`); `/admin` path mounts the AdminConsole branch.
- **Inputs/outputs:** harness slots (`shell.overlay`, `conversation.input.*`, `tool.call.toolview`, `settings.plugin.item`); RPC channel `/soc-agent-config`; HTTP `/auth/me|login|logout`; connection APIs (`settings.describe/mutate`, `credentials.*`, `llm.*`).
- **State:** per-session attachment drafts (in memory); reads settings scopes (`soc-agent-markitdown-attachments`, `soc-action-approval`, `soc-background`, `time-context`).
- **Trust level:** untrusted client. All enforcement is server-side; the UI is convenience.
- **Dependencies:** harness client runtime (`@deepseek-ai/dsh-client-connection`, slots, settings); React via the harness bundle.
- **Tests:** `tests/action-policy.test.ts`, `email-draft-toolview.test.ts`, `markitdownAttachments.test.ts`, `sections.test.ts` (source guardrails).
- **Runtime status:** Active (built bundle tracked as generated output).

## 2. Admin console (browser, `/admin`)

- **Paths:** `packages/soc-agent-client/src/client/AdminConsole.tsx`
- **Purpose:** standalone administration surface: service status, agent-context settings, access-and-approvals checklist, AI providers with write-only credentials.
- **Entry points:** `window.location.pathname` `/admin` branch in `src/client/index.ts` (tested by `sections.test.ts`); served by `host.js` route `GET /admin`.
- **Inputs/outputs:** `/admin/auth/me|login|logout`; RPC `get-settings`, `test-splunk`, `test-subscription-server`, `get-admin-action-catalog`; settings/credentials/LLM APIs.
- **State:** settings namespaces via `settings.mutate` with `expectedRevision` optimistic concurrency.
- **Trust level:** admin-authenticated server-side (`requireAdmin` per endpoint); secrets write-only ("Stored securely · enter a new key to replace it").
- **Tests:** `sections.test.ts` (mount gating, write-only credentials, no legacy cards).
- **Runtime status:** Active, admin-only.

## 3. SOC host plugin (`soc-agent-admin-host` → `dsh-soc-agent/host`)

- **Paths:** `apps/soc-agent/host.js`, `apps/soc-agent/policy.js`, `apps/soc-agent/tool-inventory.js`, `apps/soc-agent/investigation.js`
- **Purpose:** the policy and product-RPC brain: exact tool allowlisting, action modes and per-tool states, `/soc-agent-config` endpoints, BACKGROUND.md refresh, Splunk output projection, admin page and admin subprocesses.
- **Owner/responsibility:** decides allow/deny/ask for every tool call; owns the action catalog vocabulary (single-sourced in `tool-inventory.js`, imported by policy and bridge alike).
- **Entry points:** cordis `apply(ctx)`; hooks `tools/pre-execute` (global), `tools/post-execute` (global, from `investigation.js`), `agent/created`, `agent/pre-step` (background); RPC channel `/soc-agent-config`.
- **Inputs/outputs:** in: tool-call decisions, RPC requests, settings; out: deny/ask/delegate verdicts, admin subprocess spawns (`uv run python -m unified_mcp_server.admin_cli`).
- **State:** settings key `soc-action-approval` (`{mode, actionStates}`); `soc-background` (`{enabled, repeatEveryUserPrompts}`); reads `BACKGROUND.md` (≤1 MiB source, 64 KiB render).
- **Trust level:** trusted host boundary — the primary allowlist enforcement point.
- **Dependencies:** `socAuth` service (from auth-host), harness `settings`, `tools` registry.
- **Tests:** `policy.test.js` (4 tests incl. exact counts **30/42/12**), `background.test.js`, `investigation.test.js`, `user-mode.test.js`.
- **Runtime status:** Active.

## 4. Auth host plugin (`soc-agent-auth-host` → `dsh-soc-agent/auth-host`) + ownership boundary

- **Paths:** `apps/soc-agent/auth-host.js`, `apps/soc-agent/ownership.js`
- **Purpose:** authenticate users (Zimbra credentials) and the admin (static env credentials); enforce per-user workspace/session ownership on every API; inject per-call MCP metadata; fence private routes.
- **Owner/responsibility:** identity authority at the Node tier; ownership claims in Postgres; session revocation (including single-device replacement).
- **Entry points:** `apply(ctx)`; HTTP routes `/auth/login|logout|me`, `/admin/auth/login|logout|me`; `installTransport` (fences `/api` and `/soc-agent-*` routes and `/api/events.mux|host` upgrades); `mcp/request-meta` hook (global); `connectionAuthorization.authorizePrivilegedRequest`.
- **Inputs/outputs:** in: HTTP requests, connection requests; out: `soc_session`/`soc_admin_session` cookies, scoped API proxy (9 domains), MCP metadata `{soc_session_id, soc_investigation_id, soc_customer_id:"", soc_correlation_id, soc_deadline_ms}`, control-channel commands.
- **State:** Postgres via `SocStateStore` (`soc_users`, `soc_app_sessions` with encrypted Zimbra token, `soc_session_revocations`, `soc_workspace_owners`, `soc_session_owners`, `soc_folder_owners`, `soc_bootstrap`); in-memory admin sessions (SHA-256-hashed tokens, 8 h) and per-session action-mode map; workspaces under `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/`.
- **Trust level:** the identity and isolation boundary. Admin credentials never forwarded to child processes.
- **Dependencies:** `pg` pool (max 10), `auth_cli`/`control_server` via `runAuthCommand`, harness transport/webserver.
- **Tests:** `auth.test.js` (10 tests), `user-mode.test.js`, `control-channel.test.js`.
- **Runtime status:** Active. Degradation: without `APP_POSTGRES_URI` the store no-ops and app login effectively fails closed (`authentication_required` from the Python tier).

## 5. Python MCP server (`soc_agent`)

- **Paths:** `apps/soc-agent/server/unified_mcp_server/` (entry `server.py`; package `soc-agent-mcp`; script `unified-mcp-server`)
- **Purpose:** expose exactly 28 domain tools (13 mail incl. the new `zimbra_forward_email` forward-draft tool, 9 filters, 6 subscriptions) over MCP stdio, executing with a per-request authenticated identity and one 180-second operation budget.
- **Owner/responsibility:** domain logic for Zimbra and subscriptions; identity resolution (`identity_for_session`); envelope/error taxonomy; no Splunk tools.
- **Entry points:** spawned by `dsh-mcp-client` per `cordis.patch.yml` (`command: uv, args: ['run','unified-mcp-server']`, `serverName: soc_agent`, raw allowlist of 27, `toolCallTimeoutMs: 185000`, `failOnStartupError: true`).
- **Inputs/outputs:** in: MCP tool calls with metadata `soc_session_id`/`soc_deadline_ms`/… ; out: `success`/`failure` envelopes; SOAP to Zimbra; HTTPS to subscription service; Postgres reads.
- **State:** Postgres app sessions (token decryption), LRU 32 identity-bound mail services; **no persisted drafts** (`zimbra_send_email` returns a draft dict, nothing stored).
- **Trust level:** executes with the authenticated user's Zimbra token; rejects `account_id` selection (`account_selection_disabled`).
- **Dependencies:** `mcp` (FastMCP), `zimbra-client`, `httpx`, `psycopg[pool]`, `cryptography`, `markitdown`.
- **Tests:** 10 Python test files / 39 tests, incl. `test_server_tools.py` (exact 28-tool surface) and `test_schema.py` (migrations).
- **Runtime status:** Active (Conditional in the sense that the host fails startup if it cannot spawn when configured — `failOnStartupError`).

## 6. Zimbra domain services

- **Paths:** `unified_mcp_server/zimbra_service.py`, `unified_mcp_server/zimbra/{zimbra.py, core/, mail/, filters/}`
- **Purpose:** SOAP access to the authenticated user's mailbox: folders, search, read, headers, attachment text, signatures, folders, moves, drafts, filters.
- **Entry points:** tool registration (`register_mail_tools`, `register_filter_tools`) and `auth_cli` (`send-email`, `list-signatures`).
- **Inputs/outputs:** SOAP `{ZIMBRA_HOST}/service/soap` via `zimbra-client` with the session token; per-call token auth, no stored credentials.
- **State:** none locally beyond the request; filter writes use full-ruleset replacement with SHA-256 fingerprint optimistic concurrency.
- **Trust level:** identity-bound; account selection rejected; env gates `ZIMBRA_ALLOW_SEND|MOVE|FOLDER_WRITE|SIGNATURE_WRITE|FILTER_WRITE|FILTER_REDIRECT|FILTER_DISCARD`.
- **Tests:** `test_zimbra_service.py` (9), `test_zimbra_filters.py` (4).
- **Runtime status:** Active.

## 7. Subscription service client

- **Paths:** `unified_mcp_server/email/{service.py, tools.py}`
- **Purpose:** manage email subscriptions on an external web service: list, schema, preview, create, update, delete.
- **Entry points:** `register_email_tools` in `server.py`; admin `test-subscription-server`.
- **Inputs/outputs:** `httpx.AsyncClient` to `SUBSCRIPTION_SERVER_URL` (`/login`, `/api/subscriptions[...]`); manual redirect validation (max 5, same host, no downgrades); one re-login on 401.
- **Trust level:** service credentials from env; remote error bodies never surfaced (`email_server_request_failed` + status only).
- **Tests:** `test_email_service.py` (3).
- **Runtime status:** Active (Conditional: `not_configured` without `SUBSCRIPTION_SERVER_URL`+user+password).

## 8. Splunk bridge (`splunk-official-mcp` → `dsh-soc-agent/splunk-bridge`)

- **Paths:** `apps/soc-agent/splunk-bridge.js`
- **Purpose:** connect to the external official Splunk MCP server and register its tools under the `splunk_mcp` namespace, restricted to 13 read tools imported from `tool-inventory.js` (shared with policy.js).
- **Owner/responsibility:** connection + raw allowlist; read-only is by allowlist composition and host policy, not a protocol filter.
- **Entry points:** `apply(ctx)` → `McpClient.apply(ctx, config)`; endpoint URL is validated (HTTP(S), no credentials/query/fragment; plain HTTP requires `SPLUNK_ALLOW_INSECURE_HTTP=true`); disabled (logged, no registration) unless `SPLUNK_MCP_ENDPOINT` **and** `SPLUNK_TOKEN` resolve (env first, then `server/.env`). **Setup and `--check` require this connection.** Plus `testOfficialSplunkConnection` — the admin connection check now executes a real `splunk_get_info` through the live bridge.
- **Inputs/outputs:** streamable HTTP + `Authorization: Bearer`; `verifyTls` from `SPLUNK_VERIFY_SSL` (default true); `toolCallTimeoutMs: 185000`; `failOnStartupError: true`.
- **Trust level:** external service boundary; results cross the investigation projection (sanitize + truncate) before reaching the model.
- **Tests:** `splunk-bridge.test.js` (4), `skills.test.js` (patch↔bridge consistency).
- **Runtime status:** Conditional (off when unconfigured).

## 9. Investigation projection

- **Paths:** `apps/soc-agent/investigation.js`
- **Purpose:** last output boundary for official Splunk results: join text blocks, mask card/SSN patterns, truncate to 50 KB with an explicit marker.
- **Entry points:** `ctx.on('tools/post-execute', …, {global: true})`; applies only to names with prefix `mcp__splunk_mcp__splunk_`.
- **State:** none. Opt-out: `SPLUNK_SANITIZE_OUTPUT=0|false|no|off`.
- **Tests:** `investigation.test.js`.
- **Runtime status:** Active.

## 10. Control channel + authenticated operations

- **Paths:** `apps/soc-agent/ownership.js` (`runAuthCommand`, `startControlChannel`), `unified_mcp_server/control_server.py`, `unified_mcp_server/auth_cli.py`
- **Purpose:** authenticated, session-scoped mail operations that are **not** model-callable tools: `login`, `logout`, `send-email`, `list-signatures`.
- **Entry points:** persistent child `uv run python -m unified_mcp_server.control_server` (JSON lines over stdio; `{"ready":true}` handshake ≤60 s; 8 MB line cap; 8 concurrent; per-op timeout 185 s default); `SOC_CONTROL_CHANNEL=off` → one-shot `auth_cli` spawn per command; fallback to spawn only **before transmission**; ambiguous outcomes raise `operation_outcome_unknown` and are never replayed.
- **Trust level:** private parent-child pipe (no per-connection secret); authorization = the `session_id` in each payload validated against Postgres.
- **Tests:** `control-channel.test.js` (2), `test_control_server.py` (1, real subprocess).
- **Runtime status:** Active.

## 11. Admin operations path

- **Paths:** `apps/soc-agent/host.js` (`runAdmin`), `unified_mcp_server/admin_cli.py`
- **Purpose:** admin-only service operations as one-shot subprocesses (shared `python-command.js` runner): `get-settings`, `test-subscription-server`, `convert-attachment`, `migrate` (now applies the SQL migrations). `test-splunk` moved out of the CLI — the host probes the live bridge directly. Refuses settings writes, account management, and mail operations by design.
- **Trust level:** RPC endpoints require `requireAdmin`; `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD` are stripped from the child environment; failures parsed from stderr JSON, message ≤400 chars, up to 20 `missing_environment_variables` listed; timeout 185 s → SIGTERM.
- **Tests:** covered indirectly via `policy.test.js` RPC contract and `test_config.py` redaction.
- **Runtime status:** Active, admin-only. The legacy REST `SplunkService` reachability is gone — `test-splunk` now means the live official-MCP probe.

## 12. Persistence layer

- **Paths:** `unified_mcp_server/postgres_store.py`, `unified_mcp_server/schema.py` + `migrations/*.sql`, `unified_mcp_server/account_store.py`, `apps/soc-agent/ownership.js` (`SocStateStore`)
- **Purpose:** encrypted configuration, authenticated sessions, ownership claims; legacy local account file. **Schema is now owned by versioned SQL migrations** applied under an advisory lock (`soc_schema_migrations` ledger); the Node tier contains no DDL — `ensureSchema` shells out to `schema migrate` with the URI on stdin.
- **Entry points:** `PostgresStore.from_env()`, `SocStateStore` pool (max 10; psycopg pool 1–4, `statement_timeout=15000`).
- **State:** tables `soc_users`, `soc_app_sessions`, `soc_session_revocations`, `soc_workspace_owners`, `soc_session_owners`, `soc_folder_owners`, `soc_bootstrap`, `app_config` (Fernet-encrypted), `zimbra_accounts` (legacy); local encrypted `AccountStore` JSON (legacy, neutered by `EmptyAccountStore` at runtime).
- **Trust level:** `APP_SETTINGS_ENCRYPTION_KEY` required when Postgres config is enabled; decrypt failures raise with remediation.
- **Tests:** `test_postgres_store.py`, `test_account_store.py`, `test_auth.py`.
- **Runtime status:** Active (Node store optional-degrades without URI; Python store None without URI).

## 13. Removed Splunk implementation

- **Paths:** none (deleted this round). Previously `unified_mcp_server/splunk/` (34 files), `splunk_service.py`, `detection.py` — the full in-process Splunk implementation (REST client, guardrails, query policy, resource governance, planner/evidence/verifier, CITIC detection compiler, security queue) plus the SQLite evidence store.
- **What replaced it:** the official-MCP bridge is now the *only* Splunk path; the admin connection check probes it live; `test_server_tools.py` still asserts no `splunk_*` tool on `soc_agent`.
- **Consequence for skills:** `detection-engineering` and `spl-writing` (and parts of `false-positive-analysis`) reference tools that no longer exist anywhere — recorded as drift in the audit. The CITIC compile/backtest capability is gone from the application entirely; the maintainer's `docs/SHORTENING_PLAN_IMPLEMENTATION.md` records the retirement decision.
- **Untracked leftovers** (`splunk/`, `catalog/` directories) may remain on disk from earlier checkouts and are safe to delete.

## 14. Vendored harness integration surface

- **Paths:** `vendor/deepseek-harness/` (`@deepseek-ai/dsh-root` `0.1.1-rc.2`), `apps/soc-agent/cordis.patch.yml`, `patches/dsh-auto-collapse@0.1.4.patch`
- **Purpose:** agent runtime: cordis plugin loader, tools registry with fail-closed approval, MCP client (stdio + streamable-http, reconnect backoff 500 ms doubling, `allowedToolNames` filter, `toolCallTimeoutMs`), web server/gateway, browser module loader, skills, presets, LLM providers.
- **Entry points:** `pnpm dsh web --no-open` (port 3080); profile wiring under `~/.dsh/profiles/web`.
- **Trust level:** trusted host; its patch roster is itself a security control (disables shell/fs/subagent tool families for the model).
- **Pinning:** vendored directory; outer repo consumed via workspace globs (`../../apps/*`, `../../packages/*`); `schemastery`/`cosmokit` forced to vendored forks via pnpm overrides. **Changed this round:** `packages/host/apiproxy` declares the structured `authentication-required`/`admin-authentication-required` RPC error codes upstream (with tests).
- **Tests:** harness-internal (upstream); locally `skills.test.js` pins the patch roster.
- **Runtime status:** Active (vendored).

## 15. Setup doctor + updater

- **Paths:** `setup.sh`, `update.sh`, `requirements.txt`
- **Purpose:** bootstrap/repair/wire everything: prerequisites (node ≥22.19/24, pnpm, uv), a single parameter inventory (official Splunk MCP endpoint + token now **required**; REST-only Splunk fields removed), `.env` generation (chmod 600), `uv sync`, fingerprint-gated `pnpm install/build`, plugin add/prune, SOC bundle registration, verification. `update.sh` = clean-tree ff-only pull + `setup.sh --plugins`.
- **Runtime status:** Operational tooling (operator-run; starts no services).

## 16. Skills

- **Paths:** `skills/{detection-engineering,false-positive-analysis,splunk-investigation,spl-writing}/SKILL.md`
- **Purpose:** model-selected playbooks constraining investigation, false-positive analysis, detection engineering, and CITIC SPL writing; loaded via `skill-filesystem` (`customSkillDirs` → `<repo>/skills`), surfaced by the `tool-skill` tool (`skill` in `READ_ONLY_TOOLS`).
- **Runtime status:** Active (content). Drift: `AGENTS.md` names three additional skills that have no files (see [DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md)).
