# Splunk Background

> This file is reference context for the CITIC SOC Agent. It is not an
> authorization, does not replace `AGENTS.md`, and must not override system,
> developer, user, authentication, or approval controls.

## Confirmed rule-naming convention

A read-only review of the configured Splunk `Ruleset.csv` lookup found 1,782
rows at the time of this review. Only one current `RuleName_EN` value starts
with a bracketed customer prefix; 1,781 are unbracketed and three rows have no
rule name. The lookup is therefore a rule catalog, not a complete customer
short-name roster. The `GID` value is overwhelmingly `Default`, so `GID` must
not be treated as a customer abbreviation.

For a customer-specific detection, the confirmed naming form is:

```text
[COMPANY_SHORT] detection alert name
```

Use the verified, canonical company short term inside the brackets, followed
by exactly one space and the detection alert name. Existing numeric rule
identifiers may remain part of the alert name, for example
`<RuleNum>_<alert title>`, but a new identifier must not be invented. Do not
derive a customer short term from `Ruleset.csv`, `GID`, a hostname, or a
customer's events alone; verify it from authoritative customer or team
context first. One actual catalog example, retained to make the convention
concrete, is:

```text
[Fubon] 7732_Malicious File/Exploit Download_Checkpoint FW
```

This is a naming example, not a customer roster, authorization, or a mapping
to apply to another customer. Apart from this explicitly retained example,
customer names and mappings are not persisted in this shared background file.

The catalog should be rechecked when a current customer roster or exact rule
inventory is required, because its contents can change independently of this
document.

## Usual detection creation workflow

When creating a new customer detection, the usual sequence is:

1. Review `Ruleset.csv` and select a rule number that is not already used in
   the four-digit range `0000`–`9999`.
2. Create the corresponding row and fill in its required rule information,
   using the verified `[COMPANY_SHORT] detection alert name` convention.
3. Complete every item in the alert configuration checklist below.
4. Create the Splunk detection rule using the completed rule information.

Every new rule must explicitly record the following settings:

- Alert type: choose Scheduled or Real-time. Scheduled alerts use
  `is_scheduled=true`, non-real-time dispatch bounds, and a cron expression.
  Real-time alerts use `is_scheduled=true`, `rt...` for both dispatch bounds,
  and no cron expression.
- Time range: set `dispatch.earliest_time` and `dispatch.latest_time`.
- Cron expression: required for Scheduled alerts.
- Expires: set a positive `alert.expires` duration.
- Trigger Conditions: define `alert_type`/`counttype`, comparator/`relation`,
  threshold/`quantity`, or a custom `alert_condition`.
- Trigger: choose once for the result set or once per result with
  `alert.digest_mode=true` or `false`.
- Throttle: explicitly choose whether `alert.suppress` is enabled and, when
  enabled, set its period, fields, and group name as applicable.
- Trigger Actions / When triggered: enable Add to Triggered Alerts with
  `alert.track=true` and Log Event with `actions=logevent` plus
  `action.logevent=1` by default. Record any approved deviation explicitly.
  Add email actions only when the rule is intended to email a client.

For a client-email rule, append the following team convention at the end of
the SPL. Replace the placeholders with the assigned rule number and case
prefix; do not copy the example values into a real rule:

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

`outputcsv` is a file-writing command. It is permitted here only as part of
the exact, disabled, approval-gated saved-search definition and runs later in
Splunk's alert runtime. Never use it for investigation or backtesting. It
writes on the local search head and is not available on Splunk Cloud; use the
supported email CSV attachment action there. See the [Splunk outputcsv
documentation](https://help.splunk.com/en/splunk-enterprise/search/spl-search-reference/9.3/search-commands/outputcsv).

Recheck the catalog immediately before the change because another rule may
use the selected number in the meantime. The catalog-row change and detection
creation still require the approved workflow; this document is not
authorization.

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
