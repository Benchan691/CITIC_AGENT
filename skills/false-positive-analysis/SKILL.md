---
name: false-positive-analysis
description: Determine why a Splunk detection fired, assess malicious versus benign explanations, and propose evidence-based tuning without modifying the rule. Use for noisy, broad, or unexpectedly triggered detections.
---

# False-Positive Analysis

Explain the trigger and determine whether it is malicious, suspicious, likely benign, confirmed benign, or inconclusive. This skill recommends changes but never applies them.

## Boundaries

- Never use detection create, update, enable, or disable tools.
- Familiar users, internal IPs, signed binaries, approved applications, recurring activity, or administrative accounts do not independently prove benign intent.
- Never guess data scope. Start with the existing detection SPL and use carefully bounded exploratory search only if necessary.
- Avoid exclusions based only on broad identity, hostname, process name, path, or network range.

## Tools

1. Discover with `splunk_list_saved_searches(name=..., app=..., limit=..., include_spl=false)` when the exact name is unknown.
2. Retrieve the exact rule with `splunk_get_detection`.
3. Validate supporting SPL with `splunk_validate_query`.
4. Investigate with bounded `splunk_search(..., fields=[...])` or scoped `splunk_run_saved_search`.
5. Evaluate candidate logic with `splunk_validate_detection` and `splunk_backtest_detection`; do not persist it.

## Workflow

1. Identify the alert instance, rule version, trigger time, entities, and exact matching condition.
2. Explain why the current SPL matched this event.
3. Test competing malicious, benign, and data-quality explanations using surrounding telemetry.
4. Compare historical frequency and relevant peers. Distinguish repeatability from legitimacy.
5. Identify the specific benign mechanism, if supported: scheduled automation, deployment, scanner, service account, application behavior, shared infrastructure, threshold issue, or bad data.
6. Classify and assign confidence. Reserve “confirmed false positive” for corroborated benign intent and mechanics.
7. Propose the narrowest stable tuning dimension, ideally combining multiple contextual conditions.
8. Validate and backtest the candidate over a representative bounded period. Compare alert volume and check that suspicious examples remain detectable.
9. Check for overfitting and document the coverage lost by the exclusion.
10. Hand an approved change to `detection-engineering`.

## Output

- Detection and trigger explanation
- Triggering and surrounding evidence
- Competing explanations
- Classification and confidence
- False-positive mechanism
- Proposed tuning and coverage risk
- Validation/backtest result
- Limitations and next action
