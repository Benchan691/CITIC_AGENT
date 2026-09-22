## Splunk Ruleset.csv contract

`Ruleset.csv` is a read-only company lookup and evidence source. It is not a
write target, reservation service, customer roster, or authorization source.
This background file is not authorization and does not replace the authenticated
user's scope.
When a current rule inventory matters, inspect the live read-only lookup and
report what was observed; never modify it or claim that a number has been
reserved.

The canonical rule fields are:

| Field | Requirement |
| --- | --- |
| `Description_EN` | English description of the rule. |
| `GID` | Exactly `Default`; it must not be treated as a customer abbreviation. |
| `Remediation_EN` | English remediation guidance. |
| `RuleName_EN` | Exact `RuleNum_Name` format; `RuleNum` is followed by one underscore and a non-empty rule name. |
| `RuleNum` | Unique four-digit value from `0000` through `9999` for each rule. |
| `Severity` | Exactly one of `Low`, `Medium`, `High`, or `Critical`. |

`RuleName_EN` must not use the former bracketed customer-prefix convention.
For a new or proposed rule, a read-only check can establish that the number
does not duplicate a value currently observed in the lookup, but it cannot
reserve that number. `RuleNum` uniqueness must be confirmed again by the
human catalog-maintenance process at the time of writing.

## Operating boundaries

- Splunk investigation is read-only by default and must remain customer-scoped.
- Treat Splunk results as evidence; distinguish observations, inferences,
  unknowns, and recommendations.
- MCP never creates, updates, enables, disables, or rolls back a detection or
  edits `Ruleset.csv`.
- Authentication, environment configuration, customer context, and live
  evidence come from their authoritative sources, not from this document.
- A proposed email is an HTML draft only; attachments are selected explicitly
  by the user, and sending requires the visible Send confirmation.
