"""Unified MCP server exposing prefixed Splunk and Zimbra tools."""

import json
import asyncio
import hashlib
import inspect
import logging
import time
import uuid
import warnings
from contextvars import ContextVar
from collections import OrderedDict
from collections.abc import Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any

from mcp.server.fastmcp import Context, FastMCP
from pydantic_settings.exceptions import IncompleteFieldDefinitionWarning

from .account_store import AccountStore
from .auth import ZimbraIdentity, identity_for_session
from .catalog.service import CatalogService
from .catalog.tools import register_tools as register_catalog_tools
from .config import ServerSettings
from .env_loader import load_server_env
from .errors import ServiceError
from .email.service import EmailSubscriptionService
from .email.tools import register_tools as register_email_tools
from .postgres_store import PostgresAccountStore, PostgresStore
from .responses import failure, success
from .request_context import operation_budget, operation_context
from .blocking_io import run_blocking
from .splunk_service import SplunkService
from .splunk.search.tools import register_tools as register_search_tools
from .splunk.detection.tools import register_tools as register_detection_tools
from .splunk.security_queue.tools import register_tools as register_security_queue_tools
from .zimbra_service import ZimbraService
from .zimbra.mail.service import ZimbraMailService
from .zimbra.mail.tools import register_tools as register_mail_tools
from .zimbra.filters.service import ZimbraFilterService
from .zimbra.filters.tools import register_tools as register_filter_tools

load_server_env()
logger = logging.getLogger(__name__)
_request_runtime: ContextVar["Runtime | None"] = ContextVar("soc_request_runtime", default=None)
_correlation_id: ContextVar[str] = ContextVar("soc_correlation_id", default="")
warnings.filterwarnings(
    "ignore",
    message=r"Field 'lifespan' has an incomplete definition.*",
    category=IncompleteFieldDefinitionWarning,
)


class McpFailureEnvelope(Exception):
    """Carry a bounded failure envelope through the MCP error channel.

    Application failures must not look like successful tool results: raising
    makes the transport mark the result ``isError`` while ``__str__`` keeps the
    full ``ok:false`` envelope JSON that SOC editors already parse.
    """

    def __init__(self, payload: dict[str, Any]) -> None:
        super().__init__(json.dumps(payload, separators=(",", ":"), ensure_ascii=True))
        self.payload = payload


@dataclass
class Runtime:
    settings: ServerSettings
    splunk: SplunkService
    zimbra: ZimbraService
    email_subscriptions: EmailSubscriptionService
    zimbra_filters: ZimbraFilterService | None = None
    postgres: PostgresStore | None = None
    account_store: AccountStore | PostgresAccountStore | None = None
    catalog: CatalogService | None = None
    identity: ZimbraIdentity | None = None
    owns_services: bool = True
    config_revision: str = field(init=False)
    _mail_sessions: OrderedDict = field(default_factory=OrderedDict, init=False)

    def __post_init__(self):
        self.config_revision = hashlib.sha256(repr(self.settings.splunk).encode()).hexdigest()

    @property
    def splunk_search(self):
        return self.splunk.search_service

    @property
    def splunk_detection(self):
        return self.splunk.detection_service

    @property
    def splunk_security_queue(self):
        return self.splunk.security_queue_service

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
        splunk_service = SplunkService(settings.splunk)
        return cls(
            settings,
            splunk_service,
            ZimbraMailService(settings.zimbra, accounts, settings.markitdown),
            EmailSubscriptionService(settings.email_server),
            zimbra_filters=ZimbraFilterService(settings.zimbra, accounts),
            postgres=postgres,
            account_store=accounts,
            catalog=CatalogService.from_env(settings.splunk, splunk=splunk_service),
        )

    async def close(self) -> None:
        if not self.owns_services:
            return
        await self.splunk.close()
        await self.email_subscriptions.close()
        if self.catalog is not None:
            await self.catalog.close()
        if self.postgres is not None:
            await asyncio.to_thread(self.postgres.close)
        self._mail_sessions.clear()

    def for_identity(self, identity: ZimbraIdentity) -> "Runtime":
        """Create a request-scoped view without sharing mutable Zimbra state."""
        cached = self._mail_sessions.get(identity.session_id)
        if cached is not None and cached.identity == identity:
            self._mail_sessions.move_to_end(identity.session_id)
            return cached
        scoped = Runtime(
            settings=self.settings,
            splunk=self.splunk,
            zimbra=ZimbraMailService(
                self.settings.zimbra,
                None,
                self.settings.markitdown,
                identity,
            ),
            email_subscriptions=self.email_subscriptions,
            zimbra_filters=ZimbraFilterService(
                self.settings.zimbra,
                None,
                identity=identity,
            ),
            postgres=self.postgres,
            account_store=self.account_store,
            catalog=self.catalog,
            identity=identity,
            owns_services=False,
        )
        self._mail_sessions[identity.session_id] = scoped
        while len(self._mail_sessions) > 32:
            self._mail_sessions.popitem(last=False)
        return scoped


