# Project Structure

This repository is a single self-contained SOC Agent project. Runtime code is
separated from packages, while the DeepSeek Harness source used by the agent
stays in the repository under `vendor/`.

```text
apps/
└── soc-agent/                 Host, policy, MCP server, and product tests

packages/
├── soc-agent-client/          Browser settings and tool-view plugin
└── soc-agent-scheduler/       Durable read-only investigation scheduler

vendor/
└── deepseek-harness/          In-repository harness source and build runtime

skills/                        SOC investigation and response playbooks
docs/                          Architecture and operating notes
```

## Dependency direction

`apps/soc-agent` consumes the scheduler and client packages. Both packages may
consume build/runtime code from `vendor/deepseek-harness`; the vendor tree does
not depend on SOC product code.

The Python MCP server lives at:

`apps/soc-agent/server/unified_mcp_server`

Its domain boundaries are `splunk/` and `zimbra/`. Cross-domain coordination
belongs in the agent workflow and skills, not in low-level clients.

## Common commands

```sh
# SOC MCP server
cd apps/soc-agent/server
uv sync --python 3.12 --extra test
.venv/bin/python -m pytest

# Product host and policy tests
cd apps/soc-agent
pnpm test

# Client build and tests
cd packages/soc-agent-client
npm run build
npm test

# Scheduler tests
cd packages/soc-agent-scheduler
pnpm test
```

Dependencies are intentionally ignored from version control. Recreate them
from the lockfiles with `pnpm install` or `npm install` in the package being
worked on.
