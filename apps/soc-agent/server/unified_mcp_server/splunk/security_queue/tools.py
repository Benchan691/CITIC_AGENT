"""MCP registrations for read-only Splunk security queue operations."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context


def register_tools(server, *, get_runtime, execute) -> None:
    @server.tool()
    async def splunk_list_security_findings(
        ctx: Context,
        status: str = "",
        urgency: str = "",
        owner: str = "",
        detection: str = "",
        earliest_time: str = "-24h",
        latest_time: str = "now",
        limit: int = 50,
        cursor: str = "",
    ) -> dict[str, Any]:
        """List bounded read-only security findings from Enterprise Security or classic fired alerts; inspect source and capabilities because classic history is retention-limited."""
        return await execute(
            ctx,
            "splunk",
            "list_security_findings",
            lambda: get_runtime(ctx).splunk_security_queue.list_security_findings(
                status, urgency, owner, detection, earliest_time, latest_time, limit, cursor
            ),
        )

    @server.tool()
    async def splunk_get_security_finding(ctx: Context, finding_id: str) -> dict[str, Any]:
        """Read one bounded, read-only security finding and its available evidence."""
        return await execute(
            ctx,
            "splunk",
            "get_security_finding",
            lambda: get_runtime(ctx).splunk_security_queue.get_security_finding(finding_id),
        )

    @server.tool()
    async def splunk_get_investigation(ctx: Context, investigation_id: str) -> dict[str, Any]:
        """Read one read-only Enterprise Security investigation; classic Splunk reports that native investigations are unsupported."""
        return await execute(
            ctx,
            "splunk",
            "get_investigation",
            lambda: get_runtime(ctx).splunk_security_queue.get_investigation(investigation_id),
        )
