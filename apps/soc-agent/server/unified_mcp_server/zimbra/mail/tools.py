"""MCP registrations for Zimbra Mail tools."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from mcp.server.fastmcp import Context
from pydantic import Field


def register_tools(server, *, get_runtime, fresh_runtime, execute, success) -> None:
    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_list_folders(ctx: Context) -> dict[str, Any]:
        """List your mailbox folders: id, name, path, parent_id, unread_count,
        message_count. Use the full path with in:/under: or the returned ID
        with inid:/underid: in search queries. Never shorten /Inbox/SOC to SOC;
        ask the user if the intended folder is unclear.
        """
        return await execute(ctx, "zimbra", "list_folders", lambda: get_runtime(ctx).zimbra_mail.list_folders())

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_list_signatures(ctx: Context) -> dict[str, Any]:
        """List Zimbra signatures with plain-text and HTML content."""
        return await execute(ctx, "zimbra", "list_signatures", lambda: get_runtime(ctx).zimbra_mail.list_signatures())

    @server.tool()
    async def zimbra_create_signature(
        ctx: Context,
        name: str,
        text: str | None = None,
        html: str | None = None,
    ) -> dict[str, Any]:
        """Create a Zimbra signature; requires ZIMBRA_ALLOW_SIGNATURE_WRITE and approval."""
        return await execute(
            ctx,
            "zimbra",
            "create_signature",
            lambda: get_runtime(ctx).zimbra_mail.create_signature(name, text, html),
        )

    @server.tool()
    async def zimbra_delete_signature(ctx: Context, signature_id: str) -> dict[str, Any]:
        """Delete one Zimbra signature by ID; requires ZIMBRA_ALLOW_SIGNATURE_WRITE and approval."""
        return await execute(
            ctx,
            "zimbra",
            "delete_signature",
            lambda: get_runtime(ctx).zimbra_mail.delete_signature(signature_id),
        )

    @server.tool()
    async def zimbra_create_folder(ctx: Context, name: str, parent_id: str = "1") -> dict[str, Any]:
        """Create one direct child Zimbra folder when ZIMBRA_ALLOW_FOLDER_WRITE is enabled."""
        return await execute(ctx, "zimbra", "create_folder", lambda: get_runtime(ctx).zimbra_mail.create_folder(name, parent_id))

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_search_emails(
        ctx: Context,
        query: Annotated[str, Field(min_length=1, description='Native Zimbra query. Dates are optional. Example: in:"Inbox/SOC" date:09/30/2026.')],
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Search email metadata. Inputs: query (required), limit (default 20,
        maximum 100), offset (default 0). Put all filters in query; folder
        and date filters are optional.

        Common query fields:
        - Addresses: from:, to:, cc:, tofrom:, tocc:, fromcc:, tofromcc:.
        - Text: subject:, content:, or bare keywords.
        - Folders: in:, under:, inid:, underid:.
        - Dates: date:, after:, before:, mdate:.
        - Status/tags: is: (e.g. is:unread), has:attachment, tag:.
        - Attachments: filename:, attachment:, type:.
        - Size: size:, bigger:, larger:, smaller:.

        Use verified full folder paths, e.g. in:"Inbox/SOC", never a guessed
        basename. under: includes subfolders; IDs come from zimbra_list_folders.
        Absolute dates use MM/DD/YYYY (en_US); relative dates use e.g. after:-7d.
        Do not use d:YYYYMMDD or ISO dates. Quote phrases with spaces; combine
        filters with spaces (AND) and group OR alternatives in parentheses.
        Example: in:"Inbox/SOC" date:09/30/2026 (subject:alert OR subject:warning).
        On folder_not_found or query_validation_error, follow the returned
        guidance; preserve requested filters and correct query before retrying.
        """
        return await execute(
            ctx, "zimbra", "search_emails",
            lambda: get_runtime(ctx).zimbra_mail.search_emails(query, limit, offset=offset),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_get_email(ctx: Context, message_id: str, max_body_chars: int = 20_000) -> dict[str, Any]:
        """Retrieve one message with a bounded body and normal attachment metadata.

        Body-embedded image parts such as inline CID/logo images are omitted
        from attachments and reported only by a bounded skipped-image count.
        Review each listed attachment separately with
        ``zimbra_get_attachment_text``; a skipped result is non-fatal and
        should not stop review of the remaining attachments.
        """
        return await execute(ctx, "zimbra", "get_email", lambda: get_runtime(ctx).zimbra_mail.get_email(message_id, max_body_chars=max_body_chars))

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_get_email_headers(ctx: Context, message_id: str, names: list[str] | None = None) -> dict[str, Any]:
        """Retrieve selected untrusted authentication and routing headers without the body."""
        return await execute(ctx, "zimbra", "get_email_headers", lambda: get_runtime(ctx).zimbra_mail.get_email_headers(message_id, names=names))

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_get_attachment_text(ctx: Context, message_id: str, part: str, max_chars: int = 20_000) -> dict[str, Any]:
        """Read one bounded attachment. XLSX/XLS/CSV return a private file_id for
        excel_inspect and analysis tools; other documents use MarkItDown.
        Inspect spreadsheet headers, calculate with count/aggregate/group,
        and retrieve only relevant evidence rows. Use the original file for
        calculations even if a Markdown preview already exists.

        This includes attached email parts such as ``message/rfc822``. Review
        each normal attachment independently; if one file returns
        ``skipped: true``, continue with the message body and the other parts.

        For conversion-only failures such as unsupported or unavailable OCR,
        return ``skipped: true`` with a safe reason code so the caller can
        continue with the message body and other attachments. Authentication,
        download, invalid-part, and size-limit failures remain errors.
        """
        return await execute(ctx, "zimbra", "get_attachment_text", lambda: get_runtime(ctx).zimbra_mail.get_attachment_text(message_id, part, max_chars=max_chars))

    @server.tool(annotations={"readOnlyHint": True})
    async def zimbra_send_email(
        ctx: Context,
        action: Literal["send", "reply", "forward"] = "send",
        to: list[str] | None = None,
        subject: str = "",
        body: str = "",
        message_id: str | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        body_format: Literal["html"] = "html",
        reply_all: bool = False,
    ) -> dict[str, Any]:
        """Prepare a browser-editable local email draft for sending, replying, or forwarding; delivery requires the draft's explicit Send button.

        Use action='send' for a new message, action='reply' with message_id to
        reply to the source (recipients are derived unless supplied), or
        action='forward' with message_id and at least one To recipient. All
        drafts use HTML and the browser view shows a sanitized rendered
        preview; delivery remains behind its explicit Send button.

        Write body as an HTML fragment in a main div with inline
        color: #000; background-color: #fff; so the email includes readable
        defaults. Use simple paragraphs, lists, or tables with safe inline
        CSS. Escape customer/Splunk data before insertion (ampersands, angle
        brackets, and quotes); do not escape the whole HTML template. Pass
        HTML directly without Markdown fences, scripts, or external
        stylesheets. The preview defaults to black on white and preserves
        explicit HTML colors; check custom colors for readability.

        Example body: <div style="color: #000; background-color: #fff;"><p>Hello,</p><p>Update for Example &amp; Co.</p></div>
        """
        async def create_draft() -> dict[str, Any]:
            return await get_runtime(ctx).zimbra_mail.create_email_action_draft(
                action=action,
                to=to,
                subject=subject,
                body=body,
                message_id=message_id,
                cc=cc,
                bcc=bcc,
                body_format=body_format,
                reply_all=reply_all,
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
        body_format: Literal["html"] = "html",
        placement: str = "below",
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a local editable draft with a selected Zimbra signature; it never sends.

        Write body as an HTML fragment in a main div with inline
        color: #000; background-color: #fff;. Use simple paragraphs, lists,
        or tables with safe inline CSS, and escape customer/Splunk data
        (ampersands, angle brackets, and quotes) before insertion, not the
        whole template. Pass HTML directly without Markdown fences, scripts,
        or external stylesheets. The preview defaults to black on white;
        explicit body and signature colors are preserved, so check readability.

        Example body: <div style="color: #000; background-color: #fff;"><p>Hello,</p><p>Update for Example &amp; Co.</p></div>
        """
        return await execute(
            ctx,
            "zimbra",
            "use_signature_on_email",
            lambda: get_runtime(ctx).zimbra_mail.use_signature_on_email(
                to, subject, body, signature_id, body_format, placement, cc, bcc,
            ),
        )

    @server.tool()
    async def zimbra_move_email(ctx: Context, message_id: str, folder_id: str) -> dict[str, Any]:
        """Move one message to a validated folder and verify it; requires ZIMBRA_ALLOW_MOVE."""
        return await execute(ctx, "zimbra", "move_email", lambda: get_runtime(ctx).zimbra_mail.move_email(message_id, folder_id))
