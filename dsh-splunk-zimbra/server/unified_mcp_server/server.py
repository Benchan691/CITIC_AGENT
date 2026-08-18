"""Unified MCP server exposing prefixed Splunk and Zimbra tools."""

import logging
import warnings
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from os import environ
from typing import Any

from mcp.server.fastmcp import Context, FastMCP
from pydantic_settings.exceptions import IncompleteFieldDefinitionWarning

from .account_store import AccountStore
from .config import ServerSettings
from .env_loader import load_server_env
from .errors import ServiceError
from .postgres_store import PostgresAccountStore, PostgresStore
from .responses import failure, success
from .splunk_service import SplunkService
from .zimbra_service import ZimbraService

load_server_env()
logger = logging.getLogger(__name__)
warnings.filterwarnings(
    "ignore",
    message=r"Field 'lifespan' has an incomplete definition.*",
    category=IncompleteFieldDefinitionWarning,
)


@dataclass
class Runtime:
    settings: ServerSettings
    splunk: SplunkService
    zimbra: ZimbraService
    postgres: PostgresStore | None = None
    account_store: AccountStore | PostgresAccountStore | None = None

    @classmethod
    def create(
        cls,
        settings: ServerSettings,
        accounts: AccountStore | PostgresAccountStore | None = None,
        postgres: PostgresStore | None = None,
    ) -> "Runtime":
        accounts = accounts or AccountStore(
            settings.zimbra.accounts_file,
            settings.zimbra.key_file,
            settings.zimbra.explicit_key,
        )
        return cls(
            settings,
            SplunkService(settings.splunk),
            ZimbraService(settings.zimbra, accounts),
            postgres=postgres,
            account_store=accounts,
        )

    async def close(self) -> None:
        await self.splunk.close()

    async def refresh(self) -> None:
        if self.postgres is None:
            return
        updated = ServerSettings.from_store(self.postgres)
        if updated.splunk != self.settings.splunk:
            await self.splunk.close()
            self.splunk = SplunkService(updated.splunk)
        if updated.zimbra != self.settings.zimbra:
            if self.account_store is None:
                self.account_store = PostgresAccountStore(self.postgres)
            self.zimbra = ZimbraService(updated.zimbra, self.account_store)
        self.settings = updated


