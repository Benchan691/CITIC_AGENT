"""MCP registrations for Zimbra Mail tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context


def register_tools(server, *, get_runtime, fresh_runtime, execute, success) -> None:
    @server.tool()
    async def zimbra_list_accounts(ctx: Context) -> dict[str, Any]:
        """List safe identifiers for configured Zimbra accounts; never returns credentials."""
        current = await fresh_runtime(ctx)
        return success("zimbra", "list_accounts", {"accounts": current.zimbra_mail.list_accounts()})

    @server.tool()
    async def zimbra_list_folders(ctx: Context, account_id: str = "") -> dict[str, Any]:
        """List visible Zimbra mail folders and their message counts."""
        return await execute(ctx, "zimbra", "list_folders", lambda: get_runtime(ctx).zimbra_mail.list_folders(account_id))

    @server.tool()
    async def zimbra_create_folder(ctx: Context, name: str, parent_id: str = "1", account_id: str = "") -> dict[str, Any]:
        """Create one direct child Zimbra folder when ZIMBRA_ALLOW_FOLDER_WRITE is enabled."""
        return await execute(ctx, "zimbra", "create_folder", lambda: get_runtime(ctx).zimbra_mail.create_folder(name, parent_id, account_id))

    @server.tool()
    async def zimbra_search_emails(ctx: Context, query: str, limit: int = 20, account_id: str = "") -> dict[str, Any]:
        """Search Zimbra using native query syntax and return message metadata."""
        return await execute(ctx, "zimbra", "search_emails", lambda: get_runtime(ctx).zimbra_mail.search_emails(query, limit, account_id))

    @server.tool()
    async def zimbra_get_email(ctx: Context, message_id: str, account_id: str = "") -> dict[str, Any]:
        """Retrieve one Zimbra message, including its body and attachment metadata."""
        return await execute(ctx, "zimbra", "get_email", lambda: get_runtime(ctx).zimbra_mail.get_email(message_id, account_id))

    @server.tool()
    async def zimbra_get_attachment_text(ctx: Context, message_id: str, part: str, account_id: str = "") -> dict[str, Any]:
        """Download one bounded Zimbra attachment and extract supported evidence text."""
        return await execute(ctx, "zimbra", "get_attachment_text", lambda: get_runtime(ctx).zimbra_mail.get_attachment_text(message_id, part, account_id))

    @server.tool()
    async def zimbra_send_email(ctx: Context, to: list[str], subject: str, body: str, account_id: str = "") -> dict[str, Any]:
        """Send a plain-text Zimbra email when ZIMBRA_ALLOW_SEND is explicitly enabled."""
        return await execute(ctx, "zimbra", "send_email", lambda: get_runtime(ctx).zimbra_mail.send_email(to, subject, body, account_id))
