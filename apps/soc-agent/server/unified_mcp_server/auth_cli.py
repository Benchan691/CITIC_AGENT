"""Private host-side commands for authenticated application sessions."""

from __future__ import annotations

import json
import sys
import asyncio
from contextvars import ContextVar
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from threading import Lock
from typing import Any

from .config import ServerSettings
from .env_loader import load_server_env
from .auth import ZimbraIdentity, public_session
from .catalog.service import CatalogService
from .errors import ServiceError
from .zimbra.mail.service import ZimbraMailService
from .postgres_store import PostgresStore, normalize_zimbra_email
from .splunk_service import SplunkService
from .zimbra import zimbra_login
from .blocking_io import run_blocking
from .request_context import operation_budget


@dataclass
class CommandRuntime:
    store: PostgresStore | None
    settings: ServerSettings
    splunk: SplunkService | None = None
    catalog: CatalogService | None = None
    lock: Lock = field(default_factory=Lock)

    @classmethod
    def create(cls):
        settings = ServerSettings.from_env()
        store = PostgresStore.from_env()
        return cls(store, settings)

    def splunk_service(self):
        with self.lock:
            if self.splunk is None:
                self.splunk = SplunkService(self.settings.splunk)
            return self.splunk

    def catalog_service(self):
        splunk = self.splunk_service()
        with self.lock:
            if self.catalog is None:
                self.catalog = CatalogService.from_env(self.settings.splunk, splunk=splunk)
            return self.catalog


_command_runtime: ContextVar[CommandRuntime | None] = ContextVar("soc_command_runtime", default=None)


@asynccontextmanager
async def command_runtime():
    runtime = await asyncio.to_thread(CommandRuntime.create)
    token = _command_runtime.set(runtime)
    try:
        yield runtime
    finally:
        _command_runtime.reset(token)
        if runtime.catalog is not None:
            await runtime.catalog.close()
        if runtime.splunk is not None:
            await runtime.splunk.close()
        if runtime.store is not None:
            await asyncio.to_thread(runtime.store.close)


def _settings():
    runtime = _command_runtime.get()
    return runtime.settings if runtime else ServerSettings.from_env()


async def _close_service(service):
    runtime = _command_runtime.get()
    if runtime is None or (service is not runtime.splunk and service is not runtime.catalog):
        await service.close()


def _payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("request must be an object")
    return value


def _store() -> PostgresStore:
    runtime = _command_runtime.get()
    store = runtime.store if runtime else PostgresStore.from_env()
    if store is None:
        raise RuntimeError("application authentication requires PostgreSQL")
    return store


def login(payload: dict[str, Any]) -> dict[str, object]:
    email = normalize_zimbra_email(str(payload.get("email", "")))
    password = str(payload.get("password", ""))
    if not password:
        raise ValueError("authentication failed")
    store = _store()
    settings = _settings()
    if not settings.zimbra.host:
        raise RuntimeError("Zimbra authentication is not configured")
    try:
        token = zimbra_login(settings.zimbra.client_config(email=email, username="", password=password))
    except Exception as exc:
        # The submitted password is deliberately never included in this error.
        raise ValueError("authentication failed") from exc
    session = store.create_user_session(email, token)
    return {
        "session": public_session(session),
        "new_device_login": bool(session.replaced_session_ids),
        "replaced_session_ids": list(session.replaced_session_ids),
    }


def logout(payload: dict[str, Any]) -> dict[str, bool]:
    return {"deleted": _store().delete_app_session(str(payload.get("session_id", "")))}


def _service(payload: dict[str, Any]) -> ZimbraMailService:
    store = _store()
    session = store.get_app_session(str(payload.get("session_id", "")))
    if session is None:
        raise ValueError("authentication failed")
    settings = _settings()
    return ZimbraMailService(settings.zimbra, identity=ZimbraIdentity.from_session(session))


async def send_email(payload: dict[str, Any]) -> dict[str, Any]:
    service = await run_blocking(_service, payload, principal=str(payload.get("session_id", "")))
    return await service.send_email(
        payload.get("to", []),
        payload.get("subject", ""),
        payload.get("body", ""),
        cc=payload.get("cc"),
        bcc=payload.get("bcc"),
        body_format=payload.get("body_format", "text"),
    )


