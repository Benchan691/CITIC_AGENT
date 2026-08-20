"""MCP registrations for read-only Splunk Search tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context


def register_tools(server, *, get_runtime, fresh_runtime, execute, success, failure, service_error) -> None:
    @server.tool()
    async def splunk_validate_query(ctx: Context, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        """Risk-score an SPL query locally without executing it."""
        try:
            data = (await fresh_runtime(ctx)).splunk_search.validate(query, earliest_time, latest_time)
            return success("splunk", "validate_query", data)
        except service_error as exc:
            return failure("splunk", "validate_query", exc.code, exc.message, details=exc.details)

    @server.tool()
    async def splunk_search(ctx: Context, query: str, earliest_time: str = "-24h", latest_time: str = "now", max_count: int = 100) -> dict[str, Any]:
        """Execute a guarded Splunk oneshot search and return structured events."""
        return await execute(ctx, "splunk", "search", lambda: get_runtime(ctx).splunk_search.search(query, earliest_time, latest_time, max_count))

    @server.tool()
    async def splunk_list_saved_searches(ctx: Context, name: str = "", app: str = "") -> dict[str, Any]:
        """Find read-only saved searches or alerts by optional partial name and app."""
        return await execute(ctx, "splunk", "list_saved_searches", lambda: get_runtime(ctx).splunk_search.list_saved_searches(name, app))

    @server.tool()
    async def splunk_list_data_sources(ctx: Context, index: str = "") -> dict[str, Any]:
        """Discover indexes and bounded sourcetype metadata for investigation."""
        return await execute(ctx, "splunk", "list_data_sources", lambda: get_runtime(ctx).splunk_search.list_data_sources(index))

    @server.tool()
    async def splunk_find_lookup(ctx: Context, name: str) -> dict[str, Any]:
        """Find a visible Splunk lookup-table file by exact name."""
        return await execute(ctx, "splunk", "find_lookup", lambda: get_runtime(ctx).splunk_search.find_lookup(name))

    @server.tool()
    async def splunk_list_lookups(ctx: Context, app: str = "", name: str = "") -> dict[str, Any]:
        """List visible Splunk lookup-table files with optional app and name filters."""
        return await execute(ctx, "splunk", "list_lookups", lambda: get_runtime(ctx).splunk_search.list_lookups(app, name))

    @server.tool()
    async def splunk_run_saved_search(ctx: Context, name: str) -> dict[str, Any]:
        """Run a saved Splunk search with actions disabled."""
        return await execute(ctx, "splunk", "run_saved_search", lambda: get_runtime(ctx).splunk_search.run_saved_search(name))
