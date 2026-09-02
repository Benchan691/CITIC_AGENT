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

Use the Splunk detection MCP workflow to validate, propose, approve, and apply
saved-search alert settings. For example, a scheduled alert can include:

```json
{
  "name": "Example error alert",
  "spl": "index=main error",
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
  "actions": "email",
  "action.email.to": "soc@example.invalid"
}
```

Real-time alerts use `is_scheduled: true` with `rt...` dispatch time values;
`alert_type` describes the trigger condition, not the timing mode. Omitted
settings remain unchanged on updates, while empty or `null` values clear
non-secret settings. New and updated detections remain disabled until a
separate enable approval is applied; credential-like action settings are
preserved by Splunk and are not returned or accepted for replacement.

For new rules, complete the alert workflow checklist in `BACKGROUND.md`:
alert type, time range, cron (when scheduled), expiry, trigger conditions,
trigger behavior, throttle, and trigger actions. The team defaults are Add to
Triggered Alerts (`alert.track=true`) and Log Event (`actions=logevent` plus
`action.logevent=1`). Client-email rules may append the documented `outputcsv`
filename subsearch. MCP keeps `outputcsv` blocked for ordinary searches and
backtests; it is accepted only inside an exact disabled detection proposal and
does not execute until a separate enable approval.

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