async def list_signatures(payload: dict[str, Any]) -> dict[str, Any]:
    service = await run_blocking(_service, payload, principal=str(payload.get("session_id", "")))
    return await service.list_signatures()


def _splunk_service(payload: dict[str, Any]) -> tuple[SplunkService, str]:
    store = _store()
    session = store.get_app_session(str(payload.get("session_id", "")))
    if session is None:
        raise ValueError("authentication failed")
    runtime = _command_runtime.get()
    return (runtime.splunk_service() if runtime else SplunkService(_settings().splunk)), session.user_id


async def save_detection(payload: dict[str, Any]) -> dict[str, Any]:
    operation = payload.get("operation")
    detection = payload.get("detection")
    if operation not in {"write", "update"} or not isinstance(detection, dict):
        raise ValueError("invalid detection save request")
    name = payload.get("name")
    if name is not None and not isinstance(name, str):
        raise ValueError("invalid detection save request")
    expected_fingerprint = payload.get("expected_fingerprint")
    if expected_fingerprint is not None and not isinstance(expected_fingerprint, str):
        raise ValueError("invalid detection save request")
    service, actor_id = await run_blocking(_splunk_service, payload, principal=str(payload.get("session_id", "")))
    try:
        return await service.save_detection(
            operation,
            detection,
            name=name,
            expected_fingerprint=expected_fingerprint,
            actor_id=actor_id,
        )
    finally:
        await _close_service(service)


async def save_lookup(payload: dict[str, Any]) -> dict[str, Any]:
    operation = payload.get("operation")
    name = payload.get("name")
    content = payload.get("content")
    expected_fingerprint = payload.get("expected_fingerprint")
    if operation not in {"write", "update", "delete"} or not isinstance(name, str):
        raise ValueError("invalid lookup save request")
    if operation in {"write", "update"} and not isinstance(content, str):
        raise ValueError("invalid lookup save request")
    if operation in {"update", "delete"} and not isinstance(expected_fingerprint, str):
        raise ValueError("invalid lookup save request")
    if expected_fingerprint is not None and not isinstance(expected_fingerprint, str):
        raise ValueError("invalid lookup save request")
    service, actor_id = await run_blocking(_splunk_service, payload, principal=str(payload.get("session_id", "")))
    try:
        return await service.save_lookup(
            operation,
            name,
            content=content,
            expected_fingerprint=expected_fingerprint,
            actor_id=actor_id,
        )
    finally:
        await _close_service(service)


def _catalog_session(payload: dict[str, Any]) -> str:
    store = _store()
    session = store.get_app_session(str(payload.get("session_id", "")))
    if session is None:
        raise ValueError("authentication failed")
    return session.user_id


def _catalog_context(payload: dict[str, Any]) -> tuple[CatalogService, str]:
    actor_id = _catalog_session(payload)
    runtime = _command_runtime.get()
    service = runtime.catalog_service() if runtime else CatalogService.from_env(_settings().splunk)
    return service, actor_id


async def catalog_list(payload: dict[str, Any]) -> dict[str, Any]:
    service, actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        return await run_blocking(service.list_records,
            str(payload.get("catalog", "")),
            search=str(payload.get("search", "") or ""),
            limit=int(payload.get("limit", 50)),
            offset=int(payload.get("offset", 0)),
            include_archived=bool(payload.get("include_archived", False)),
        )
    finally:
        await _close_service(service)


async def catalog_get(payload: dict[str, Any]) -> dict[str, Any]:
    service, _actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        record = await run_blocking(service.get_record,str(payload.get("catalog", "")), str(payload.get("record_id", "")))
        return {"record": record}
    finally:
        await _close_service(service)


async def catalog_history(payload: dict[str, Any]) -> dict[str, Any]:
    service, _actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        return {
            "history": await run_blocking(service.record_history,
                str(payload.get("catalog", "")),
                str(payload.get("record_id", "")),
                limit=int(payload.get("limit", 100)),
            )
        }
    finally:
        await _close_service(service)


async def catalog_publications(payload: dict[str, Any]) -> dict[str, Any]:
    service, _actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        return {
            "publications": await run_blocking(service.list_publications,
                str(payload.get("catalog", "")),
                limit=int(payload.get("limit", 50)),
            )
        }
    finally:
        await _close_service(service)


async def catalog_preview_publish(payload: dict[str, Any]) -> dict[str, Any]:
    service, _actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        return await run_blocking(service.preview_publication,str(payload.get("catalog", "")))
    finally:
        await _close_service(service)


