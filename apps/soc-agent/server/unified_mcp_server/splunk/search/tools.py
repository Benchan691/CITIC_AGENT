"""MCP registrations for read-only Splunk Search tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context

def _principal_id(get_runtime, ctx: Context) -> str:
    identity = getattr(get_runtime(ctx), "identity", None)
    principal = getattr(identity, "user_id", "") or getattr(identity, "zimbra_email", "")
    return principal.strip() if isinstance(principal, str) and principal.strip() else "anonymous"


def register_tools(server, *, get_runtime, fresh_runtime, execute, success, failure, service_error) -> None:
    @server.tool()
    async def splunk_validate_query(ctx: Context, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        """Analyze SPL scope and safety locally without executing it."""
        try:
            data = (await fresh_runtime(ctx)).splunk_search.validate(query, earliest_time, latest_time)
            return success("splunk", "validate_query", data)
        except service_error as exc:
            return failure("splunk", "validate_query", exc.code, exc.message, details=exc.details)

    @server.tool()
    async def splunk_search(ctx: Context, query: str, earliest_time: str = "-24h", latest_time: str = "now", max_count: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        """Execute a guarded read-only Splunk search. Use an exact index and narrow time range; use stats, tstats, chart, or similar aggregation for statistical questions, then sort/head as appropriate. Keep raw-event samples small, and never treat returned_count as total matches; inspect truncation metadata before volume or absence conclusions."""
        return await execute(ctx, "splunk", "search", lambda: get_runtime(ctx).splunk_search.search(query, earliest_time, latest_time, max_count, fields, principal_id=_principal_id(get_runtime, ctx)))

    @server.tool()
    async def splunk_list_saved_searches(ctx: Context, name: str = "", app: str = "", limit: int = 50, include_spl: bool = False) -> dict[str, Any]:
        """Find bounded saved-search summaries; request SPL only when it is needed."""
        return await execute(ctx, "splunk", "list_saved_searches", lambda: get_runtime(ctx).splunk_search.list_saved_searches(name, app, limit, include_spl))

    @server.tool()
    async def splunk_find_lookup(ctx: Context, name: str) -> dict[str, Any]:
        """Find a visible Splunk lookup-table file by exact name."""
        return await execute(ctx, "splunk", "find_lookup", lambda: get_runtime(ctx).splunk_search.find_lookup(name))

    @server.tool()
    async def splunk_list_lookups(ctx: Context, app: str = "", name: str = "", limit: int = 50) -> dict[str, Any]:
        """List visible Splunk lookup-table files with optional app and name filters."""
        return await execute(ctx, "splunk", "list_lookups", lambda: get_runtime(ctx).splunk_search.list_lookups(app, name, limit))

    @server.tool()
    async def splunk_run_saved_search(ctx: Context, name: str, max_count: int = 50, app: str = "", owner: str = "") -> dict[str, Any]:
        """Run a scoped saved search with actions disabled and bounded results."""
        return await execute(ctx, "splunk", "run_saved_search", lambda: get_runtime(ctx).splunk_search.run_saved_search(name, max_count, app, owner, principal_id=_principal_id(get_runtime, ctx)))
