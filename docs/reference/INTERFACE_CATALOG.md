# Interface catalog

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.

**Who this is for:** developers changing a boundary and security reviewers enumerating entry points.

**What you will understand:** every meaningful first-party interface — caller, callee, auth, inputs/outputs, errors, limits, and tests. Shapes are sanitized; no real data.

Related: [MCP_TOOL_CATALOG.md](MCP_TOOL_CATALOG.md) (tool-by-tool), [CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md) (env contracts), [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md).

---

## 1. Process entry points

| Entry point | Invocation | Purpose |
|---|---|---|
| Harness web runtime | `cd vendor/deepseek-harness && pnpm dsh web --no-open` (port 3080) | Starts the Node host + web server; loads the web profile plugins (SOC bundle) |
| `unified-mcp-server` | `uv run unified-mcp-server` (spawned by `dsh-mcp-client` per `cordis.patch.yml`; cwd `apps/soc-agent/server`) | The `soc_agent` stdio MCP server (`server.py main()`) |
| `unified_mcp_server.control_server` | `uv run python -m unified_mcp_server.control_server` (spawned by `ownership.js startControlChannel`) | Persistent authenticated-operations channel |
| `unified_mcp_server.auth_cli <command>` | spawned per command when the channel is off/unavailable | One-shot auth operations (`login`, `logout`, `send-email`, `list-signatures`) |
| `unified_mcp_server.admin_cli <command>` | `uv run python -m unified_mcp_server.admin_cli …` (spawned by `host.js runAdmin`) | One-shot admin operations |
| `setup.sh [--check|--plugins] [--rebuild]` / `update.sh` | operator | Install/audit/repair/update |

## 2. HTTP surface (Node host)

| Route | Method | Auth | Purpose | Evidence |
|---|---|---|---|---|
| `/auth/login` | POST | public (+ same-site/origin check, 32 KiB JSON cap) | Zimbra credential login → `soc_session` cookie; single-device replacement; General workspace bootstrap | `ownership.js handleAuthRoute('login')` |
| `/auth/logout` | POST | cookie | Delete session + unbind agents + clear cookie | `handleAuthRoute('logout')` |
| `/auth/me` | GET | session | Session probe (`expires_at`, one-shot `new_device_login` reason) | `handleAuthRoute('me')` |
| `/admin/auth/login` | POST | public (same-site) | Static admin login → `soc_admin_session` (8 h) | `handleAdminAuthRoute` |
| `/admin/auth/logout` / `/admin/auth/me` | POST / GET | admin cookie | Drop/probe admin session | `handleAdminAuthRoute` |
| `/admin` | GET/HEAD | (page itself; RPCs enforce admin) | Admin console HTML (harness frontend rendered with `webServer.renderIndex`) | `host.js serveAdminPage` |
| `/api/**`, `/soc-agent-*` | mixed | fenced by `installTransport` | Harness + scoped product APIs; privileged methods require admin (`authorizePrivilegedRequest`) | `ownership.js installTransport`, `isPrivilegedApiPath` |
| `/api/events.mux`, `/api/events.host` | WebSocket | session; frames filtered/redacted per user | Live event streams | `PRIVATE_UPGRADE_PATHS`, `filteredFrames` |

## 3. RPC channel `/soc-agent-config` (browser ⇄ host)

Registered with `authority: 'trusted-host'`; every endpoint re-checks auth (`requireUser` / `requireAdmin`). Errors: `authentication-required`, `admin-authentication-required`, `bad-request`, `attachment-error{reason}`, `internalError`.

| Endpoint | Auth | Input → Output | Evidence |
|---|---|---|---|
| `get-action-catalog` / `get-admin-action-catalog` | user / admin | `{}` → `{actions: ACTION_CATALOG, tools: TOOL_CATALOG}` | `host.js handleEndpoint` |
| `get-action-policy` | user | `{}` → `{actions, tools, mode, actionStates, source: 'session'\|'deployment'}` | `policyValue` |
| `set-action-mode` | user | `{mode: 'soc'\|'full'}` → updated policy | `socAuth.setActionMode` |
| `get-settings` | admin | `{}` → redacted service statuses (admin_cli `get-settings`) | `runAdmin` |
| `update-settings` / `delete-setting` | admin | always `bad-request` — "Service configuration is managed by the server environment." | `host.js` |
| `list/add/update/delete/test-account` | — | always refuse — "Stored Zimbra accounts are no longer supported" | legacy stubs |
| `send-email` | user | `{to[], cc[], bcc[], subject, body, body_format}` → `{sent: true}` required by the UI | `runAuthCommand('send-email', {…, session_id})` |
| `list-signatures` | user | `{}` → `{signatures: [{id,name,text,html}]}` | `runAuthCommand` |
| `test-splunk` / `test-subscription-server` | admin | `{}` → status/failure (message prefixed, ≤400 chars, ≤20 missing-env names) | `runAdmin` |
| `convert-attachment` | admin | `{filename, content_type, data(base64), limits{max_bytes, max_chars}}` → `{text, text_truncated?, …}`; limits: ≤100 MB decoded, ≤2 M chars, filename ≤255 | `validateAttachmentPayload` + admin_cli |
| `migrate` | admin | `{}` → `{}` | admin_cli no-op |

