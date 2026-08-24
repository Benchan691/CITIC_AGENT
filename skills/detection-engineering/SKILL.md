---
name: detection-engineering
description: Design, review, validate, backtest, stage, enable, or disable Splunk detections through controlled tools. Use when investigation evidence should become a new or modified rule.
---

# Detection Engineering

Turn supported evidence into a precise, reviewable detection. A hypothesis alone is not deployment evidence.

## Invariants

- Inspect an existing rule immediately before modifying, enabling, or disabling it; use its fresh fingerprint.
- New and modified rules remain disabled until separately reviewed and approved.
- Validate before every backtest or write.
- Backtests are bounded samples, not total match counts or proof of production quality.
- Generic saved-search writes do not persist severity, ATT&CK, risk, suppression, or provider-specific action settings.
- Never enable a rule without a persisted schedule and at least one persisted Splunk alert action.
- Do not invent MITRE mappings, severity, risk objects, or scores.
- All writes follow the harness approval gate.

## Tools

- Discover exact names with `splunk_list_saved_searches(name=..., app=..., limit=..., include_spl=false)`.
- Inspect with `splunk_get_detection`.
- Validate locally with `splunk_validate_detection`.
- Test with `splunk_backtest_detection` using a bounded period, result count, and selected fields.
- Stage with `splunk_create_detection_draft` or `splunk_update_detection_draft(..., expected_fingerprint=...)`.
- Use `splunk_enable_detection` only after explicit review and approval.
- Use `splunk_disable_detection` for a reversible rollback.

## Workflow

1. State the behavior, evidence, entities, expected data, match condition, and known benign behavior.
2. Inspect existing or equivalent rules. Request full SPL only for the exact relevant rule.
3. Design scoped SPL with stable fields, bounded windows, and only necessary transformations. Prefer `tstats` or accelerated data models when appropriate and actually available.
4. Define supported metadata: name, description, time range, schedule, severity, ATT&CK, risk, suppression, and `enabled: false`.
5. Validate and resolve errors. Review warnings rather than ignoring them.
6. Backtest on a representative bounded period. Examine the returned sample count and budget, repeated entities, field consistency, noise, suppression need, and performance; the tool does not return a total match count.
7. Iterate design → validate → backtest until the result is defensible or limitations are explicit.
8. Present the exact proposed change and evidence before writing.
9. Create or update a disabled draft through approval. Treat returned review-only metadata as unpersisted.
10. For a new draft, configure and re-read the required Splunk alert action outside this generic tool before activation.
11. Enable only through a second, explicit approval with the fresh fingerprint. Verify resulting state.
12. If behavior is unsafe or noisy, re-read, disable with the fresh fingerprint, and document rollback evidence.

## Output

- Objective and supporting evidence
- SPL and metadata
- Validation warnings/errors
- Backtest window, count, samples, and limitations
- Proposed change and rollback plan
- Current state and next approval required
