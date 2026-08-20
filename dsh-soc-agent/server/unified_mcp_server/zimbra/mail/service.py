"""Mail capability built on the independent Zimbra Core boundary.

The existing implementation remains the compatibility implementation; this
subclass gives new composition code a stable Mail-specific service surface
without changing its behavior.
"""

from unified_mcp_server.account_store import AccountStore, StoredAccount
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.zimbra_service import ZimbraService

from ..core.service import ZimbraCore


class ZimbraMailService(ZimbraService):
    def __init__(self, settings: ZimbraSettings, accounts: AccountStore | None = None) -> None:
        self.core = ZimbraCore(settings, accounts)
        self.settings = self.core.settings
        self.accounts = self.core.accounts

    def account_count(self) -> int:
        return self.core.account_count()

    def list_accounts(self):
        return self.core.list_accounts()

    def _legacy_account(self) -> StoredAccount | None:
        return self.core.legacy_account()

    def _resolve_account(self, account_id: str = "") -> StoredAccount:
        return self.core.resolve_account(account_id)

    def _config(self, account: StoredAccount) -> dict[str, object]:
        return self.core.client_config(account)
