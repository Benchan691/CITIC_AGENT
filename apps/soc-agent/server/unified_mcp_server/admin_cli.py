"""Administrative CLI for PostgreSQL-backed MCP settings."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections.abc import Mapping
from os import environ
from typing import Any

from .config import ServerSettings
from .email.service import EmailSubscriptionService
from .env_loader import load_server_env
from .postgres_store import PostgresAccountStore, PostgresStore, dump_json
from .splunk_service import SplunkService
from .zimbra_service import ZimbraService

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
    "zimbra.max_attachment_bytes": ("ZIMBRA_MAX_ATTACHMENT_BYTES",),
    "zimbra.max_attachment_text_chars": ("ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS",),
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
            "configured": bool(settings.zimbra.host and store.count_accounts()),
            "verify_ssl": settings.zimbra.verify_ssl,
            "timeout": settings.zimbra.timeout,
            "max_attachment_bytes": settings.zimbra.max_attachment_bytes,
            "max_attachment_text_chars": settings.zimbra.max_attachment_text_chars,
            "account_count": store.count_accounts(),
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
    settings = _settings(store)
    accounts = PostgresAccountStore(store)
    account = accounts.get(account_id)
    if account is None:
        raise RuntimeError("Account not found.")
    service = ZimbraService(settings.zimbra, accounts)
    await service.test_account(account)
    return {"ok": True, "account_id": account.id}


def add_account(store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    account = store.add_account(
        label=str(payload.get("label", "")).strip(),
        email=str(payload.get("email", "")).strip(),
        username=str(payload.get("username", "")).strip(),
        password=str(payload.get("password", "")),
    )
    return {"account": account.public_dict()}


def update_account(store: PostgresStore, account_id: str, payload: Mapping[str, Any]) -> dict[str, Any]:
    account = store.update_account(
        account_id,
        label=None if "label" not in payload else str(payload.get("label", "")).strip(),
        email=None if "email" not in payload else str(payload.get("email", "")).strip(),
        username=None if "username" not in payload else str(payload.get("username", "")).strip(),
        password=None if "password" not in payload or not str(payload.get("password", "")) else str(payload["password"]),
    )
    return {"account": account.public_dict()}


def list_accounts(store: PostgresStore) -> dict[str, Any]:
    return {"accounts": [account.public_dict() for account in store.list_accounts()]}


def delete_account(store: PostgresStore, account_id: str) -> dict[str, Any]:
    return {"deleted": store.delete_account(account_id), "account_id": account_id}


def migrate(store: PostgresStore) -> dict[str, Any]:
    settings = _settings(store)
    from .account_store import AccountStore

    file_store = AccountStore(settings.zimbra.accounts_file, settings.zimbra.key_file, settings.zimbra.explicit_key)
    store.migrate_env_config(environ)
    imported = store.migrate_account_store(file_store)
    return {"ok": True, "imported_accounts": imported}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command")
    parser.add_argument("arg", nargs="?")
    args = parser.parse_args()
    store = _store()
    payload = _read_payload()
    command = args.command

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
    elif command == "test-splunk":
        result = asyncio.run(test_splunk(store))
    elif command == "test-subscription-server":
        result = asyncio.run(test_subscription_server(store))
    elif command == "migrate":
        result = migrate(store)
    else:
        raise RuntimeError(f"Unknown command: {command}")
    sys.stdout.write(dump_json(result))


if __name__ == "__main__":
    main()
