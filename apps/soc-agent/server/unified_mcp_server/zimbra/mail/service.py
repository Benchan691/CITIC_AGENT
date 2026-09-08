"""Mail capability built on the independent Zimbra Core boundary.

Extends the shared mail implementation with folder creation.
"""

from unified_mcp_server.blocking_io import run_blocking
from unified_mcp_server.request_context import remaining_seconds

from unified_mcp_server.account_store import StoredAccount
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.zimbra import zimbra_create_folder, zimbra_list_folders, zimbra_login
from unified_mcp_server.zimbra_service import ZimbraService, _upstream_error

class ZimbraMailService(ZimbraService):
    async def create_folder(self, name: str, parent_id: str = "1", account_id: str = "") -> dict[str, object]:
        if not self.settings.allow_folder_write:
            raise ServiceError(
                "operation_disabled",
                "Zimbra folder writes are disabled. Set ZIMBRA_ALLOW_FOLDER_WRITE=true after review.",
            )
        name = str(name or "").strip()
        parent_id = str(parent_id or "").strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        if "/" in name:
            raise ServiceError("invalid_input", "name must be a direct folder name and cannot contain '/'")
        if not parent_id:
            raise ServiceError("invalid_input", "parent_id cannot be empty")
        if not parent_id.isdigit():
            raise ServiceError("invalid_input", "parent_id must be a numeric Zimbra folder ID")
        account = self.core.resolve_account(account_id)
        try:
            folder = await run_blocking(self._create_folder, account, name, parent_id, principal=self.core.identity.user_id if self.core.identity else "legacy")
        except ServiceError:
            raise
        except ValueError as exc:
            raise ServiceError("zimbra_malformed_response", "Zimbra returned a malformed folder response.") from exc
        except Exception as exc:
            raise _upstream_error(exc) from exc
        return {"folder": folder}

    def _create_folder(self, account: StoredAccount, name: str, parent_id: str) -> dict[str, object]:
        token = self.core.identity.zimbra_token if self.core.identity is not None else zimbra_login(self._config(account))
        folders = zimbra_list_folders(
            self.settings.host,
            token,
            verify_ssl=self.settings.verify_ssl,
            timeout=remaining_seconds(self.settings.timeout),
            allow_insecure_http=self.settings.allow_insecure_http,
        )
        if not any(str(folder.get("id", "")) == parent_id for folder in folders):
            raise ServiceError("folder_parent_not_found", "The selected parent folder was not found.")
        return zimbra_create_folder(
            self.settings.host,
            token,
            name,
            parent_id,
            verify_ssl=self.settings.verify_ssl,
            timeout=remaining_seconds(self.settings.timeout),
            allow_insecure_http=self.settings.allow_insecure_http,
        )
