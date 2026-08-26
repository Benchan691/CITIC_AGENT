"""Administrative CLI for PostgreSQL-backed MCP settings."""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import sys
from collections.abc import Mapping
from os import environ
from typing import Any

from .config import ServerSettings
from .attachment_converter import AttachmentConversionLimits, AttachmentConverter
from .email.service import EmailSubscriptionService
from .env_loader import load_server_env
from .errors import ServiceError
from .postgres_store import PostgresStore, dump_json
from .splunk_service import SplunkService

load_server_env()

CONFIG_KEYS = {
    "splunk.url": ("SPLUNK_URL",),
    "splunk.username": ("SPLUNK_USERNAME",),
    "splunk.password": ("SPLUNK_PASSWORD",),
    "splunk.verify_ssl": ("SPLUNK_VERIFY_SSL",),
    "splunk.max_events": ("SPLUNK_MAX_EVENTS",),
    "splunk.risk_tolerance": ("SPLUNK_RISK_TOLERANCE",),
    "splunk.detection_write_enabled": ("SPLUNK_ALLOW_DETECTION_WRITE",),
    "splunk.detection_enable_enabled": ("SPLUNK_ALLOW_DETECTION_ENABLE",),
    "zimbra.host": ("ZIMBRA_HOST",),
    "zimbra.verify_ssl": ("ZIMBRA_VERIFY_SSL",),
    "zimbra.timeout": ("ZIMBRA_TIMEOUT",),
    "zimbra.allow_send": ("ZIMBRA_ALLOW_SEND",),
    "zimbra.max_attachment_bytes": ("ZIMBRA_MAX_ATTACHMENT_BYTES",),
    "zimbra.max_attachment_text_chars": ("ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS",),
    "markitdown.llm_enabled": ("MARKITDOWN_LLM_ENABLED",),
    "markitdown.llm_base_url": ("MARKITDOWN_LLM_BASE_URL",),
    "markitdown.llm_model": ("MARKITDOWN_LLM_MODEL",),
    "markitdown.llm_timeout": ("MARKITDOWN_LLM_TIMEOUT",),
}


def _store() -> PostgresStore:
    store = PostgresStore.from_env()
    if store is None:
        raise RuntimeError("APP_POSTGRES_URI and APP_SETTINGS_ENCRYPTION_KEY are required.")
    return store


def _settings(store: PostgresStore) -> ServerSettings:
    return ServerSettings.from_store(store)


def _public_settings(store: PostgresStore) -> dict[str, Any]:
    settings = _settings(store)
    config = store.list_config()
    return {
        "splunk": {
            "url": settings.splunk.url,
            "username": settings.splunk.username,
            "configured": settings.splunk.configured,
            "has_password": bool(config.get("SPLUNK_PASSWORD") or settings.splunk.password),
            "verify_ssl": settings.splunk.verify_ssl,
            "max_events": settings.splunk.max_events,
            "risk_tolerance": settings.splunk.risk_tolerance,
            "detection_write_enabled": settings.splunk.detection_write_enabled,
            "detection_enable_enabled": settings.splunk.detection_enable_enabled,
        },
        "zimbra": {
            "host": settings.zimbra.host,
            "configured": bool(settings.zimbra.host),
            "verify_ssl": settings.zimbra.verify_ssl,
            "timeout": settings.zimbra.timeout,
            "max_attachment_bytes": settings.zimbra.max_attachment_bytes,
            "max_attachment_text_chars": settings.zimbra.max_attachment_text_chars,
            "send_enabled": settings.zimbra.allow_send,
        },
        "markitdown": {
            "llm_enabled": settings.markitdown.llm_enabled,
            "llm_base_url": settings.markitdown.llm_base_url,
            "llm_model": settings.markitdown.llm_model,
            "llm_timeout": settings.markitdown.llm_timeout,
            "has_api_key": bool(config.get("MARKITDOWN_LLM_API_KEY") or settings.markitdown.llm_api_key),
        },
        "subscription_server": {
            "url": settings.email_server.url,
            "configured": settings.email_server.configured,
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


def _string_bool(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value).strip()


def update_settings(store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    writes: dict[str, str] = {}
    for path, env_keys in CONFIG_KEYS.items():
        cursor: Any = payload
        for key in path.split("."):
            if not isinstance(cursor, Mapping) or key not in cursor:
                cursor = None
                break
            cursor = cursor[key]
        if cursor is None:
            continue
        writes[env_keys[0]] = _string_bool(cursor)
    for key, value in writes.items():
        store.set_config(key, value)
    return _public_settings(store)


def delete_setting(store: PostgresStore, key: str) -> dict[str, Any]:
    env_keys = CONFIG_KEYS.get(key)
    if env_keys is None:
        raise RuntimeError(f"Unknown setting key: {key}")
    store.delete_config(env_keys[0])
    return _public_settings(store)


async def test_splunk(store: PostgresStore) -> dict[str, Any]:
    settings = _settings(store)
    service = SplunkService(settings.splunk)
    try:
        result = await service.test_connection()
        return {"ok": True, "index_count": result["index_count"], "host": settings.splunk.host}
    finally:
        await service.close()


async def test_subscription_server(store: PostgresStore) -> dict[str, Any]:
    settings = _settings(store)
    service = EmailSubscriptionService(settings.email_server)
    try:
        return await service.test_connection()
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
    store.migrate_env_config(environ)
    return {"ok": True, "imported_accounts": 0}


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
        if command != "convert-attachment":
            raise
        sys.stderr.write(json.dumps({"code": error.code, "message": error.message}))
        raise SystemExit(2) from error
    sys.stdout.write(dump_json(result))


if __name__ == "__main__":
    main()
