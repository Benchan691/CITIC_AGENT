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
    async def zimbra_search_emails(ctx: Context, query: str, limit: int = 20, account_id: str = "", offset: int = 0) -> dict[str, Any]:
        """Search one page of Zimbra message metadata using native query syntax."""
        return await execute(ctx, "zimbra", "search_emails", lambda: get_runtime(ctx).zimbra_mail.search_emails(query, limit, account_id, offset))

    @server.tool()
    async def zimbra_get_email(ctx: Context, message_id: str, account_id: str = "", max_body_chars: int = 20_000) -> dict[str, Any]:
        """Retrieve one message with attachment metadata and a bounded body."""
        return await execute(ctx, "zimbra", "get_email", lambda: get_runtime(ctx).zimbra_mail.get_email(message_id, account_id, max_body_chars))

    @server.tool()
    async def zimbra_get_email_headers(ctx: Context, message_id: str, account_id: str = "", names: list[str] | None = None) -> dict[str, Any]:
        """Retrieve selected untrusted authentication and routing headers without the body."""
        return await execute(ctx, "zimbra", "get_email_headers", lambda: get_runtime(ctx).zimbra_mail.get_email_headers(message_id, account_id, names))

    @server.tool()
    async def zimbra_get_attachment_text(ctx: Context, message_id: str, part: str, account_id: str = "", max_chars: int = 20_000) -> dict[str, Any]:
        """Download one bounded Zimbra attachment and return bounded evidence text."""
        return await execute(ctx, "zimbra", "get_attachment_text", lambda: get_runtime(ctx).zimbra_mail.get_attachment_text(message_id, part, account_id, max_chars))

    @server.tool()
    async def zimbra_create_email_draft(
        ctx: Context,
        to: list[str],
        subject: str,
        body: str,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        account_id: str = "",
    ) -> dict[str, Any]:
        """Create a browser-editable local email draft; it never writes or sends through Zimbra."""
        async def create_draft() -> dict[str, Any]:
            return get_runtime(ctx).zimbra_mail.create_email_draft(
                to, subject, body, cc, bcc, account_id,
            )

        return await execute(
            ctx,
            "zimbra",
            "create_email_draft",
            create_draft,
        )

    @server.tool()
    async def zimbra_send_email(
        ctx: Context,
        to: list[str],
        subject: str,
        body: str,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        account_id: str = "",
    ) -> dict[str, Any]:
        """Send a plain-text Zimbra email when ZIMBRA_ALLOW_SEND is explicitly enabled."""
        return await execute(
            ctx,
            "zimbra",
            "send_email",
            lambda: get_runtime(ctx).zimbra_mail.send_email(
                to, subject, body, account_id, cc=cc, bcc=bcc,
            ),
        )

    @server.tool()
    async def zimbra_move_email(ctx: Context, message_id: str, folder_id: str, account_id: str = "") -> dict[str, Any]:
        """Move one message to a validated folder and verify it; requires ZIMBRA_ALLOW_MOVE."""
        return await execute(ctx, "zimbra", "move_email", lambda: get_runtime(ctx).zimbra_mail.move_email(message_id, folder_id, account_id))
