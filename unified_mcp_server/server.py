"""Unified MCP server exposing prefixed Splunk and Zimbra tools."""

import logging
import warnings
from collections.abc import Awaitable, Callable, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass, replace
from hmac import compare_digest
from typing import Any
from urllib.parse import urlsplit

from dotenv import load_dotenv
from mcp.server.fastmcp import Context, FastMCP
from pydantic_settings.exceptions import IncompleteFieldDefinitionWarning
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .account_store import AccountStore, StoredAccount
from .config import ServerSettings, SplunkSettings
from .errors import ServiceError
from .responses import failure, success
from .splunk_service import SplunkService
from .model_providers import MODEL_PROVIDERS, is_provider, public_provider_config
from .settings_store import SettingsStore
from .zimbra_service import ZimbraService

load_dotenv()
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
    settings_store: SettingsStore | None = None

    @classmethod
    def create(cls, settings: ServerSettings, accounts: AccountStore | None = None) -> "Runtime":
        accounts = accounts or AccountStore(settings.zimbra.accounts_file, settings.zimbra.key_file, settings.zimbra.explicit_key)
        store = (
            SettingsStore(settings.app_postgres_uri, settings.settings_encryption_key)
            if settings.app_postgres_uri
            else None
        )
        return cls(settings, SplunkService(settings.splunk), ZimbraService(settings.zimbra, accounts), store)

    async def close(self) -> None:
        await self.splunk.close()


