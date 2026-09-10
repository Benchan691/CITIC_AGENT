# Splunk + Zimbra MCP server

Python MCP backend for the Splunk + Zimbra Analyst product bundle. See the
[project structure](../../../docs/PROJECT_STRUCTURE.md) for workspace commands
and dependency boundaries.

```bash
cp .env.example .env
uv sync --extra test
uv run unified-mcp-server
uv run pytest
```

Authenticated UI operations (catalog edits and email) run through a persistent Python control channel
(`unified_mcp_server.control_server`) instead of one interpreter per command;
`SOC_CONTROL_CHANNEL=off` restores per-command interpreters. The control channel
shares settings, provider clients and bounded PostgreSQL pools across requests.
Only failures before transmission may fall back to a fresh interpreter. An
unconfirmed operation returns `operation_outcome_unknown` and is not replayed.
Search evidence snapshots are cached in memory and, when `SOC_EVIDENCE_STORE`
is configured, retained in SQLite and paged through `soc_evidence_read`. The
SOC host defaults that file to `$DSH_HOME/soc-evidence.sqlite3` (or
`~/.dsh/soc-evidence.sqlite3`). An explicit empty path disables disk retention.
The deterministic search planner is exposed as `splunk_plan_search` once
`SPLUNK_SEARCH_PLANNER_ENABLED=true` and its schema mappings are verified.

Configure Splunk, Zimbra, MarkItDown, and subscription-server settings in the
ignored `.env` file. PostgreSQL stores authenticated users, sessions, and
workspace ownership, plus the SOC catalogs (Ruleset, Customer Information,
Fix Source type) with their audit history; it is not a service-configuration
source. Catalog records are edited through the authenticated editor workflow.
The application can preview validated lookup snapshots but cannot publish them
to Splunk. The
`/admin` console shows service status and manages LLM provider credentials, but
does not expose or edit deployment variables.

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
and throttle reads under `mcp__splunk_official__...`. Official reads bypass
the harness approval and local query-admission gates; Splunk MCP Server owns
query guardrails and its 1,000-event response cap. Authentication, session and
customer isolation, sanitization, evidence handling, model-visible output
limits, and transport deadlines remain application-enforced.
Set `SPLUNK_VERIFY_SSL=false` only while a self-signed chain cannot be
installed in the machine trust store. That exception is scoped to this MCP
connection and does not disable TLS checks process-wide.

The Python adapter remains for compatibility reads such as bounded lookup and
existing search-job result retrieval. An official MCP rejection is surfaced
and is never silently retried through REST. The application exposes no Splunk
write tool, REST mutation method, or catalog-to-Splunk publication path.

Remove either official MCP setting and restart the host to disable the direct
bridge; the legacy read-only compatibility tools remain available when their
REST configuration is present.

Standalone MCP clients should set `cwd` to this directory and pass `MCP_SERVER_ROOT` when workspace data lives elsewhere (for example the repository root `.data/` directory). The former misspelling `MCP_SEVER_ROOT` remains accepted for compatibility.

Splunk event outputs keep complete events within a 20,000-character budget and
report truncation explicitly; request selected `fields` when narrowing is
needed. Zimbra supports bounded metadata/body pagination, header-only evidence,
MarkItDown-based attachment-to-Markdown conversion for PDF, Word, PowerPoint,
Excel, images, ZIP, EPUB, CSV, JSON, XML, HTML, and text files; attachment
hashes; and verified reversible message moves. The authenticated email
webserver exposes subscription listing, preview, creation, updates, and
deletion. Sends, moves, folders, filters, catalog changes, and subscription
mutations remain approval-gated by the host.

Ad-hoc searches coalesce identical in-flight requests within the host-resolved
user, investigation and customer scope. Completed snapshots can be reused for
`SPLUNK_SEARCH_REUSE_TTL_SECONDS` (default 300; zero disables completed reuse).
Use `fresh=true` when new evidence is required. Responses retain source counts,
retrieval time, resolved time bounds, checksum and source-completeness flags.
Simple relative windows resolve once; calendar snaps retain Splunk's syntax and
bypass reuse. Disk and memory retain at most 32 snapshots and 64 MB of serialized
payload each; eviction can make an old evidence ID unavailable. Evidence pages
accept `fields`, return up to 200 whole rows within a 24,000-byte data budget,
and expose `next_offset`. The host additionally projects ordinary event previews
to at most eight rows and a 7,500-byte JSON envelope when it fits. Oversized
metadata passes through intact. Retention covers fetched evidence, not events
outside the provider's result cap.

An operation has one 180-second budget including authentication and admission;
the host MCP transport allows 185 seconds for cleanup. Splunk job time includes
dispatch, polling and retrieval, and cleanup is bounded to five seconds. Only
transient Splunk GET failures receive one retry. Zimbra blocking calls retain
their admission slots until their worker exits, even if a caller cancels; each
SOAP request checks the remaining deadline. PostgreSQL pooling defaults on,
with up to four connections per store, a five-second connection/pool wait and
a 15-second statement timeout. `APP_POSTGRES_POOL=false` restores per-call
connections. Deployment configuration changes require a host/backend restart.

See the [implementation and validation report](../../../docs/PERFORMANCE_REDESIGN_IMPLEMENTATION.md)
for measured offline results, remaining work and rollout steps.

Persistent CSV lookups can be read with `splunk_get_lookup`; they cannot be
edited by this application.

Legacy REST compatibility searches retain local resource settings for
admission, lookback, runtime, concurrency, dispatch rate, and weighted query
budget. Direct official MCP reads rely on provider-side guardrails. Keep these
controls layered with Splunk role-level controls such as
`srchJobsQuota`, `cumulativeSrchJobsQuota`, `srchDiskQuota`, `srchMaxTime`, and
allowed/disallowed indexes; the MCP server does not modify Splunk
authorization. Result limits and the 20,000-character budget control returned
data, not the amount of work Splunk performs.

The web UI authenticates users directly against the configured Zimbra server.
The PostgreSQL-backed application session stores the authenticated Zimbra token
server-side for 24 hours; it never stores the submitted password. Workspaces
and Harness sessions are owned by the authenticated local user, and the first
successful login creates that user's `General` workspace.

Attachment conversion is local by default. Set `MARKITDOWN_LLM_ENABLED=true`
with the `MARKITDOWN_LLM_*` variables when OpenAI-compatible OCR or image
descriptions are explicitly required; `setup.sh` installs the optional
`markitdown-llm` dependencies automatically.
