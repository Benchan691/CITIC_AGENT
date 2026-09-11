---
name: detection-engineering
description: Design, review, validate, and backtest Splunk detections using read-only tools. Use when investigation evidence should become a proposed new or modified rule.
---

# Detection Engineering

Turn supported evidence into a precise, reviewable detection. A hypothesis alone is not deployment evidence.

## Invariants

- Inspect an existing rule immediately before proposing a modification.
- MCP never creates, updates, enables, disables, or rolls back a detection.
- Validate before every backtest or handoff.
- Backtests are bounded samples, not total match counts or proof of production quality.
- Generic saved-search writes do not persist severity, ATT&CK, risk, suppression, or provider-specific action settings.
- Activation timing is outside this application; require at least one persisted Splunk alert action before an external operator activates a rule.
- Do not invent MITRE mappings, severity, risk objects, or scores.
- Any deployment must occur through a separately controlled human Splunk
  process outside this application.

## Tools

- Discover exact names with `splunk_list_saved_searches(name=..., app=..., limit=..., include_spl=false)`.
- Inspect with `splunk_get_detection`.
- Validate locally with `splunk_validate_detection`.
- Compile production CITIC SPL with `splunk_compile_citic_detection`; follow
  the `spl-writing` skill for the required wrapper and field order.
- Test with `splunk_backtest_detection` using a bounded period, result count, and selected fields.
- Produce a concise reviewed handoff containing the validated definition,
  backtest evidence, limitations, and recommended deployment settings.
- Use a separately controlled human Splunk process for creation, changes,
  activation, rollback, or removal.

## CITIC team rule-writing workflow

For a new customer detection:

1. Read the current `Ruleset.csv` lookup and select a rule number not already used
   in the four-digit range `0000`–`9999`. This check is read-only.
2. Hand the required catalog maintenance to the external human process, using
   the verified `[COMPANY_SHORT] detection alert name` convention. Do not claim
   the rule number is reserved until that process confirms it.
3. Complete the alert configuration checklist below.
4. Prepare the validated rule for the separately controlled deployment process.

Production detections start with detection logic only. Call
`splunk_compile_citic_detection`; do not hand-write the CITIC wrapper or submit
separate production and backtest SPL. Use the returned `production_spl` for
validation and the external deployment handoff, and use only the derived
`backtest_spl` for testing.

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

- Time range: `dispatch.earliest_time` and `dispatch.latest_time`.
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

`outputcsv` is permitted only in the exact disabled, externally reviewed
detection definition. It runs later in Splunk's alert runtime, is never
executed or exported by MCP, must not be used for investigation/backtesting, writes on the local
search head, and is unavailable on Splunk Cloud. Use the supported email
CSV attachment action on Splunk Cloud. Recheck `Ruleset.csv` immediately
before the change; its row and the detection change remain separately
controlled operations.

## Workflow

1. State the behavior, evidence, entities, expected data, match condition, and known benign behavior.
2. Inspect existing or equivalent rules. Request full SPL only for the exact relevant rule.
3. Design base detection logic with stable fields, bounded windows, and only necessary transformations. Prefer `tstats` or accelerated data models when appropriate and actually available.
4. Compile the logic with `splunk_compile_citic_detection`; use its production SPL for validation and external handoff, and its derived backtest SPL for testing.
5. Define supported metadata: name, description, bounded time range, severity, ATT&CK, risk, suppression, alert actions, and `enabled: false`. Do not include schedule or real-time activation fields; the application ignores them.
6. Validate and resolve errors. Review warnings rather than ignoring them.
7. Backtest on a representative bounded period. Examine the returned sample count and budget, repeated entities, field consistency, noise, suppression need, and performance; the tool does not return a total match count.
8. Iterate design → compile → validate → backtest until the result is defensible or limitations are explicit.
9. Present the exact proposed change and evidence before handoff.
10. Hand off the disabled-by-default validated definition and the required
    `Ruleset.csv` maintenance to the separately controlled human process.
11. After the operator deploys it, verify the resulting state with
    `splunk_get_detection`.
12. If behavior is unsafe or noisy, stop and document the outside-MCP rollback
    recommendation and any independently verified rollback evidence.

## Output

- Objective and supporting evidence
- SPL and metadata
- Validation warnings/errors
- Backtest window, count, samples, and limitations
- Proposed change and rollback plan
- Current state and next approval required
