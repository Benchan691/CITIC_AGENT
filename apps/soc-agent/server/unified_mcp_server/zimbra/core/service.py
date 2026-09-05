"""Zimbra account selection and connection configuration primitives."""

from __future__ import annotations

from typing import Any

from unified_mcp_server.account_store import AccountStore, StoredAccount
from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ConfigurationError, ServiceError
from unified_mcp_server.request_context import remaining_seconds


class _EmptyAccountStore:
    """Avoid touching legacy credential storage for identity-bound services."""

    def list(self) -> list[StoredAccount]:
        return []

    def list_agent(self) -> list[StoredAccount]:
        return []

    def count(self) -> int:
        return 0

    def get(self, _account_id: str) -> StoredAccount | None:
        return None


class ZimbraCore:
    def __init__(
        self,
        settings: ZimbraSettings,
        accounts: AccountStore | None = None,
        identity: ZimbraIdentity | None = None,
    ) -> None:
        self.settings = settings
        if accounts is not None:
            self.accounts = accounts
        elif identity is not None:
            self.accounts = _EmptyAccountStore()
        else:
            self.accounts = AccountStore(settings.accounts_file, settings.key_file, settings.explicit_key)
        self.identity = identity

    def account_count(self) -> int:
        if self.identity is not None:
            return 1
        return self.accounts.count() + (1 if self.legacy_account() else 0)

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
        legacy = self.legacy_account()
        if legacy:
            accounts.append(legacy.agent_dict())
        return accounts

    def legacy_account(self) -> StoredAccount | None:
        if self.identity is not None:
            return None
        if self.settings.email and self.settings.password:
            return StoredAccount("legacy", "Legacy account", self.settings.email, "", self.settings.password)
        return None

    def resolve_account(self, account_id: str = "", *, require_host: bool = True) -> StoredAccount:
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
                account = self.legacy_account()
            if account is None:
                raise ServiceError("account_not_found", "The selected email account was not found.")
            return account
        legacy = self.legacy_account()
        if legacy:
            return legacy
        if self.accounts.count() == 1:
            return self.accounts.list()[0]
        raise ServiceError("account_required", "Select an email account before using Zimbra tools.")

    def client_config(self, account: StoredAccount) -> dict[str, object]:
        return {**self.settings.client_config(email=account.email, username=account.username, password=account.password), "timeout": remaining_seconds(self.settings.timeout)}
