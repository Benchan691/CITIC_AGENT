"""Private host-side commands for authenticated application sessions."""

from __future__ import annotations

import json
import sys
import asyncio
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


def _payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("request must be an object")
    return value


def _store() -> PostgresStore:
    store = PostgresStore.from_env()
    if store is None:
        raise RuntimeError("application authentication requires PostgreSQL")
    return store


def login(payload: dict[str, Any]) -> dict[str, object]:
    email = normalize_zimbra_email(str(payload.get("email", "")))
    password = str(payload.get("password", ""))
    if not password:
        raise ValueError("authentication failed")
    store = _store()
    settings = ServerSettings.from_env()
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
    settings = ServerSettings.from_env()
    return ZimbraMailService(settings.zimbra, identity=ZimbraIdentity.from_session(session))


async def send_email(payload: dict[str, Any]) -> dict[str, Any]:
    service = _service(payload)
    return await service.send_email(
        payload.get("to", []),
        payload.get("subject", ""),
        payload.get("body", ""),
        cc=payload.get("cc"),
        bcc=payload.get("bcc"),
        body_format=payload.get("body_format", "text"),
    )


async def list_signatures(payload: dict[str, Any]) -> dict[str, Any]:
    return await _service(payload).list_signatures()


def _splunk_service(payload: dict[str, Any]) -> tuple[SplunkService, str]:
    store = _store()
    session = store.get_app_session(str(payload.get("session_id", "")))
    if session is None:
        raise ValueError("authentication failed")
    return SplunkService(ServerSettings.from_env().splunk), session.user_id


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
    service, actor_id = _splunk_service(payload)
    try:
        return await service.save_detection(
            operation,
            detection,
            name=name,
            expected_fingerprint=expected_fingerprint,
            actor_id=actor_id,
        )
    finally:
        await service.close()


def _catalog_session(payload: dict[str, Any]) -> str:
    store = _store()
    session = store.get_app_session(str(payload.get("session_id", "")))
    if session is None:
        raise ValueError("authentication failed")
    return session.user_id


def _catalog_context(payload: dict[str, Any]) -> tuple[CatalogService, str]:
    actor_id = _catalog_session(payload)
    service = CatalogService.from_env(ServerSettings.from_env())
    return service, actor_id


async def catalog_list(payload: dict[str, Any]) -> dict[str, Any]:
    service, actor_id = _catalog_context(payload)
    try:
        return service.list_records(
            str(payload.get("catalog", "")),
            search=str(payload.get("search", "") or ""),
            limit=int(payload.get("limit", 50)),
            offset=int(payload.get("offset", 0)),
            include_archived=bool(payload.get("include_archived", False)),
        )
    finally:
        await service.close()


async def catalog_get(payload: dict[str, Any]) -> dict[str, Any]:
    service, _actor_id = _catalog_context(payload)
    try:
        record = service.get_record(str(payload.get("catalog", "")), str(payload.get("record_id", "")))
        return {"record": record}
    finally:
        await service.close()


async def catalog_history(payload: dict[str, Any]) -> dict[str, Any]:
    service, _actor_id = _catalog_context(payload)
    try:
        return {
            "history": service.record_history(
                str(payload.get("catalog", "")),
                str(payload.get("record_id", "")),
                limit=int(payload.get("limit", 100)),
            )
        }
    finally:
        await service.close()


async def catalog_publications(payload: dict[str, Any]) -> dict[str, Any]:
    service, _actor_id = _catalog_context(payload)
    try:
        return {
            "publications": service.list_publications(
                str(payload.get("catalog", "")),
                limit=int(payload.get("limit", 50)),
            )
        }
    finally:
        await service.close()


async def catalog_preview_publish(payload: dict[str, Any]) -> dict[str, Any]:
    service, _actor_id = _catalog_context(payload)
    try:
        return service.preview_publication(str(payload.get("catalog", "")))
    finally:
        await service.close()


async def save_catalog_record(payload: dict[str, Any]) -> dict[str, Any]:
    operation = payload.get("operation")
    record = payload.get("record")
    catalog = str(payload.get("catalog", ""))
    if operation not in {"write", "update"} or not isinstance(record, dict):
        raise ValueError("invalid catalog save request")
    expected_revision = payload.get("expected_revision")
    if expected_revision is not None and not isinstance(expected_revision, int):
        raise ValueError("invalid catalog save request")
    service, actor_id = _catalog_context(payload)
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
        await service.close()


async def archive_catalog_record(payload: dict[str, Any]) -> dict[str, Any]:
    expected_revision = payload.get("expected_revision")
    if not isinstance(expected_revision, int):
        raise ValueError("invalid catalog archive request")
    service, actor_id = _catalog_context(payload)
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
        await service.close()


async def publish_catalog(payload: dict[str, Any]) -> dict[str, Any]:
    service, actor_id = _catalog_context(payload)
    try:
        return await service.publish_catalog(str(payload.get("catalog", "")), actor_id=actor_id)
    finally:
        await service.close()


async def rollback_publication(payload: dict[str, Any]) -> dict[str, Any]:
    service, actor_id = _catalog_context(payload)
    try:
        return await service.rollback_publication(
            str(payload.get("publication_id", "")), actor_id=actor_id
        )
    finally:
        await service.close()


_SYNC_COMMANDS = {
    "login": login,
    "logout": logout,
}

_ASYNC_COMMANDS = {
    "send-email": send_email,
    "list-signatures": list_signatures,
    "save-detection": save_detection,
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
        return sync_handler(payload)
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
        result = asyncio.run(dispatch_command(command, payload))
        print(json.dumps(result, separators=(",", ":")))
    except Exception as exc:
        _expire_session_on_auth_error(payload, exc)
        print(json.dumps(command_failure(command, exc), separators=(",", ":")), file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