def create_server(settings: ServerSettings | None = None) -> FastMCP:
    settings = settings or ServerSettings.from_env()
    account_store = AccountStore(settings.zimbra.accounts_file, settings.zimbra.key_file, settings.zimbra.explicit_key)
    account_service = ZimbraService(settings.zimbra, account_store)
    settings_store = (
        SettingsStore(settings.app_postgres_uri, settings.settings_encryption_key)
        if settings.app_postgres_uri
        else None
    )
    runtime_ref: dict[str, Runtime | None] = {"value": None}

    @asynccontextmanager
    async def server_lifespan(_):
        runtime_settings = settings
        if settings_store is not None:
            try:
                stored = settings_store.load()
                if stored:
                    runtime_settings = replace(
                        settings,
                        splunk=_settings_splunk(settings.splunk, stored),
                    )
            except Exception:
                logger.exception("Could not load persisted settings at startup; using environment settings")
        runtime = Runtime.create(runtime_settings, account_store)
        runtime.settings_store = settings_store
        runtime_ref["value"] = runtime
        try:
            yield runtime
        finally:
            runtime_ref["value"] = None
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
        service: str,
        operation: str,
        action: Callable[[], Awaitable[Any]],
    ) -> dict[str, Any]:
        try:
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

    def _cors_headers(request: Request) -> dict[str, str]:
        origin = request.headers.get("origin", "")
        if origin and _origin_allowed(origin):
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Headers": "Content-Type, X-Account-Api-Key",
                "Access-Control-Allow-Methods": "GET, PUT, POST, PATCH, DELETE, OPTIONS",
                "Vary": "Origin",
            }
        return {}

    def _origin_allowed(origin: str) -> bool:
        if origin in settings.zimbra.allowed_origins:
            return True
        # Local development servers may choose another port or IPv6 loopback
        # when the default UI port is already occupied. Keep this exception
        # limited to loopback hosts; remote origins still require an explicit
        # MCP_ALLOWED_ORIGINS entry.
        parsed = urlsplit(origin)
        return parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}

    def _protected_route_allowed(request: Request) -> bool:
        origin = request.headers.get("origin", "")
        if origin and not _origin_allowed(origin):
            return False
        client_host = request.client.host if request.client else ""
        if settings.zimbra.account_api_key:
            return compare_digest(
                request.headers.get("x-account-api-key", ""),
                settings.zimbra.account_api_key,
            )
        return client_host in {"127.0.0.1", "::1", "localhost"}

    def _account_response(request: Request, data: Any, status_code: int = 200) -> JSONResponse:
        return JSONResponse(data, status_code=status_code, headers=_cors_headers(request))

    def _account_error(request: Request, code: str, message: str, status_code: int = 400) -> JSONResponse:
        return _account_response(request, {"ok": False, "error": {"code": code, "message": message}}, status_code)

    def _account_service() -> ZimbraService:
        current = runtime_ref["value"]
        return current.zimbra if current is not None else account_service

    def _settings_store() -> SettingsStore | None:
        current = runtime_ref["value"]
        return current.settings_store if current is not None else settings_store

    def _stored_settings() -> dict[str, Any]:
        store = _settings_store()
        return store.load() if store is not None else {}

    def _public_settings() -> dict[str, Any]:
        stored = _stored_settings()
        splunk = stored.get("splunk", {})
        splunk = splunk if isinstance(splunk, dict) else {}
        model = public_provider_config(stored)
        return {
            "splunk": {
                "url": str(splunk.get("url", settings.splunk.url)),
                "username": str(splunk.get("username", settings.splunk.username)),
                "configured": bool(
                    splunk.get("url", settings.splunk.url)
                    and splunk.get("username", settings.splunk.username)
                    and (splunk.get("password") or settings.splunk.password)
                ),
                "has_password": bool(splunk.get("password") or settings.splunk.password),
            },
            "model": model,
        }

    def _validate_splunk(payload: Mapping[str, Any]) -> tuple[str, str, str] | None:
        url = str(payload.get("url", "")).strip()
        username = str(payload.get("username", "")).strip()
        password = payload.get("password")
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.query or parsed.fragment:
            return None
        if not username or (password is not None and not isinstance(password, str)):
            return None
        return url.rstrip("/"), username, password if isinstance(password, str) else ""

    def _settings_splunk(base: SplunkSettings, stored: Mapping[str, Any]) -> SplunkSettings:
        raw = stored.get("splunk", {})
        raw = raw if isinstance(raw, Mapping) else {}
        url = str(raw.get("url", base.url)).strip().rstrip("/")
        parsed = urlsplit(url)
        host = parsed.hostname or base.host
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        return replace(
            base,
            host=host,
            port=port,
            url=url,
            username=str(raw.get("username", base.username)).strip(),
            password=str(raw.get("password", base.password)),
            token="",
        )

    async def _request_json(request: Request) -> dict[str, Any] | None:
        try:
            payload = await request.json()
        except Exception:
            return None
        return payload if isinstance(payload, dict) else None

    def _credential_fields(payload: dict[str, Any], *, require_password: bool) -> tuple[str, str, str, str] | None:
        label = str(payload.get("label", "")).strip()
        email = str(payload.get("email", "")).strip()
        username = str(payload.get("username", "")).strip()
        password = payload.get("password")
        if not email or "@" not in email:
            return None
        if require_password and (not isinstance(password, str) or not password):
            return None
        return label, email, username, password if isinstance(password, str) else ""

    @server.custom_route("/api/accounts", methods=["GET", "POST", "OPTIONS"], include_in_schema=False)
    async def accounts_route(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=_cors_headers(request))
        if not _protected_route_allowed(request):
            return _account_error(request, "forbidden", "Account management is not authorized.", 403)
        service = _account_service()
        if request.method == "GET":
            return _account_response(request, {"accounts": service.accounts.list_public()})
        payload = await _request_json(request)
        fields = _credential_fields(payload or {}, require_password=True)
        if fields is None:
            return _account_error(request, "invalid_input", "Email and password are required.")
        label, email, username, password = fields
        candidate = StoredAccount("pending", label or email, email, username, password)
        try:
            await service.test_account(candidate)
            account = service.accounts.add(label=label, email=email, username=username, password=password)
        except ServiceError as exc:
            return _account_error(request, exc.code, exc.message, 502)
        return _account_response(request, {"account": account.public_dict()}, 201)

    @server.custom_route("/api/accounts/{account_id}", methods=["PATCH", "DELETE", "OPTIONS"], include_in_schema=False)
    async def account_route(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=_cors_headers(request))
        if not _protected_route_allowed(request):
            return _account_error(request, "forbidden", "Account management is not authorized.", 403)
        service = _account_service()
        account_id = request.path_params["account_id"]
        current = service.accounts.get(account_id)
        if current is None:
            return _account_error(request, "account_not_found", "The selected email account was not found.", 404)
        if request.method == "DELETE":
            service.accounts.delete(account_id)
            return _account_response(request, {"deleted": True, "account_id": account_id})
        payload = await _request_json(request)
        if payload is None:
            return _account_error(request, "invalid_input", "A JSON object is required.")
        fields = _credential_fields(payload, require_password=False)
        email = current.email if fields is None else fields[1]
        if "email" in payload and (fields is None or not email):
            return _account_error(request, "invalid_input", "A valid email is required.")
        label = current.label if "label" not in payload else str(payload.get("label", "")).strip() or current.label
        username = current.username if "username" not in payload else str(payload.get("username", "")).strip()
        password = current.password if not isinstance(payload.get("password"), str) or not payload.get("password") else payload["password"]
        candidate = StoredAccount(current.id, label, email, username, password)
        try:
            await service.test_account(candidate)
            account = service.accounts.update(account_id, label=label, email=email, username=username, password=password)
        except ServiceError as exc:
            return _account_error(request, exc.code, exc.message, 502)
        return _account_response(request, {"account": account.public_dict()})

    @server.custom_route("/api/accounts/{account_id}/test", methods=["POST", "OPTIONS"], include_in_schema=False)
    async def account_test_route(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=_cors_headers(request))
        if not _protected_route_allowed(request):
            return _account_error(request, "forbidden", "Account management is not authorized.", 403)
        service = _account_service()
        account = service.accounts.get(request.path_params["account_id"])
        if account is None:
            return _account_error(request, "account_not_found", "The selected email account was not found.", 404)
        try:
            await service.test_account(account)
        except ServiceError as exc:
            return _account_error(request, exc.code, exc.message, 502)
        return _account_response(request, {"ok": True, "account_id": account.id})

    @server.custom_route("/api/splunk/test", methods=["POST", "OPTIONS"], include_in_schema=False)
    async def splunk_test_route(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=_cors_headers(request))
        if not _protected_route_allowed(request):
            return _account_error(request, "forbidden", "Splunk connectivity testing is not authorized.", 403)
        current = runtime_ref["value"]
        temporary_service = False
        payload = await _request_json(request)
        if payload and isinstance(payload.get("splunk"), Mapping):
            splunk_payload = payload["splunk"]
            splunk_fields = _validate_splunk(splunk_payload)
            if splunk_fields is None:
                return _account_error(request, "invalid_input", "A valid Splunk URL, username, and password are required.")
            try:
                stored = _stored_settings()
            except Exception:
                logger.exception("Could not load settings for a Splunk connection test")
                return _account_error(request, "settings_unavailable", "Saved server settings are temporarily unavailable.", 503)
            current_splunk = stored.get("splunk", {})
            current_splunk = current_splunk if isinstance(current_splunk, Mapping) else {}
            password = splunk_fields[2] or str(current_splunk.get("password", ""))
            if not password:
                return _account_error(request, "invalid_input", "A Splunk password is required.")
            candidate = {
                **stored,
                "splunk": {
                    "url": splunk_fields[0],
                    "username": splunk_fields[1],
                    "password": password,
                },
            }
            service = SplunkService(_settings_splunk(settings.splunk, candidate))
            temporary_service = True
        else:
            service = current.splunk if current is not None else SplunkService(_settings_splunk(settings.splunk, _stored_settings()))
        try:
            result = await service.test_connection()
        except ServiceError as exc:
            return _account_error(request, exc.code, exc.message, 502)
        except Exception:
            logger.exception("Unexpected Splunk connection test failure")
            return _account_error(request, "splunk_connection_failed", "The Splunk connection test failed.", 502)
        finally:
            if current is None or temporary_service:
                await service.close()
        service_settings = getattr(service, "settings", None)
        return _account_response(
            request,
            {
                "ok": True,
                "service": "splunk",
                "host": getattr(service_settings, "host", settings.splunk.host),
                "index_count": result["index_count"],
            },
        )

    @server.custom_route("/api/settings", methods=["GET", "PUT", "OPTIONS"], include_in_schema=False)
    async def settings_route(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=_cors_headers(request))
        if not _protected_route_allowed(request):
            return _account_error(request, "forbidden", "Settings management is not authorized.", 403)
        store = _settings_store()
        if store is None:
            return _account_error(
                request,
                "settings_storage_unavailable",
                "Configure APP_POSTGRES_URI and APP_SETTINGS_ENCRYPTION_KEY before saving UI settings.",
                503,
            )
        if request.method == "GET":
            try:
                return _account_response(request, _public_settings())
            except Exception:
                logger.exception("Could not load application settings")
                return _account_error(request, "settings_unavailable", "Saved server settings are temporarily unavailable.", 503)
        payload = await _request_json(request)
        if payload is None:
            return _account_error(request, "invalid_input", "A JSON object is required.")
        splunk_payload = payload.get("splunk")
        model_payload = payload.get("model")
        if not isinstance(splunk_payload, Mapping) or not isinstance(model_payload, Mapping):
            return _account_error(request, "invalid_input", "Splunk and model settings are required.")
        splunk_fields = _validate_splunk(splunk_payload)
        provider = str(model_payload.get("provider", "")).strip().lower()
        if splunk_fields is None or not is_provider(provider):
            return _account_error(request, "invalid_input", "A valid Splunk URL, username, and model provider are required.")
        try:
            current = store.load()
        except Exception:
            logger.exception("Could not load application settings before saving")
            return _account_error(request, "settings_unavailable", "Saved server settings are temporarily unavailable.", 503)
        current_splunk = current.get("splunk", {})
        current_splunk = current_splunk if isinstance(current_splunk, dict) else {}
        password = splunk_fields[2] if "password" in splunk_payload else str(current_splunk.get("password", ""))
        if not password:
            return _account_error(request, "invalid_input", "A Splunk password is required.")
        models = current.get("models", {})
        models = dict(models) if isinstance(models, dict) else {}
        current_model = models.get(provider, {})
        current_model = dict(current_model) if isinstance(current_model, dict) else {}
        if "api_key" in model_payload:
            api_key = model_payload.get("api_key")
            if api_key is None:
                current_model.pop("api_key", None)
            elif isinstance(api_key, str) and api_key.strip():
                current_model["api_key"] = api_key.strip()
            elif not isinstance(api_key, str):
                return _account_error(request, "invalid_input", "The model API key must be text.")
        if bool(MODEL_PROVIDERS[provider]["requires_api_key"]) and not current_model.get("api_key"):
            return _account_error(request, "invalid_input", f"An API key is required for {MODEL_PROVIDERS[provider]['label']}.")
        models[provider] = current_model
        updated = {
            **current,
            "default_provider": provider,
            "splunk": {
                "url": splunk_fields[0],
                "username": splunk_fields[1],
                "password": password,
            },
            "models": models,
        }
        try:
            store.save(updated)
        except Exception:
            logger.exception("Could not save application settings")
            return _account_error(request, "settings_unavailable", "Server settings could not be saved right now.", 503)
        current_runtime = runtime_ref["value"]
        if current_runtime is not None:
            await current_runtime.splunk.update_settings(_settings_splunk(settings.splunk, updated))
        return _account_response(request, _public_settings())

    @server.tool()
    async def system_get_status(ctx: Context) -> dict[str, Any]:
        """Show non-secret server configuration and service readiness."""
        current = runtime(ctx)
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
            data = runtime(ctx).splunk.validate(query, earliest_time, latest_time)
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
            "splunk",
            "search",
            lambda: runtime(ctx).splunk.search(query, earliest_time, latest_time, max_count),
        )

    @server.tool()
    async def splunk_list_indexes(ctx: Context) -> dict[str, Any]:
        """List Splunk indexes available to the configured account."""
        return await execute("splunk", "list_indexes", lambda: runtime(ctx).splunk.list_indexes())

    @server.tool()
    async def splunk_list_saved_searches(ctx: Context) -> dict[str, Any]:
        """List saved Splunk searches without running them."""
        return await execute(
            "splunk",
            "list_saved_searches",
            lambda: runtime(ctx).splunk.list_saved_searches(),
        )

    @server.tool()
    async def splunk_list_data_sources(ctx: Context, index: str = "") -> dict[str, Any]:
        """List index metadata to help scope a detection rule before authoring SPL."""
        return await execute(
            "splunk",
            "list_data_sources",
            lambda: runtime(ctx).splunk.list_data_sources(index),
        )

    @server.tool()
    async def splunk_get_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Retrieve one saved search as a detection-review record without running it."""
        return await execute(
            "splunk",
            "get_detection",
            lambda: runtime(ctx).splunk.get_detection(name),
        )

    @server.tool()
    async def splunk_validate_detection(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Validate a detection draft locally, including SPL safety and schedule metadata."""
        try:
            return success("splunk", "validate_detection", runtime(ctx).splunk.validate_detection(detection))
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
            "splunk",
            "backtest_detection",
            lambda: runtime(ctx).splunk.backtest_detection(detection, earliest_time, latest_time, max_count),
        )

    @server.tool()
    async def splunk_create_detection_draft(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Create a disabled saved-search draft; requires explicit detection write configuration."""
        return await execute(
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
            "splunk",
            "update_detection_draft",
            lambda: runtime(ctx).splunk.update_detection_draft(name, detection),
        )

    @server.tool()
    async def splunk_enable_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Enable a reviewed detection through a separate approval-gated operation."""
        return await execute(
            "splunk",
            "enable_detection",
            lambda: runtime(ctx).splunk.set_detection_enabled(name, True),
        )

    @server.tool()
    async def splunk_disable_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Disable a detection without deleting it, providing a reversible rollback."""
        return await execute(
            "splunk",
            "disable_detection",
            lambda: runtime(ctx).splunk.set_detection_enabled(name, False),
        )

    @server.tool()
    async def splunk_run_saved_search(ctx: Context, name: str) -> dict[str, Any]:
        """Run a saved Splunk search with actions disabled."""
        return await execute(
            "splunk",
            "run_saved_search",
            lambda: runtime(ctx).splunk.run_saved_search(name),
        )

    @server.tool()
    async def zimbra_list_accounts(ctx: Context) -> dict[str, Any]:
        """List safe identifiers for configured Zimbra accounts; never returns credentials."""
        return success("zimbra", "list_accounts", {"accounts": runtime(ctx).zimbra.list_accounts()})

    @server.tool()
    async def zimbra_list_folders(ctx: Context, account_id: str = "") -> dict[str, Any]:
        """List visible Zimbra mail folders and their message counts."""
        return await execute("zimbra", "list_folders", lambda: runtime(ctx).zimbra.list_folders(account_id))

    @server.tool()
    async def zimbra_search_emails(ctx: Context, query: str, limit: int = 20, account_id: str = "") -> dict[str, Any]:
        """Search Zimbra using native query syntax and return message metadata."""
        return await execute(
            "zimbra",
            "search_emails",
            lambda: runtime(ctx).zimbra.search_emails(query, limit, account_id),
        )

    @server.tool()
    async def zimbra_get_email(ctx: Context, message_id: str, account_id: str = "") -> dict[str, Any]:
        """Retrieve one Zimbra message, including its body and attachment metadata."""
        return await execute(
            "zimbra",
            "get_email",
            lambda: runtime(ctx).zimbra.get_email(message_id, account_id),
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
            "zimbra",
            "send_email",
            lambda: runtime(ctx).zimbra.send_email(to, subject, body, account_id),
        )

    return server


mcp = create_server()


def main() -> None:
    settings = ServerSettings.from_env()
    logging.basicConfig(level=getattr(logging, settings.log_level, logging.INFO))
    mcp.run(transport=settings.transport)


if __name__ == "__main__":
    main()
