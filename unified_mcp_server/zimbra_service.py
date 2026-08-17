"""Async Zimbra service with server-side account selection."""

from __future__ import annotations

import asyncio
from typing import Any

from plugin.zimbra import (
    zimbra_get_message,
    zimbra_list_folders,
    zimbra_login,
    zimbra_search_query,
    zimbra_send_email,
)

from .account_store import AccountStore, StoredAccount
from .config import ZimbraSettings
from .errors import ConfigurationError, ServiceError


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

    async def search_emails(self, query: str, limit: int = 20, account_id: str = "") -> dict[str, Any]:
        query = query.strip()
        if not query:
            raise ServiceError("invalid_input", "query cannot be empty")
        limit = min(max(1, int(limit)), 100)
        account = self._resolve_account(account_id)
        messages = await self._run(self._search_emails, account, query, limit)
        for message in messages:
            message["account_id"] = account.id
            message["account"] = account.agent_dict()
        return {"account_id": account.id, "account": account.agent_dict(), "query": query, "count": len(messages), "messages": messages}

    async def get_email(self, message_id: str, account_id: str = "") -> dict[str, Any]:
        message_id = message_id.strip()
        if not message_id:
            raise ServiceError("invalid_input", "message_id cannot be empty")
        account = self._resolve_account(account_id)
        message = await self._run(self._get_email, account, message_id)
        if message is None:
            raise ServiceError("not_found", "Zimbra message was not found.")
        message["account_id"] = account.id
        message["account"] = account.agent_dict()
        return message

    async def send_email(self, to: list[str], subject: str, body: str, account_id: str = "") -> dict[str, Any]:
        if not self.settings.allow_send:
            raise ServiceError(
                "operation_disabled",
                "Zimbra sending is disabled. Set ZIMBRA_ALLOW_SEND=true to enable it.",
            )
        recipients = [address.strip() for address in to if address.strip()]
        if not recipients:
            raise ServiceError("invalid_input", "At least one recipient is required.")
        if not subject.strip():
            raise ServiceError("invalid_input", "subject cannot be empty")
        account = self._resolve_account(account_id)
        await self._run(zimbra_send_email, account, recipients, subject, body)
        return {"sent": True, "account_id": account.id, "account": account.agent_dict(), "recipients": recipients, "subject": subject}

    def _legacy_account(self) -> StoredAccount | None:
        if self.settings.email and self.settings.password:
            return StoredAccount("legacy", "Legacy account", self.settings.email, "", self.settings.password)
        return None

    def _resolve_account(self, account_id: str) -> StoredAccount:
        if not self.settings.host:
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

    def _search_emails(self, account: StoredAccount, query: str, limit: int) -> list[dict[str, Any]]:
        token = zimbra_login(self._config(account))
        ids = zimbra_search_query(self.settings.host, token, query, limit, verify_ssl=self.settings.verify_ssl, timeout=self.settings.timeout)
        messages = []
        for message_id in ids:
            message = zimbra_get_message(self.settings.host, token, message_id, verify_ssl=self.settings.verify_ssl, timeout=self.settings.timeout)
            if message:
                message = dict(message)
                message.pop("body", None)
                messages.append(message)
        return messages

    def _get_email(self, account: StoredAccount, message_id: str) -> dict[str, Any] | None:
        token = zimbra_login(self._config(account))
        return zimbra_get_message(self.settings.host, token, message_id, verify_ssl=self.settings.verify_ssl, timeout=self.settings.timeout)

    async def _run(self, function, *args):
        try:
            return await asyncio.to_thread(function, *args)
        except ServiceError:
            raise
        except (ValueError, TypeError) as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        except Exception as exc:
            raise _upstream_error(exc) from exc
