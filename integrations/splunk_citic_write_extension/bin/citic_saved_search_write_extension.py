#!/usr/bin/env python3
"""Authenticated MCP write extension for CITIC saved-search publication.

This process is deployed beside Splunk, separately from the SOC backend.  It
is intentionally small: the extension owns the narrow write contract and
Splunk REST call, while the backend owns customer identity and AID allocation.
Operations are persisted in SQLite so a transport timeout can be reconciled
without issuing a second write.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen

from mcp.server.fastmcp import Context, FastMCP


APPROVED_ACTION = "citic_alert_delivery"
OPERATION_LIMIT = 100_000
DEFAULT_DB = Path(__file__).resolve().parents[1] / "var" / "write_operations.sqlite3"
ALLOWED_BASE_FIELDS = {
    "name", "search", "description", "is_scheduled", "cron_schedule", "disabled",
    "app", "owner", "sharing", "dispatch.earliest_time", "dispatch.latest_time",
    "dispatch.rt_backfill", "dispatch.indexedRealtime", "dispatch.indexedRealtimeOffset",
    "dispatch.indexedRealtimeMinSpan", "dispatch.rt_maximum_span", "alert_type",
    "alert_comparator", "alert_threshold", "alert_condition", "alert.digest_mode",
    "alert.suppress", "alert.suppress.period", "alert.suppress.fields",
    "alert.suppress.group_name", "alert.expires", "alert.track", "actions",
}
ALLOWED_ACTION_FIELDS = {
    "action.citic_alert_delivery",
    "action.citic_alert_delivery.param.payload_format",
    "action.citic_alert_delivery.param.deployment",
    "action.citic_alert_delivery.param.registration_id",
    "action.citic_alert_delivery.param.stable_id",
    "action.citic_alert_delivery.param.spl",
    "action.citic_alert_delivery.param.source_indexes",
    "action.citic_alert_delivery.param.app",
    "action.citic_alert_delivery.param.owner",
    "action.citic_alert_delivery.param.policy_id",
    "action.citic_alert_delivery.param.policy_revision",
    "action.citic_alert_delivery.param.definition_revision",
    "action.citic_alert_delivery.param.selected_columns",
    "action.citic_alert_delivery.param.row_filters",
    "action.citic_alert_delivery.param.max_stored_rows",
}


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _flag(value: Any) -> bool:
    return value is True or str(value or "").strip().casefold() in {"1", "true", "yes", "on"}


def _safe_json(value: Any, depth: int = 0) -> Any:
    if depth > 3:
        return str(value)[:500]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {str(key)[:128]: _safe_json(item, depth + 1) for key, item in list(value.items())[:100]}
    if isinstance(value, (list, tuple)):
        return [_safe_json(item, depth + 1) for item in list(value)[:100]]
    return str(value)[:500]


def _json_hash(value: Mapping[str, Any]) -> str:
    return hashlib.sha256(json.dumps(_safe_json(value), sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _bool_text(value: Any) -> str:
    return "1" if _flag(value) else "0"


def _field_text(value: Any) -> str:
    if isinstance(value, bool):
        return _bool_text(value)
    if isinstance(value, Mapping):
        return ",".join(sorted(str(item).strip() for item in value if str(item).strip()))
    if isinstance(value, (list, tuple, set)):
        return ",".join(str(item).strip() for item in value if str(item).strip())
    return str(value if value is not None else "").strip()


def _approved_apps() -> set[str]:
    configured = [item.strip() for item in _env("CITIC_WRITE_ALLOWED_APPS", _env("CITIC_WRITE_APP", "search")).split(",") if item.strip()]
    return set(configured)


def _approved_owners() -> set[str]:
    configured = [item.strip() for item in _env("CITIC_WRITE_ALLOWED_OWNERS", _env("CITIC_WRITE_OWNER", "nobody")).split(",") if item.strip()]
    return set(configured)


def _extension_token() -> str:
    token = _env("CITIC_WRITE_MCP_TOKEN")
    if not token:
        raise RuntimeError("CITIC_WRITE_MCP_TOKEN is required")
    return token


def _authorize_context(context: Context) -> None:
    """Authenticate every tool call at the extension boundary."""
    expected = _extension_token().encode()
    request = getattr(context.request_context, "request", None)
    headers = getattr(request, "headers", {}) if request is not None else {}
    supplied = str(headers.get("authorization", "")) if headers else ""
    if not supplied.casefold().startswith("bearer "):
        raise PermissionError("bearer authentication is required")
    actual = supplied[7:].strip().encode()
    if not actual or not hmac.compare_digest(actual, expected):
        raise PermissionError("write extension authentication failed")


class WriteExtension:
    def __init__(self) -> None:
        self.db_path = Path(_env("CITIC_WRITE_OPERATION_DB", str(DEFAULT_DB))).expanduser()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.splunk_url = _env("CITIC_WRITE_SPLUNK_URL")
        self.splunk_token = _env("CITIC_WRITE_SPLUNK_TOKEN")
        self.timeout = max(1, min(int(_env("CITIC_WRITE_TIMEOUT", "30")), 120))
        self.verify_ssl = not _flag(_env("CITIC_WRITE_ALLOW_INSECURE_HTTP"))
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout=10000")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS operations (
                    idempotency_key TEXT PRIMARY KEY,
                    operation TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    target_name TEXT NOT NULL DEFAULT '',
                    desired_fields TEXT NOT NULL DEFAULT '{}',
                    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
                    result TEXT NOT NULL DEFAULT '{}',
                    error TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
                """
            )
            connection.execute("CREATE INDEX IF NOT EXISTS operations_updated_idx ON operations(updated_at)")

    def capabilities(self) -> dict[str, Any]:
        # Capability discovery must remain useful while an operator is still
        # wiring the extension. Authentication is enforced on the write call;
        # a missing token should report can_write=false, not crash discovery.
        configured = bool(self.splunk_url and self.splunk_token and _env("CITIC_WRITE_MCP_TOKEN"))
        return {
            "version": 1,
            "can_write": configured,
            "disabled_only": True,
            "approved_actions": [APPROVED_ACTION],
            "approved_apps": sorted(_approved_apps()),
            "approved_owners": sorted(_approved_owners()),
            "operations": ["create_saved_search", "update_saved_search", "operation_status"],
        }

    @staticmethod
    def _validate_fields(fields: Any) -> dict[str, Any]:
        if not isinstance(fields, Mapping):
            raise ValueError("fields must be an object")
        normalized = {str(key): value for key, value in fields.items()}
        unknown = [
            key for key in normalized
            if key not in ALLOWED_BASE_FIELDS and key not in ALLOWED_ACTION_FIELDS
        ]
        if unknown:
            raise ValueError("unsupported saved-search fields: " + ", ".join(sorted(unknown)[:10]))
        app = str(normalized.get("app", "")).strip()
        owner = str(normalized.get("owner", "")).strip()
        if app not in _approved_apps() or owner not in _approved_owners():
            raise PermissionError("saved-search namespace is not approved")
        if not _flag(normalized.get("disabled", False)) or _flag(normalized.get("enabled", False)):
            raise ValueError("the write extension only saves disabled definitions")
        actions = normalized.get("actions", "")
        action_values = actions.keys() if isinstance(actions, Mapping) else actions if isinstance(actions, (list, tuple, set)) else str(actions).split(",")
        action_values = [str(item).strip() for item in action_values if str(item).strip()]
        if APPROVED_ACTION not in action_values:
            raise ValueError("CITIC Alert Delivery must be selected explicitly")
        if set(action_values) != {APPROVED_ACTION}:
            raise ValueError("only the approved CITIC Alert Delivery action is permitted")
        if not _flag(normalized.get("action.citic_alert_delivery", True)):
            raise ValueError("CITIC Alert Delivery action is disabled")
        name = str(normalized.get("name", "")).strip()
        search = str(normalized.get("search", "")).strip()
        if not name or len(name) > 255 or not search:
            raise ValueError("saved-search name and search are required")
        return normalized

    def _base_url(self, owner: str, app: str, name: str | None = None) -> str:
        base = self.splunk_url.rstrip("/")
        path = f"/servicesNS/{quote(owner, safe='')}/{quote(app, safe='')}/saved/searches"
        if name is not None:
            path += "/" + quote(name, safe="")
        return base + path

    def _rest(self, method: str, url: str, form: Mapping[str, Any] | None = None) -> dict[str, Any]:
        parsed = urlsplit(url)
        if parsed.scheme != "https" and not _flag(_env("CITIC_WRITE_ALLOW_INSECURE_HTTP")):
            raise ValueError("Splunk write endpoint must use HTTPS")
        headers = {"Authorization": f"Bearer {self.splunk_token}", "Accept": "application/json"}
        data = None
        if form is not None:
            encoded: dict[str, str] = {}
            for key, value in form.items():
                if value is None:
                    continue
                if isinstance(value, bool):
                    value = _bool_text(value)
                elif isinstance(value, (list, tuple, set)):
                    value = ",".join(str(item) for item in value)
                encoded[str(key)] = str(value)
            data = urlencode(encoded).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        try:
            with urlopen(Request(url, data=data, headers=headers, method=method), timeout=self.timeout) as response:
                raw = response.read(2 * 1024 * 1024)
        except HTTPError as exc:
            if exc.code in {401, 403}:
                raise PermissionError("Splunk rejected the write extension credentials") from exc
            raise RuntimeError(f"Splunk write returned HTTP {exc.code}") from exc
        except (TimeoutError, URLError) as exc:
            raise TimeoutError("Splunk write request timed out or was unavailable") from exc
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError("Splunk write returned malformed JSON") from exc
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _entry_content(response: Mapping[str, Any]) -> dict[str, Any]:
        entries = response.get("entry")
        if isinstance(entries, list) and entries and isinstance(entries[0], Mapping):
            content = entries[0].get("content", {})
            return dict(content) if isinstance(content, Mapping) else {}
        return {}

    @staticmethod
    def _matches_desired(content: Mapping[str, Any], fields: Mapping[str, Any]) -> bool:
        for key, expected in fields.items():
            if key in {"app", "owner", "name"}:
                continue
            actual = content.get(key)
            if key == "actions":
                actual_values = {item for item in _field_text(actual).split(",") if item}
                expected_values = {item for item in _field_text(expected).split(",") if item}
                if actual_values != expected_values:
                    return False
            elif key in {"disabled", "is_scheduled", "alert.suppress", "action.citic_alert_delivery"}:
                if _bool_text(actual) != _bool_text(expected):
                    return False
            elif _field_text(actual) != _field_text(expected):
                return False
        return True

    def _perform(
        self,
        operation: str,
        fields: dict[str, Any],
        search_name: str = "",
        expected_revision: Any = None,
    ) -> dict[str, Any]:
        if _flag(_env("CITIC_WRITE_DRY_RUN")):
            return {"name": fields.get("name") or search_name, "app": fields.get("app", ""), "owner": fields.get("owner", ""), "revision": "dry-run"}
        if not self.splunk_url or not self.splunk_token:
            raise RuntimeError("Splunk REST write configuration is incomplete")
        app = str(fields["app"])
        owner = str(fields["owner"])
        name = str(fields.get("name") or search_name)
        form = {key: value for key, value in fields.items() if key not in {"app", "owner", "name"}}
        if operation == "create_saved_search":
            form["name"] = name
        url = self._base_url(owner, app, None if operation == "create_saved_search" else name)
        url += "?output_mode=json"
        if operation == "update_saved_search" and expected_revision is None:
            raise ValueError("expected_revision is required for update")
        if operation == "update_saved_search" and expected_revision is not None:
            current = self._entry_content(self._rest("GET", url))
            actual_revision = current.get("revision") or current.get("eai:acl.updated") or current.get("updated")
            if actual_revision is None or str(actual_revision) != str(expected_revision):
                raise ValueError("saved-search revision changed or cannot be verified")
        response = self._rest("POST", url, form)
        read_back = self._rest("GET", self._base_url(owner, app, name) + "?output_mode=json")
        content = self._entry_content(read_back)
        if not content or not self._matches_desired(content, fields):
            raise RuntimeError("saved-search publication readback did not match the approved definition")
        return {
            "name": name,
            "app": app,
            "owner": owner,
            "revision": content.get("revision") or content.get("eai:acl.updated") or response.get("revision", ""),
            "response": _safe_json(read_back),
        }

    def write(
        self,
        operation: str,
        fields: Any,
        search_name: str,
        idempotency_key: str,
        expected_revision: Any = None,
    ) -> dict[str, Any]:
        if operation not in {"create_saved_search", "update_saved_search"}:
            raise ValueError("unsupported write operation")
        if not isinstance(idempotency_key, str) or not idempotency_key.strip() or len(idempotency_key) > 256:
            raise ValueError("idempotency_key is required")
        normalized = self._validate_fields(fields)
        if operation == "update_saved_search" and not search_name.strip():
            raise ValueError("search_name is required for update")
        request = {"operation": operation, "fields": normalized, "search_name": search_name, "expected_revision": expected_revision}
        request_hash = _json_hash(request)
        now = time.time()
        with self._connect() as connection:
            # Reserve the idempotency key before leaving the process.  A
            # deferred SQLite transaction would allow two extension workers
            # to observe the key as absent and both call Splunk.
            connection.execute("BEGIN IMMEDIATE")
            existing = connection.execute("SELECT * FROM operations WHERE idempotency_key = ?", (idempotency_key,)).fetchone()
            if existing is not None:
                if not hmac.compare_digest(str(existing["request_hash"]), request_hash):
                    raise ValueError("idempotency key was reused for different content")
                if existing["status"] == "succeeded":
                    return json.loads(existing["result"])
                if existing["status"] == "failed":
                    raise RuntimeError(existing["error"] or "the original write failed")
                if existing["status"] == "pending":
                    raise TimeoutError("the original write is still pending; reconcile operation_status first")
            else:
                operation_count = connection.execute("SELECT COUNT(*) FROM operations").fetchone()[0]
                if int(operation_count or 0) >= OPERATION_LIMIT:
                    raise RuntimeError(
                        "publication operation journal is at capacity; archive it only through the operator procedure"
                    )
                connection.execute(
                    "INSERT INTO operations (idempotency_key,operation,request_hash,target_name,desired_fields,status,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?)",
                    (idempotency_key, operation, request_hash, search_name or str(normalized.get("name", "")), json.dumps(_safe_json(normalized)), now, now),
                )
        try:
            result = self._perform(operation, normalized, search_name, expected_revision)
        except TimeoutError:
            # Keep pending. The operator/client must ask operation_status and
            # the extension can reconcile the original target without retrying.
            raise
        except Exception as exc:
            with self._connect() as connection:
                connection.execute("UPDATE operations SET status='failed', error=?, updated_at=? WHERE idempotency_key=?", (str(exc)[:1_000], time.time(), idempotency_key))
            raise
        with self._connect() as connection:
            connection.execute("UPDATE operations SET status='succeeded', result=?, updated_at=? WHERE idempotency_key=?", (json.dumps(_safe_json(result)), time.time(), idempotency_key))
        return result

    def _reconcile_pending(self, row: sqlite3.Row) -> dict[str, Any] | None:
        if _flag(_env("CITIC_WRITE_DRY_RUN")):
            result = {"name": row["target_name"], "status": "dry-run"}
        else:
            try:
                fields = json.loads(row["desired_fields"] or "{}")
                if not isinstance(fields, dict):
                    return None
                response = self._rest(
                    "GET",
                    self._base_url(str(fields.get("owner", "")), str(fields.get("app", "")), row["target_name"]) + "?output_mode=json",
                )
                content = self._entry_content(response)
                if not content or not self._matches_desired(content, fields):
                    return None
                result = {"name": row["target_name"], "app": fields.get("app", ""), "owner": fields.get("owner", ""), "revision": content.get("revision", ""), "response": _safe_json(response)}
            except Exception:
                return None
        with self._connect() as connection:
            connection.execute("UPDATE operations SET status='succeeded', result=?, updated_at=? WHERE idempotency_key=? AND status='pending'", (json.dumps(_safe_json(result)), time.time(), row["idempotency_key"]))
        return result

    def operation_status(self, operation_id: str) -> dict[str, Any]:
        if not isinstance(operation_id, str) or not operation_id.strip() or len(operation_id) > 256:
            raise ValueError("operation id is invalid")
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM operations WHERE idempotency_key = ?", (operation_id,)).fetchone()
        if row is None:
            return {"status": "unknown", "operation_id": operation_id}
        if row["status"] == "pending":
            self._reconcile_pending(row)
            with self._connect() as connection:
                row = connection.execute("SELECT * FROM operations WHERE idempotency_key = ?", (operation_id,)).fetchone()
        result = json.loads(row["result"]) if row["result"] else {}
        return {"status": row["status"], "operation_id": operation_id, "operation": row["operation"], "result": result, "error": row["error"]}


_extension = WriteExtension()
mcp = FastMCP(
    "CITIC Saved Search Write Extension",
    instructions="Only disabled, explicitly CITIC Alert Delivery saved searches in approved namespaces may be written.",
    host=_env("CITIC_WRITE_HOST", "127.0.0.1"),
    port=max(1, min(int(_env("CITIC_WRITE_PORT", "8090")), 65535)),
    streamable_http_path=_env("CITIC_WRITE_MCP_PATH", "/mcp"),
    stateless_http=False,
)


@mcp.tool()
def citic_write_saved_search(
    operation: str,
    fields: dict[str, Any] | None = None,
    search_name: str = "",
    idempotency_key: str = "",
    expected_revision: str | None = None,
    ctx: Context | None = None,
) -> dict[str, Any]:
    if ctx is None:
        raise PermissionError("request context is required")
    _authorize_context(ctx)
    if operation == "capabilities":
        return _extension.capabilities()
    if operation == "operation_status":
        return _extension.operation_status(idempotency_key)
    return _extension.write(operation, fields or {}, search_name, idempotency_key, expected_revision)


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
