---
name: detection-engineering
description: Design, review, validate, backtest, write, or update Splunk detections through controlled tools. Use when investigation evidence should become a new or modified rule.
---

# Detection Engineering

Turn supported evidence into a precise, reviewable detection. A hypothesis alone is not deployment evidence.

## Invariants

- Inspect an existing rule immediately before modifying it; use its fresh fingerprint.
- New and modified rules are always written disabled. MCP never enables a
  detection and has no explicit disable operation.
- Validate before every backtest or write.
- Backtests are bounded samples, not total match counts or proof of production quality.
- Generic saved-search writes do not persist severity, ATT&CK, risk, suppression, or provider-specific action settings.
- If a rule is later activated outside MCP, require a persisted schedule and at least one persisted Splunk alert action.
- Do not invent MITRE mappings, severity, risk objects, or scores.
- Detection draft tools always require harness approval, and a remembered
  approval for a detection tool name is never sufficient. A separate explicit
  Save in the authenticated editor is the only detection write action.

## Tools

- Discover exact names with `splunk_list_saved_searches(name=..., app=..., limit=..., include_spl=false)`.
- Inspect with `splunk_get_detection`.
- Validate locally with `splunk_validate_detection`.
- Compile production CITIC SPL with `splunk_compile_citic_detection`; follow
  the `spl-writing` skill for the required wrapper and field order.
- Test with `splunk_backtest_detection` using a bounded period, result count, and selected fields.
- Stage a disabled draft with `splunk_write_detection` for a new rule or
  `splunk_update_detection(..., expected_fingerprint=...)` for an existing
  rule; these return the complete editor state and do not write yet.
- Let the harness approval complete, review the inline editor, and use its
  explicit Save action. Cancel leaves Splunk unchanged. Save always persists
  the detection disabled.
- If activation or rollback is required, use the separately controlled human
  Splunk process outside MCP.

## CITIC team rule-writing workflow

For a new customer detection:

1. Review the rule catalog and select a rule number not already used in the
   four-digit range `0000`–`9999`. Prefer the managed catalog tools
   (`catalog_list_rules`, then a `catalog_write_rule` draft followed by the
   editor's explicit Save); the published `Ruleset.csv` lookup on Splunk
   remains the source consumers read.
2. Create the corresponding catalog row and fill in its required rule
   information, using the verified `[COMPANY_SHORT] detection alert name`
   convention. New rows stay saved-but-unpublished until an operator runs the
   catalog publish action.
3. Complete the alert configuration checklist below.
4. Write the detection rule through the controlled workflow.

Production detections start with detection logic only. Call
`splunk_compile_citic_detection`; do not hand-write the CITIC wrapper or submit
separate production and backtest SPL. Use the returned `production_spl` for
validation and `splunk_write_detection`/`splunk_update_detection`, and use only
the derived `backtest_spl` for testing.

The required production fields are:

```text
GID
rulename
search=strftime(now(), "%Y%m%d%H%M")
Fix_Ticketnumber
Fix_TriggerTime
Fix_Index
Fix_Source Type
Event_Hostname
Event_Date Time
```

The final top-level stages must be a `table` beginning with
`Fix_Ticketnumber`, `Fix_TriggerTime`, `Fix_Index`, `Fix_Source Type`,
`Event_Hostname`, and `Event_Date Time`, followed by the dynamic `outputcsv`
filename subsearch. Optional fields follow those required fields.
Investigation SPL does not require this wrapper, and backtest SPL must not
contain `outputcsv`.

Every new rule must record:

- Alert type: Scheduled uses `is_scheduled=true`, non-real-time dispatch
  bounds, and a cron expression. Real-time uses `is_scheduled=true`, `rt...`
  for both dispatch bounds, and no cron expression.
- Time range: `dispatch.earliest_time` and `dispatch.latest_time`.
- Cron expression: required for Scheduled alerts.
- Expires: a positive `alert.expires` duration.
- Trigger Conditions: `alert_type`/`counttype`, comparator/`relation`,
  threshold/`quantity`, or a custom `alert_condition`.
- Trigger behavior: `alert.digest_mode=true` once per result set, or `false`
  once per result.
- Throttle: whether `alert.suppress` is enabled and, when enabled, its
  period, fields, and group name as applicable.
- Trigger Actions / When triggered: default Add to Triggered Alerts with
  `alert.track=true` and Log Event with `actions=logevent` plus
  `action.logevent=1`. Record deviations explicitly and add email actions only
  when the rule must email a client.

MCP fixes Log Event parameters to source `$name$`, sourcetype
`ticket_details`, an empty host, and index `ticket_summary`. It generates the
event text from final table fields using `$result.<field>$`, stripping `Fix_`/
`Event_` prefixes and spaces from output keys.

For a client-email rule, append this convention with the assigned rule number
and case prefix:

```spl
... | outputcsv [
    | stats count
    | addinfo
    | eval rulename="RULE_NUMBER"
    | eval search=strftime(now(), "%Y%m%d%H%M")
    | eval casename="CASE_PREFIX"."".search."".rulename
    | return $casename
]
```

`outputcsv` is permitted only in the exact disabled, harness-approved detection
draft. It runs later in Splunk's alert runtime, is never executed or exported
by MCP, must not be used for investigation/backtesting, writes on the local
search head, and is unavailable on Splunk Cloud. Use the supported email
CSV attachment action on Splunk Cloud. Recheck `Ruleset.csv` immediately
before the change; its row and the detection change remain separately
controlled operations.

## Workflow

1. State the behavior, evidence, entities, expected data, match condition, and known benign behavior.
2. Inspect existing or equivalent rules. Request full SPL only for the exact relevant rule.
3. Design base detection logic with stable fields, bounded windows, and only necessary transformations. Prefer `tstats` or accelerated data models when appropriate and actually available.
4. Compile the logic with `splunk_compile_citic_detection`; use its production SPL for validation and write/update, and its derived backtest SPL for testing.
5. Define supported metadata: name, description, time range, schedule, severity, ATT&CK, risk, suppression, alert actions, and `enabled: false`.
6. Validate and resolve errors. Review warnings rather than ignoring them.
7. Backtest on a representative bounded period. Examine the returned sample count and budget, repeated entities, field consistency, noise, suppression need, and performance; the tool does not return a total match count.
8. Iterate design → compile → validate → backtest until the result is defensible or limitations are explicit.
9. Present the exact proposed change and evidence before writing.
10. Create or update a disabled draft and review its complete editor state.
11. Let the harness approve the draft tool call, then Save the inline editor. Verify the persisted detection is disabled; treat returned review-only metadata as unpersisted.
12. If activation or rollback is required, hand off to the separately controlled human Splunk process outside MCP and verify the resulting state with `splunk_get_detection`.
13. If behavior is unsafe or noisy, stop further MCP changes and document the outside-MCP rollback evidence.

## Output

- Objective and supporting evidence
- SPL and metadata
- Validation warnings/errors
- Backtest window, count, samples, and limitations
- Proposed change and rollback plan
- Current state and next approval required
