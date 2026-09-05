"""MCP registrations for webserver notification subscription tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context


def register_tools(server, *, get_runtime, execute) -> None:
    @server.tool(annotations={"readOnlyHint": True})
    async def list_subscriptions(ctx: Context) -> dict[str, Any]:
        """List webserver notification subscriptions."""
        return await execute(
            ctx,
            "subscription",
            "list_subscriptions",
            lambda: get_runtime(ctx).email_subscriptions.list_subscriptions(),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def get_subscription_schema(ctx: Context) -> dict[str, Any]:
        """Get live webserver subscription fields, defaults, enums, and limits."""
        return await execute(
            ctx,
            "subscription",
            "get_subscription_schema",
            lambda: get_runtime(ctx).email_subscriptions.get_subscription_schema(),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def preview_subscription(
        ctx: Context,
        mode: str = "create",
        email: str = "",
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Validate a proposed subscription without saving or notifying."""
        return await execute(
            ctx,
            "subscription",
            "preview_subscription",
            lambda: get_runtime(ctx).email_subscriptions.preview_subscription(
                mode, email, newsletter_profile, report_profile,
            ),
        )

    @server.tool()
    async def create_subscription(
        ctx: Context,
        email: str,
        team: str,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a webserver notification subscription."""
        return await execute(
            ctx,
            "subscription",
            "create_subscription",
            lambda: get_runtime(ctx).email_subscriptions.create_subscription(
                email, team, newsletter_profile, report_profile,
            ),
        )

    @server.tool()
    async def update_subscription(
        ctx: Context,
        email: str,
        team: str | None = None,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Update a webserver notification subscription."""
        return await execute(
            ctx,
            "subscription",
            "update_subscription",
            lambda: get_runtime(ctx).email_subscriptions.update_subscription(
                email, team, newsletter_profile, report_profile,
            ),
        )

    @server.tool()
    async def delete_subscription(ctx: Context, email: str) -> dict[str, Any]:
        """Delete a webserver notification subscription."""
        return await execute(
            ctx,
            "subscription",
            "delete_subscription",
            lambda: get_runtime(ctx).email_subscriptions.delete_subscription(email),
        )
