# Unified Splunk + Zimbra MCP Server

One Python MCP server exposes guarded Splunk investigation tools and Zimbra email tools, with a LangChain Deep Agent client that discovers the tools at runtime.

The implementation reuses the existing `splunk-mcp-server2/python` REST client and SPL guardrails, and extends the existing `plugin/zimbra` SOAP client with query search, folders, message bodies, SSL controls, and normalized metadata. The TypeScript Splunk implementation remains available as a reference but is not a second runtime dependency.

## Architecture

```text
Deep Agent
  └─ langchain-mcp-adapters (tool discovery)
       └─ unified_mcp_server.server (stdio, SSE, or streamable HTTP)
            ├─ splunk_* tools
            │    └─ SplunkService
            │         ├─ reused SplunkClient
            │         └─ reused SPL guardrails + output sanitizer
            └─ zimbra_* tools
                 └─ ZimbraService (async boundary)
                      └─ extended plugin.zimbra SOAP client
```

The official UI startup runs the LangGraph Agent Server in Docker with a
PostgreSQL checkpointer. The default database is stored in the Docker volume
`langgraph-data`; it survives Agent Server and machine restarts. Set
`LANGGRAPH_POSTGRES_URI` to use an external PostgreSQL database instead.

`ServerSettings` reads shared server configuration from environment variables. Zimbra mailbox credentials are stored in an encrypted local account store managed through the HTTP account API. UI-managed Splunk credentials and model API keys are encrypted in a single PostgreSQL settings profile. `Runtime` owns the service instances for the MCP lifespan. Each tool returns the same response envelope, so clients can distinguish configuration failures, blocked queries, upstream failures, and successful results without parsing exception text.

## Tools

| Namespace | Tool | Purpose |
|---|---|---|
| System | `system_get_status` | Non-secret configuration and readiness |
| Splunk | `splunk_validate_query` | Local SPL risk scoring, without execution |
| Splunk | `splunk_search` | Guarded oneshot search with result caps and sanitization |
| Splunk | `splunk_list_indexes` | Available indexes |
| Splunk | `splunk_list_saved_searches` | Saved-search metadata |
| Splunk | `splunk_run_saved_search` | Run a saved search with actions disabled |
| Splunk | `splunk_list_data_sources` | Index metadata for scoping a rule |
| Splunk | `splunk_get_detection` | Review one saved search without executing it |
| Splunk | `splunk_validate_detection` | Validate rule metadata and SPL safety |
| Splunk | `splunk_backtest_detection` | Bounded, read-only historical sample |
| Splunk | `splunk_create_detection_draft` | Persist a disabled draft (opt-in) |
| Splunk | `splunk_update_detection_draft` | Revalidate and update a disabled draft |
| Splunk | `splunk_enable_detection` | Explicit approval-gated enable operation |
| Splunk | `splunk_disable_detection` | Reversible disable/rollback |
| Zimbra | `zimbra_list_folders` | Visible folders and counts |
| Zimbra | `zimbra_list_accounts` | Safe account IDs and labels; never credentials |
| Zimbra | `zimbra_search_emails` | Native Zimbra query search; metadata only |
| Zimbra | `zimbra_get_email` | One message with body and attachment metadata |
| Zimbra | `zimbra_send_email` | Plain-text send, disabled by default |

The prefixes are intentional: an agent can tell which system a tool affects from its name.

## Setup

Requirements: Python 3.12+ and `uv` (recommended) or `pip`.

The combined UI startup additionally requires Docker Desktop (or a Docker
Engine) for the PostgreSQL-backed LangGraph Agent Server.

```bash
cp .env.example .env
# Fill in shared server/model settings; add mailboxes from the frontend.
uv sync --extra agent --extra test
```

With `pip`:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e '.[agent,test]'
```

### Authentication variables

Splunk can be configured from the Settings screen with a full URL such as
`http://127.0.0.1:8089`, username, and password. Environment configuration
remains supported as a fallback and accepts either:

- `SPLUNK_TOKEN` (preferred), or
- both `SPLUNK_USERNAME` and `SPLUNK_PASSWORD`.

It also requires `SPLUNK_HOST`; the management port defaults to `8089`.

Zimbra requires `ZIMBRA_HOST`. Add mailbox credentials from the frontend Settings screen. Hosts may be bare hostnames or full HTTP(S) base URLs.

The server creates `.data/zimbra_accounts.enc` and `.data/zimbra_accounts.key` on first use. The account store is encrypted and the key file is restricted to the server user. Set `ZIMBRA_ACCOUNTS_KEY` instead when an externally managed key is preferred.

