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
before/after values. The application can preview validated lookup snapshots,
but it never publishes catalog data to Splunk. Imports of existing lookup data
remain read-only and go through staging and a reconciliation report via
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

## Official Splunk MCP (read-only)

Set `SPLUNK_MCP_ENDPOINT` and `SPLUNK_TOKEN` to expose the approved official
Splunk MCP read tools directly as `mcp__splunk_official__...`. The bridge uses
Streamable HTTP, forwards the bearer token, and registers only query, instance,
index, metadata, knowledge-object, saved-search, alert, fired-alert, and
throttle reads. It is disabled unless both settings are present.

Official reads do not enter the harness approval or local query-admission
flow. Splunk MCP Server applies its own query guardrails and result cap. The
application still enforces authentication and session ownership, sanitizes
results, preserves evidence boundaries, bounds model-visible output, and keeps
transport deadlines. Shell, filesystem, coding, and unrelated tools remain
disabled. The application exposes no Splunk mutation tool or catalog-to-Splunk
publication path.

## Splunk background context

The CITIC SOC agent loads the repository-root `BACKGROUND.md` just in time:
once at `agent/pre-step`, immediately before the first model request that has
a visible `mcp__soc_agent__splunk_` or `mcp__splunk_official__splunk_` tool. It is not loaded for non-Splunk
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
