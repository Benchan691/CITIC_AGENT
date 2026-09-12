# Zimbra + subscription MCP server

Python MCP backend for the Zimbra and subscription tools used by the SOC Agent.
Splunk is connected separately through the official `splunk_mcp` bridge. See
the [repository guide](../../../README.md) for workspace commands and the
[shortening-plan implementation report](../../../docs/SHORTENING_PLAN_IMPLEMENTATION.md)
for the current refactors and dependency boundaries.

```bash
cp .env.example .env
uv sync --extra test
uv run unified-mcp-server
uv run pytest
```

Authenticated email operations run through a persistent Python control channel
(`unified_mcp_server.control_server`) instead of one interpreter per command;
`SOC_CONTROL_CHANNEL=off` restores per-command interpreters. The control channel
shares settings, provider clients and bounded PostgreSQL pools across requests.
Only failures before transmission may fall back to a fresh interpreter. An
unconfirmed operation returns `operation_outcome_unknown` and is not replayed.

Configure Splunk, Zimbra, MarkItDown, and subscription-server settings in the
ignored `.env` file. PostgreSQL stores authenticated users, sessions, and
workspace ownership; it is not a service-configuration source. The
`/admin` console shows service status and manages LLM provider credentials, but
does not expose or edit deployment variables. The user model picker includes
only providers whose named credential is currently configured; adding or
removing a credential refreshes that picker without exposing the credential
reference to users.

The host exposes the approved official Splunk MCP read tools directly when
both `SPLUNK_MCP_ENDPOINT` and `SPLUNK_TOKEN` are set. Configure them in the
ignored `.env` file:

```dotenv
SPLUNK_MCP_ENDPOINT=https://splunk.example:8000/en-US/splunkd/__raw/services/mcp
SPLUNK_TOKEN=
SPLUNK_VERIFY_SSL=true
SPLUNK_ALLOW_INSECURE_HTTP=false
```

The Streamable HTTP bridge forwards the bearer token and registers only query,
instance, index, metadata, knowledge-object, saved-search, alert, fired-alert,
and throttle reads under `mcp__splunk_mcp__...`. Official reads bypass
the harness approval and local query-admission gates; Splunk MCP Server owns
query guardrails and its 1,000-event response cap. Authentication, session and
customer isolation, sanitization, evidence handling, model-visible output
limits, and transport deadlines remain application-enforced.
Set `SPLUNK_VERIFY_SSL=false` only while a self-signed chain cannot be
installed in the machine trust store. That exception is scoped to this MCP
connection and does not disable TLS checks process-wide.

The `soc_agent` MCP server does not register Splunk tools. The admin connection
check probes `splunk_get_info` through the same official bridge configuration.
The retired Python Splunk APIs and REST fallback are no longer shipped. No
Splunk write tool or REST mutation method is exposed to the SOC Agent.

Remove either official MCP setting and restart the host to disable the direct
bridge. The `soc_agent` MCP server continues to expose only Zimbra and
subscription tools.

Standalone MCP clients should set `cwd` to this directory and pass `MCP_SERVER_ROOT` when workspace data lives elsewhere (for example the repository root `.data/` directory). The former misspelling `MCP_SEVER_ROOT` remains accepted for compatibility.

Zimbra supports bounded metadata/body pagination, header-only evidence,
MarkItDown-based attachment-to-Markdown conversion for PDF, Word, PowerPoint,
Excel, images, ZIP, EPUB, CSV, JSON, XML, HTML, and text files; attachment
hashes; and verified reversible message moves. The authenticated email
webserver exposes subscription listing, preview, creation, updates, and
deletion. Sends, moves, folders, filters, and subscription mutations remain
approval-gated by the host.

Splunk query limits, evidence retention, and provider-side guardrails belong to
the separately deployed official MCP service. The SOC host still sanitizes and
size-limits direct `splunk_mcp` output before it reaches model context.

An operation has one 180-second budget including authentication and admission;
the host MCP transport allows 185 seconds for cleanup. Zimbra blocking calls
retain their admission slots until their worker exits, even if a caller
cancels; each SOAP request checks the remaining deadline. PostgreSQL pooling defaults on,
with up to four connections per store, a five-second connection/pool wait and
a 15-second statement timeout. `APP_POSTGRES_POOL=false` restores per-call
connections. Deployment configuration changes require a host/backend restart.

See the [implementation and validation report](../../../docs/SHORTENING_PLAN_IMPLEMENTATION.md)
for the completed refactors, recorded checks, remaining work, and rollout implications.

Direct official MCP reads rely on provider-side guardrails. Keep these controls
layered with Splunk role-level controls such as
`srchJobsQuota`, `cumulativeSrchJobsQuota`, `srchDiskQuota`, `srchMaxTime`, and
allowed/disallowed indexes; the MCP server does not modify Splunk
authorization. Result limits and the 20,000-character budget control returned
data, not the amount of work Splunk performs.

Legacy REST credentials, planner, lookup, query-policy, and resource-admission
settings are ignored. Readiness requires the official MCP endpoint and token;
REST-only deployments must configure both before Splunk tools are available.

The web UI authenticates users directly against the configured Zimbra server.
The PostgreSQL-backed application session stores the authenticated Zimbra token
server-side for 24 hours; it never stores the submitted password. Workspaces
and Harness sessions are owned by the authenticated local user, and the first
successful login creates that user's `General` workspace. New chats without an
explicit folder are created in `General`; ownership is committed before Host
publication so they never appear under `Ungrouped`.

Attachment conversion is local by default. Set `MARKITDOWN_LLM_ENABLED=true`
with the `MARKITDOWN_LLM_*` variables when OpenAI-compatible OCR or image
descriptions are explicitly required; `setup.sh` installs the optional
`markitdown-llm` dependencies automatically.
