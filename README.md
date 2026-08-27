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

All JavaScript apps and local plugins share the DeepSeek Harness pnpm
workspace. Run JavaScript dependency commands from `vendor/deepseek-harness`;
do not install dependencies separately inside `apps/` or `packages/`.

## Update the server deployment

The active deployment at `~/CITIC_AGENT/current` is a Git checkout. To update
the code on the server:

```bash
cd ~/CITIC_AGENT/current
git pull --ff-only

cd vendor/deepseek-harness
pnpm install --frozen-lockfile
pnpm run build
```

Restart the web app in its tmux session

The server intentionally listens only on `127.0.0.1`. Access it from another
device through an SSH tunnel:

```bash
ssh -L 3080:127.0.0.1:3080 usr@ip
```

Runtime configuration and data (`.env`, `.data`, PostgreSQL, and `~/.dsh`) are
outside Git. Keep secrets out of commits and preserve those files when
updating the code.
