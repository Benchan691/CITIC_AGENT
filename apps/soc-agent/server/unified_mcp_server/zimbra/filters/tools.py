"""MCP registrations for Zimbra email-filter tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context


def register_tools(server, *, get_runtime, fresh_runtime, execute) -> None:
    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_list_email_filters(ctx: Context, include_details: bool = False) -> dict[str, Any]:
        """List compact Zimbra filter summaries; include full rules only when needed."""
        return await execute(ctx, "zimbra", "list_email_filters", lambda: get_runtime(ctx).zimbra_filters.list_email_filters(include_details=include_details))

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_get_email_filter(ctx: Context, name: str) -> dict[str, Any]:
        """Get one structured incoming Zimbra filter and the complete-set fingerprint."""
        return await execute(ctx, "zimbra", "get_email_filter", lambda: get_runtime(ctx).zimbra_filters.get_email_filter(name))

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_validate_email_filter(ctx: Context, rule: dict[str, Any]) -> dict[str, Any]:
        """Validate a structured Zimbra filter without writing it."""
        return await execute(ctx, "zimbra", "validate_email_filter", lambda: get_runtime(ctx).zimbra_filters.validate_email_filter(rule))

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_preview_email_filter_update(ctx: Context, name: str, proposed_rule: dict[str, Any]) -> dict[str, Any]:
        """Preview a structured Zimbra filter update without writing it."""
        return await execute(ctx, "zimbra", "preview_email_filter_update", lambda: get_runtime(ctx).zimbra_filters.preview_email_filter_update(name, proposed_rule))

    @server.tool()
    async def zimbra_create_email_filter(ctx: Context, rule: dict[str, Any], expected_fingerprint: str) -> dict[str, Any]:
        """Create a Zimbra filter only when write and dangerous-action gates permit it."""
        return await execute(ctx, "zimbra", "create_email_filter", lambda: get_runtime(ctx).zimbra_filters.create_email_filter(rule, expected_fingerprint))

    @server.tool()
    async def zimbra_update_email_filter(ctx: Context, name: str, rule: dict[str, Any], expected_fingerprint: str) -> dict[str, Any]:
        """Update a Zimbra filter using optimistic concurrency protection."""
        return await execute(ctx, "zimbra", "update_email_filter", lambda: get_runtime(ctx).zimbra_filters.update_email_filter(name, rule, expected_fingerprint))

    @server.tool()
    async def zimbra_delete_email_filter(ctx: Context, name: str, expected_fingerprint: str) -> dict[str, Any]:
        """Delete a Zimbra filter using write permission and optimistic concurrency protection."""
        return await execute(ctx, "zimbra", "delete_email_filter", lambda: get_runtime(ctx).zimbra_filters.delete_email_filter(name, expected_fingerprint))

    @server.tool()
    async def zimbra_set_email_filter_enabled(ctx: Context, name: str, enabled: bool, expected_fingerprint: str) -> dict[str, Any]:
        """Enable or disable a Zimbra filter using optimistic concurrency protection."""
        return await execute(ctx, "zimbra", "set_email_filter_enabled", lambda: get_runtime(ctx).zimbra_filters.set_email_filter_enabled(name, enabled, expected_fingerprint))

    @server.tool()
    async def zimbra_reorder_email_filter(ctx: Context, name: str, order: int, expected_fingerprint: str) -> dict[str, Any]:
        """Move a Zimbra filter to a 1-based position using optimistic concurrency protection."""
        return await execute(ctx, "zimbra", "reorder_email_filter", lambda: get_runtime(ctx).zimbra_filters.reorder_email_filter(name, order, expected_fingerprint))
