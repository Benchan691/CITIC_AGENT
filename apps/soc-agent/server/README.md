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

Authenticated UI operations (detection saves, catalog edits, publication,
email) run through a persistent Python control channel
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
Fix Source type) with their audit history and publication records; it is not a
service-configuration source. Catalog records are edited through the
authenticated editor workflow. The official Splunk MCP server currently
exposes no mutation tool, so lookup publication remains unavailable until an
upstream MCP write tool is provided. The
`/admin` console shows service status and manages LLM provider credentials, but
does not expose or edit deployment variables.
Customer Information uses `gid` as the single tenant identifier; older catalog
rows with a separate `tenant_number` are consolidated automatically when the
catalog store starts.

Splunk uses only the official Splunk MCP Server. Configure the endpoint and the
MCP bearer token in the ignored `.env` file, for example:

```dotenv
SPLUNK_MCP_ENDPOINT=https://splunk.example:8000/en-US/splunkd/__raw/services/mcp
SPLUNK_TOKEN=
SPLUNK_ALLOW_INSECURE_HTTP=false
```

The adapter routes searches, index and metadata discovery, sourcetypes,
knowledge objects, saved-search execution, lookup reads, and fired-alert reads
through MCP. The existing query policy, resource admission, evidence
retention, customer isolation, sanitization, and approval flow remain in the
CITIC server. Splunk MCP Server 2.0 currently exposes read-only tools, so
lookup and detection writes are unavailable until the upstream MCP server
provides write tools.

Manual fired-alert ingestion is available after the alert-ingestion migration
has been applied:

```bash
uv run python -m unified_mcp_server.alert_ingest --limit 100 --dry-run
uv run python -m unified_mcp_server.alert_ingest --limit 100
```

The command reads fired-alert metadata and `Event_GID`/`Event_Rulenum` fields
returned in the MCP alert payload. It stores alert
metadata in PostgreSQL, skips duplicates, and quarantines alerts whose mapping
is missing or ambiguous. It never dispatches searches or writes to Splunk.

For live ingestion, enable the backend worker in the server environment:

```dotenv
ALERT_INGEST_ENABLED=true
ALERT_INGEST_INTERVAL_SECONDS=60
ALERT_INGEST_LIMIT=100
ALERT_INGEST_MAX_BACKOFF_SECONDS=300
```

The worker runs once at backend startup and then at the configured interval. A
PostgreSQL advisory lock prevents a second backend process from polling at the
same time. It retries transient failures with bounded backoff, rechecks
unresolved quarantine rows, and records counters in `sec_alert_ingestion_status`.
It only reads Splunk MCP results; all database inserts and quarantine decisions
happen in the application backend.

Automatic alert email uses the PostgreSQL outbox and a separate SMTP worker.
Apply migration 013 after 012 with sending stopped and `ALERT_EMAIL_ENABLED=false`.
Migration 013 disables existing rules and queued historical deliveries. Applied
migration 012 is unchanged. Review routes before enabling them, then restart the
backend with the following environment configuration:

```dotenv
ALERT_EMAIL_ENABLED=false
ALERT_SMTP_HOST=
ALERT_SMTP_PORT=25
ALERT_SMTP_TLS=starttls
ALERT_EMAIL_FROM=
ALERT_EMAIL_USERNAME=
ALERT_EMAIL_PASSWORD=
ALERT_EMAIL_INTERVAL_SECONDS=5
ALERT_EMAIL_BATCH_SIZE=25
```

`ALERT_SMTP_TLS` accepts `none`, `starttls`, or `ssl`. Authentication is optional;
username/password must be supplied together. The supplied legacy scripts use
`mail01.trustcsi.com:25` without TLS/authentication. Its current connection requirements
have not been confirmed; obtain those before setting the host and enabling live sends.
No live message is needed to validate rendering or the local SMTP test sink.
Interactive user-controlled Zimbra email is unchanged.

Administrators use `/admin/alert-email` for customer defaults (`recipients`, `cc`,
`bcc`, `language`: EN/CN/ZH, `brand`: CPC/CEC), source types, IP/subnet/range and
hostname filters, recipient overrides, preview and delivery history. Filter categories
are AND, values within each category are OR; missing filter data does not match.
Overrides require an explicit customer. All matching routes are combined, with BCC
visibility preserved and duplicate addresses removed. Global rules use each event's
own customer defaults. Ruleset localized email content is stored as
`rulesets.email_content = {"EN":{"description":"...","remediation":"..."}}`;
the rule template summary is a fallback description. No raw logs are copied.

CSV preview requires selecting the exact customer and exact PostgreSQL source-type
names. Supported headers are `gid` (optional, must match selected customer),
`source_type`, `severity`, `ip1`, `ip2`, `hostname`, `recipients`, `cc`, `bcc`.
Unknown mappings remain unapplied. Previewed rows require an explicit Save and
are saved disabled. Legacy IP-or-hostname conditions become two equivalent routes.
Customer Python modules, Remedy and event-supplied recipients are not executed.

Each new event has at most one outbox row. Disabled rules do not queue historical
mail. SMTP acceptance is recorded separately from mailbox delivery, which is
unconfirmed. Partial failures retain accepted recipients and retry only temporary
refusals; permanent failures have no retry timestamp. Interrupted sends and database
acknowledgement failures require operator review, including after restart. Do not
manually requeue uncertain rows without checking the relay delivery records.

Standalone MCP clients should set `cwd` to this directory and pass `MCP_SERVER_ROOT` when workspace data lives elsewhere (for example the repository root `.data/` directory). The former misspelling `MCP_SEVER_ROOT` remains accepted for compatibility.

Splunk event outputs keep complete events within a 20,000-character budget and
report truncation explicitly; request selected `fields` when narrowing is
needed. Zimbra supports bounded metadata/body pagination, header-only evidence,
MarkItDown-based attachment-to-Markdown conversion for PDF, Word, PowerPoint,
Excel, images, ZIP, EPUB, CSV, JSON, XML, HTML, and text files; attachment
hashes; and verified reversible message moves. The authenticated email
webserver exposes subscription listing, preview, creation, updates, and
deletion. Sends, moves, folders, filters, detection changes, and subscription
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
transient Splunk MCP read failures receive one retry. Zimbra blocking calls retain
their admission slots until their worker exits, even if a caller cancels; each
SOAP request checks the remaining deadline. PostgreSQL pooling defaults on,
with up to four connections per store, a five-second connection/pool wait and
a 15-second statement timeout. `APP_POSTGRES_POOL=false` restores per-call
connections. Deployment configuration changes require a host/backend restart.

See the [implementation and validation report](../../../docs/PERFORMANCE_REDESIGN_IMPLEMENTATION.md)
for measured offline results, remaining work and rollout steps.

Persistent CSV lookups can be read with the official MCP knowledge-object and
query tools. The authenticated editor can still validate and stage drafts, but
the final remote Save or Delete is unavailable because the official MCP server
does not expose lookup mutation tools. Keep the app/owner scope fixed in
`SPLUNK_LOOKUP_APP` and `SPLUNK_LOOKUP_OWNER`.

Search resource settings limit admission, lookback, runtime, concurrency,
dispatch rate, and weighted query budget before a Splunk job is created. Keep
these MCP limits layered with Splunk role-level controls such as
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
