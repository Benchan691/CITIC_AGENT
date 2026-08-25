"""Async Zimbra service with server-side account selection."""

from __future__ import annotations

import asyncio
import csv
import hashlib
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import PurePath
from typing import Any

from pypdf import PdfReader

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
from .config import ZimbraSettings
from .errors import ConfigurationError, ServiceError


_MAX_DOCX_XML_BYTES = 8_000_000
_MAX_PDF_PAGES = 100
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


def _upstream_error(exc: Exception) -> ServiceError:
    """Convert upstream failures to useful messages without returning raw responses."""
    text = str(exc).lower()
    if any(marker in text for marker in ("login failed", "authentication", "auth failed", "auth token")):
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
    return ServiceError(
        "zimbra_api_error",
        "Zimbra request failed. Check ZIMBRA_HOST, TLS settings, and account credentials.",
        retryable=True,
        details={"exception_type": type(exc).__name__},
    )


class ZimbraService:
    def __init__(self, settings: ZimbraSettings, accounts: AccountStore | None = None) -> None:
        self.settings = settings
        self.accounts = accounts or AccountStore(settings.accounts_file, settings.key_file, settings.explicit_key)

    def account_count(self) -> int:
        return self.accounts.count() + (1 if self._legacy_account() else 0)

    def list_accounts(self) -> list[dict[str, Any]]:
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
        if self.settings.email and self.settings.password:
            return StoredAccount("legacy", "Legacy account", self.settings.email, "", self.settings.password)
        return None

    def _resolve_account(self, account_id: str, *, require_host: bool = True) -> StoredAccount:
        if require_host and not self.settings.host:
            raise ConfigurationError("Zimbra", ["ZIMBRA_HOST"])
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

    async def _run_login(self, account: StoredAccount) -> None:
        if not self.settings.host:
            raise ConfigurationError("Zimbra", ["ZIMBRA_HOST"])
        try:
            await asyncio.to_thread(zimbra_login, self._config(account))
        except Exception as exc:
            raise _upstream_error(exc) from exc

    def _list_folders(self, account: StoredAccount) -> dict[str, Any]:
        token = zimbra_login(self._config(account))
        folders = zimbra_list_folders(self.settings.host, token, verify_ssl=self.settings.verify_ssl, timeout=self.settings.timeout)
        return {"count": len(folders), "folders": folders}

    def _list_signatures(self, account: StoredAccount) -> list[dict[str, Any]]:
        token = zimbra_login(self._config(account))
        return zimbra_list_signatures(
            self.settings.host,
            token,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
        )

    def _create_signature(
        self,
        account: StoredAccount,
        name: str,
        text: str | None,
        html: str | None,
    ) -> dict[str, Any]:
        token = zimbra_login(self._config(account))
        options = {"verify_ssl": self.settings.verify_ssl, "timeout": self.settings.timeout}
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
        token = zimbra_login(self._config(account))
        options = {"verify_ssl": self.settings.verify_ssl, "timeout": self.settings.timeout}
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
        token = zimbra_login(self._config(account))
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
        )

    def _search_emails(self, account: StoredAccount, query: str, limit: int, offset: int) -> list[dict[str, Any]]:
        token = zimbra_login(self._config(account))
        return zimbra_search_messages(
            self.settings.host,
            token,
            query,
            limit,
            offset,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
        )

    def _get_email(self, account: StoredAccount, message_id: str) -> dict[str, Any] | None:
        token = zimbra_login(self._config(account))
        return zimbra_get_message(self.settings.host, token, message_id, verify_ssl=self.settings.verify_ssl, timeout=self.settings.timeout)

    def _get_email_headers(
        self,
        account: StoredAccount,
        message_id: str,
        names: list[str],
    ) -> dict[str, Any] | None:
        token = zimbra_login(self._config(account))
        return zimbra_get_message_headers(
            self.settings.host,
            token,
            message_id,
            names,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
        )

    def _move_email(self, account: StoredAccount, message_id: str, folder_id: str) -> dict[str, Any]:
        token = zimbra_login(self._config(account))
        options = {"verify_ssl": self.settings.verify_ssl, "timeout": self.settings.timeout}
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
        token = zimbra_login(self._config(account))
        message = zimbra_get_message(
            self.settings.host,
            token,
            message_id,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
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
        text = _extract_attachment_text(data, filename, content_type)
        characters = len(text)
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
        }

    async def _run(self, function, *args):
        try:
            return await asyncio.to_thread(function, *args)
        except ServiceError:
            raise
        except (ValueError, TypeError) as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        except Exception as exc:
            raise _upstream_error(exc) from exc


