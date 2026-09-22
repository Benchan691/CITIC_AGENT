"""MCP registrations for webserver notification subscription tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context


def register_tools(server, *, get_runtime, execute) -> None:
    @server.tool(annotations={"readOnlyHint": True})
    async def list_subscriptions(ctx: Context) -> dict[str, Any]:
        """List subscriptions visible to the authenticated local administrator.

        Zimbra subscriptions use the existing Zimbra account email. Local
        subscriptions use their manually supplied recipient addresses.
        """
        return await execute(
            ctx,
            "subscription",
            "list_subscriptions",
            lambda: get_runtime(ctx).email_subscriptions.list_subscriptions(),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def get_subscription_schema(ctx: Context) -> dict[str, Any]:
        """Get live Rust webserver subscription fields, defaults, and limits."""
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
        subscription_id: str = "",
        username: str = "",
        emails: list[str] | None = None,
        organization: str = "",
        local_subscription: bool = False,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Validate a Rust subscription payload without saving or notifying.

        For updates, identify the record with subscription_id. Zimbra
        subscriptions use the existing Zimbra account email; local
        subscriptions accept manually supplied recipient addresses. The
        authenticated local administrator can preview any visible record.
        """
        return await execute(
            ctx,
            "subscription",
            "preview_subscription",
            lambda: get_runtime(ctx).email_subscriptions.preview_subscription(
                mode,
                subscription_id,
                username,
                emails,
                organization,
                local_subscription,
                newsletter_profile,
                report_profile,
            ),
        )

    @server.tool()
    async def create_subscription(
        ctx: Context,
        username: str,
        emails: list[str],
        organization: str = "",
        local_subscription: bool = False,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a Rust webserver subscription.

        A Zimbra subscription uses the existing Zimbra account email. Set
        local_subscription for a local subscription and provide one or more
        manually managed recipient addresses. Local administrator access can
        manage all subscriptions.
        """
        return await execute(
            ctx,
            "subscription",
            "create_subscription",
            lambda: get_runtime(ctx).email_subscriptions.create_subscription(
                username,
                emails,
                organization,
                local_subscription,
                newsletter_profile,
                report_profile,
            ),
        )

    @server.tool()
    async def update_subscription(
        ctx: Context,
        subscription_id: str,
        username: str | None = None,
        emails: list[str] | None = None,
        organization: str | None = None,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Update a subscription by its Rust subscription ID.

        Zimbra subscriptions keep the existing Zimbra account email. Local
        subscriptions may update their manually supplied recipient addresses.
        The authenticated local administrator can update all subscriptions.
        """
        return await execute(
            ctx,
            "subscription",
            "update_subscription",
            lambda: get_runtime(ctx).email_subscriptions.update_subscription(
                subscription_id,
                username,
                emails,
                organization,
                newsletter_profile,
                report_profile,
            ),
        )

    @server.tool()
    async def delete_subscription(ctx: Context, subscription_id: str) -> dict[str, Any]:
        """Delete a subscription by its Rust subscription ID.

        Local administrator access can delete any subscription it can see.
        """
        return await execute(
            ctx,
            "subscription",
            "delete_subscription",
            lambda: get_runtime(ctx).email_subscriptions.delete_subscription(subscription_id),
        )
