---
name: splunk-investigation
description: Investigate security questions with guarded, read-only Splunk searches. Use for user, host, IP, process, authentication, network, alert, incident, or timeline investigations that do not modify Splunk.
---

# Splunk Investigation

Produce an evidence-based assessment using the smallest useful searches.

## Boundaries

- Read only. Never create, update, enable, disable, or delete Splunk objects.
- Treat tool output as evidence and distinguish observations, inferences, and unknowns.
- Never guess an index or sourcetype. Derive scope from existing detection SPL, known environment conventions, user context, email evidence, or returned events.
- If scope is still unknown, state it and use a carefully bounded exploratory search only when justified.
- Do not expose unnecessary sensitive fields in the answer.

Route email-led investigations to `email-to-splunk-investigation`, false-positive questions to `false-positive-analysis`, and proposed rule changes to `detection-engineering`.

## Tools

- `splunk_list_saved_searches(name=..., app=..., limit=..., include_spl=false)` discovers bounded summaries. Request `include_spl=true` only when the query is required.
- `splunk_get_detection` retrieves an exact rule definition.
- `splunk_validate_query` validates new SPL before execution.
- `splunk_search(..., fields=[...])` runs bounded SPL. Select only fields needed for the current question.
- `splunk_run_saved_search(..., max_count=..., app=..., owner=...)` runs an existing scoped search with actions disabled.
- `splunk_find_lookup` and `splunk_list_lookups` inspect lookup metadata; they do not expose lookup contents.

## Workflow

1. Define the security question, strongest entity, timezone, narrow time window, and expected telemetry.
2. If an alert or saved search is involved, use filtered alert discovery and inspect its existing detection SPL before constructing a query.
3. Form one testable hypothesis and one plausible alternative.
4. Build a scoped query that answers one question. Avoid unbounded wildcards, joins, transactions, broad subsearches, and raw-field output unless necessary.
5. Validate the query. Stop or revise if blocked.
6. Search with a small `max_count` and explicit `fields`. Increase either only when evidence requires it.
7. If the event budget reports truncation, narrow `fields` or scope; do not treat omitted samples as zero matches.
8. Pivot from returned evidence: entity → related event → surrounding activity → affected scope. Validate every new query.
9. Build a UTC-normalized timeline while preserving source timestamps and timezone uncertainty.
10. Classify as malicious, suspicious, likely benign, no supporting evidence, or inconclusive. Use calibrated confidence.
11. Recommend the smallest next action and name missing evidence.

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