async def save_catalog_record(payload: dict[str, Any]) -> dict[str, Any]:
    operation = payload.get("operation")
    record = payload.get("record")
    catalog = str(payload.get("catalog", ""))
    if operation not in {"write", "update"} or not isinstance(record, dict):
        raise ValueError("invalid catalog save request")
    expected_revision = payload.get("expected_revision")
    if expected_revision is not None and not isinstance(expected_revision, int):
        raise ValueError("invalid catalog save request")
    service, actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        return await service.save_record(
            catalog,
            operation,
            record,
            record_id=payload.get("record_id"),
            expected_revision=expected_revision,
            actor_id=actor_id,
            reason=str(payload.get("reason", "") or ""),
        )
    finally:
        await _close_service(service)


async def archive_catalog_record(payload: dict[str, Any]) -> dict[str, Any]:
    expected_revision = payload.get("expected_revision")
    if not isinstance(expected_revision, int):
        raise ValueError("invalid catalog archive request")
    service, actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        return await service.set_record_archived(
            str(payload.get("catalog", "")),
            str(payload.get("record_id", "")),
            archived=not bool(payload.get("restore", False)),
            expected_revision=expected_revision,
            actor_id=actor_id,
            reason=str(payload.get("reason", "") or ""),
        )
    finally:
        await _close_service(service)


async def publish_catalog(payload: dict[str, Any]) -> dict[str, Any]:
    service, actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        return await service.publish_catalog(str(payload.get("catalog", "")), actor_id=actor_id)
    finally:
        await _close_service(service)


async def rollback_publication(payload: dict[str, Any]) -> dict[str, Any]:
    service, actor_id = await run_blocking(_catalog_context, payload, principal=str(payload.get("session_id", "")))
    try:
        return await service.rollback_publication(
            str(payload.get("publication_id", "")), actor_id=actor_id
        )
    finally:
        await _close_service(service)


_SYNC_COMMANDS = {
    "login": login,
    "logout": logout,
}

_ASYNC_COMMANDS = {
    "send-email": send_email,
    "list-signatures": list_signatures,
    "save-detection": save_detection,
    "save-lookup": save_lookup,
    "catalog-list": catalog_list,
    "catalog-get": catalog_get,
    "catalog-history": catalog_history,
    "catalog-publications": catalog_publications,
    "catalog-preview-publish": catalog_preview_publish,
    "save-catalog-record": save_catalog_record,
    "archive-catalog-record": archive_catalog_record,
    "publish-catalog": publish_catalog,
    "rollback-publication": rollback_publication,
}

KNOWN_COMMANDS = frozenset({*_SYNC_COMMANDS, *_ASYNC_COMMANDS})


async def dispatch_command(command: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Run one host command; shared by the CLI and the persistent control server."""
    sync_handler = _SYNC_COMMANDS.get(command)
    if sync_handler is not None:
        return await run_blocking(sync_handler, payload, principal=str(payload.get("session_id", "")))
    async_handler = _ASYNC_COMMANDS.get(command)
    if async_handler is not None:
        return await async_handler(payload)
    raise ValueError("unknown authentication command")


def command_failure(command: str, exc: Exception) -> dict[str, Any]:
    """Bounded, credential-free failure payload consumed by the host."""
    if command == "login":
        return {"code": "authentication_failed", "message": "authentication failed", "details": {}}
    if isinstance(exc, ServiceError):
        return {"code": exc.code, "message": exc.message, "details": exc.details}
    return {"code": "operation_failed", "message": "The requested operation failed.", "details": {}}


def _expire_session_on_auth_error(payload: dict[str, Any], exc: Exception) -> None:
    if isinstance(exc, ServiceError) and exc.code == "zimbra_auth_error":
        try:
            _store().delete_app_session(str(payload.get("session_id", "")))
        except Exception:
            pass


def main() -> None:
    load_server_env()
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    payload: dict[str, Any] = {}
    try:
        payload = _payload()
        async def run():
            async with command_runtime(), operation_budget():
                return await dispatch_command(command, payload)
        result = asyncio.run(run())
        print(json.dumps(result, separators=(",", ":")))
    except Exception as exc:
        _expire_session_on_auth_error(payload, exc)
        print(json.dumps(command_failure(command, exc), separators=(",", ":")), file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
