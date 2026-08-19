---
name: detection-engineering
description: Design and review Splunk detections using validation and backtesting.
---

# Purpose

Turn supported investigation evidence into a reviewable SPL detection change.

# When to use

Use when evidence supports creating, improving, or reviewing a detection rule.

# Workflow

1. Review the investigation evidence and define the detection objective.
2. Draft or improve the SPL and required detection metadata.
3. Validate the draft and backtest it over a bounded historical window.
4. Present expected matches, limitations, and the proposed change for approval.

# Safety and behavior

- Keep new or updated detections disabled until explicitly approved.
- Use the existing Detection tools and host approval path.
- Never bypass policy, write guards, or approval prompts.
- Do not enable a rule based only on assumptions or an unreviewed sample.
