# Official Splunk MCP read-only integration

The SOC host connects directly to Splunk MCP Server 2.0 over Streamable HTTP
when both `SPLUNK_MCP_ENDPOINT` and `SPLUNK_TOKEN` are configured. The bridge
forwards the bearer token and publishes allowlisted tools under the
`mcp__splunk_official__...` namespace.

## Exposed official tools

- SPL query execution
- Splunk instance, index, and metadata reads
- knowledge objects and saved-search execution
- alert, fired-alert, and throttle reads

Tool discovery is filtered by exact raw name before registration. Tools from
Splunk AI Assistant, Observability, user administration, custom extensions, or
unknown future additions are not exposed automatically.

## Safety boundary

Official Splunk tools are read-only in the harness and never require harness
approval. Their SPL safety and 1,000-event response guardrails are enforced by
Splunk MCP Server. The application retains authentication, session/customer
scope metadata, sanitization, evidence boundaries, model-visible output
limits, and transport deadlines.

The local Python MCP server retains read-only SOC workflows and bounded REST
compatibility reads that have no official equivalent, including existing
search-job result reads and the bounded complete-lookup path. Local query and
resource admission remain available only for legacy REST execution; they do
not gate the official MCP path.

There is no application-owned Splunk mutation surface: detection writes,
lookup writes, catalog publication, rollback, write RPCs, and write editor
toolviews are removed. Catalog records and read-only snapshot previews remain.

## Verification

Offline tests cover endpoint/header configuration, exact tool filtering,
schema forwarding, client selection, pagination, truncation, saved-search time
bounds, fallback limits, and policy behavior. No live MCP request should run
unless a valid customer-scoped endpoint and token are available.

Remove either `SPLUNK_MCP_ENDPOINT` or `SPLUNK_TOKEN` and restart the host to
disable the direct bridge.