class _HTMLText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())


def _decoded_text(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ServiceError("attachment_malformed", "The attachment is not valid UTF-8 text.") from exc


def _docx_text(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if any(info.flag_bits & 0x1 for info in archive.infolist()):
                raise ServiceError("attachment_encrypted", "Encrypted DOCX attachments are not supported.")
            document_info = archive.getinfo("word/document.xml")
            if document_info.file_size > _MAX_DOCX_XML_BYTES:
                raise ServiceError("attachment_too_complex", "The DOCX document exceeds the safe expansion limit.")
            document = ET.fromstring(archive.read(document_info))
    except ServiceError:
        raise
    except (zipfile.BadZipFile, KeyError, ET.ParseError) as exc:
        raise ServiceError("attachment_malformed", "The DOCX attachment could not be parsed.") from exc
    except RuntimeError as exc:
        if "encrypted" in str(exc).lower():
            raise ServiceError("attachment_encrypted", "Encrypted DOCX attachments are not supported.") from exc
        raise ServiceError("attachment_malformed", "The DOCX attachment could not be parsed.") from exc
    paragraphs = []
    for paragraph in document.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
        text = "".join(node.text or "" for node in paragraph.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"))
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def _pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ServiceError("attachment_encrypted", "Encrypted PDF attachments are not supported.")
        if len(reader.pages) > _MAX_PDF_PAGES:
            raise ServiceError("attachment_too_complex", "The PDF exceeds the safe page limit.")
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except ServiceError:
        raise
    except Exception as exc:
        raise ServiceError("attachment_malformed", "The PDF attachment could not be parsed.") from exc


def _extract_attachment_text(data: bytes, filename: str, content_type: str) -> str:
    suffix = PurePath(filename).suffix.lower()
    if content_type == "application/pdf" or suffix == ".pdf":
        return _pdf_text(data)
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or suffix == ".docx":
        return _docx_text(data)
    text_types = {".txt", ".csv", ".json", ".xml", ".html", ".htm", ".log"}
    if content_type.startswith("text/") or content_type in {"application/json", "application/xml"} or suffix in text_types:
        text = _decoded_text(data)
        if content_type == "text/html" or suffix in {".html", ".htm"}:
            parser = _HTMLText()
            try:
                parser.feed(text)
            except Exception as exc:
                raise ServiceError("attachment_malformed", "The HTML attachment could not be parsed.") from exc
            return "\n".join(parser.parts)
        if content_type == "application/json" or suffix == ".json":
            try:
                json.loads(text)
            except json.JSONDecodeError as exc:
                raise ServiceError("attachment_malformed", "The JSON attachment could not be parsed.") from exc
        if content_type == "text/csv" or suffix == ".csv":
            try:
                for _ in csv.reader(io.StringIO(text)):
                    pass
            except csv.Error as exc:
                raise ServiceError("attachment_malformed", "The CSV attachment could not be parsed.") from exc
        if content_type in {"application/xml", "text/xml"} or suffix == ".xml":
            try:
                ET.fromstring(text)
            except ET.ParseError as exc:
                raise ServiceError("attachment_malformed", "The XML attachment could not be parsed.") from exc
        return text
    raise ServiceError("attachment_unsupported", "This attachment type cannot be converted to text.")
