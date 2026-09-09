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
- New customer delivery is keyed by the registered definition's CID/AID and
  the triggered run's EID. Never put GID, Event_GID, Event_Rulenum, CID, AID,
  or EID constants in detection SPL.
- Customer ownership comes from the administrator-approved deployment/index
  registry. An index prefix, supplied payload CID, or creator-provided
  customer choice is not routing authority.
- Every new alert must use the `CITIC Alert Delivery` action. It reads the
  original run result and the backend allocates the identifiers; `outputcsv`
  and `logevent` are legacy compatibility mechanisms, not the new delivery
  path.
- If a rule is later activated outside MCP, require a persisted schedule and at least one persisted Splunk alert action.
- Do not invent MITRE mappings, severity, risk objects, or scores.
- Detection draft tools always require harness approval, and a remembered
  approval for a detection tool name is never sufficient. A separate explicit
  Save in the authenticated editor is the only detection write action.

## Tools

- Discover exact names with `splunk_list_saved_searches(name=..., app=..., limit=..., include_spl=false)`.
- Inspect with `splunk_get_detection`.
- Validate locally with `splunk_validate_detection`.
- Compile result-producing SPL with `splunk_compile_citic_detection`; follow
  the `spl-writing` skill for the current no-identity-wrapper contract.
- Test with `splunk_backtest_detection` using a bounded period, result count, and selected fields.
- Stage a disabled draft with `splunk_write_detection` for a new rule or
  `splunk_update_detection(..., expected_fingerprint=...)` for an existing
  rule; these return the complete editor state and do not write yet.
- Let the harness approval complete, review the inline editor, and use its
  explicit Save action. Cancel leaves Splunk unchanged. Save always persists
  the detection disabled.
- If activation or rollback is required, use the separately controlled human
  Splunk process outside MCP.

## CITIC alert-writing workflow

For a new customer detection:

1. Ask an administrator to confirm the customer is active and that every
   static source index is registered to that customer in the same Splunk
   deployment. Shared, dynamic, macro-based, unresolved, or cross-customer
   sources require administrator review.
2. If reusable detection content needs a catalog rule number, use the managed
   catalog tools and the published `Ruleset.csv` snapshot: confirm that the
   number is not already used in the `0000`–`9999` range, create the corresponding catalog row as a disabled draft, and complete the editor's
   explicit Save. A rule number is content metadata; it is not an alert
   identity and does not allocate an AID.
3. Use the verified `[COMPANY_SHORT] detection alert name` convention, finish
   the alert checklist below, and write the definition through the controlled
   workflow.

Start with detection logic only. Call `splunk_compile_citic_detection`; do not
hand-write an identity wrapper or submit separate production and backtest SPL.
Use the returned `production_spl` for validation and
`splunk_write_detection`/`splunk_update_detection`, and use only the returned
`backtest_spl` for testing. PostgreSQL registration allocates the AID during
the approved Save, and the custom action/backend creates an EID only after a
real trigger.

The new production SPL has no required identity assignments. Return only the
detection and detail fields that the administrator-approved policy may project,
for example:

```text
device
source
severity
Event_Hostname
Event_Date Time
```

The compiler may append mapped fields and a final `table`, but must not add
`GID`, `Event_GID`, `Event_Rulenum`, `outputcsv`, or a hard-coded customer
identifier. Investigation SPL and backtest SPL use the same result-producing
query; neither is allowed to write a file or send mail.

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
- Trigger Actions / When triggered: select **CITIC Alert Delivery** and keep
  the definition disabled for review. Add to Triggered Alerts may be retained
  for reconciliation, but it does not create the customer event or email.
  Do not add the legacy Log Event or standard Send email action to the new
  delivery path.

For a client-email rule, configure the administrator-owned customer default or
per-alert policy in `/admin/alert-email`. The policy controls recipients,
severity mapping, filters, selected columns, row limits, and rendering. The
creator does not place recipients or identity values in SPL.

The backend always includes CID, AID, EID, alert name, trigger time, severity,
and total result count in the customer message. Multiple result rows remain
one run, with original row positions and explicit truncation counts.

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