For PostgreSQL-backed Settings, set `APP_POSTGRES_URI` and
`APP_SETTINGS_ENCRYPTION_KEY` in `.env`. When using `unified-dev`, a local
host such as `localhost` or `127.0.0.1` is automatically rewritten to
`host.docker.internal` for the Docker Agent Server. The host MCP process keeps
using the original URI. The same local PostgreSQL database stores both UI
settings and LangGraph threads. Set `LANGGRAPH_POSTGRES_URI` only when you
want to override the shared database URI. The Settings API never returns
stored passwords or API keys. DeepSeek keys are entered only when DeepSeek is
selected; local-model connection details remain server-side.

See [.env.example](./.env.example) for every variable. TLS verification is enabled by default for both systems. Use `SPLUNK_VERIFY_SSL=false` or `ZIMBRA_VERIFY_SSL=false` only for a controlled development environment with a self-signed certificate.

Detection writes are opt-in. `SPLUNK_ALLOW_DETECTION_WRITE=true` permits creating or updating disabled drafts; `SPLUNK_ALLOW_DETECTION_ENABLE=true` is a separate gate for enabling a reviewed rule. Keep both false for read-only investigation and validation.

## Run the MCP server

The default transport is stdio:

```bash
uv run unified-mcp-server
```

For streamable HTTP (required for frontend account management):

```bash
MCP_TRANSPORT=streamable-http MCP_HOST=127.0.0.1 MCP_PORT=8050 uv run unified-mcp-server
```

The MCP endpoint is `http://127.0.0.1:8050/mcp`.

To verify discovery without invoking an LLM:

```bash
uv run unified-deep-agent --list-tools
```

## Official Deep Agents UI

The official Next.js UI is included under `deep-agents-ui/`. It connects to the local LangGraph Agent Server, which wraps the same MCP-discovering Deep Agent used by the CLI. Install the UI/runtime dependencies once:

The frontend follows the checked-in `.nvmrc` (Node 20) and uses Yarn through Corepack.

```bash
uv sync --extra ui
corepack yarn --cwd deep-agents-ui install --frozen-lockfile
```

Start the MCP server in one terminal:

```bash
MCP_TRANSPORT=streamable-http MCP_HOST=127.0.0.1 MCP_PORT=8050 uv run unified-mcp-server
```

Start the backend in a second terminal:

```bash
uv run langgraph up --port 2024 --docker-compose docker-compose.langgraph.yml
```

This starts the Agent Server with a persistent local PostgreSQL volume. To
use managed PostgreSQL, set `LANGGRAPH_POSTGRES_URI` in `.env`; the startup
command passes it to LangGraph automatically. The older `langgraph dev`
command is an in-memory development mode and its threads are lost when that
process restarts.

Start the official frontend in a second terminal:

```bash
corepack yarn --cwd deep-agents-ui dev
```

Or start the MCP server, LangGraph server, and frontend together:

```bash
uv run unified-dev
```

