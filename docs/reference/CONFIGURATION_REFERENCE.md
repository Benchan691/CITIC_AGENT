# Configuration reference

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](../zh/reference/CONFIGURATION_REFERENCE.md)
> Sources: `apps/soc-agent/server/.env.example` (safe template), `unified_mcp_server/config.py` (`ServerSettings.from_env`), `unified_mcp_server/env_loader.py`, `unified_mcp_server/postgres_store.py`, `apps/soc-agent/splunk-bridge.js`, `apps/soc-agent/ownership.js`, `apps/soc-agent/host.js`, `apps/soc-agent/cordis.patch.yml`, `setup.sh`.

**Who this is for:** operators preparing a deployment and developers tracing where a value comes from.

**What you will understand:** every configuration key, its consumer, precedence, sensitivity, and validation — with safe example *shapes* only. **Never place real secret values in documentation, tickets, or shell history.**

**Plain-language summary.** Configuration is deployment-owned: the Python server reads only process environment variables (seeded from the root `.env` and `apps/soc-agent/server/.env`), never the database or any browser-editable document. The Node host reads a small set of its own variables plus the server file for bridge/admin values. Precedence observed in code: **process environment wins**, then `server/.env`; `env_loader.py` additionally loads the root `.env` with override. The pristine vendor tree receives no runtime `.env`.

---

## 1. Loading and precedence (as coded)

1. Process environment (highest).
2. `apps/soc-agent/server/.env` (loaded by `env_loader.load_server_env`, then workspace `.env` **with override**).
3. `.env.example` — template only, never loaded.
4. `setup.sh` writes the root `.env` and `server/.env` (chmod 600); it does not write into pristine `vendor/deepseek-harness`.
5. `env_loader.py` strips `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD` from the Python process (`_NODE_ONLY_ENV_NAMES`); `host.js runAdmin`/`ownership.js childEnvironment()` also delete them before spawning children.

Fallback chains exactly as coded:
- Storage URI: `APP_POSTGRES_URI` → `LANGGRAPH_POSTGRES_URI` → `POSTGRES_URI` (`postgres_store.py`, `ownership.js`, `cordis.patch.yml` env).
- Server root: `DSH_SOC_AGENT_SERVER` → `<bundle>/server`; workspace root: `MCP_SERVER_ROOT` → legacy misspelling `MCP_SEVER_ROOT` (still honored by `python-command.js` and `config.py _storage_path`).
- Bridge config: `process.env` → `server/.env` (`splunk-bridge.js deploymentValues`).

**Schema migrations are not environment-driven:** the Node host's `ensureSchema` (and the admin `migrate` RPC) invoke `uv run python -m unified_mcp_server.schema migrate` and pass the resolved PostgreSQL URI **as JSON over stdin** — deliberately, because loading `.env` in that child "could override that target and initialize a different database" (`schema.py`).

## 2. Node host / auth variables

| Variable | Consumer | Purpose | Required when | Safe example shape | Default / fallback | Sensitivity | Validation |
|---|---|---|---|---|---|---|---|
| `SOC_ADMIN_EMAIL` | `ownership.js resolveAdminCredentials` | Static admin identity for `/admin` login | Always (startup throws without it) | `soc-admin@example.test` | — | Credential-adjacent | Non-empty; lowercased; compared with `timingSafeEqual`; stripped from child env |
| `SOC_ADMIN_PASSWORD` | `ownership.js` | Static admin secret | Always | *(generated long random value)* | — | **Secret** | Non-empty; never echoed; hashed (SHA-256) in memory |
| `APP_POSTGRES_URI` | `SocStateStore`, `PostgresStore`, patch env | Application storage | Required for login/ownership | `postgresql://user:***@db.example.test:5432/soc` | falls back `LANGGRAPH_POSTGRES_URI`, `POSTGRES_URI` | **Secret** (contains password) | Regex-validated by setup; best-effort `psql` probe |
| `APP_SETTINGS_ENCRYPTION_KEY` | `postgres_store.py` | Fernet key for `app_config` + stored tokens | Required when Postgres store used | 32-byte hex or urlsafe Fernet key | derived via SHA-256 if not a valid Fernet key | **Secret** | Required error otherwise; decrypt failure raises with remediation |
| `APP_POSTGRES_POOL` | `postgres_store.py` | Enable psycopg pool | Optional | `true` | `true` | — | Boolean |
| `SOC_CONTROL_CHANNEL` | `ownership.js` | `auto` (persistent control process) vs `off` (one-shot spawn) | Optional | `auto` | `auto` | — | Enum-ish |
| `SOC_AUTH_COMMAND_TIMEOUT_MS` | `ownership.js`, `host.js` | Timeout for auth/admin subprocess ops | Optional | `185000` | `185000` | — | Integer |
| `DSH_SOC_AGENT_SERVER` | `host.js`, `ownership.js`, bridge | Override Python server root | Optional | `/opt/CITIC_AGENT/apps/soc-agent/server` | `<bundle>/server` | — | Path |
| `MCP_SERVER_ROOT` | patch env, `host.js workspaceRoot` | Workspace root (`.data/`, `skills/` anchor) | Set by patch | repo root | `MCP_SEVER_ROOT` fallback → cwd-derived | — | Path |