## 4. MCP boundaries

- **`soc_agent`** (host is MCP client): stdio; per-call metadata `{soc_session_id, soc_investigation_id, soc_customer_id:"", soc_correlation_id, soc_deadline_ms}` attached by the `mcp/request-meta` waterfall; per-call timeout 185 000 ms; startup failure is fatal (`failOnStartupError: true`). Server responses are `{ok, service, operation, data|error{code,message,retryable,details}, meta}` envelopes; failures ride `McpFailureEnvelope` so transport marks `isError`.
- **`splunk_mcp`** (host is MCP client to an **external** server): streamable HTTP + Bearer; 13-tool raw allowlist; results pass the post-execute projection (mask card/SSN, truncate 50 KB).
- **Harness→tools policy interface:** `tools/pre-execute` decisions `{kind: 'deny'|'ask'}` / delegate; harness approval plugin (fail-closed `ask`) dispatches `approval/request` to the UI.

## 5. Private control channel (Node ⇄ Python)

- Transport: stdio JSON lines; first line `{"ready":true}`; requests `{id, command, payload}`; responses `{id, ok, result}` / `{id, ok:false, error:{code,message,details}}`.
- Bounds: 8 000 000-byte line cap (channel killed on overflow), 8 concurrent requests, 60 s startup handshake, per-op timeout 185 s default.
- Commands: `login`, `logout`, `send-email`, `list-signatures` (dispatch table = `auth_cli.dispatch_command`); `zimbra_auth_error` triggers `_expire_session_on_auth_error`.
- Fallback rule: spawn one-shot `auth_cli` only if the failure occurred **before transmission**; a lost response after transmission raises `operation_outcome_unknown` and is never replayed.
- Auth: no channel secret (private pipe); every command validated by `session_id` against Postgres.

## 6. External service calls

| Call | From | Protocol / auth | Errors |
|---|---|---|---|
| Zimbra SOAP (`/service/soap`, upload `?fmt=raw`) | `zimbra.py` via `zimbra-client` | XML over HTTPS (`ZIMBRA_HOST`), per-call session token | `zimbra_auth_error` (deletes app session), `zimbra_tls_error`, `zimbra_connection_error` (retryable), `zimbra_api_error`, `query_validation_error` |
| Subscription REST (`/login`, `/api/subscriptions[…]`) | `email/service.py` | httpx; form login; ≤5 same-host redirects, no downgrades | `email_server_unavailable` (retryable), `email_server_auth_failed`, `email_server_request_failed` (status only; bodies withheld), `email_server_invalid_response` |
| Official Splunk MCP | `splunk-bridge.js` | streamable HTTP + Bearer (`SPLUNK_TOKEN`), TLS verified by default | connection/timeout failures logged; startup failure fatal when configured |
| Splunk REST (retained) | `splunk_service.py` via `SplunkService` | HTTPS; used by admin `test-splunk` only | admin command failure contract |

## 7. Storage interfaces

- **PostgreSQL** (`SocStateStore`, `PostgresStore`): documented in [DATA_STORE_CATALOG.md](DATA_STORE_CATALOG.md). Errors: decrypt failure raises with remediation; store absence → `authentication_required` fail-closed.
- **Harness settings API** (`settings.get/mutate`, namespaces + `expectedRevision`): durability for action policy, background cadence, attachment limits, providers.
- **Credentials API** (`credentials.set/unset/describe`): write-only secret storage; `describe` returns only `configured`/`writable`.

## 8. UI handoff boundaries

- **Email draft handoff:** `zimbra_send_email` tool result (draft JSON) → `EmailDraftToolview` renders editable form → explicit confirm → `send-email` RPC → `{sent:true}` or failure card. No other delivery path exists; no model-callable send.
- **Attachment boundary:** composer file → base64 → `convert-attachment` (admin RPC) or mailbox `zimbra_get_attachment_text` → MarkItDown Markdown with `text_truncated` marker → model context.
- **Browser bundle boundary:** `lib/client.js` closure factory loaded via `window.__ModuleLoader__` + `__DSH_BOOT__` graph (harness `packages/client/web/src/boot.ts`).

## 9. Patch seams into the vendored harness

- `apps/soc-agent/cordis.patch.yml`: enables/disables upstream plugin rows, sets `approval.policy: ask`, disables model-facing coding tools, inserts the five SOC plugins, configures both MCP servers (raw allowlists, timeouts), points `skill-filesystem.customSkillDirs` at `<repo>/skills`.
- `patches/dsh-auto-collapse@0.1.4.patch`: pnpm patch over the upstream UI plugin's built bundle — English localization, English duration parsing, `[data-dshcf-preserve]` rows excluded from auto-collapse (protects the SOC draft card).
- Preset seam: `vendor/.../agent-presets/citic-soc/agent.cordis.yml` — persona "Sentinel", `instructionFileCandidates` (AGENTS/CLAUDE/BACKGROUND, 64 KiB cap), compaction thresholds (8192/4096/1024), `tool-ask-user`.
