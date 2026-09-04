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

## Detection rule-writing guidance

The operational detection-writing method is intentionally kept in
`skills/detection-engineering/SKILL.md` and `skills/spl-writing/SKILL.md`, not
in this just-in-time background file. Load those skills for detection work;
this file provides reference context only, not authorization and not a
replacement for `AGENTS.md`.

## Operating boundaries

- Splunk investigation is read-only by default and must remain customer-scoped.
- Treat Splunk results as evidence; distinguish observations, inferences,
  unknowns, and recommendations.
- Detection changes use the approved flow: validate, write or update a
  disabled proposal, review the exact proposal, approve it, and apply it.
- Use `splunk_write_detection` for a create-only rule and
  `splunk_update_detection` with the fresh fingerprint for an existing rule.
  Both operations always persist the detection disabled after approval.
- MCP never enables a detection and has no explicit disable operation.
  Authorized staff must use a separately controlled Splunk process outside MCP
  when activation or rollback is required.
- Authentication, environment configuration, customer context, and live
  evidence come from their authoritative sources, not from this document.
