# Zimbra, subscription, and customer report MCP server

Python MCP backend for the Zimbra, subscription, and customer report tools used by the SOC Agent.
Splunk is connected separately through the official `splunk_mcp` bridge. See
the [repository guide](../../../README.md) for workspace commands and
dependency boundaries.

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

Subscription tools connect to the Rust webserver configured by
`SUBSCRIPTION_SERVER_URL` (normally port 9100) and authenticate with the local
administrator credentials in `SUBSCRIPTION_SERVER_USER` and
`SUBSCRIPTION_SERVER_PASSWORD` through `/login/local`. They use the Rust
subscription IDs for update and delete operations. Zimbra subscriptions keep
the existing Zimbra account email; local subscriptions use manually supplied
recipient addresses. Keep these service credentials in the ignored `.env` and
never in tool arguments or documentation.

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
The retired general-purpose Python Splunk tools and REST fallback are no longer shipped.
Customer reports retain their dedicated dashboard renderer inside the report plugin;
it creates a temporary dashboard and removes it after printing. The report tool
therefore uses the configured Harness approval flow.

Remove either official MCP setting and restart the host to disable the direct
bridge. The `soc_agent` MCP server continues to expose Zimbra, subscription,
and customer report tools.

Standalone MCP clients should set `cwd` to this directory and pass `MCP_SERVER_ROOT` when workspace data lives elsewhere (for example the repository root `.data/` directory). The former misspelling `MCP_SEVER_ROOT` remains accepted for compatibility.

`zimbra_search_emails` accepts a native Zimbra `query`, plus `limit` and `offset`.
All filters, including folder paths and dates, go directly in `query`. Folder
and date filters are optional; sender, recipient, subject, text, unread status,
attachments and other native filters may be used alone or combined. Examples:

```json
{"query": "in:\"Inbox/SOC\" date:09/30/2026", "limit": 20}
```

```json
{"query": "in:\"Inbox/SOC\" subject:alert is:unread", "limit": 20}
```

```json
{"query": "from:analyst@example.com has:attachment", "limit": 20}
```

Use a full path confirmed by the user or returned by `zimbra_list_folders`.
For `/Inbox/SOC`, both `in:"Inbox/SOC"` and `in:"/Inbox/SOC"` work; `in:"SOC"`
refers to `/SOC`. `under:` also searches subfolders; `inid:` and `underid:` use
returned folder IDs. The backend passes the query through without looking up
or guessing folder paths. Group OR alternatives to preserve intended scope,
e.g. `in:"Inbox/SOC" (subject:alert OR subject:warning)`.

Absolute dates use `MM/DD/YYYY` with `date:`, `after:` or `before:`. The tool
sets the parsing locale to `en_US` so these dates do not depend on the mailbox
locale; dates still follow its timezone. Relative dates such as `after:-7d`
are supported. `d:YYYYMMDD` is rejected with a suggested corrected query when
the date is valid. Empty queries are rejected.

The MCP tool descriptions carry this guidance; it is not added to `AGENTS.md`.
SOAP faults retain a safe `upstream_code` while omitting raw upstream messages.
Missing folders return `folder_not_found` with full-path/ID guidance, malformed
queries return `query_validation_error` with native syntax examples, and
permission/authentication failures have distinct errors. Folder and syntax
errors are non-retryable until corrected; known transient faults are retryable.

Zimbra supports bounded metadata/body pagination, header-only evidence,
MarkItDown-based attachment-to-Markdown conversion for PDF, Word, PowerPoint,
Excel, images, ZIP, EPUB, CSV, JSON, XML, HTML, and text files; attachment
hashes; and verified reversible message moves. Body-embedded CID/content-
hashes; attached RFC822/EML messages are read from their text parts without
resolving remote HTML images; and verified reversible message moves. Body-
embedded CID/content-location images are omitted from normal attachment
metadata, and conversion-only failures are reported as skipped attachment
results so other message content can still be read. The authenticated email
webserver exposes subscription listing, preview, creation, updates, and
deletion. Sends, moves, folders, filters, and subscription mutations remain
approval-gated by the host.

Splunk query limits, evidence retention, and provider-side guardrails belong to
the separately deployed official MCP service. The SOC host still sanitizes and
size-limits direct `splunk_mcp` output before it reaches model context.

An ordinary operation has one 180-second budget including authentication and admission.
Report generation has a 900-second budget; the SOC MCP transport permits 905 seconds.
Zimbra blocking calls
retain their admission slots until their worker exits, even if a caller
cancels; each SOAP request checks the remaining deadline. PostgreSQL pooling defaults on,
with up to four connections per store, a five-second connection/pool wait and
a 15-second statement timeout. `APP_POSTGRES_POOL=false` restores per-call
connections. Deployment configuration changes require a host/backend restart.

Direct official MCP reads rely on provider-side guardrails. Keep these controls
layered with Splunk role-level controls such as
`srchJobsQuota`, `cumulativeSrchJobsQuota`, `srchDiskQuota`, `srchMaxTime`, and
allowed/disallowed indexes; the MCP server does not modify Splunk
authorization. Result limits and the 20,000-character budget control returned
data, not the amount of work Splunk performs.

Legacy REST credentials, planner, lookup, query-policy, and resource-admission
settings are ignored. Readiness requires the official MCP endpoint and token;
REST-only deployments must configure both before Splunk tools are available.

Customer report generation is packaged separately as
[`dsh-soc-agent-reports`](../../../packages/soc-agent-reports/README.md).
Save customer email account/folder or label settings under **Settings → Customer reports**.
`generate_customer_report` resolves the authenticated user's saved profile, reads
the period's mail using the existing Zimbra service, validates canonical JSON,
and invokes that plugin. A successful result provides Excel and PDF download
links in the session. Missing settings, inaccessible mail, malformed evidence,
rendering failures, and failed artifact publication return explicit errors.
The parser uses deterministic field extraction and explicit customer verdicts.

Configure `REPORT_SPLUNK_*` rendering variables in `.env`; they are independent
of the official Splunk MCP bridge. Install the browser once with
`uv run playwright install chromium`, or configure `REPORT_CHROME_BINARY`.
The report profile and artifact registry migration is applied by the existing
PostgreSQL migration runner. Report profiles are encrypted and owned by the user;
downloads check both user and session ownership.

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
