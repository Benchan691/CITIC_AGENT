---
name: detection-engineering
description: Design, review, validate, backtest, and safely stage Splunk detection rules from supported investigation evidence. Use when creating a new detection, improving an existing saved search, reviewing detection quality, or preparing a rule for controlled deployment.
---

# Purpose

Turn supported security evidence into a precise, reviewable, and tested Splunk detection.

This skill covers the detection lifecycle:

evidence
→ detection objective
→ SPL design
→ validation
→ backtesting
→ review
→ disabled draft
→ explicit approval
→ enablement

Do not treat an investigation hypothesis as sufficient evidence for deploying a detection.

# When to use

Use this skill when the task involves:

- creating a new Splunk detection rule;
- improving or tuning an existing detection;
- reviewing the SPL or metadata of an existing detection;
- converting investigation findings into a reusable detection;
- validating or backtesting a proposed detection;
- preparing a detection for deployment;
- disabling a detection as a reversible rollback.

Do not use this skill for general event investigation when no detection change is being proposed.
Use the Splunk investigation skill instead.

Do not use this skill only to determine whether an alert is a false positive.
Use the false-positive analysis skill first.

# Available Detection Tools

Use the dedicated Splunk Detection tools whenever possible:

- `splunk_get_detection`
  - retrieve an existing saved search without executing it.

- `splunk_validate_detection`
  - validate SPL safety and detection metadata locally.

- `splunk_backtest_detection`
  - execute a bounded, read-only historical test.

- `splunk_create_detection_draft`
  - create a new disabled detection draft.

- `splunk_update_detection_draft`
  - update an existing detection while keeping it disabled.

- `splunk_enable_detection`
  - enable a reviewed detection through the separate approval-gated path.

- `splunk_disable_detection`
  - disable a detection as a reversible rollback.

# Detection Definition

When designing a detection, define as many of the following fields as the available evidence supports:

- `name`
- `description`
- `spl`
- `earliest_time`
- `latest_time`
- `cron_schedule`
- `severity`
- `mitre_attack`
- `risk_score`
- `risk_objects`
- `suppression_window`
- `enabled`

New and modified drafts MUST use:

`enabled: false`

Do not invent MITRE ATT&CK mappings, severity, risk objects, or risk scores when the evidence does not support them.

# Workflow

## 1. Define the Detection Objective

Before writing SPL, state clearly:

- what behavior should be detected;
- what evidence supports the behavior;
- which Splunk data is expected to contain it;
- which entities are relevant, such as user, host, IP, process, URL, or email address;
- what should count as a match;
- important known benign behavior.

Separate confirmed evidence from assumptions.

If the required fields or data sources are not known, investigate them before producing a deployable rule.

## 2. Inspect Existing Detection

When modifying, tuning, reviewing, enabling, or disabling an existing rule:

Use:

`splunk_get_detection`

Review its:

- current SPL;
- search window;
- schedule;
- description;
- enabled/disabled state;
- existing actions;
- ACL/context where relevant.

Do not overwrite an existing detection based only on the user's description of it.

For a completely new rule, this step may be skipped unless there is a reasonable possibility of an existing equivalent detection.

## 3. Design the SPL

Build the SPL from the detection objective rather than copying the investigation query blindly.

Prefer:

- explicit index or data scope;
- stable normalized fields;
- clear filtering conditions;
- understandable transformations;
- bounded time windows;
- aggregation only when required by the behavior;
- `tstats` or accelerated data models when appropriate for high-volume scheduled searches.

Avoid unnecessary:

- broad wildcard searches;
- expensive commands;
- unbounded joins or subsearches;
- assumptions about fields that have not been observed;
- hard-coded environment-specific values unless intentional.

An investigation query and a production detection query do not have to be identical.

## 4. Validate the Draft

Always run:

`splunk_validate_detection`

before:

- backtesting;
- creating;
- updating;
- or recommending enablement.

Treat validation errors as blocking.

Review warnings individually rather than ignoring them automatically.

Correct the draft and validate again until the detection is valid or clearly explain why it cannot be made valid.

Do not attempt to bypass the SPL safety validator.

## 5. Backtest

After successful validation, run:

`splunk_backtest_detection`

Use a bounded historical window.

Start with a representative period such as:

`-7d` → `now`

unless incident timing or data volume makes another period more appropriate.

Keep returned events bounded.

Backtesting is read-only and is intended to estimate detection behavior, not prove that the rule is production-ready.

## 6. Review Backtest Quality

Evaluate:

- number of matches;
- representative sample events;
- whether matches correspond to the intended behavior;
- obvious false-positive patterns;
- repeated matches from the same entity;
- field availability and consistency;
- whether suppression or aggregation is required;
- expected alert frequency;
- obvious search-performance concerns.

Where possible, distinguish:

- expected malicious/suspicious matches;
- expected benign matches;
- unknown matches requiring investigation.

Do not claim a false-positive rate from a small or unlabelled sample.

If the backtest clearly shows excessive noise or incorrect matching, refine the SPL and repeat:

design
→ validate
→ backtest

## 7. Prepare the Detection Change

Before making any Splunk write, present the proposed change.

Include:

- detection name;
- objective;
- SPL;
- schedule and search window;
- severity;
- MITRE ATT&CK mapping if supported;
- risk metadata if supported;
- suppression strategy if needed;
- validation result;
- backtest window;
- match count;
- observed limitations;
- expected false-positive risks.

For an existing detection, summarize the important changes from the current version.

## 8. Create or Update Draft

Only after validation and backtesting should a rule normally be written.

For a new rule use:

`splunk_create_detection_draft`

For an existing rule use:

`splunk_update_detection_draft`

Creation and updates must remain disabled.

If detection writes are disabled by the MCP server, do not attempt another path around the guard.

Return the reviewed detection definition instead.

## 9. Enablement

Enabling a detection is a separate action from creating or updating it.

Use:

`splunk_enable_detection`

only when the user or authorized host workflow has explicitly approved enablement.

Do not interpret any of the following as approval:

- asking for a rule;
- asking for a draft;
- asking to improve SPL;
- asking to backtest;
- asking whether the rule looks good.

If explicit enablement approval is absent, leave the detection disabled.

## 10. Rollback

If a deployed rule must be stopped, prefer:

`splunk_disable_detection`

This is the default reversible rollback mechanism.

Do not delete a detection as a rollback method.

# Safety Rules

- Never bypass Splunk write guards.
- Never bypass detection enablement guards.
- Never bypass approval prompts.
- Never enable a newly created or modified detection automatically.
- Never deploy a detection that fails validation.
- Never treat a successful SPL execution as sufficient proof that a detection is correct.
- Never fabricate fields, event values, MITRE mappings, or backtest findings.
- Keep backtests bounded and read-only.
- Preserve existing rule behavior unless the requested change intentionally modifies it.
- Prefer reversible changes over destructive actions.

# Output

For a detection-engineering task, present:

## Detection

- Name
- Objective
- Status: `proposed`, `validated`, `backtested`, `drafted`, or `enabled`

## SPL

```spl
<detection SPL>
```

## Metadata

- Search window
- Schedule
- Severity
- MITRE ATT&CK
- Risk score / objects
- Suppression

## Validation

- Valid / invalid
- Errors
- Warnings

## Backtest

- Historical window
- Match count
- Important observations
- Likely noise / false-positive patterns

## Limitations

State unsupported assumptions, missing data, performance concerns, and anything requiring analyst review.

## Recommended Action

State exactly one next action, such as:

- investigate missing data;
- refine SPL;
- perform a longer backtest;
- create disabled draft;
- request analyst approval;
- enable approved detection;
- disable detection for rollback.