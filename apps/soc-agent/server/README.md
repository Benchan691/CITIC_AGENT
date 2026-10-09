# SOC MCP server

Python MCP backend for Zimbra, spreadsheet analysis and subscription tools used by the SOC Agent.
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
The retired Python Splunk APIs and REST fallback are no longer shipped. No
Splunk write tool or REST mutation method is exposed to the SOC Agent.

Remove either official MCP setting and restart the host to disable the direct
bridge. The `soc_agent` MCP server continues to expose Zimbra, spreadsheet and
subscription tools.

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
spreadsheet analysis for XLSX, XLS and CSV, and MarkItDown-based document
conversion for PDF, Word, PowerPoint, images, ZIP, EPUB, JSON, XML, HTML and
text files. Attached RFC822/EML messages are read from their text parts without
resolving remote HTML images. Attachment hashes and verified reversible
message moves are supported. Body-
embedded CID/content-location images are omitted from normal attachment
metadata, and conversion-only failures are reported as skipped attachment
results so other message content can still be read. The authenticated email
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

## Spreadsheet attachments

Composer uploads and `zimbra_get_attachment_text` route XLSX, XLS and CSV to
the pinned [jwadow/mcp-excel](https://github.com/jwadow/mcp-excel) engine inside
the existing authenticated MCP server. CSV support and the private file-ID
wrapper are local adapters. No additional MCP server configuration is needed.
The dependency is pinned to `eb088c5edd5335c67ffc14e521be607a46d49b2a` and
uses the upstream AGPL-3.0-or-later license.

The model receives a short manifest with a `file_id`, filename, hash and sheet
names. It does not receive the full spreadsheet as Markdown. Tool descriptions
and the manifest guide it to inspect headers, calculate on the full original
file, and request only a small evidence sample:

| Tool | Fields and purpose |
| --- | --- |
| `excel_inspect` | `file_id`, optional `sheet_name`, `header_row`; list sheets or inspect columns/types and up to 3 sample rows |
| `excel_profile` | `file_id`, `sheet_name`, `columns`, optional `top_n`, `header_row`; null/distinct counts, statistics and top values |
| `excel_count` | `file_id`, `sheet_name`, optional `filters`, `logic`, `header_row`; count all matching rows |
| `excel_aggregate` | same filtering fields plus `operation`, `target_column`; full-file calculation |
| `excel_group` | same filtering fields plus `group_columns`, `agg_column`, `agg_operation`; grouped calculation |
| `excel_rows` | same filtering fields plus required `columns`, optional `limit`, `offset`; bounded selected rows |

Header rows are zero-based; inspect and verify them before calculations. CSV
has one sheet named `CSV`. Aggregations support sum, mean, median, min, max,
std, var and count. Aggregate/group count counts non-empty selected values;
`excel_count` counts rows. Rows with empty grouping keys are excluded. Mixed
non-numeric columns return an explicit error instead of silently dropping
values. Undefined aggregate statistics return an insufficient-data error.

Filters use `column`, `operator`, `value` (or `values` for membership), and
optional `negate`. Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `in`, `not_in`,
`contains`, `startswith`, `endswith`, `is_null`, `is_not_null`. Combine up to
32 simple filters with AND/OR. Regex and nested filters are unavailable.

MarkItDown continues to process other supported documents. If a spreadsheet
was previously converted to Markdown, retrieve the original email attachment
again or reattach the original upload; use its new file ID for calculations.
Do not calculate from a truncated Markdown excerpt or page through the whole
file. File contents remain untrusted evidence, not instructions. The guidance
is in MCP descriptions and attachment manifests, not `AGENTS.md`.

Files are stored under `.data/spreadsheets` with private permissions and are
scoped to the authenticated user, chat and host-provided customer context.
Tools accept file IDs, never arbitrary paths or user identities. IDs expire
after 24 hours; expired files are removed on the next upload in that scope.
Metadata and original bytes survive an application restart until expiry.

Limits: 10 MB per file, 200,000 rows, 200 columns, 2 million total workbook
cells, 32 sheets; 20 files/100 MB per chat. Results are at most 12 KB. Row
samples are at most 50 rows/10 selected columns. Large inspection samples are
omitted while keeping the schema. CSV supports UTF-8/UTF-16, comma, semicolon,
tab or pipe delimiters and quoted newlines. Text identifiers retain leading
zeros and literal `NA` values. Formulas are not recalculated; Excel reads their
saved values. Password-protected workbooks must be unlocked first.

After copying these changes to another server, refresh dependencies/builds
with `./setup.sh --plugins` from the repository root and restart the web app.