## 3. Splunk — official MCP bridge variables (the only Splunk configuration left)

Setup and `./setup.sh --check` **require** this connection. `SplunkSettings` now contains exactly these five fields.

| Variable | Consumer | Purpose | Required when | Safe example shape | Default | Sensitivity | Validation |
|---|---|---|---|---|---|---|---|
| `SPLUNK_MCP_ENDPOINT` | `splunk-bridge.js`, `config.py` | External official Splunk MCP server URL (streamable HTTP) | Always (setup/check fail without it, with `SPLUNK_TOKEN`) | `https://splunk-mcp.example.test/mcp` | unset → bridge disabled + setup failure | Endpoint | HTTP(S) only; **no embedded credentials, query parameters, or fragments** (`splunk-bridge.js` URL validation) |
| `SPLUNK_TOKEN` | `splunk-bridge.js`, `config.py` | Bearer token for the bridge | With endpoint | *(service token)* | — | **Secret** | Non-empty; sent as `Authorization: Bearer`; redacted from connection-test errors |
| `SPLUNK_VERIFY_SSL` | `splunk-bridge.js`, `config.py` | TLS verification | Optional | `true` | `true` | — | Boolean; certificate exception applies only to this Splunk connection |
| `SPLUNK_ALLOW_INSECURE_HTTP` | `splunk-bridge.js`, `config.py` | Opt-in for plain-HTTP endpoints | Only for `http://` endpoints | `false` | `false` | — | Required `true` for `http:` URLs (bridge refuses otherwise) |
| `SPLUNK_SANITIZE_OUTPUT` | `investigation.js`, `config.py` | Disable card/SSN output masking | Optional | `true` | `true` (disabled by `0/false/no/off`) | — | Boolean-ish regex |

## 4. Retired Splunk configuration (removed this round)

All legacy Splunk REST variables (`SPLUNK_HOST`, `SPLUNK_HOST_FOR_DOCKER`, `RUNNING_INSIDE_DOCKER`, `SPLUNK_PORT`, `SPLUNK_SCHEME`, `SPLUNK_URL`, `SPLUNK_USERNAME`, `SPLUNK_PASSWORD`), all `SPLUNK_POLICY_*` query-policy variables, all `SPLUNK_SEARCH_*` resource-governance variables, `SPLUNK_LOOKUP_*`, `SPLUNK_DETECTION_*`, `SPLUNK_JOB_TIMEOUT`, `SPLUNK_REQUEST_TIMEOUT`, `SPLUNK_MAX_EVENTS`, `SPLUNK_RISK_TOLERANCE`, `SPLUNK_SAFE_TIMERANGE`, `SECURITY_QUEUE_*`, `SOC_EVIDENCE_STORE`, and their `SPL_*` aliases were **deleted from the codebase** (config.py, `.env.example`, setup.sh). REST-only deployments must add the official endpoint and token before Splunk tools appear. The `SPL_*` → `SPLUNK_*` legacy-alias mechanism is gone with them.

## 5. Zimbra variables

| Variable | Purpose | Default | Notes |
|---|---|---|---|
| `ZIMBRA_HOST` | SOAP endpoint base | — (required; `configured = bool(host)`) | https enforced unless `ZIMBRA_ALLOW_INSECURE_HTTP`; no credentials/query/fragment/path |
| `ZIMBRA_VERIFY_SSL` | TLS verification | true | — |
| `ZIMBRA_TIMEOUT` | Request timeout seconds | 1–600 range | — |
| `ZIMBRA_ALLOW_SEND` | Gate for real email delivery | `true` in code; deployment decides | The only path that sends is the UI-confirmed RPC |
| `ZIMBRA_ALLOW_MOVE` / `ZIMBRA_ALLOW_FOLDER_WRITE` / `ZIMBRA_ALLOW_SIGNATURE_WRITE` | Mutation gates | `true` | MCP-side complement to host ask-gates |
| `ZIMBRA_ALLOW_FILTER_WRITE` | Filter write gate | `true` | writes also need `expected_fingerprint` |
| `ZIMBRA_ALLOW_FILTER_REDIRECT` / `ZIMBRA_ALLOW_FILTER_DISCARD` | Dangerous filter semantics | `true` | validated per rule |
| `ZIMBRA_MAX_ATTACHMENT_BYTES` / `ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS` | Attachment limits | 10 MB / 200 000 (hard caps 100 MB / 2 000 000) | — |
| `ZIMBRA_ALLOW_INSECURE_HTTP` | Allow plain HTTP | false | — |

