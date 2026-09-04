---
name: spl-writing
description: Build CITIC production detection SPL and safe backtest SPL from one detection logic query.
---

# CITIC SPL Writing

Use this skill when creating or modifying a production Splunk detection. A
normal investigation search may use ordinary SPL and does not need this CITIC
wrapper.

## Production format

Production detection SPL must be compiled from the detection logic and include:

- a `rulename` containing exactly four digits;
- `GID` and `search=strftime(now(), "%Y%m%d%H%M")`;
- `Fix_Ticketnumber=GID."".search."".rulename`;
- `Fix_TriggerTime=strftime(now(), "%F %T")`;
- `Fix_Index`;
- `Fix_Source Type`;
- `Event_Hostname`;
- `Event_Date Time=strftime(_time, "%F %T")`;
- a final `table` containing the required CITIC fields in this order:
  `Fix_Ticketnumber`, `Fix_TriggerTime`, `Fix_Index`, `Fix_Source Type`,
  `Event_Hostname`, `Event_Date Time`;
- a final dynamic `outputcsv` subsearch that sets the same four-digit rule
  number, creates the timestamp, builds
  `casename="CASE_PREFIX"."".search."".rulename`, and returns `$casename`.

Optional event fields may be placed after the required table fields.

MCP applies the company Log Event action automatically: `source=$name$`,
`sourcetype=ticket_details`, an empty host, and `index=ticket_summary`. Its
event text is generated from the final table with `$result.<field>$` values.

## Workflow

1. Start with only the detection logic SPL. Do not write the CITIC wrapper by
   hand and do not include `outputcsv` in the input.
2. Call `splunk_compile_citic_detection` with the rule number, threat
   metadata, explicit case/GID prefix, and event field mappings.
3. Review the returned `production_spl`, `backtest_spl`, and validation results.
4. Backtest only the returned `backtest_spl`; it is derived from the same
   logic and contains no `outputcsv`.
5. Use only the returned production SPL in `splunk_write_detection` or
   `splunk_update_detection`. Those tools create the existing exact proposal
   and all applied detections remain disabled.

The compiler and MCP do not execute `outputcsv`, export a file, or send email.
`outputcsv` is only part of the disabled, approval-gated production definition.
