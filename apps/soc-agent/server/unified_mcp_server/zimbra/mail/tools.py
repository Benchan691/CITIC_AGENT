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
    async def zimbra_list_signatures(ctx: Context, account_id: str = "") -> dict[str, Any]:
        """List Zimbra signatures with plain-text and HTML content."""
        return await execute(ctx, "zimbra", "list_signatures", lambda: get_runtime(ctx).zimbra_mail.list_signatures(account_id))

    @server.tool()
    async def zimbra_create_signature(
        ctx: Context,
        name: str,
        text: str | None = None,
        html: str | None = None,
        account_id: str = "",
    ) -> dict[str, Any]:
        """Create a Zimbra signature; requires ZIMBRA_ALLOW_SIGNATURE_WRITE and approval."""
        return await execute(
            ctx,
            "zimbra",
            "create_signature",
            lambda: get_runtime(ctx).zimbra_mail.create_signature(name, text, html, account_id),
        )

    @server.tool()
    async def zimbra_delete_signature(ctx: Context, signature_id: str, account_id: str = "") -> dict[str, Any]:
        """Delete one Zimbra signature by ID; requires ZIMBRA_ALLOW_SIGNATURE_WRITE and approval."""
        return await execute(
            ctx,
            "zimbra",
            "delete_signature",
            lambda: get_runtime(ctx).zimbra_mail.delete_signature(signature_id, account_id),
        )

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
    async def zimbra_send_email(
        ctx: Context,
        to: list[str],
        subject: str,
        body: str,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        account_id: str = "",
    ) -> dict[str, Any]:
        """Create a browser-editable local email draft; sending requires the draft's explicit Send button."""
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
    async def zimbra_use_signature_on_email(
        ctx: Context,
        to: list[str],
        subject: str,
        body: str,
        signature_id: str,
        body_format: str = "text",
        placement: str = "below",
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        account_id: str = "",
    ) -> dict[str, Any]:
        """Create a local editable draft with a selected Zimbra signature; it never sends."""
        return await execute(
            ctx,
            "zimbra",
            "use_signature_on_email",
            lambda: get_runtime(ctx).zimbra_mail.use_signature_on_email(
                to, subject, body, signature_id, body_format, placement, cc, bcc, account_id,
            ),
        )

    @server.tool()
    async def zimbra_move_email(ctx: Context, message_id: str, folder_id: str, account_id: str = "") -> dict[str, Any]:
        """Move one message to a validated folder and verify it; requires ZIMBRA_ALLOW_MOVE."""
        return await execute(ctx, "zimbra", "move_email", lambda: get_runtime(ctx).zimbra_mail.move_email(message_id, folder_id, account_id))
