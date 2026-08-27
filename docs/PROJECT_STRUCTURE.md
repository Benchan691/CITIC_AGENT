# Project Structure

This repository is a single self-contained SOC Agent project. Runtime code is
separated from packages, while the DeepSeek Harness source used by the agent
stays in the repository under `vendor/`.

```text
apps/
└── soc-agent/                 Host, policy, MCP server, and product tests

packages/
├── soc-agent-client/          Browser settings and tool-view plugin
├── soc-agent-scheduler/       Durable read-only investigation scheduler
└── soc-memory/                Tenant-isolated SOC memory package

vendor/
└── deepseek-harness/          In-repository harness source and build runtime

skills/                        SOC investigation and response playbooks
docs/                          Architecture and operating notes
```

## Dependency direction

`apps/soc-agent` consumes the scheduler, client, and memory packages. All
JavaScript packages are members of the `vendor/deepseek-harness` pnpm
workspace and share its lockfile and virtual store; the vendor tree does not
depend on SOC product code.

The Python MCP server lives at:

`apps/soc-agent/server/unified_mcp_server`

Its domain boundaries are `splunk/` and `zimbra/`. Cross-domain coordination
belongs in the agent workflow and skills, not in low-level clients.

## Common commands

```sh
# SOC MCP server (run from the repository root)
(cd apps/soc-agent/server && uv sync --python 3.12 --extra test && .venv/bin/python -m pytest)

# Shared JavaScript workspace (run from the repository root)
cd vendor/deepseek-harness
pnpm install --frozen-lockfile
pnpm --filter dsh-soc-agent test
pnpm --filter dsh-soc-agent-client run build
pnpm --filter dsh-soc-agent-client test
pnpm --filter @deepseek-ai/dsh-soc-agent-scheduler test
pnpm --filter @citic/soc-memory test
```

Dependencies are intentionally ignored from version control. Recreate all
JavaScript dependencies from the shared lockfile by running `pnpm install`
from `vendor/deepseek-harness`. The Python MCP server remains separate and
uses `uv`.
