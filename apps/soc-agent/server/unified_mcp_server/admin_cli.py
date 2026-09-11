"""Administrative CLI for status checks and protected SOC operations."""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import sys
from collections.abc import Mapping
from typing import Any

from .config import ServerSettings
from .attachment_converter import AttachmentConversionLimits, AttachmentConverter
from .email.service import EmailSubscriptionService
from .env_loader import load_server_env
from .errors import ServiceError
from .postgres_store import PostgresStore, dump_json
from .splunk_service import SplunkService

load_server_env()

def _store() -> PostgresStore:
    store = PostgresStore.from_env()
    if store is None:
        raise RuntimeError("APP_POSTGRES_URI and APP_SETTINGS_ENCRYPTION_KEY are required.")
    return store


def _settings(_store: PostgresStore) -> ServerSettings:
    """Read service configuration from the server environment only."""
    return ServerSettings.from_env()


def _public_settings(store: PostgresStore) -> dict[str, Any]:
    settings = _settings(store)
    return {
        "services": {
            "splunk": {"status": "ready" if settings.splunk.configured else "not_configured"},
            "zimbra": {"status": "ready" if settings.zimbra.configured else "not_configured"},
            "markitdown": {"status": "ready"},
            "subscription_server": {"status": "ready" if settings.email_server.configured else "not_configured"},
        },
    }


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise RuntimeError("Expected a JSON object on stdin.")
    return payload


def update_settings(store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    del store, payload
    raise RuntimeError("Service configuration is managed by the server .env file.")


def delete_setting(store: PostgresStore, key: str) -> dict[str, Any]:
    del store, key
    raise RuntimeError("Service configuration is managed by the server .env file.")


async def test_splunk(store: PostgresStore) -> dict[str, Any]:
    settings = _settings(store)
    service = SplunkService(settings.splunk)
    try:
        await service.test_connection()
        return {"ok": True}
    finally:
        await service.close()


async def test_subscription_server(store: PostgresStore) -> dict[str, Any]:
    settings = _settings(store)
    service = EmailSubscriptionService(settings.email_server)
    try:
        await service.test_connection()
        return {"ok": True}
    finally:
        await service.close()


async def test_account(store: PostgresStore, account_id: str) -> dict[str, Any]:
    raise RuntimeError("Stored Zimbra accounts are no longer supported; log in with Zimbra.")


async def send_email(store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    raise RuntimeError("Authenticated Zimbra sessions are required for mail operations.")


async def list_signatures(store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    raise RuntimeError("Authenticated Zimbra sessions are required for mail operations.")


def convert_attachment(store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    encoded = payload.get("data")
    if not isinstance(encoded, str) or not encoded:
        raise RuntimeError("Attachment data is required.")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as exc:
        raise RuntimeError("Attachment data is invalid.") from exc
    settings = _settings(store)
    raw_limits = payload.get("limits")
    limits = raw_limits if isinstance(raw_limits, Mapping) else {}
    try:
        max_bytes = int(limits.get("max_bytes", settings.zimbra.max_attachment_bytes))
        max_chars = int(limits.get("max_chars", settings.zimbra.max_attachment_text_chars))
    except (TypeError, ValueError) as exc:
        raise RuntimeError("Attachment conversion limits are invalid.") from exc
    return AttachmentConverter(settings.markitdown).convert(
        data,
        str(payload.get("filename", "")),
        str(payload.get("content_type", "")),
        AttachmentConversionLimits(max_bytes=max_bytes, max_chars=max_chars),
    )


def add_account(store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    raise RuntimeError("Stored Zimbra accounts are no longer supported; log in with Zimbra.")


def update_account(store: PostgresStore, account_id: str, payload: Mapping[str, Any]) -> dict[str, Any]:
    raise RuntimeError("Stored Zimbra accounts are no longer supported; log in with Zimbra.")


def list_accounts(store: PostgresStore) -> dict[str, Any]:
    raise RuntimeError("Stored Zimbra accounts are no longer supported; log in with Zimbra.")


def delete_account(store: PostgresStore, account_id: str) -> dict[str, Any]:
    raise RuntimeError("Stored Zimbra accounts are no longer supported; log in with Zimbra.")


def migrate(store: PostgresStore) -> dict[str, Any]:
    del store
    return {"ok": True}


def _safe_error_details(error: ServiceError) -> dict[str, Any]:
    details = error.details if isinstance(error.details, Mapping) else {}
    safe: dict[str, Any] = {}
    status_code = details.get("status_code")
    if isinstance(status_code, int) and not isinstance(status_code, bool):
        safe["status_code"] = status_code
    runtime_limit = details.get("runtime_limit_seconds")
    if isinstance(runtime_limit, (int, float)) and not isinstance(runtime_limit, bool):
        safe["runtime_limit_seconds"] = runtime_limit
    missing = details.get("missing_environment_variables")
    if isinstance(missing, list) and all(isinstance(item, str) for item in missing):
        safe["missing_environment_variables"] = missing[:20]
    return safe


def _write_service_error(error: ServiceError) -> None:
    payload = {
        "code": str(error.code)[:80],
        "message": str(error.message or "The requested operation failed.").strip()[:400],
        "details": _safe_error_details(error),
    }
    # Keep the diagnostic as one complete stderr record.  The Node host reads
    # stderr line-by-line so it can ignore launcher noise and preserve this
    # actionable service message for the admin console.
    sys.stderr.write(json.dumps(payload) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command")
    parser.add_argument("arg", nargs="?")
    args = parser.parse_args()
    store = _store()
    payload = _read_payload()
    command = args.command

    try:
        if command == "get-settings":
            result = _public_settings(store)
        elif command == "update-settings":
            result = update_settings(store, payload)
        elif command == "delete-setting":
            result = delete_setting(store, args.arg or "")
        elif command == "list-accounts":
            result = list_accounts(store)
        elif command == "add-account":
            result = add_account(store, payload)
        elif command == "update-account":
            result = update_account(store, args.arg or "", payload)
        elif command == "delete-account":
            result = delete_account(store, args.arg or "")
        elif command == "test-account":
            result = asyncio.run(test_account(store, args.arg or ""))
        elif command == "send-email":
            result = asyncio.run(send_email(store, payload))
        elif command == "list-signatures":
            result = asyncio.run(list_signatures(store, payload))
        elif command == "convert-attachment":
            result = convert_attachment(store, payload)
        elif command == "test-splunk":
            result = asyncio.run(test_splunk(store))
        elif command == "test-subscription-server":
            result = asyncio.run(test_subscription_server(store))
        elif command == "migrate":
            result = migrate(store)
        else:
            raise RuntimeError(f"Unknown command: {command}")
    except ServiceError as error:
        _write_service_error(error)
        raise SystemExit(2) from error
    except ValueError:
        if command not in {"get-settings", "test-splunk", "test-subscription-server"}:
            raise
        payload = {
            "code": "admin_configuration_error",
            "message": "The server environment configuration is invalid. Check the server .env file.",
            "details": {},
        }
        sys.stderr.write(json.dumps(payload) + "\n")
        raise SystemExit(2)
    sys.stdout.write(dump_json(result))


if __name__ == "__main__":
    main()
