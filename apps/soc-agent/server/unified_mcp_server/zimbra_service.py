"""Async Zimbra service with server-side identity binding."""

from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import datetime
from pathlib import PurePath
from typing import Any

from markitdown import MarkItDown, __version__ as markitdown_version

from unified_mcp_server.zimbra import (
    download_attachment,
    zimbra_get_message,
    zimbra_get_message_headers,
    zimbra_create_signature,
    zimbra_delete_signature,
    zimbra_list_folders,
    zimbra_list_signatures,
    zimbra_login,
    zimbra_move_message,
    zimbra_search_messages,
    zimbra_send_message,
)

from .account_store import AccountStore, StoredAccount
from .auth import ZimbraIdentity
from .attachment_converter import (
    MAX_ARCHIVE_MEMBERS as _MAX_ARCHIVE_MEMBERS,
    AttachmentConversionLimits,
    AttachmentConverter,
    _validate_archive_safety as _shared_validate_archive_safety,
    create_markitdown,
)
from .config import MarkItDownSettings, ZimbraSettings
from .errors import ConfigurationError, ServiceError
from .zimbra.core.service import _EmptyAccountStore


_HEADER_NAMES = {
    name.casefold(): name for name in (
        "Message-ID", "Reply-To", "Return-Path", "Received",
        "Authentication-Results", "Received-SPF", "DKIM-Signature",
        "ARC-Authentication-Results", "From", "To", "Date", "Subject",
    )
}
_DEFAULT_HEADER_NAMES = (
    "Message-ID", "Reply-To", "Return-Path", "Received",
    "Authentication-Results", "Received-SPF", "DKIM-Signature",
)
_SEARCH_QUERY_EXAMPLES = (
    "date:MM/DD/YYYY",
    "after:MM/DD/YYYY",
    "before:MM/DD/YYYY",
    "from:analyst@example.com",
    "subject:alert",
    "in:Inbox",
    "is:unread",
)
_INVALID_DATE_ALIAS = re.compile(r"(?:^|(?<=[\s(-]))d\s*:\s*(?P<value>[^\s()]+)", re.IGNORECASE)


def _query_validation_error(*, invalid_operator: str | None = None, suggested_query: str | None = None) -> ServiceError:
    details: dict[str, Any] = {
        "examples": list(_SEARCH_QUERY_EXAMPLES),
        "date_format": "MM/DD/YYYY (locale-sensitive)",
    }
    if invalid_operator:
        details["invalid_operator"] = invalid_operator
    if suggested_query:
        details["suggested_query"] = suggested_query
    message = (
        "Invalid Zimbra search query. The d:YYYYMMDD date form is not supported; use date:MM/DD/YYYY, "
        "after:MM/DD/YYYY, or before:MM/DD/YYYY instead."
        if invalid_operator == "d"
        else "Zimbra rejected the search query syntax. Use native operators such as date:MM/DD/YYYY, "
        "after:MM/DD/YYYY, before:MM/DD/YYYY, from:address, subject:text, in:Inbox, or is:unread."
    )
    return ServiceError(
        "query_validation_error",
        message,
        details=details,
    )


def _validate_search_query(query: str) -> None:
    match = next(
        (candidate for candidate in _INVALID_DATE_ALIAS.finditer(query) if query[:candidate.start()].count('"') % 2 == 0),
        None,
    )
    if match is None:
        return
    value = match.group("value")
    suggested_query = None
    if re.fullmatch(r"\d{8}", value):
        try:
            suggested_query = f"date:{datetime.strptime(value, '%Y%m%d'):%m/%d/%Y}"
        except ValueError:
            pass
    raise _query_validation_error(invalid_operator="d", suggested_query=suggested_query)


def _is_query_error(text: str) -> bool:
    return any(marker in text for marker in (
        "parse_error", "parse error", "invalid_search_query", "invalid search query",
        "invalid_query", "invalid query", "malformed query", "query syntax",
        "search syntax", "syntax error",
    ))


