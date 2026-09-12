"""Private host-side commands for authenticated application sessions."""

from __future__ import annotations

import json
import sys
import asyncio
from contextvars import ContextVar
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

from .config import ServerSettings
from .env_loader import load_server_env
from .auth import ZimbraIdentity, public_session
from .errors import ServiceError
from .zimbra.mail.service import ZimbraMailService
from .postgres_store import PostgresStore, normalize_zimbra_email
from .zimbra import zimbra_login
from .blocking_io import run_blocking
from .request_context import operation_budget


@dataclass
class CommandRuntime:
    store: PostgresStore | None
    settings: ServerSettings

    @classmethod
    def create(cls):
        settings = ServerSettings.from_env()
        store = PostgresStore.from_env()
        return cls(store, settings)

_command_runtime: ContextVar[CommandRuntime | None] = ContextVar("soc_command_runtime", default=None)


@asynccontextmanager
async def command_runtime():
    runtime = await asyncio.to_thread(CommandRuntime.create)
    token = _command_runtime.set(runtime)
    try:
        yield runtime
    finally:
        _command_runtime.reset(token)
        if runtime.store is not None:
            await asyncio.to_thread(runtime.store.close)


def _settings():
    runtime = _command_runtime.get()
    return runtime.settings if runtime else ServerSettings.from_env()


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
        forward_message_id=payload.get("forward_message_id"),
    )


async def list_signatures(payload: dict[str, Any]) -> dict[str, Any]:
    service = await run_blocking(_service, payload, principal=str(payload.get("session_id", "")))
    return await service.list_signatures()


_SYNC_COMMANDS = {
    "login": login,
    "logout": logout,
}

_ASYNC_COMMANDS = {
    "send-email": send_email,
    "list-signatures": list_signatures,
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
