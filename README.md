# CITIC SOC Agent

Self-contained daily SOC operations agent built on DeepSeek Harness
`dsh-v0.1.1-rc.2`. Application source, SOC packages, skills, and the pinned
harness source all remain inside this repository; no sibling checkout or Git
submodule is required.

The repository is organized by ownership:

- `apps/soc-agent` — host policy, MCP server, scheduler wiring, and product tests
- `packages/soc-agent-client` — browser settings and tool-view plugin
- `packages/soc-agent-scheduler` — durable read-only investigation scheduling
- `vendor/deepseek-harness` — in-repository harness source and runtime
- `skills` — concise SOC operating playbooks
- `docs` — project structure and operating notes

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for commands and
dependency boundaries.
