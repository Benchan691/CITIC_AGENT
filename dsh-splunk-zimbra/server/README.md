# Splunk + Zimbra MCP server

Python MCP backend for the Splunk + Zimbra Analyst product bundle. See the [repository README](../../README.md) for setup, tools, and security behavior.

```bash
cp .env.example .env
uv sync --extra test
uv run unified-mcp-server
uv run pytest
```

Standalone MCP clients should set `cwd` to this directory and pass `MCP_SEVER_ROOT` when workspace data lives elsewhere (for example the repository root `.data/` directory).