def create_server(settings: ServerSettings | None = None) -> FastMCP:
    postgres_store = PostgresStore.from_env()
    settings = settings or ServerSettings.from_env()

    # Normal operation never reads or writes the legacy stored-account table.
    # A no-op adapter keeps the compatibility service constructors simple while
    # ensuring an MCP caller cannot select a persisted mailbox credential.
    class EmptyAccountStore:
        def list(self):
            return []

        def list_agent(self):
            return []

        def count(self):
            return 0

        def get(self, _account_id):
            return None

    account_store = EmptyAccountStore()

    @asynccontextmanager
    async def server_lifespan(_):
        runtime = await asyncio.to_thread(Runtime.create, settings, account_store, postgres_store)
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
        action: Callable[[], Any],
    ) -> dict[str, Any]:
        correlation = _correlation_from_meta(ctx) or uuid.uuid4().hex[:12]
        correlation_token = _correlation_id.set(correlation)
        runtime_token = _request_runtime.set(None)
        started = time.monotonic()
        prepare_ms: float | None = None
        try:
            async with operation_budget(_meta_value(ctx, "soc_deadline_ms")):
                prepare_started = time.monotonic()
                await fresh_runtime(ctx)
                prepare_ms = (time.monotonic() - prepare_started) * 1000
                # Catalog callbacks use synchronous PostgreSQL APIs. Other
                # capabilities return either an awaitable or a local draft.
                data = await run_blocking(action, principal=operation_context.get().principal_id) if service == "catalog" else action()
                if inspect.isawaitable(data):
                    data = await data
                logger.debug(
                    "mcp_call ok service=%s operation=%s correlation_id=%s prepare_ms=%.1f execute_ms=%.1f",
                    service,
                    operation,
                    correlation,
                    prepare_ms,
                    (time.monotonic() - started) * 1000 - prepare_ms,
                )
                return success(service, operation, data)
        except ServiceError as exc:
            current = _request_runtime.get()
            if current is not None and exc.code == "zimbra_auth_error" and current.identity is not None and current.postgres is not None:
                await asyncio.to_thread(current.postgres.delete_app_session, current.identity.session_id)
            logger.info(
                "mcp_call failed service=%s operation=%s correlation_id=%s code=%s prepare_ms=%s total_ms=%.1f",
                service,
                operation,
                correlation,
                exc.code,
                "n/a" if prepare_ms is None else f"{prepare_ms:.1f}",
                (time.monotonic() - started) * 1000,
            )
            raise McpFailureEnvelope(
                failure(
                    service,
                    operation,
                    exc.code,
                    exc.message,
                    retryable=exc.retryable,
                    details=exc.details,
                )
            ) from exc
        except Exception:
            # Third-party exception strings can contain URLs, request bodies,
            # or credentials. Keep the operational log stable and credential-
            # free; the caller receives the same generic failure envelope.
            logger.error(
                "mcp_call unexpected service=%s operation=%s correlation_id=%s total_ms=%.1f",
                service,
                operation,
                correlation,
                (time.monotonic() - started) * 1000,
            )
            raise McpFailureEnvelope(
                failure(service, operation, "internal_error", "The MCP server encountered an unexpected error.")
            )

        finally:
            _request_runtime.reset(runtime_token)
            _correlation_id.reset(correlation_token)

    def _meta_value(ctx: Context, key: str):
        meta = getattr(ctx.request_context, "meta", None)
        return meta.get(key) if isinstance(meta, dict) else getattr(meta, key, None)

    def runtime(ctx: Context) -> Runtime:
        return _request_runtime.get() or ctx.request_context.lifespan_context

    def _session_id(ctx: Context) -> str:
        meta = getattr(ctx.request_context, "meta", None)
        if isinstance(meta, dict):
            return str(meta.get("soc_session_id", ""))
        return str(getattr(meta, "soc_session_id", "") or "")

    def _correlation_from_meta(ctx: Context) -> str:
        meta = getattr(ctx.request_context, "meta", None)
        if isinstance(meta, dict):
            value = str(meta.get("soc_correlation_id", "") or "")
        else:
            value = str(getattr(meta, "soc_correlation_id", "") or "")
        return value[:64]

    async def fresh_runtime(ctx: Context) -> Runtime:
        # A Context may service multiple sequential MCP calls. Never let a
        # previous call's identity survive a missing or expired metadata value.
        _request_runtime.set(None)
        base = ctx.request_context.lifespan_context
        if base.postgres is None:
            raise ServiceError("authentication_required", "Log in with Zimbra before using SOC Agent tools.")
        identity = await run_blocking(identity_for_session, base.postgres, _session_id(ctx), principal=_session_id(ctx))
        if identity is None:
            raise ServiceError("session_expired", "Your SOC Agent session has expired. Log in again.")
        operation_context.set(replace(
            operation_context.get(),
            principal_id=identity.user_id,
            investigation_id=str(_meta_value(ctx, "soc_investigation_id") or identity.session_id)[:128],
            customer_id=str(_meta_value(ctx, "soc_customer_id") or "")[:128],
            config_revision=base.config_revision,
            scheduled_at=datetime.fromisoformat(_meta_value(ctx, "soc_scheduled_for")).timestamp() if _meta_value(ctx, "soc_scheduled_for") else None,
            workload="scheduled" if _meta_value(ctx, "soc_workload") == "scheduled" else "interactive",
        ))
        scoped = base.for_identity(identity)
        _request_runtime.set(scoped)
        return scoped

    @server.tool(annotations={"readOnlyHint": True})
    async def system_get_status(ctx: Context) -> dict[str, Any]:
        """Show non-sensitive service readiness; detailed configuration is administrator-only."""
        async def status():
            return runtime(ctx).settings.public_readiness()
        return await execute(ctx, "system", "get_status", status)

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
    register_security_queue_tools(
        server,
        get_runtime=runtime,
        execute=execute,
    )
    register_catalog_tools(
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
