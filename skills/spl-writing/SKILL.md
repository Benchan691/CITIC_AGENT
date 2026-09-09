---
name: spl-writing
description: Build CITIC production detection SPL and safe backtest SPL from one detection logic query.
---

# CITIC SPL Writing

Use this skill when creating or modifying a production Splunk detection. A
normal investigation search may use ordinary SPL and does not need this
workflow. The new CID/AID/EID delivery path does not use an SPL identity
wrapper.

## Production format

Compile production SPL from detection logic. Do not assign `GID`,
`Event_GID`, `Event_Rulenum`, `CID`, `AID`, or `EID` in SPL. Return only the
detection and detail fields that the administrator-approved policy may project.
The backend receives the saved-search identity and original trigger metadata,
allocates AID/EID, and applies the approved projection after the trigger.

The final query may use `table` to make result fields explicit, but it must not
use `outputcsv`, `sendemail`, `logevent`, or another write action. A four-digit
catalog rule number remains optional reusable content metadata; it is not an
event identity.

## Workflow

1. Start with only the detection logic SPL. Do not write an identity wrapper.
2. Call `splunk_compile_citic_detection` with optional catalog rule metadata,
   threat metadata, and approved event-field mappings. Do not pass a customer
   identifier as an SPL constant.
3. Review the returned `production_spl`, `backtest_spl`, and validation results.
4. Backtest only the returned `backtest_spl`; it is the same result-producing
   query and must not write files or send mail.
5. Use only the returned production SPL in `splunk_write_detection` or
   `splunk_update_detection`. Those tools return an editable disabled draft;
   harness approval and the authenticated editor's explicit Save are required
   before a detection is written.

The Save flow registers the definition, allocates an AID, and installs the
backend-owned `CITIC Alert Delivery` action parameters. It does not activate
the detection or send historical email. A real triggered run receives one EID;
multiple result rows remain one run.

Direct Splunk Web alerts must select **CITIC Alert Delivery** explicitly. The
action refreshes registration and policy context from the backend, so copied or
renamed searches cannot safely reuse a parent's AID. Recipients, severity
mapping, filters, selected columns, and row limits are administrator-owned.
