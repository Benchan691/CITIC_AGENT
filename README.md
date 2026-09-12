# CITIC SOC Agent

Self-contained SOC operations agent built on DeepSeek Harness. The repository
contains the application, SOC packages, investigation skills, Python MCP
server, and pinned harness source.

## Repository layout

- `apps/soc-agent` — application host, policy, and MCP server
- `packages` — SOC client package
- `vendor/deepseek-harness` — JavaScript workspace and web runtime
- `skills` — SOC operating playbooks
- `docs` — project structure and operating notes

See the [shortening-plan implementation report](docs/SHORTENING_PLAN_IMPLEMENTATION.md)
for the completed refactors, measured source reduction, validation results,
compatibility decisions, and deployment implications.

## First-time setup

From the repository root, run:

```bash
./setup.sh
```

The setup process collects missing configuration, installs dependencies, builds
the harness, and wires the SOC product into the web profile. Use
`./setup.sh --check` to audit the installation without changing it.

When bootstrapping from a downloaded script, the setup prompts for the
repository branch. Running `./setup.sh` in an existing checkout also prompts;
press Enter to keep the current branch or type another branch. Switching is
allowed only when the working tree is clean; local changes are never stashed or
discarded.

## Update from GitHub

Keep the checkout clean, then run:

```bash
./update.sh
```

The update script fast-forwards the current branch from its configured
upstream and runs `setup.sh --plugins` to refresh dependencies, builds, and
profile wiring. It never stashes or discards local changes. If the web app is
already running, restart it manually after the update. It follows whichever
branch is currently checked out. To change branches, run `./setup.sh` and make
the selection when prompted before running the update.

## Official Splunk MCP (read-only)

Set `SPLUNK_MCP_ENDPOINT` and `SPLUNK_TOKEN` to expose the approved official
Splunk MCP read tools directly as `mcp__splunk_mcp__...`. The bridge uses
Streamable HTTP, forwards the bearer token, and registers only query, instance,
index, metadata, knowledge-object, saved-search, alert, fired-alert, and
throttle reads. It is disabled unless both settings are present.

Setup and `./setup.sh --check` require this official MCP connection. The admin
**Check connection** action reads `splunk_get_info` through the agent's bridge.
HTTPS and certificate verification are enabled by default; private HTTP
deployments require `SPLUNK_ALLOW_INSECURE_HTTP=true`. A certificate exception
with `SPLUNK_VERIFY_SSL=false` applies only to this Splunk connection.

The retired Python Splunk APIs, REST authentication, planner, lookup, and local
query-policy settings are no longer used. Existing REST-only deployments must
add the official endpoint and bearer token before Splunk tools become available.

Official reads do not enter the harness approval or local query-admission
flow. Splunk MCP Server applies its own query guardrails and result cap. The
application still enforces authentication and session ownership, sanitizes
results, preserves evidence boundaries, bounds model-visible output, and keeps
transport deadlines. Shell, filesystem, coding, and unrelated tools remain
disabled. The application exposes no Splunk mutation tool.

## Splunk background context

The CITIC SOC agent loads the repository-root `BACKGROUND.md` with `AGENTS.md`
when a session starts, when enabled. It then reloads the file after the configured
number of additional user prompts, so edits can reach long-running sessions.
Administrators can enable or disable the file, change or disable its repeat cadence,
and enable or throttle current-time context from the **Agent context** section of
`/admin`. The file is reference context only and does not grant access or override
`AGENTS.md`, authentication, or approval controls.

The default access mode and per-action checklist are available in the
**Access & approvals** section of the admin dashboard. Signed-in users can choose
**Full access** or **SOC mode** from the conversation menu. Their choice applies
to their current login session across conversations, leaves other users unchanged,
and resets to the deployment default after logout or a server restart. **Full access** runs
permitted tools directly. **SOC mode** applies each tool's
ask, auto-run, or disabled setting. The per-action checklist is deployment-wide. Mode selection
does not provide mailbox identity; Zimbra calls still require the authenticated
user's Zimbra session. Detection deployment stays outside the application, and
sending email always requires the draft-view Send confirmation.

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
