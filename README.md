# CITIC SOC Agent

Self-contained SOC operations agent built on DeepSeek Harness. The repository
contains the application, SOC packages, investigation skills, Python MCP
server, and pinned harness source.

## Repository layout

- `apps/soc-agent` — application host, policy, scheduler, and MCP server
- `packages` — SOC client, scheduler, and tenant-isolated memory packages
- `vendor/deepseek-harness` — JavaScript workspace and web runtime
- `skills` — SOC operating playbooks
- `docs` — project structure and operating notes

## SOC catalogs

The Ruleset, Customer Information, and Fix Source type catalogs live in
PostgreSQL. Analysts edit records through authenticated forms (`/catalogs`, or
the catalog MCP tools with the editor's explicit Save); every change is
recorded in an audit history table with the actor, timestamp, reason, and
before/after values. Splunk consumers keep reading their lookup files:
publishing generates the lookup snapshot from the catalog, validates it, and
uploads it through the controlled write path (`SPLUNK_ALLOW_LOOKUP_WRITE`,
admin-only), then verifies the published content by reading it back. Imports
of existing lookup data go through staging and a reconciliation report via
`python -m unified_mcp_server.catalog_cli --help`.

## First-time setup

From the repository root, run:

```bash
./setup.sh
```

The setup process collects missing configuration, installs dependencies, builds
the harness, and wires the SOC product into the web profile. Use
`./setup.sh --check` to audit the installation without changing it.

## Update from GitHub

Keep the checkout clean, then run:

```bash
./update.sh
```

The update script fast-forwards the current branch from its configured
upstream and runs `setup.sh --plugins` to refresh dependencies, builds, and
profile wiring. It never stashes or discards local changes. If the web app is
already running, restart it manually after the update.

## Configure Splunk alerts

Use the Splunk detection MCP workflow to validate and stage saved-search alert
settings. The harness approves the draft tool call, then the inline editor's
Save action performs the authenticated write. For example, a scheduled alert
can include:

For production detections, write only the detection logic first. Run
`splunk_compile_citic_detection` with the four-digit rule number, explicit
case/GID prefix, threat metadata, and event mappings. Review its generated
`production_spl` and derived `backtest_spl`; validate and backtest the returned
values, then pass only `production_spl` to `splunk_write_detection` or
`splunk_update_detection`. The compiler adds the CITIC fields, final `table`,
and dynamic `outputcsv`. Investigation SPL remains flexible and does not need
this wrapper.

```json
{
  "name": "Example error alert",
  "spl": "<production_spl returned by splunk_compile_citic_detection>",
  "is_scheduled": true,
  "cron_schedule": "*/15 * * * *",
  "dispatch.earliest_time": "-15m",
  "dispatch.latest_time": "now",
  "alert_type": "number of events",
  "alert_comparator": "greater than",
  "alert_threshold": 0,
  "alert.digest_mode": true,
  "alert.suppress": false,
  "alert.expires": "24h",
  "alert.track": true,
  "actions": "email,logevent",
  "action.logevent": true,
  "action.email.to": "soc@example.invalid"
}
```

Real-time alerts use `is_scheduled: true` with `rt...` dispatch time values;
`alert_type` describes the trigger condition, not the timing mode. Omitted
settings remain unchanged on updates, while empty or `null` values clear
non-secret settings. `splunk_write_detection` is create-only, while
`splunk_update_detection` requires the current fingerprint and applies patch
semantics. Both tools return browser-editable drafts and never write by
themselves. Credential-like action settings are preserved by Splunk and are
not returned or accepted for replacement.

The harness asks for approval before either detection draft tool runs. After
approval, review the inline editor and use its explicit Save action to write
the detection. Cancel makes no Splunk change. MCP does not expose an
enable/disable operation and never enables a detection. Every saved
write/update persists the detection disabled; authorized staff must use a
separately controlled Splunk process outside MCP when activation or rollback
is required.
The only MCP write gate is `SPLUNK_ALLOW_DETECTION_WRITE`; the legacy
`SPLUNK_ALLOW_DETECTION_ENABLE` setting is ignored and is not reported.

For new rules, follow the detection-writing workflow in
`skills/detection-engineering/SKILL.md` and the SPL format in
`skills/spl-writing/SKILL.md`. The checklist covers alert type, time range,
cron (when scheduled), expiry, trigger conditions, trigger behavior, throttle,
and trigger actions. The team defaults are Add to Triggered Alerts (`alert.track=true`) and Log Event (`actions=logevent` plus
`action.logevent=1`). Log Event source, sourcetype, host, and index are fixed to
`$name$`, `ticket_details`, empty, and `ticket_summary`; event text is generated
from the final table. Client-email rules may append the documented `outputcsv`
filename subsearch. MCP keeps `outputcsv` blocked for ordinary searches and
backtests; it is accepted only inside a disabled detection draft and is never
executed by MCP. No MCP path exports the CSV or sends email merely by
preparing or saving a disabled definition.

## Splunk background context

The CITIC SOC agent loads the repository-root `BACKGROUND.md` just in time:
once at `agent/pre-step`, immediately before the first model request that has
a visible `mcp__soc_agent__splunk_` tool. It is not loaded for non-Splunk
requests, is not fetched through MCP, and is retained for later Splunk steps
without being repeated. The file provides generic Splunk background and the
confirmed customer-rule naming pattern; it is reference context only and does
not grant access or override `AGENTS.md`, authentication, or approval controls.
Start a new SOC session after editing the file so the updated context is
available.

To start the web app:

```bash
cd vendor/deepseek-harness
pnpm dsh web --no-open
```

Open `http://127.0.0.1:3080`, or use an SSH tunnel for remote access:

```bash
ssh -L 3080:127.0.0.1:3080 usr@ip
```

Runtime configuration and data, including `.env`, `.data`, PostgreSQL, and
`~/.dsh`, are kept outside Git and preserved during updates.
