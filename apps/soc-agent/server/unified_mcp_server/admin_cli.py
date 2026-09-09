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
from .alert_email import AlertEmailStore
from .alert_ingest import AlertIdentityError, AlertIngestionStore
from .attachment_converter import AttachmentConversionLimits, AttachmentConverter
from .bridge_auth import require_host_capability
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
    alert_email_enabled = bool(getattr(settings, "alert_email_enabled", False))
    alert_email_configured = bool(getattr(settings, "alert_email_configured", False))
    return {
        "services": {
            "splunk": {"status": "ready" if settings.splunk.configured else "not_configured"},
            "zimbra": {"status": "ready" if settings.zimbra.configured else "not_configured"},
            "markitdown": {"status": "ready"},
            "subscription_server": {"status": "ready" if settings.email_server.configured else "not_configured"},
            "alert_email": {
                "status": "ready" if alert_email_enabled and alert_email_configured else "disabled",
                "enabled": alert_email_enabled,
                "configured": alert_email_configured,
            },
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
    if not settings.splunk.mcp_endpoint:
        raise ServiceError(
            "splunk_configuration_error",
            "SPLUNK_MCP_ENDPOINT is required for the Splunk connection test.",
        )
    service = SplunkService(settings.splunk)
    try:
        await service.search_service.test_connection()
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


def get_alert_email_settings(
    _store: PostgresStore,
    payload: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    payload = payload if isinstance(payload, Mapping) else {}

    def page_value(name: str, default: int, maximum: int) -> int:
        try:
            value = int(payload.get(name, default))
        except (TypeError, ValueError):
            value = default
        return max(0 if name.endswith("_offset") else 1, min(value, maximum))

    page_size = page_value("limit", 200, 1_000)
    registration_offset = page_value("registration_offset", 0, 10_000_000)
    review_offset = page_value("review_offset", 0, 10_000_000)
    ownership_offset = page_value("ownership_offset", 0, 10_000_000)
    quarantine_offset = page_value("quarantine_offset", 0, 10_000_000)
    policy_offset = page_value("policy_offset", 0, 10_000_000)
    settings = _settings(_store)
    alert_store = AlertEmailStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert email settings.")
    try:
        ingest_store = AlertIngestionStore.from_env()
        if ingest_store is None:
            raise RuntimeError("APP_POSTGRES_URI is required for alert registration settings.")
        try:
            registrations = ingest_store.list_alert_registrations(limit=page_size, offset=registration_offset)
            registration_review = ingest_store.list_alert_registration_review(limit=page_size, offset=review_offset)
            index_ownership = ingest_store.list_alert_index_ownership(limit=page_size, offset=ownership_offset)
            quarantine = ingest_store.list_unresolved_quarantine(limit=page_size, offset=quarantine_offset)
            policies = ingest_store.list_alert_policies(limit=page_size, offset=policy_offset)
            migration_report = ingest_store.migration_report()
        finally:
            ingest_store.close()
        return {
            "runtime": settings.public_status().get("alert_email", {}),
            "rules": alert_store.list_rules(),
            "customers": alert_store.list_customer_email_configs(),
            "delivery": alert_store.status(),
            "alert_registrations": registrations,
            "alert_registration_review": registration_review,
            "alert_index_ownership": index_ownership,
            "alert_quarantine": quarantine,
            "alert_policies": policies,
            "migration_report": migration_report,
            "pagination": {
                "limit": page_size,
                "registration_offset": registration_offset,
                "review_offset": review_offset,
                "ownership_offset": ownership_offset,
                "quarantine_offset": quarantine_offset,
                "policy_offset": policy_offset,
                "next_offsets": {
                    "registration_offset": registration_offset + page_size if len(registrations) == page_size else None,
                    "review_offset": review_offset + page_size if len(registration_review) == page_size else None,
                    "ownership_offset": ownership_offset + page_size if len(index_ownership) == page_size else None,
                    "quarantine_offset": quarantine_offset + page_size if len(quarantine) == page_size else None,
                    "policy_offset": policy_offset + page_size if len(policies) == page_size else None,
                },
            },
            **alert_store.admin_details(),
        }
    finally:
        alert_store.close()


def preview_alert_email(_store, payload):
    alert_store = AlertEmailStore.from_env()
    if alert_store is None:
        raise RuntimeError("PostgreSQL is required")
    try:
        if 'csv' in payload:
            return alert_store.preview_csv(payload.get('customer_id'),payload['csv'])
        return alert_store.preview(payload.get('customer_id'),payload.get('event_id'))
    finally:
        alert_store.close()


def save_alert_email_rule(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    alert_store = AlertEmailStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert email settings.")
    try:
        return {"rule": alert_store.save_rule(payload)}
    finally:
        alert_store.close()


def save_customer_email_config(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    customer_id = payload.get("customer_id")
    if not isinstance(customer_id, str) or not customer_id.strip():
        raise ValueError("customer_id is required")
    alert_store = AlertEmailStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert email settings.")
    try:
        value = payload.get("email_config", payload)
        actor = payload.get("actor_id")
        return {"customer": alert_store.save_customer_email_config(
            customer_id.strip(),
            value,
            alert_delivery_enabled=payload.get("alert_delivery_enabled"),
            actor=str(actor or "admin"),
        )}
    finally:
        alert_store.close()


def save_alert_email_policy(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    customer_id = payload.get("customer_id")
    policy = payload.get("policy")
    if not isinstance(customer_id, str) or not customer_id.strip() or not isinstance(policy, Mapping):
        raise ValueError("customer_id and policy are required")
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert email policy settings.")
    try:
        registration_id = payload.get("registration_id")
        if registration_id is not None and not isinstance(registration_id, str):
            raise ValueError("registration_id is invalid")
        return {
            "policy": alert_store.save_alert_policy(
                customer_id.strip(),
                policy,
                registration_id=registration_id.strip() if registration_id else None,
                actor=str(payload.get("actor_id") or "admin"),
            )
        }
    finally:
        alert_store.close()


def receive_alert_run(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert ingestion.")
    try:
        # The host verifies the deployment-bound signature and replay header
        # before invoking this private command.  Forward those trusted
        # assertions explicitly; the ingestion store must never accept an
        # unauthenticated deployment or invent a replay identity.
        return alert_store.receive_alert_run(
            payload,
            authenticated_deployment=payload.get("_authenticated_deployment"),
            replay_id=payload.get("_authenticated_replay_id"),
        )
    finally:
        alert_store.close()


def resolve_alert_action_context(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert action context resolution.")
    try:
        try:
            return alert_store.resolve_alert_action_context(
                payload,
                authenticated_deployment=payload.get("_authenticated_deployment"),
                replay_id=payload.get("_authenticated_replay_id"),
            )
        except AlertIdentityError as exc:
            raise ServiceError(exc.code, str(exc)) from exc
    finally:
        alert_store.close()


def get_alert_migration_report(_store: PostgresStore) -> dict[str, Any]:
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert migration reporting.")
    try:
        return alert_store.migration_report()
    finally:
        alert_store.close()


def set_alert_index_ownership(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    required = (payload.get("deployment"), payload.get("index_name"), payload.get("customer_id"))
    if not all(isinstance(value, str) and value.strip() for value in required):
        raise ValueError("deployment, index_name, and customer_id are required")
    status = payload.get("status", "active")
    if not isinstance(status, str):
        raise ValueError("status is invalid")
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert ownership settings.")
    try:
        return {
            "ownership": alert_store.set_index_ownership(
                deployment=required[0].strip(), index_name=required[1].strip(),
                customer_id=required[2].strip(), status=status,
                actor=str(payload.get("actor_id") or "admin"),
            )
        }
    finally:
        alert_store.close()


def set_alert_registration(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    registration_id = payload.get("registration_id")
    enabled = payload.get("enabled")
    if not isinstance(registration_id, str) or not registration_id.strip() or not isinstance(enabled, bool):
        raise ValueError("registration_id and boolean enabled are required")
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert registration settings.")
    try:
        return {
            "registration": alert_store.set_registration_delivery_enabled(
                registration_id.strip(), enabled, actor=str(payload.get("actor_id") or "admin")
            )
        }
    finally:
        alert_store.close()


def relink_alert_registration(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    registration_id = payload.get("registration_id")
    customer_id = payload.get("customer_id")
    indexes = payload.get("source_indexes")
    if (
        not isinstance(registration_id, str) or not registration_id.strip()
        or not isinstance(customer_id, str) or not customer_id.strip()
        or not isinstance(indexes, list)
    ):
        raise ValueError("registration_id, customer_id, and source_indexes are required")
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert registration review.")
    try:
        review_id = payload.get("review_id")
        if review_id is not None and (not isinstance(review_id, str) or not review_id.strip()):
            raise ValueError("review_id is invalid")
        return {
            "registration": alert_store.relink_registration(
                registration_id.strip(), customer_id=customer_id.strip(), source_indexes=indexes,
                actor=str(payload.get("actor_id") or "admin"),
                review_id=review_id.strip() if review_id else None,
            )
        }
    finally:
        alert_store.close()


def release_held_alert(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    event_id = payload.get("event_id")
    customer_id = payload.get("customer_id")
    if not isinstance(event_id, str) or not event_id.strip() or not isinstance(customer_id, str) or not customer_id.strip():
        raise ValueError("event_id and customer_id are required")
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert delivery review.")
    try:
        return alert_store.release_held_event(
            event_id.strip(), customer_id=customer_id.strip(), actor=str(payload.get("actor_id") or "admin")
        )
    finally:
        alert_store.close()


def preview_alert_migration(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert migration preview.")
    try:
        return alert_store.migration_preview(
            actor=str(payload.get("actor_id") or "admin"),
            limit=int(payload.get("limit", 1_000)),
        )
    finally:
        alert_store.close()


def backfill_alert_migration(_store: PostgresStore, payload: Mapping[str, Any]) -> dict[str, Any]:
    alert_store = AlertIngestionStore.from_env()
    if alert_store is None:
        raise RuntimeError("APP_POSTGRES_URI is required for alert migration backfill.")
    try:
        return alert_store.migration_backfill(actor=str(payload.get("actor_id") or "admin"))
    finally:
        alert_store.close()


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
    payload = _read_payload()
    command = args.command

    try:
        bridge_kind = "webhook" if command in {"receive-alert-run", "resolve-alert-action-context"} else "admin"
        claims = require_host_capability(payload, command=command, kind=bridge_kind)
        store = _store()
        payload = dict(payload)
        if bridge_kind == "admin":
            # The actor is signed by the Node host. Never use a caller-supplied
            # actor_id for an audit record.
            payload["actor_id"] = claims["actor_id"]
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
        elif command == "get-alert-email-settings":
            result = get_alert_email_settings(store, payload)
        elif command == "preview-alert-email":
            result = preview_alert_email(store, payload)
        elif command == "save-alert-email-rule":
            result = save_alert_email_rule(store, payload)
        elif command == "save-customer-email-config":
            result = save_customer_email_config(store, payload)
        elif command == "save-alert-email-policy":
            result = save_alert_email_policy(store, payload)
        elif command == "receive-alert-run":
            result = receive_alert_run(store, payload)
        elif command == "resolve-alert-action-context":
            result = resolve_alert_action_context(store, payload)
        elif command == "get-alert-migration-report":
            result = get_alert_migration_report(store)
        elif command == "set-alert-index-ownership":
            result = set_alert_index_ownership(store, payload)
        elif command == "set-alert-registration":
            result = set_alert_registration(store, payload)
        elif command == "relink-alert-registration":
            result = relink_alert_registration(store, payload)
        elif command == "release-held-alert":
            result = release_held_alert(store, payload)
        elif command == "preview-alert-migration":
            result = preview_alert_migration(store, payload)
        elif command == "backfill-alert-migration":
            result = backfill_alert_migration(store, payload)
        elif command == "migrate":
            result = migrate(store)
        else:
            raise RuntimeError(f"Unknown command: {command}")
    except ServiceError as error:
        _write_service_error(error)
        raise SystemExit(2) from error
    except ValueError:
        if command not in {
            "get-settings",
            "test-splunk",
            "test-subscription-server",
            "get-alert-email-settings",
            "save-alert-email-rule",
            "save-customer-email-config",
            "save-alert-email-policy",
            "receive-alert-run",
            "resolve-alert-action-context",
            "get-alert-migration-report",
            "set-alert-index-ownership",
            "set-alert-registration",
            "relink-alert-registration",
            "release-held-alert",
            "preview-alert-migration",
            "backfill-alert-migration",
        }:
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
