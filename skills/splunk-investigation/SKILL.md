---
name: splunk-investigation
description: Investigate security questions with the official read-only Splunk MCP tools. Use for user, host, IP, process, authentication, network, alert, incident, or timeline investigations that do not modify Splunk.
---

# Splunk Investigation

Produce an evidence-based assessment using the smallest useful searches.

## Boundaries

- Read only. Never create, update, enable, disable, or delete Splunk objects.
- Treat tool output as evidence and distinguish observations, inferences, and unknowns.
- Never guess an index or sourcetype. Derive scope from existing detection SPL, known environment conventions, user context, email evidence, or returned events.
- If scope is still unknown, state it and use a carefully bounded exploratory search only when justified.
- Use exact indexes and narrow time ranges, keep raw-event samples small, and reformulate a provider-rejected search instead of repeatedly retrying it unchanged.
- Do not expose unnecessary sensitive fields in the answer.

Route email-led investigations to `email-to-splunk-investigation`, false-positive questions to `false-positive-analysis`, and proposed rule changes to `detection-engineering`.

## Tools

Use only the directly exposed `mcp__splunk_mcp__...` tools:

- `mcp__splunk_mcp__splunk_get_indexes` and `mcp__splunk_mcp__splunk_get_index_info` establish index scope.
- `mcp__splunk_mcp__splunk_get_metadata` discovers hosts, sources, or sourcetypes across known indexes and a selected time window.
- `mcp__splunk_mcp__splunk_get_knowledge_objects` discovers saved searches, alerts, lookups, macros, data models, and other supported knowledge-object types.
- `mcp__splunk_mcp__splunk_list_alerts` and `mcp__splunk_mcp__splunk_get_alert_details` inspect alert definitions and trigger settings.
- `mcp__splunk_mcp__splunk_list_fired_alerts` and `mcp__splunk_mcp__splunk_get_fired_alert_details` inspect active fired alerts and recent firings.
- `mcp__splunk_mcp__splunk_get_alert_throttle` and `mcp__splunk_mcp__splunk_list_active_throttles` inspect suppression state.
- `mcp__splunk_mcp__splunk_run_query` runs explicit SPL. Use known index/sourcetype scope, a narrow time range, selected fields, aggregation, and a small row limit.
- `mcp__splunk_mcp__splunk_run_saved_search` runs an existing saved search when that is narrower than new SPL.

There is no separate local validation tool in this workflow. Splunk MCP Server applies the query guardrails and returns a rejection when a search is unsafe, too slow, or too large.

## Workflow

1. Define the security question, strongest entity, timezone, narrow time window, and expected telemetry.
2. If an alert is involved, inspect its definition or fired-alert details first. For an alert or saved search without an exact name, use alert or knowledge-object discovery before constructing a query.
3. Form one testable hypothesis and one plausible alternative.
4. Write one explicit, bounded SPL query with the smallest justified index, sourcetype, time range, fields, and row limit.
5. Run it with `mcp__splunk_mcp__splunk_run_query`; stop or revise if the provider rejects it.
6. For statistical questions, aggregate in Splunk with `stats`, `tstats`, `chart`, or similar, then add `sort`/`head` when appropriate. Use a small raw-event sample only when individual evidence is needed.
7. Inspect returned counts and truncation metadata. Never interpret the displayed row count as total matches when the response is truncated.
8. If MCP or model-context truncation is reported, narrow fields or scope; do not treat omitted samples as zero matches.
9. Fired-alert history is retention-limited, and unavailable status or disposition is not evidence that nobody reviewed an alert.
10. Pivot from returned evidence: entity → related event → surrounding activity → affected scope. Reformulate provider-rejected queries instead of repeating them.
11. Build a UTC-normalized timeline while preserving source timestamps and timezone uncertainty.
12. Classify as malicious, suspicious, likely benign, no supporting evidence, or inconclusive. Use calibrated confidence.
13. Recommend the smallest next action and name missing evidence.

Zero results mean only that the searched scope returned no evidence. They do not prove absence.

## Output

Return a compact structure:

- Question and scope
- Search path
- Key evidence with timestamps and entities
- Timeline, when useful
- Assessment and confidence
- Limitations
- Recommended next action