Open [http://localhost:3000](http://localhost:3000). Press `Ctrl+C` once to stop all three processes.

In Settings, enter:

- Deployment URL: `http://127.0.0.1:2024`
- Assistant ID: `incident_agent`
- Splunk URL, username, and password
- The model provider and its provider-specific credentials

The local Agent Server exposes the API at `http://127.0.0.1:2024` and stores
threads in PostgreSQL. Add Splunk and model credentials from the UI Settings
screen; add Zimbra mailboxes there as well. For a local PostgreSQL instance,
make sure it accepts TCP connections from Docker Desktop. The Docker Agent Server is given
`http://host.docker.internal:8050/mcp` so it can use the host MCP server,
while the browser continues to use `http://127.0.0.1:8050/mcp`. The UI
repository is the official `langchain-ai/deep-agents-ui` checkout with the
account workspace layered on top.

The default PostgreSQL volume is retained when services restart. Do not run
`docker compose down -v` unless you intentionally want to delete the local
thread database. With an external PostgreSQL URI, thread retention is managed
by that database.

The combined startup allows up to 10 minutes for the first Docker image pull
and Agent Server build. Adjust `LANGGRAPH_STARTUP_TIMEOUT_SECONDS` in `.env`
if your connection or machine needs more time.

## Deep Agent workflow

The client uses `MultiServerMCPClient.get_tools()` to discover the live schema and passes those tools to `deepagents.create_deep_agent()`. It launches the server over stdio by default, so no separately managed server process is required.

Set the model provider key required by `DEEP_AGENT_MODEL`, then run:

```bash
export OPENAI_API_KEY=...
uv run unified-deep-agent --indicator app-01 --earliest-time=-24h
```

### Use DeepSeek

DeepSeek exposes an OpenAI-compatible API. Replace the existing `DEEP_AGENT_MODEL` line in `.env` (do not keep two entries) and add these settings:

```bash
DEEP_AGENT_PROVIDER=deepseek
DEEP_AGENT_MODEL=deepseek-v4-flash
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Then run the same command. The client creates a LangChain `ChatOpenAI` instance pointed at DeepSeek; the MCP tools and investigation workflow stay unchanged. You can also select it for one run with `uv run unified-deep-agent --model deepseek-v4-flash ...` when `DEEPSEEK_API_KEY` is set.

### Use the local llama.cpp model

The web UI can switch each thread between DeepSeek and the local OpenAI-compatible
llama.cpp server. Configure the local option in the MCP server environment:

```bash
DEEP_AGENT_DEFAULT_PROVIDER=deepseek
LOCAL_MODEL_BASE_URL=http://127.0.0.1:6767/v1
LOCAL_MODEL_NAME=/models/Qwen_Qwen3.6-35B-A3B-IQ4_XS.gguf
LOCAL_MODEL_CONTEXT_TOKENS=8192
LOCAL_MODEL_API_KEY=local
```

The frontend sends only the provider choice (`deepseek` or `local`). Model URLs,
model identifiers, and credentials remain server-side. The local model profile
automatically resets an oversized active conversation at about 80% of its
8,192-token input capacity. The agent keeps a concise handoff with the
objective, verified results, constraints, outstanding work, and next action,
then continues automatically from that handoff. Earlier messages and
conversation-history files are removed from the active thread and future model
context; historical PostgreSQL checkpoints remain available for recovery and
audit.

The example workflow instructs the agent to:

1. search scoped Splunk telemetry for the indicator;
2. extract concrete users, emails, hosts, alerts, and timestamps;
3. search Zimbra for the strongest correlators and fetch relevant message bodies;
4. produce an evidence-based timeline and identify any unavailable data source.

To review a proposed detection rule with the Deep Agent:

```bash
uv run unified-deep-agent --detection-name "Suspicious PowerShell download" \
  --spl 'index=windows sourcetype=WinEventLog:Security EventCode=4688 powershell' \
  --earliest-time=-7d
```

The detection workflow discovers data sources, validates the rule, backtests a bounded sample, and keeps persistence and enablement as explicit follow-up actions.

The same workflow is available as a script:

```bash
uv run python examples/investigate_incident.py app-01
```

To connect the Deep Agent to an already-running HTTP server, set:

```bash
export MCP_SERVER_URL=http://127.0.0.1:8050/mcp
```

## Structured responses

Success:

```json
{
  "ok": true,
  "service": "splunk",
  "operation": "search",
  "data": {"event_count": 1, "events": []},
  "error": null,
  "meta": {}
}
```

Failure:

```json
{
  "ok": false,
  "service": "zimbra",
  "operation": "search_emails",
  "data": null,
  "error": {
    "code": "not_configured",
    "message": "Zimbra is not configured on the MCP server.",
    "retryable": false,
    "details": {"missing_environment_variables": ["ZIMBRA_HOST"]}
  },
  "meta": {}
}
```

Unexpected exceptions are logged server-side and return a generic `internal_error`; secrets and raw upstream response bodies are not returned.

## Security behavior

- Zimbra credentials are accepted only by the account-management HTTP API and stored encrypted on the server.
- The agent receives only opaque account IDs, labels, and masked email metadata; passwords never appear in prompts, graph state, tool arguments, tool results, or status output.
- Account routes are localhost-only by default. Remote access requires `ZIMBRA_ACCOUNT_API_KEY` and an allowed origin.
- TLS verification and Splunk output sanitization default to enabled.
- SPL is evaluated against the configured risk tolerance before network execution.
- Search result counts are clamped by `SPLUNK_MAX_EVENTS`.
- Saved-search actions are always disabled.
- Zimbra searches return metadata first; full bodies require `zimbra_get_email`.
- Sending email requires the explicit opt-in `ZIMBRA_ALLOW_SEND=true`.
- Do not keep old Zimbra credentials in `.env`; rotate any credentials that were previously stored there before using the account UI.
- The Deep Agent prompt cannot substitute for access control; restrict Splunk and Zimbra accounts to least privilege.

## Tests

```bash
uv run pytest
```

The suite covers environment validation/redaction, response envelopes, guarded and sanitized Splunk searches, Zimbra SOAP normalization, read/write safety boundaries, and real stdio MCP discovery through the LangChain adapter.

Tests mock Splunk and Zimbra upstream APIs; live credentials are not required.

## Extending the server

Keep backend-specific code in its service module and register a prefixed tool in `unified_mcp_server/server.py`. Raise `ServiceError` for expected failures so the common envelope remains stable. Add the tool to the discovery test to make namespace and schema changes intentional.

The original components remain in place:

- `splunk-mcp-server2/python`: reused Splunk client and guardrails
- `splunk-mcp-server2/typescript`: reference implementation
- `plugin/zimbra`: extended SOAP client
- `deepagents`: clean upstream reference checkout; the client uses its released Python package
- `plugin/edrive`: out of scope for the unified mail/telemetry server

The pre-change repository architecture graph produced during inspection is stored locally at `.ua/knowledge-graph.json` (ignored by Git).
