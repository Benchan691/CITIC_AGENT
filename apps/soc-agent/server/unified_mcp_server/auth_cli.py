"""Private host-side commands for Zimbra-backed application sessions."""

from __future__ import annotations

import json
import sys
import asyncio
from typing import Any

from .config import ServerSettings
from .env_loader import load_server_env
from .auth import ZimbraIdentity, public_session
from .errors import ServiceError
from .zimbra.mail.service import ZimbraMailService
from .postgres_store import PostgresStore, normalize_zimbra_email
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
    settings = ServerSettings.from_store(store)
    if not settings.zimbra.host:
        raise RuntimeError("Zimbra authentication is not configured")
    try:
        token = zimbra_login(settings.zimbra.client_config(email=email, username="", password=password))
    except Exception as exc:
        # The submitted password is deliberately never included in this error.
        raise ValueError("authentication failed") from exc
    session = store.create_user_session(email, token)
    return {"session": public_session(session)}


def logout(payload: dict[str, Any]) -> dict[str, bool]:
    return {"deleted": _store().delete_app_session(str(payload.get("session_id", "")))}


def _service(payload: dict[str, Any]) -> ZimbraMailService:
    store = _store()
    session = store.get_app_session(str(payload.get("session_id", "")))
    if session is None:
        raise ValueError("authentication failed")
    settings = ServerSettings.from_store(store)
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


def main() -> None:
    load_server_env()
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    payload: dict[str, Any] = {}
    try:
        payload = _payload()
        result = login(payload) if command == "login" else logout(payload) if command == "logout" else None
        if command == "send-email": result = asyncio.run(send_email(payload))
        if command == "list-signatures": result = asyncio.run(list_signatures(payload))
        if result is None:
            raise ValueError("unknown authentication command")
        print(json.dumps(result, separators=(",", ":")))
    except Exception as exc:
        if isinstance(exc, ServiceError) and exc.code == "zimbra_auth_error":
            try:
                _store().delete_app_session(str(payload.get("session_id", "")))
            except Exception:
                pass
        # Stable, credential-free stderr is consumed by the host and is safe to display.
        message = "authentication failed" if command == "login" else str(exc)
        print(message, file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
