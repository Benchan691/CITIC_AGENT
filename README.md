# CITIC SOC Agent

Self-contained SOC operations agent built on DeepSeek Harness. The repository
contains the application, SOC packages, investigation skills, Python MCP
server, and pinned harness source.

## Repository layout

- `apps/soc-agent` — application host, policy, scheduler, and MCP server
- `packages` — SOC client and scheduler packages
- `vendor/deepseek-harness` — JavaScript workspace and web runtime
- `skills` — SOC operating playbooks
- `docs` — project structure and operating notes

## SOC catalogs

The Ruleset, Customer Information, and Fix Source type catalogs live in
PostgreSQL. Analysts edit records through authenticated forms (`/catalogs`, or
the catalog MCP tools with the editor's explicit Save); every change is
recorded in an audit history table with the actor, timestamp, reason, and
before/after values. Splunk consumers keep reading their lookup files. The
catalog workflow still generates and validates lookup snapshots, but the
official Splunk MCP server is currently read-only, so remote publication is
unavailable until an upstream MCP mutation tool is provided. Imports of
existing lookup data go through staging and a reconciliation report via
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

Use the Splunk detection workflow to validate and stage saved-search alerts.
Core Splunk access remains read-only; an optional, separately deployed and
authenticated write extension performs only approved disabled saved-search
publication after harness approval and an explicit authenticated editor Save.

Start with result-producing detection logic. `splunk_compile_citic_detection`
may add mapped detail fields and a final `table`, but it does not construct
GID, CID, AID, EID, or output files. Review and backtest the returned SPL, then
pass it to `splunk_write_detection` or `splunk_update_detection`. A catalog
rule number may remain content metadata, but it is not alert identity.

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
  "alert.track": true
}
```

Real-time alerts use `is_scheduled: true` with `rt...` dispatch time values;
`alert_type` describes the trigger condition, not the timing mode. Omitted
settings remain unchanged on updates, while empty or `null` values clear
non-secret settings. `splunk_write_detection` is create-only, while
`splunk_update_detection` requires the current fingerprint and a verified
Splunk revision. Both tools return browser-editable drafts and never write by
themselves. The Save workflow allocates an AID in PostgreSQL, installs the
backend-owned **CITIC Alert Delivery** action parameters, verifies the saved
definition, and leaves it disabled. A real triggered run receives one EID.

The harness asks for approval before either detection draft tool runs. After
approval, review the inline editor and Save explicitly. Cancel makes no Splunk
change. A failed publication retains its allocated AID for reconciliation.
Activation remains a separate operator action; MCP never enables a detection.

Persistent CSV lookups use the same draft/editor pattern. `splunk_get_lookup`
reads the canonical CSV, while `splunk_write_lookup`, `splunk_update_lookup`,
and `splunk_delete_lookup` prepare approval-gated drafts. The inline editor
continues to validate the authenticated user, fixed
`SPLUNK_LOOKUP_APP`/`SPLUNK_LOOKUP_OWNER` scope, CSV validity, and update
fingerprints, but Save and Delete are unavailable until MCP exposes lookup
mutation tools. The CSV editor does not execute `outputlookup` or
`outputcsv`.

For new rules, follow `skills/detection-engineering/SKILL.md`,
`skills/spl-writing/SKILL.md`, and `docs/SPLUNK_ALERT_EMAIL_SETUP.md`. New
customer-delivery alerts must return detection details only and must not use
`GID`, `Event_GID`, `Event_Rulenum`, `outputcsv`, `logevent`, or Splunk's
standard Send email action. Customer recipients, selected fields, filters,
severity mapping, and row limits are administrator-owned. Exact source indexes
must be verified to one customer before delivery can become active.

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
