# Customer reports for DSH

`dsh-soc-agent-reports` packages the existing report renderer, customer settings,
and session downloads. The Python package `soc-agent-reports` owns parsing,
canonical JSON validation, Excel generation, HTML, and Splunk dashboard printing.
The MCP backend looks up configuration, retrieves authenticated Zimbra messages,
invokes the plugin, and registers the completed Excel/PDF pair.

## Use in CITIC_AGENT

1. Sign in with Zimbra and open **Settings → Customer reports**.
2. Add a customer and set the email account, folder or label, dashboard template,
   and Security News folder or label. Save the configuration.
3. Ask for that customer's report and reporting period. For example:
   “Generate the 50238 report for July 2026.”
4. After successful generation, download **Excel** and **PDF** from the report
   tool result in the session panel.

The configured email account must match the signed-in Zimbra account. Folder
paths begin with `/`; labels use their exact names. Credentials and server paths
are deployment settings and cannot be supplied in a customer profile.
Report generation uses the existing Harness approval policy because the PDF
renderer creates and removes a temporary Splunk dashboard.

The tool accepts this bounded request:

```json
{
  "customer_id": "50238",
  "period_start": "2026-07-01",
  "period_end": "2026-07-31"
}
```

If both dates are omitted, the preceding calendar month in Hong Kong is used.
`reported_security_incidents` is an optional non-negative confirmed incident
count; it is separate from the number of notification cases.

## Customer configuration

Profiles are encrypted in the existing PostgreSQL store and belong to the
authenticated user. The settings form edits the common fields and provides a
JSON editor for advanced configuration:

```json
{
  "customer_id": "50238",
  "display_name": "Customer 50238",
  "report_id": "50238",
  "company_name": "Customer 50238",
  "email": {
    "account": "analyst@example.com",
    "scope_type": "folder",
    "scope": "/Customers/50238",
    "include_subfolders": false
  },
  "customer_senders": ["customer@example.com"],
  "report": {
    "template": {"owner": "nobody", "app": "search", "view": "monthly_report_50238"},
    "output_stem": "G50238 TrustCSI MSS Monthly Report {month} {year}"
  },
  "news": {
    "scope_type": "folder",
    "scope": "/Security News",
    "source_labels": ["Source collection", "来源集合"],
    "source_terms": ["hkcert"],
    "scan_limit": 500
  },
  "extensions": {}
}
```

Set `scope_type` to `label` to use a Zimbra tag. `extensions` reserves bounded,
JSON-compatible customer options for later additions. Optional
`report.executive_summary_html` and `report.security_analysis_html` accept
customer-edited HTML content; the renderer validates and sanitizes it.

The parser extracts the existing notification fields (case number, case name,
severity, and incident time), deduplicates cases, and creates the canonical
`report_id`, `cases`, and optional narrative/count fields. Case rows use
`RuleName_EN`, `Severity`, `TicketTime`, `Ticketnumber`, `Status`, and `Reason`.
Only configured `customer_senders` can supply customer verdicts. Explicit true
positive or false positive replies become a brief remark of about 20 words;
missing verdicts remain Pending. Malformed expected notifications and truncated
bodies stop generation. Unrelated mail and excluded severities are reported
in warnings. No LLM is used to parse or generate report content.

Default report sections use We/our language, at most three analysis themes,
and no more than six incidents per table. All cases remain in the Excel output
and complete incident listings.

## Deployment and registration

Run the repository's existing `./setup.sh --plugins` workflow. It builds and
registers the report package along with the SOC bundle. The MCP server's local
Python dependency installs the same report engine from this package.

In `apps/soc-agent/server/.env`, configure:

```dotenv
REPORT_SPLUNK_BASE_URL=https://splunk.example.com:8089
REPORT_SPLUNK_USERNAME=
REPORT_SPLUNK_PASSWORD=
REPORT_SPLUNK_VERIFY_TLS=true
REPORT_SPLUNK_WEB_BASE_URL=https://splunk.example.com:8000
REPORT_PDF_WAIT_SECONDS=180
REPORT_PDF_STABLE_SECONDS=45
REPORT_PDF_SETTLE_SECONDS=20
```

The report service identity needs access to the configured dashboard and
permission to create and delete temporary dashboards. Install managed Chromium
with `uv run playwright install chromium` from the server directory, or set
`REPORT_CHROME_BINARY` to a trusted installed Chrome executable. Zimbra login,
PostgreSQL, and encryption settings use the existing server configuration.

The existing migration runner installs the report profile and artifact tables.
Outputs are stored under the server-owned `.data/reports` tree. Model/tool
arguments never select output paths. Authenticated downloads authorize the
artifact registry entry against both the user and the originating session.
Only a completed Excel/PDF pair is published.

## Reuse the renderer

Import `generate_report`, `SecurityNewsArticle`, `ReportResult`, and
`ReportGenerationError` from `soc_agent_reports`. Call
`generate_report(input_data, output_dir, configuration=..., period_start=...,
period_end=..., environment=..., security_news=...)` with canonical JSON,
trusted renderer configuration, and a news article already retrieved under an
authenticated identity. It returns paths to the generated `.xlsx` and `.pdf`.
The API has no CLI folder scanner, local environment file loader, or mailbox
credential lookup.

## Failures and verification

Missing customer/backend configuration, account mismatch, inaccessible folders,
no matching mail, malformed or truncated messages, invalid JSON, missing news,
Excel/PDF failures, temporary-dashboard cleanup failures, and artifact
publication failures return explicit error codes. Critical failures never
publish a partial report. Download links may only be opened by their owning
user in their owning session.

Run Python tests from the server with `uv run pytest` and
`uv run python -m unittest discover -s ../../../packages/soc-agent-reports/python/tests`.
Run package tests/build with `pnpm --filter dsh-soc-agent-reports test` and
`pnpm --filter dsh-soc-agent-reports build` from `vendor/deepseek-harness`.