def _upstream_error(exc: Exception) -> ServiceError:
    """Convert upstream failures to useful messages without returning raw responses."""
    text = str(exc).lower()
    if re.search(r"\b(?:401|403)\b", text) or any(marker in text for marker in (
        "login failed", "authentication", "auth failed", "auth token", "auth_expired", "auth expired",
        "auth_invalid", "auth invalid", "auth_required", "auth required", "unauthorized",
    )):
        return ServiceError(
            "zimbra_auth_error",
            "Zimbra authentication failed. Check the email, optional login username, and password.",
            details={"exception_type": type(exc).__name__},
        )
    if any(marker in text for marker in ("certificate", "ssl", "tls")):
        return ServiceError(
            "zimbra_tls_error",
            "Zimbra TLS validation failed. Check the server certificate or ZIMBRA_VERIFY_SSL.",
            details={"exception_type": type(exc).__name__},
        )
    if any(marker in text for marker in ("connection", "timed out", "timeout", "name or service", "refused")):
        return ServiceError(
            "zimbra_connection_error",
            "Could not connect to Zimbra. Check ZIMBRA_HOST and network access.",
            retryable=True,
            details={"exception_type": type(exc).__name__},
        )
    if _is_query_error(text):
        return _query_validation_error()
    return ServiceError(
        "zimbra_api_error",
        "Zimbra request failed. Check ZIMBRA_HOST, TLS settings, and account credentials.",
        retryable=True,
        details={"exception_type": type(exc).__name__},
    )


