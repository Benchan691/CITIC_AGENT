---
name: false-positive-analysis
description: Analyze detection triggers and recommend evidence-based tuning.
---

# Purpose

Explain why a detection triggered and identify useful tuning conditions.

# When to use

Use when a detection result may be benign, noisy, or unexpectedly broad.

# Workflow

1. Inspect the triggering event and the detection definition.
2. Compare it with surrounding Splunk evidence and related activity.
3. Identify repeatable benign patterns and safe narrowing conditions.
4. Recommend tuning with evidence, confidence, and remaining uncertainty.

# Safety and behavior

- Keep evidence separate from assumptions and hypotheses.
- Recommend tuning rather than silently suppressing activity.
- Do not change, disable, or enable detections in this workflow.
- Preserve suspicious indicators until evidence supports a conclusion.