def create_server(settings: ServerSettings | None = None) -> FastMCP:
    postgres_store = PostgresStore.from_env()
    settings = settings or ServerSettings.from_store(postgres_store)
    file_account_store = AccountStore(
        settings.zimbra.accounts_file,
        settings.zimbra.key_file,
        settings.zimbra.explicit_key,
    )
    if postgres_store is not None:
        postgres_store.migrate_env_config(environ)
        postgres_store.migrate_account_store(file_account_store)
        account_store: AccountStore | PostgresAccountStore = PostgresAccountStore(postgres_store)
    else:
        account_store = file_account_store

    @asynccontextmanager
    async def server_lifespan(_):
        runtime = Runtime.create(settings, account_store, postgres_store)
        try:
            yield runtime
        finally:
            await runtime.close()

    server = FastMCP(
        settings.name,
        instructions=settings.description,
        lifespan=server_lifespan,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )

    async def execute(
        ctx: Context,
        service: str,
        operation: str,
        action: Callable[[], Awaitable[Any]],
    ) -> dict[str, Any]:
        try:
            await fresh_runtime(ctx)
            return success(service, operation, await action())
        except ServiceError as exc:
            return failure(
                service,
                operation,
                exc.code,
                exc.message,
                retryable=exc.retryable,
                details=exc.details,
            )
        except Exception:
            logger.exception("Unexpected %s.%s failure", service, operation)
            return failure(service, operation, "internal_error", "The MCP server encountered an unexpected error.")

    def runtime(ctx: Context) -> Runtime:
        return ctx.request_context.lifespan_context

    async def fresh_runtime(ctx: Context) -> Runtime:
        current = runtime(ctx)
        await current.refresh()
        return current

    @server.tool()
    async def system_get_status(ctx: Context) -> dict[str, Any]:
        """Show non-secret server configuration and service readiness."""
        current = await fresh_runtime(ctx)
        return success("system", "get_status", current.settings.public_status(current.zimbra.account_count()))

    @server.tool()
    async def splunk_validate_query(
        ctx: Context,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
    ) -> dict[str, Any]:
        """Risk-score an SPL query locally without executing it."""
        try:
            data = (await fresh_runtime(ctx)).splunk.validate(query, earliest_time, latest_time)
            return success("splunk", "validate_query", data)
        except ServiceError as exc:
            return failure("splunk", "validate_query", exc.code, exc.message, details=exc.details)

    @server.tool()
    async def splunk_search(
        ctx: Context,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_count: int = 100,
    ) -> dict[str, Any]:
        """Execute a guarded Splunk oneshot search and return structured events."""
        return await execute(
            ctx,
            "splunk",
            "search",
            lambda: runtime(ctx).splunk.search(query, earliest_time, latest_time, max_count),
        )

    @server.tool()
    async def splunk_list_indexes(ctx: Context) -> dict[str, Any]:
        """List Splunk indexes available to the configured account."""
        return await execute(ctx, "splunk", "list_indexes", lambda: runtime(ctx).splunk.list_indexes())

    @server.tool()
    async def splunk_list_saved_searches(ctx: Context) -> dict[str, Any]:
        """List saved Splunk searches without running them."""
        return await execute(
            ctx,
            "splunk",
            "list_saved_searches",
            lambda: runtime(ctx).splunk.list_saved_searches(),
        )

    @server.tool()
    async def splunk_list_data_sources(ctx: Context, index: str = "") -> dict[str, Any]:
        """List index metadata to help scope a detection rule before authoring SPL."""
        return await execute(
            ctx,
            "splunk",
            "list_data_sources",
            lambda: runtime(ctx).splunk.list_data_sources(index),
        )

    @server.tool()
    async def splunk_get_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Retrieve one saved search as a detection-review record without running it."""
        return await execute(
            ctx,
            "splunk",
            "get_detection",
            lambda: runtime(ctx).splunk.get_detection(name),
        )

    @server.tool()
    async def splunk_validate_detection(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Validate a detection draft locally, including SPL safety and schedule metadata."""
        try:
            current = await fresh_runtime(ctx)
            return success("splunk", "validate_detection", current.splunk.validate_detection(detection))
        except ServiceError as exc:
            return failure("splunk", "validate_detection", exc.code, exc.message, details=exc.details)

    @server.tool()
    async def splunk_backtest_detection(
        ctx: Context,
        detection: dict[str, Any],
        earliest_time: str = "-7d",
        latest_time: str = "now",
        max_count: int = 100,
    ) -> dict[str, Any]:
        """Run a bounded, read-only historical sample of a validated detection."""
        return await execute(
            ctx,
            "splunk",
            "backtest_detection",
            lambda: runtime(ctx).splunk.backtest_detection(detection, earliest_time, latest_time, max_count),
        )

    @server.tool()
    async def splunk_create_detection_draft(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Create a disabled saved-search draft; requires explicit detection write configuration."""
        return await execute(
            ctx,
            "splunk",
            "create_detection_draft",
            lambda: runtime(ctx).splunk.create_detection_draft(detection),
        )

    @server.tool()
    async def splunk_update_detection_draft(
        ctx: Context,
        name: str,
        detection: dict[str, Any],
    ) -> dict[str, Any]:
        """Update a disabled detection draft after re-validating its complete definition."""
        return await execute(
            ctx,
            "splunk",
            "update_detection_draft",
            lambda: runtime(ctx).splunk.update_detection_draft(name, detection),
        )

    @server.tool()
    async def splunk_enable_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Enable a reviewed detection through a separate approval-gated operation."""
        return await execute(
            ctx,
            "splunk",
            "enable_detection",
            lambda: runtime(ctx).splunk.set_detection_enabled(name, True),
        )

    @server.tool()
    async def splunk_disable_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Disable a detection without deleting it, providing a reversible rollback."""
        return await execute(
            ctx,
            "splunk",
            "disable_detection",
            lambda: runtime(ctx).splunk.set_detection_enabled(name, False),
        )

    @server.tool()
    async def splunk_run_saved_search(ctx: Context, name: str) -> dict[str, Any]:
        """Run a saved Splunk search with actions disabled."""
        return await execute(
            ctx,
            "splunk",
            "run_saved_search",
            lambda: runtime(ctx).splunk.run_saved_search(name),
        )

    @server.tool()
    async def zimbra_list_accounts(ctx: Context) -> dict[str, Any]:
        """List safe identifiers for configured Zimbra accounts; never returns credentials."""
        current = await fresh_runtime(ctx)
        return success("zimbra", "list_accounts", {"accounts": current.zimbra.list_accounts()})

    @server.tool()
    async def zimbra_list_folders(ctx: Context, account_id: str = "") -> dict[str, Any]:
        """List visible Zimbra mail folders and their message counts."""
        return await execute(ctx, "zimbra", "list_folders", lambda: runtime(ctx).zimbra.list_folders(account_id))

    @server.tool()
    async def zimbra_search_emails(ctx: Context, query: str, limit: int = 20, account_id: str = "") -> dict[str, Any]:
        """Search Zimbra using native query syntax and return message metadata."""
        return await execute(
            ctx,
            "zimbra",
            "search_emails",
            lambda: runtime(ctx).zimbra.search_emails(query, limit, account_id),
        )

    @server.tool()
    async def zimbra_get_email(ctx: Context, message_id: str, account_id: str = "") -> dict[str, Any]:
        """Retrieve one Zimbra message, including its body and attachment metadata."""
        return await execute(
            ctx,
            "zimbra",
            "get_email",
            lambda: runtime(ctx).zimbra.get_email(message_id, account_id),
        )

    @server.tool()
    async def zimbra_get_attachment_text(
        ctx: Context,
        message_id: str,
        part: str,
        account_id: str = "",
    ) -> dict[str, Any]:
        """Download one bounded Zimbra attachment and extract supported evidence text."""
        return await execute(
            ctx,
            "zimbra",
            "get_attachment_text",
            lambda: runtime(ctx).zimbra.get_attachment_text(message_id, part, account_id),
        )

    @server.tool()
    async def zimbra_send_email(
        ctx: Context,
        to: list[str],
        subject: str,
        body: str,
        account_id: str = "",
    ) -> dict[str, Any]:
        """Send a plain-text Zimbra email when ZIMBRA_ALLOW_SEND is explicitly enabled."""
        return await execute(
            ctx,
            "zimbra",
            "send_email",
            lambda: runtime(ctx).zimbra.send_email(to, subject, body, account_id),
        )

    return server


mcp = create_server()


def main() -> None:
    settings = ServerSettings.from_env()
    logging.basicConfig(level=getattr(logging, settings.log_level, logging.INFO))
    try:
        mcp.run(transport=settings.transport)
    except KeyboardInterrupt:
        logger.info("MCP server stopped by the host.")


if __name__ == "__main__":
    main()