class ZimbraService:
    def __init__(
        self,
        settings: ZimbraSettings,
        accounts: AccountStore | None = None,
        markitdown_settings: MarkItDownSettings | None = None,
        identity: ZimbraIdentity | None = None,
    ) -> None:
        self.settings = settings
        self.identity = identity
        if accounts is not None:
            self.accounts = accounts
        elif identity is not None:
            self.accounts = _EmptyAccountStore()
        else:
            self.accounts = AccountStore(settings.accounts_file, settings.key_file, settings.explicit_key)
        self.markitdown_settings = markitdown_settings or MarkItDownSettings()
        self._markitdown = _create_markitdown(self.markitdown_settings)
        self._attachment_converter = AttachmentConverter(self.markitdown_settings, self._markitdown)

    def account_count(self) -> int:
        if self.identity is not None:
            return 1
        return self.accounts.count() + (1 if self._legacy_account() else 0)

    def list_accounts(self) -> list[dict[str, Any]]:
        if self.identity is not None:
            return [StoredAccount(
                "authenticated",
                "Authenticated Zimbra account",
                self.identity.zimbra_email,
                "",
                "",
            ).agent_dict()]
        accounts = self.accounts.list_agent()
        legacy = self._legacy_account()
        if legacy:
            accounts.append(legacy.agent_dict())
        return accounts

    async def test_account(self, account: StoredAccount) -> None:
        await self._run_login(account)

    async def list_folders(self, account_id: str = "") -> dict[str, Any]:
        account = self._resolve_account(account_id)
        folders = await self._run(self._list_folders, account)
        return {"account_id": account.id, "account": account.agent_dict(), **folders}

    async def list_signatures(self, account_id: str = "") -> dict[str, Any]:
        account = self._resolve_account(account_id)
        signatures = await self._run(self._list_signatures, account)
        return {
            "account_id": account.id,
            "account": account.agent_dict(),
            "count": len(signatures),
            "signatures": signatures,
        }

    async def create_signature(
        self,
        name: str,
        text: str | None = None,
        html: str | None = None,
        account_id: str = "",
    ) -> dict[str, Any]:
        if not self.settings.allow_signature_write:
            raise ServiceError(
                "operation_disabled",
                "Zimbra signature writes are disabled. Set ZIMBRA_ALLOW_SIGNATURE_WRITE=true after review.",
            )
        name = str(name or "").strip()
        text = None if text is None else str(text)
        html = None if html is None else str(html)
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        if text is None and html is None:
            raise ServiceError("invalid_input", "text or html is required")
        if text == "" and html == "":
            raise ServiceError("invalid_input", "text or html cannot both be empty")
        account = self._resolve_account(account_id)
        signature = await self._run(self._create_signature, account, name, text, html)
        return {"account_id": account.id, "account": account.agent_dict(), "signature": signature}

    async def delete_signature(self, signature_id: str, account_id: str = "") -> dict[str, Any]:
        if not self.settings.allow_signature_write:
            raise ServiceError(
                "operation_disabled",
                "Zimbra signature writes are disabled. Set ZIMBRA_ALLOW_SIGNATURE_WRITE=true after review.",
            )
        signature_id = str(signature_id or "").strip()
        if not signature_id:
            raise ServiceError("invalid_input", "signature_id cannot be empty")
        account = self._resolve_account(account_id)
        deleted = await self._run(self._delete_signature, account, signature_id)
        return {"account_id": account.id, "account": account.agent_dict(), "deleted": deleted}

    async def use_signature_on_email(
        self,
        to: list[str] | str,
        subject: str,
        body: str,
        signature_id: str,
        body_format: str = "text",
        placement: str = "below",
        cc: list[str] | str | None = None,
        bcc: list[str] | str | None = None,
        account_id: str = "",
    ) -> dict[str, Any]:
        body_format = str(body_format or "").strip().lower()
        placement = str(placement or "").strip().lower()
        signature_id = str(signature_id or "").strip()
        if body_format not in {"text", "html"}:
            raise ServiceError("invalid_input", "body_format must be text or html")
        if placement not in {"above", "below"}:
            raise ServiceError("invalid_input", "placement must be above or below")
        if not signature_id:
            raise ServiceError("invalid_input", "signature_id cannot be empty")
        account = self._resolve_account(account_id)
        signatures = await self._run(self._list_signatures, account)
        signature = next((item for item in signatures if item["id"] == signature_id), None)
        if signature is None:
            raise ServiceError("not_found", "The selected Zimbra signature was not found.")
        value = signature[body_format]
        if not value:
            raise ServiceError("invalid_input", f"The selected signature has no {body_format} content.")
        body = str(body or "")
        separator = "<br><br>" if body_format == "html" else "\n\n"
        combined = f"{value}{separator}{body}" if placement == "above" and body else (
            f"{body}{separator}{value}" if body else value
        )
        draft = self.create_email_draft(to, subject, combined, cc, bcc, account.id)
        draft["draft"]["body_format"] = body_format
        draft["draft"]["signature"] = {"id": signature["id"], "name": signature["name"]}
        return draft

    async def search_emails(
        self,
        query: str,
        limit: int = 20,
        account_id: str = "",
        offset: int = 0,
    ) -> dict[str, Any]:
        query = query.strip()
        if not query:
            raise ServiceError("invalid_input", "query cannot be empty")
        _validate_search_query(query)
        limit = min(max(1, int(limit)), 100)
        offset = min(max(0, int(offset)), 100_000)
        account = self._resolve_account(account_id)
        messages = await self._run(self._search_emails, account, query, limit, offset)
        return {
            "account_id": account.id,
            "account": account.agent_dict(),
            "query": query,
            "offset": offset,
            "count": len(messages),
            "messages": messages,
        }

    async def get_email(
        self,
        message_id: str,
        account_id: str = "",
        max_body_chars: int = 20_000,
    ) -> dict[str, Any]:
        message_id = message_id.strip()
        if not message_id:
            raise ServiceError("invalid_input", "message_id cannot be empty")
        max_body_chars = min(max(1, int(max_body_chars)), 100_000)
        account = self._resolve_account(account_id)
        message = await self._run(self._get_email, account, message_id)
        if message is None:
            raise ServiceError("not_found", "Zimbra message was not found.")
        body = str(message.get("body", ""))
        message["body_characters"] = len(body)
        message["body_truncated"] = len(body) > max_body_chars
        if message["body_truncated"]:
            message["body"] = body[:max_body_chars]
        message["account_id"] = account.id
        message["account"] = account.agent_dict()
        return message

    async def get_email_headers(
        self,
        message_id: str,
        account_id: str = "",
        names: list[str] | None = None,
    ) -> dict[str, Any]:
        message_id = message_id.strip()
        if not message_id:
            raise ServiceError("invalid_input", "message_id cannot be empty")
        raw_names = names if names is not None else list(_DEFAULT_HEADER_NAMES)
        requested = []
        for raw_name in raw_names:
            canonical = _HEADER_NAMES.get(str(raw_name).strip().casefold())
            if canonical is None:
                raise ServiceError("invalid_input", "names contains an unsupported email header")
            if canonical not in requested:
                requested.append(canonical)
        if not requested or len(requested) > 12:
            raise ServiceError("invalid_input", "names must contain between 1 and 12 supported headers")
        account = self._resolve_account(account_id)
        result = await self._run(self._get_email_headers, account, message_id, requested)
        if result is None:
            raise ServiceError("not_found", "Zimbra message was not found.")
        return {
            "account_id": account.id,
            "account": account.agent_dict(),
            **result,
            "untrusted_evidence": True,
        }

    async def move_email(self, message_id: str, folder_id: str, account_id: str = "") -> dict[str, Any]:
        if not self.settings.allow_move:
            raise ServiceError(
                "operation_disabled",
                "Zimbra message moves are disabled. Set ZIMBRA_ALLOW_MOVE=true after review.",
            )
        message_id = str(message_id or "").strip()
        folder_id = str(folder_id or "").strip()
        if not message_id:
            raise ServiceError("invalid_input", "message_id cannot be empty")
        if not folder_id.isdigit():
            raise ServiceError("invalid_input", "folder_id must be a numeric Zimbra folder ID")
        account = self._resolve_account(account_id)
        result = await self._run(self._move_email, account, message_id, folder_id)
        return {"account_id": account.id, "account": account.agent_dict(), **result}

    async def get_attachment_text(
        self,
        message_id: str,
        part: str,
        account_id: str = "",
        max_chars: int = 20_000,
    ) -> dict[str, Any]:
        message_id = message_id.strip()
        part = part.strip()
        if not message_id or not part:
            raise ServiceError("invalid_input", "message_id and part cannot be empty")
        max_chars = min(max(1, int(max_chars)), self.settings.max_attachment_text_chars)
        account = self._resolve_account(account_id)
        return await self._run(self._get_attachment_text, account, message_id, part, max_chars)

    @staticmethod
    def _recipients(value: list[str] | str | None, field: str) -> list[str]:
        if isinstance(value, (list, tuple, set)):
            values = value
        else:
            values = str(value or "").split(",")
        recipients = []
        seen = set()
        for raw in values:
            address = str(raw).strip()
            if address and address not in seen:
                if not re.fullmatch(r"[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+", address):
                    raise ServiceError("invalid_input", f"Invalid {field} recipient.")
                seen.add(address)
                recipients.append(address)
        if field == "to" and not recipients:
            raise ServiceError("invalid_input", "At least one recipient is required.")
        return recipients

    def create_email_draft(
        self,
        to: list[str] | str,
        subject: str,
        body: str,
        cc: list[str] | str | None = None,
        bcc: list[str] | str | None = None,
        account_id: str = "",
    ) -> dict[str, Any]:
        """Build a local draft without contacting or writing to Zimbra."""
        recipients = self._recipients(to, "to")
        carbon_copy = self._recipients(cc, "cc")
        blind_carbon_copy = self._recipients(bcc, "bcc")
        subject = str(subject or "").strip()
        if not subject:
            raise ServiceError("invalid_input", "subject cannot be empty")
        account = self._resolve_account(account_id, require_host=False)
        return {
            "draft": {
                "to": recipients,
                "cc": carbon_copy,
                "bcc": blind_carbon_copy,
                "subject": subject,
                "body": str(body or ""),
                "account_id": account.id,
                "account": account.agent_dict(),
            },
            "editable_fields": ["to", "cc", "bcc", "subject", "body"],
        }

    async def send_email(
        self,
        to: list[str] | str,
        subject: str,
        body: str,
        account_id: str = "",
        *,
        cc: list[str] | str | None = None,
        bcc: list[str] | str | None = None,
        body_format: str = "text",
    ) -> dict[str, Any]:
        if not self.settings.allow_send:
            raise ServiceError(
                "operation_disabled",
                "Zimbra sending is disabled. Set ZIMBRA_ALLOW_SEND=true after review.",
            )
        body_format = str(body_format or "").strip().lower()
        if body_format not in {"text", "html"}:
            raise ServiceError("invalid_input", "body_format must be text or html")
        recipients = self._recipients(to, "to")
        carbon_copy = self._recipients(cc, "cc")
        blind_carbon_copy = self._recipients(bcc, "bcc")
        subject = str(subject or "").strip()
        if not subject:
            raise ServiceError("invalid_input", "subject cannot be empty")
        account = self._resolve_account(account_id)
        result = await self._run(
            self._send_email,
            account,
            recipients,
            subject,
            str(body or ""),
            carbon_copy,
            blind_carbon_copy,
            body_format,
        )
        return {
            "sent": True,
            "account_id": account.id,
            "account": account.agent_dict(),
            "recipients": recipients,
            "cc": carbon_copy,
            "bcc": blind_carbon_copy,
            "subject": subject,
            **result,
        }

    def _legacy_account(self) -> StoredAccount | None:
        if self.identity is not None:
            return None
        if self.settings.email and self.settings.password:
            return StoredAccount("legacy", "Legacy account", self.settings.email, "", self.settings.password)
        return None

    def _resolve_account(self, account_id: str, *, require_host: bool = True) -> StoredAccount:
        if require_host and not self.settings.host:
            raise ConfigurationError("Zimbra", ["ZIMBRA_HOST"])
        if self.identity is not None:
            if account_id.strip():
                raise ServiceError("account_selection_disabled", "Zimbra uses the authenticated user's account.")
            return StoredAccount(
                "authenticated",
                "Authenticated Zimbra account",
                self.identity.zimbra_email,
                "",
                "",
            )
        account_id = account_id.strip()
        if account_id:
            account = self.accounts.get(account_id)
            if account is None and account_id == "legacy":
                account = self._legacy_account()
            if account is None:
                raise ServiceError("account_not_found", "The selected email account was not found.")
            return account
        legacy = self._legacy_account()
        if legacy:
            return legacy
        if self.accounts.count() == 1:
            return self.accounts.list()[0]
        raise ServiceError("account_required", "Select an email account before using Zimbra tools.")

    def _config(self, account: StoredAccount) -> dict[str, object]:
        return self.settings.client_config(email=account.email, username=account.username, password=account.password)

    def _token(self, account: StoredAccount) -> str:
        return self.identity.zimbra_token if self.identity is not None else zimbra_login(self._config(account))

    async def _run_login(self, account: StoredAccount) -> None:
        if not self.settings.host:
            raise ConfigurationError("Zimbra", ["ZIMBRA_HOST"])
        try:
            await asyncio.to_thread(zimbra_login, self._config(account))
        except Exception as exc:
            raise _upstream_error(exc) from exc

    def _list_folders(self, account: StoredAccount) -> dict[str, Any]:
        token = self._token(account)
        folders = zimbra_list_folders(
            self.settings.host,
            token,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
            allow_insecure_http=self.settings.allow_insecure_http,
        )
        return {"count": len(folders), "folders": folders}

    def _list_signatures(self, account: StoredAccount) -> list[dict[str, Any]]:
        token = self._token(account)
        return zimbra_list_signatures(
            self.settings.host,
            token,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
            allow_insecure_http=self.settings.allow_insecure_http,
        )

    def _create_signature(
        self,
        account: StoredAccount,
        name: str,
        text: str | None,
        html: str | None,
    ) -> dict[str, Any]:
        token = self._token(account)
        options = {
            "verify_ssl": self.settings.verify_ssl,
            "timeout": self.settings.timeout,
            "allow_insecure_http": self.settings.allow_insecure_http,
        }
        existing = zimbra_list_signatures(self.settings.host, token, **options)
        if any(str(item.get("name", "")).casefold() == name.casefold() for item in existing):
            raise ServiceError("already_exists", "A Zimbra signature with that name already exists.")
        created = zimbra_create_signature(self.settings.host, token, name, text, html, **options)
        verified = next(
            (item for item in zimbra_list_signatures(self.settings.host, token, **options) if item["id"] == created["id"]),
            None,
        )
        if verified is None:
            raise ServiceError("signature_verification_failed", "Zimbra did not confirm the created signature.")
        return verified

    def _delete_signature(self, account: StoredAccount, signature_id: str) -> dict[str, Any]:
        token = self._token(account)
        options = {
            "verify_ssl": self.settings.verify_ssl,
            "timeout": self.settings.timeout,
            "allow_insecure_http": self.settings.allow_insecure_http,
        }
        existing = zimbra_list_signatures(self.settings.host, token, **options)
        signature = next((item for item in existing if item["id"] == signature_id), None)
        if signature is None:
            raise ServiceError("not_found", "The selected Zimbra signature was not found.")
        zimbra_delete_signature(self.settings.host, token, signature_id, **options)
        if any(item["id"] == signature_id for item in zimbra_list_signatures(self.settings.host, token, **options)):
            raise ServiceError("signature_verification_failed", "Zimbra still reports the deleted signature.")
        return signature

    def _send_email(
        self,
        account: StoredAccount,
        recipients: list[str],
        subject: str,
        body: str,
        cc: list[str],
        bcc: list[str],
        body_format: str,
    ) -> dict[str, Any]:
        token = self._token(account)
        return zimbra_send_message(
            self.settings.host,
            token,
            recipients,
            subject,
            body,
            cc=cc,
            bcc=bcc,
            body_format=body_format,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
            allow_insecure_http=self.settings.allow_insecure_http,
        )

    def _search_emails(self, account: StoredAccount, query: str, limit: int, offset: int) -> list[dict[str, Any]]:
        token = self._token(account)
        return zimbra_search_messages(
            self.settings.host,
            token,
            query,
            limit,
            offset,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
            allow_insecure_http=self.settings.allow_insecure_http,
        )

    def _get_email(self, account: StoredAccount, message_id: str) -> dict[str, Any] | None:
        token = self._token(account)
        return zimbra_get_message(
            self.settings.host,
            token,
            message_id,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
            allow_insecure_http=self.settings.allow_insecure_http,
        )

    def _get_email_headers(
        self,
        account: StoredAccount,
        message_id: str,
        names: list[str],
    ) -> dict[str, Any] | None:
        token = self._token(account)
        return zimbra_get_message_headers(
            self.settings.host,
            token,
            message_id,
            names,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
            allow_insecure_http=self.settings.allow_insecure_http,
        )

    def _move_email(self, account: StoredAccount, message_id: str, folder_id: str) -> dict[str, Any]:
        token = self._token(account)
        options = {
            "verify_ssl": self.settings.verify_ssl,
            "timeout": self.settings.timeout,
            "allow_insecure_http": self.settings.allow_insecure_http,
        }
        folders = zimbra_list_folders(self.settings.host, token, **options)
        destination = next((folder for folder in folders if str(folder.get("id", "")) == folder_id), None)
        if destination is None:
            raise ServiceError("folder_not_found", "The selected destination folder was not found.")
        before = zimbra_get_message(self.settings.host, token, message_id, **options)
        if before is None:
            raise ServiceError("not_found", "Zimbra message was not found.")
        original_folder_id = str(before.get("folder_id", ""))
        if original_folder_id == folder_id:
            return {
                "moved": False,
                "message_id": message_id,
                "original_folder_id": original_folder_id,
                "folder": destination,
            }
        zimbra_move_message(self.settings.host, token, message_id, folder_id, **options)
        after = zimbra_get_message(self.settings.host, token, message_id, **options)
        if after is None or str(after.get("folder_id", "")) != folder_id:
            raise ServiceError("move_verification_failed", "Zimbra did not confirm the message in the destination folder.")
        return {
            "moved": True,
            "message_id": message_id,
            "original_folder_id": original_folder_id,
            "folder": destination,
            "rollback": {
                "tool": "zimbra_move_email",
                "message_id": message_id,
                "folder_id": original_folder_id,
                "account_id": account.id,
            },
        }

    def _get_attachment_text(
        self,
        account: StoredAccount,
        message_id: str,
        part: str,
        max_chars: int,
    ) -> dict[str, Any]:
        token = self._token(account)
        message = zimbra_get_message(
            self.settings.host,
            token,
            message_id,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
            allow_insecure_http=self.settings.allow_insecure_http,
        )
        if message is None:
            raise ServiceError("not_found", "Zimbra message was not found.")
        attachment = next((item for item in message.get("attachments", []) if str(item.get("part", "")) == part), None)
        if attachment is None:
            raise ServiceError("attachment_not_found", "The selected Zimbra attachment was not found.")
        if int(attachment.get("size", 0) or 0) > self.settings.max_attachment_bytes:
            raise ServiceError("attachment_too_large", "The attachment exceeds the configured byte limit.")
        try:
            data = download_attachment(
                self._config(account), token, message_id, part, self.settings.max_attachment_bytes
            )
        except ValueError as exc:
            if str(exc) == "attachment_too_large":
                raise ServiceError("attachment_too_large", "The attachment exceeds the configured byte limit.") from exc
            raise
        filename = str(attachment.get("filename", ""))
        content_type = str(attachment.get("content_type", "")).split(";", 1)[0].lower()
        text, title = self._convert_attachment_text(data, filename, content_type)
        characters = len(text)
        extension = PurePath(filename).suffix.lower()
        return {
            "account_id": account.id,
            "account": account.agent_dict(),
            "message_id": message_id,
            "part": part,
            "filename": filename,
            "content_type": content_type,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "characters": characters,
            "text_truncated": characters > max_chars,
            "text": text[:max_chars],
            "title": title,
            "format": {
                "content_type": content_type,
                "extension": extension,
            },
            "converter": {
                "name": "markitdown",
                "version": markitdown_version,
            },
            "llm_enabled": self.markitdown_settings.llm_enabled,
        }

    def _convert_attachment_text(self, data: bytes, filename: str, content_type: str) -> tuple[str, str | None]:
        result = self._attachment_converter.convert(
            data,
            filename,
            content_type,
            AttachmentConversionLimits(
                max_bytes=self.settings.max_attachment_bytes,
                max_chars=2_000_000,
            ),
        )
        return result["text"], result["title"]

    async def _run(self, function, *args):
        try:
            return await asyncio.to_thread(function, *args)
        except ServiceError:
            raise
        except (ValueError, TypeError) as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        except Exception as exc:
            raise _upstream_error(exc) from exc


def _create_markitdown(settings: MarkItDownSettings) -> MarkItDown:
    """Compatibility seam retained for the existing Zimbra unit tests."""
    return create_markitdown(settings, markitdown_type=MarkItDown)


def _validate_archive_safety(data: bytes, filename: str, content_type: str) -> None:
    """Compatibility wrapper; archive checks are implemented by the shared converter."""
    _shared_validate_archive_safety(data, filename, content_type)
