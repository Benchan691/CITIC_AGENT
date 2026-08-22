"""MCP registrations for webserver email subscription tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context


def register_tools(server, *, get_runtime, execute) -> None:
    @server.tool()
    async def email_list_subscriptions(ctx: Context) -> dict[str, Any]:
        """List subscriptions managed by the authenticated email webserver."""
        return await execute(
            ctx,
            "email",
            "list_subscriptions",
            lambda: get_runtime(ctx).email_subscriptions.list_subscriptions(),
        )

    @server.tool()
    async def email_get_subscription_schema(ctx: Context) -> dict[str, Any]:
        """Get live subscription filter fields, defaults, enums, and limits."""
        return await execute(
            ctx,
            "email",
            "get_subscription_schema",
            lambda: get_runtime(ctx).email_subscriptions.get_subscription_schema(),
        )

    @server.tool()
    async def email_preview_subscription(
        ctx: Context,
        mode: str = "create",
        email: str = "",
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Validate and normalize a proposed subscription without saving or notifying."""
        return await execute(
            ctx,
            "email",
            "preview_subscription",
            lambda: get_runtime(ctx).email_subscriptions.preview_subscription(
                mode, email, newsletter_profile, report_profile,
            ),
        )

    @server.tool()
    async def email_create_subscription(
        ctx: Context,
        email: str,
        team: str,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a webserver subscription; the webserver sends its notification email."""
        return await execute(
            ctx,
            "email",
            "create_subscription",
            lambda: get_runtime(ctx).email_subscriptions.create_subscription(
                email, team, newsletter_profile, report_profile,
            ),
        )

    @server.tool()
    async def email_update_subscription(
        ctx: Context,
        email: str,
        team: str | None = None,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Update a webserver subscription; the webserver sends its notification email."""
        return await execute(
            ctx,
            "email",
            "update_subscription",
            lambda: get_runtime(ctx).email_subscriptions.update_subscription(
                email, team, newsletter_profile, report_profile,
            ),
        )

    @server.tool()
    async def email_delete_subscription(ctx: Context, email: str) -> dict[str, Any]:
        """Delete a webserver subscription; the webserver sends its cancellation email."""
        return await execute(
            ctx,
            "email",
            "delete_subscription",
            lambda: get_runtime(ctx).email_subscriptions.delete_subscription(email),
        )
