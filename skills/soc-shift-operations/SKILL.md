---
name: soc-shift-operations
description: Run bounded SOC shift-start, daily screening, queue prioritization, and analyst handoff across configured Splunk and Zimbra sources. Use for recurring operational coverage, not a single known incident.
---

# SOC Shift Operations

Screen the queue without turning one shift run into an unbounded investigation.

## Scope contract

- Start with `system_get_status`; report and skip unavailable sources.
- Fix the window start/end, timezone, handoff owner, named Splunk saved searches or detections, and named Zimbra account/folder/query.
- Never infer an index, sourcetype, account, or saved-search name.
- Default to at most 20 metadata records per source and three deep investigations per run unless the operator sets different limits.
- Scheduled runs are read-only screening. Route interactive writes to `detection-engineering` or `zimbra-operations`.

## Workflow

1. Record the coverage window and source health.
2. Screen metadata only: saved-search summaries and bounded Zimbra search pages. Retrieve full SPL, bodies, attachments, or events only for selected cases.
3. Normalize timestamps to UTC while preserving source IDs, original time, and timezone.
4. Deduplicate by rule, entity, and a defensible time bucket. Do not merge cases merely because subjects or free text look similar.
5. Prioritize P1, P2, P3, or Needs-context from supported impact and urgency. Missing evidence never makes a case low priority by itself.
6. Investigate only the highest-priority cases, one specialist skill at a time. Stop each case after two evidence-neutral pivots.
7. Defer the remaining queue with the exact next query, owner, or evidence needed.

## Scheduled objective

A reusable schedule prompt must name the window/timezone, account IDs, folders or Zimbra queries, exact saved searches/detections, per-source limits, maximum cases, and handoff owner. Reject a generic “check everything” objective.

## Handoff

- Coverage window and source health
- Queue counts by priority and deduplication summary
- Top cases with IDs, compact timeline, assessment, and confidence
- Actions taken; blocked and unknown items
- Owner/SLA, deferred evidence, and next coverage window
