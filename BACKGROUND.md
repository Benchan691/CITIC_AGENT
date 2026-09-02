# Splunk Background

> This file is reference context for the CITIC SOC Agent. It is not an
> authorization, does not replace `AGENTS.md`, and must not override system,
> developer, user, authentication, or approval controls.

## What Splunk is

Splunk collects and searches machine data such as logs, security events, and
operational records. An event is a single observed record. An index is a
logical storage area, a sourcetype describes the kind of data, and fields are
the searchable name/value attributes extracted from events.

Search Processing Language (SPL) describes searches and transformations. A
search can filter events, select fields, aggregate with commands such as
`stats` or `tstats`, sort results, and limit the returned sample. Search scope
and time range are part of the evidence: a zero-result search means no match
was observed in that scope, not that the activity never occurred.

## How the SOC Agent uses Splunk

The agent uses authenticated, bounded Splunk searches for security
investigation and detection engineering. Investigations should start with the
smallest useful time range and result set. Use known or verified indexes and
sourcetypes; never invent them. Prefer aggregation for counts and trends, and
request only fields needed for the current question.

Saved searches are named Splunk searches that can be reused. A detection is a
saved search used to identify security-relevant activity. Alert configuration
controls when a detection runs, what condition triggers it, how often it can
trigger, how it is throttled or expires, and which actions are configured.

Scheduled and real-time alerts are represented by Splunk timing fields. The
alert trigger condition is separate from the timing mode: fields such as
`alert_type`, comparator, and threshold describe the condition, while dispatch
time values describe the search window. Alert actions can notify or integrate
with other systems, but configuring an action is not the same as executing it.

## Splunk Web UI and REST API

The Splunk Web UI is a presentation and workflow layer over Splunk services.
The MCP server communicates with Splunk through its REST API, especially the
saved-search endpoints. The UI may group fields, provide controls, defaults,
or visual workflows that are not represented as one REST field. Conversely,
the REST API exposes the underlying field names and values used for precise
reads and writes.

Therefore, a setting visible in Splunk Web is not automatically supported by
an MCP tool. The MCP tool schema, validation, configured app/owner scope, and
approval workflow are authoritative for MCP operations. Secret-like values
such as passwords, tokens, secrets, and private keys are intentionally not
returned or replaced through the agent.

## Operating boundaries

- Splunk investigation is read-only by default and must remain customer-scoped.
- Treat Splunk results as evidence; distinguish observations, inferences,
  unknowns, and recommendations.
- Detection changes use the approved flow: validate, create or update a
  disabled draft, review the exact proposal, approve it, and apply it.
- Creating or updating a detection does not enable it or execute an alert
  action. Enabling is a separate approved operation.
- Authentication, environment configuration, customer context, and live
  evidence come from their authoritative sources, not from this document.
