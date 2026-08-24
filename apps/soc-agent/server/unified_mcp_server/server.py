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
from .email.service import EmailSubscriptionService
from .email.tools import register_tools as register_email_tools
from .postgres_store import PostgresAccountStore, PostgresStore
from .responses import failure, success
from .splunk_service import SplunkService
from .splunk.search.tools import register_tools as register_search_tools
from .splunk.detection.tools import register_tools as register_detection_tools
from .zimbra_service import ZimbraService
from .zimbra.mail.service import ZimbraMailService
from .zimbra.mail.tools import register_tools as register_mail_tools
from .zimbra.filters.service import ZimbraFilterService
from .zimbra.filters.tools import register_tools as register_filter_tools

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
    email_subscriptions: EmailSubscriptionService
    zimbra_filters: ZimbraFilterService | None = None
    postgres: PostgresStore | None = None
    account_store: AccountStore | PostgresAccountStore | None = None

    @property
    def splunk_search(self):
        return self.splunk.search_service

    @property
    def splunk_detection(self):
        return self.splunk.detection_service

    @property
    def zimbra_mail(self):
        return self.zimbra

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
            ZimbraMailService(settings.zimbra, accounts),
            EmailSubscriptionService(settings.email_server),
            zimbra_filters=ZimbraFilterService(settings.zimbra, accounts),
            postgres=postgres,
            account_store=accounts,
        )

    async def close(self) -> None:
        await self.splunk.close()
        await self.email_subscriptions.close()

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
            self.zimbra = ZimbraMailService(updated.zimbra, self.account_store)
            self.zimbra_filters = ZimbraFilterService(updated.zimbra, self.account_store)
        if updated.email_server != self.settings.email_server:
            await self.email_subscriptions.close()
            self.email_subscriptions = EmailSubscriptionService(updated.email_server)
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

    register_search_tools(
        server,
        get_runtime=runtime,
        fresh_runtime=fresh_runtime,
        execute=execute,
        success=success,
        failure=failure,
        service_error=ServiceError,
    )
    register_detection_tools(
        server,
        get_runtime=runtime,
        fresh_runtime=fresh_runtime,
        execute=execute,
        success=success,
        failure=failure,
        service_error=ServiceError,
    )

    register_mail_tools(
        server,
        get_runtime=runtime,
        fresh_runtime=fresh_runtime,
        execute=execute,
        success=success,
    )
    register_filter_tools(
        server,
        get_runtime=runtime,
        fresh_runtime=fresh_runtime,
        execute=execute,
    )
    register_email_tools(
        server,
        get_runtime=runtime,
        execute=execute,
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