*(Removed this round: `ZIMBRA_ACCOUNTS_FILE`, `ZIMBRA_ACCOUNTS_KEY_FILE`, `ZIMBRA_ACCOUNTS_KEY`, and the legacy `ZIMBRA_EMAIL`/`ZIMBRA_PASSWORD` single-account variables no longer appear in the template or `config.py`.)*

## 6. Subscription service, MarkItDown, server identity

| Variable | Purpose | Default / validation |
|---|---|---|
| `SUBSCRIPTION_SERVER_URL` | Subscription web service base URL | Required (with user+password) for `configured`; https unless `SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP=true`; no credentials/fragment |
| `SUBSCRIPTION_SERVER_USER` / `SUBSCRIPTION_SERVER_PASSWORD` | Service login | **Secret** (password) |
| `SUBSCRIPTION_SERVER_TIMEOUT` | Seconds | 30 (1–600) |
| `MARKITDOWN_LLM_ENABLED` | Enable LLM/OCR conversion | false; when true requires `MARKITDOWN_LLM_API_KEY` + `MARKITDOWN_LLM_MODEL` |
| `MARKITDOWN_LLM_API_KEY` / `MARKITDOWN_LLM_BASE_URL` / `MARKITDOWN_LLM_MODEL` / `MARKITDOWN_LLM_TIMEOUT` | LLM converter config | **Secret** (API key) |
| `MCP_SERVER_NAME` / `MCP_SERVER_DESCRIPTION` | FastMCP identity | "SOC Agent MCP" / description default |
| `MCP_TRANSPORT` (legacy `TRANSPORT`) | `stdio` \| `sse` \| `streamable-http` (`http` mapped) | `stdio` |
| `MCP_HOST` / `MCP_PORT` (legacy `HOST`/`PORT`) | HTTP bind when not stdio | `127.0.0.1` / `8050` |
| `LOG_LEVEL` | Python logging | INFO |
| `RUNNING_INSIDE_DOCKER` | Selects `SPLUNK_HOST_FOR_DOCKER` | false |

## 7. Settings namespaces (stored in `app_config`, not environment)

| Namespace | Schema | Written by | Read by |
|---|---|---|---|
| `soc-action-approval` | `{mode: 'soc'\|'full', actionStates: {tool: 'ask'\|'auto'\|'disabled'}}` | Admin console → `settings.mutate` | `host.js savedActionPolicy` (deployment defaults) |
| `soc-background` | `{enabled: bool, repeatEveryUserPrompts: int ≥0}` | Admin console (Agent context) | `host.js installBackgroundRefresh` |
| `soc-agent-markitdown-attachments` | file/byte/char limits (defaults 5 / 10 MB / 50 MB / 200 k / 500 k) | Settings card (`settingsScope`) | `MarkItDownDocumentController` |
| `time-context` | current-time injection | Admin console (Agent context) | harness time-context plugin |
| `llm-pi-ai` | custom providers (`providers.<route>`) + credential refs `<ROUTE>_API_KEY` | Admin console (AI providers) | harness LLM provider registry |

Session-scoped action-mode override (`ownership.js setActionMode`) is **in-memory only** — cleared on logout, revocation, or host restart; deployment default then applies again.

## 8. Validation summary (fail-closed behavior)

- Endpoint validators reject embedded userinfo, query strings, fragments, and plain HTTP unless the matching `*_ALLOW_INSECURE_HTTP` is set; error messages never echo the value (`config.py _validate_http_endpoint`, `_validate_zimbra_host`).
- Missing configuration surfaces as `not_configured` with `missing_environment_variables` (≤20 listed by the admin RPC); credential-bearing Splunk/Zimbra endpoints are rejected (`test_config.py`).
- Malformed action-policy settings degrade to SOC defaults — "A malformed or unavailable saved setting must never grant an action" (`host.js normalizedActionPolicy`).
- Status output is redacted: endpoint hosts only (`redact_endpoint`), booleans/limits; no passwords, tokens, usernames, or mailbox identity (`ServerSettings.public_status`).

Related: [CONFIGURATION.md](../CONFIGURATION.md) (prose), [DATA_STORE_CATALOG.md](DATA_STORE_CATALOG.md) (where settings live).
