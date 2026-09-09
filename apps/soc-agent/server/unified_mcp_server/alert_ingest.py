"""Splunk alert registration and original-result ingestion into PostgreSQL.

The new delivery path resolves a registered saved search to a customer and
generates AID/EID values in PostgreSQL. The older fired-alert polling contract
is retained only as an explicit reconciliation/legacy mode; unresolved or
conflicting runs are retained in the quarantine table for operator review.

Run from ``apps/soc-agent/server``::

    uv run python -m unified_mcp_server.alert_ingest --limit 100 --dry-run
    uv run python -m unified_mcp_server.alert_ingest --limit 100
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import os
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .config import ServerSettings
from .env_loader import load_server_env
from .alert_identity import (
    AlertIdentityError,
    AlertRunPayload,
    definition_fingerprint,
    extract_static_indexes,
    format_eid,
    normalize_cid,
    normalize_deployment,
    normalize_alert_policy,
    project_selected_rows,
    project_selected_rows_with_counts,
    required_columns_missing,
)
from .postgres_store import PostgresBootstrap, create_connection_pool
from .splunk.official_mcp_client import OfficialSplunkMCPClient

try:
    import psycopg
except ImportError:  # pragma: no cover - optional runtime guard
    psycopg = None  # type: ignore[assignment]


LOGGER = logging.getLogger(__name__)
ALLOWED_SEVERITIES = {"info", "low", "medium", "high", "critical"}
DEFAULT_ALERT_POLICY = {
    "detail_columns": [],
    "field_mappings": [],
    "required_columns": [],
    "optional_columns": [],
    "max_display_rows": 50,
    "max_stored_rows": 1_000,
    "row_filters": [],
    "severity_source": "",
    "severity_mapping": {},
    "severity_fallback": "unknown",
}
_INVALID_SOURCE_INDEX = "__invalid_source_index__"


def _has_delivery_action(value: Any) -> bool:
    if isinstance(value, Mapping):
        value = value.keys()
    values = value if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)) else str(value or "").split(",")
    return any(str(item).strip().casefold() == "citic_alert_delivery" for item in values)
EVENT_DATA_KEYS = {
    "sid",
    "search_id",
    "trigger_time",
    "triggerTime",
    "savedsearch_name",
    "search_name",
    "detection_name",
    "alert_name",
    "result_count",
    "event_count",
    "severity",
    "owner",
    "app",
    "title",
    "description",
    "Event_GID",
    "Event_Rulenum",
    "GID",
    "rulename",
}


def _content(value: Mapping[str, Any]) -> dict[str, Any]:
    content = value.get("content")
    result = {key: item for key, item in value.items() if key != "content"}
    if isinstance(content, Mapping):
        result.update(content)
    return result


def _first(value: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        candidate = value.get(key)
        if candidate not in (None, ""):
            return candidate
    return None


def _text(value: Any, *, limit: int = 2_000) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    text = str(value).strip()
    return text[:limit] or None


def _timestamp(value: Any) -> datetime | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        if isinstance(value, (int, float)):
            parsed = datetime.fromtimestamp(float(value), timezone.utc)
        else:
            text = str(value).strip()
            if not text:
                return None
            if text.replace(".", "", 1).isdigit():
                parsed = datetime.fromtimestamp(float(text), timezone.utc)
            else:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None


def _count(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _severity(value: Any) -> str | None:
    text = _text(value, limit=32)
    if text is None:
        return None
    normalized = text.casefold()
    return normalized if normalized in ALLOWED_SEVERITIES else None


def _safe_value(value: Any, *, depth: int = 0) -> Any:
    if depth > 3:
        return _text(value, limit=500)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {
            str(key)[:128]: _safe_value(item, depth=depth + 1)
            for key, item in list(value.items())[:100]
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_safe_value(item, depth=depth + 1) for item in list(value)[:100]]
    return _text(value, limit=500)


def _event_data(payload: Mapping[str, Any], *, event_gid: str | None, event_rulenum: str | None) -> dict[str, Any]:
    """Keep alert metadata bounded and exclude arbitrary raw result fields."""
    data = {
        key: _safe_value(payload[key])
        for key in EVENT_DATA_KEYS
        if key in payload and payload[key] not in (None, "")
    }
    if event_gid:
        data["Event_GID"] = event_gid
    if event_rulenum:
        data["Event_Rulenum"] = event_rulenum
    return data


def _dedup_key(
    *,
    splunk_sid: str | None,
    alert_name: str | None,
    trigger_time: datetime | None,
    payload: Mapping[str, Any],
) -> str:
    if splunk_sid and alert_name and trigger_time:
        return "|".join((splunk_sid, alert_name, trigger_time.isoformat()))
    stable = json.dumps(_safe_value(dict(payload)), sort_keys=True, default=str, separators=(",", ":"))
    return "fallback:" + hashlib.sha256(stable.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class NormalizedAlert:
    splunk_sid: str | None
    alert_name: str | None
    trigger_time: datetime | None
    result_count: int | None
    severity: str | None
    event_gid: str | None
    event_rulenum: str | None
    event_data: dict[str, Any]
    dedup_key: str


@dataclass
class IngestReport:
    found: int = 0
    inserted: int = 0
    skipped: int = 0
    quarantined: int = 0
    failed: int = 0
    would_insert: int = 0
    errors: list[str] = field(default_factory=list)
    retryable: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "found": self.found,
            "inserted": self.inserted,
            "skipped": self.skipped,
            "quarantined": self.quarantined,
            "failed": self.failed,
            "would_insert": self.would_insert,
            "errors": list(self.errors),
        }

    def merge(self, other: "IngestReport") -> None:
        for name in ("found", "inserted", "skipped", "quarantined", "failed", "would_insert"):
            setattr(self, name, getattr(self, name) + getattr(other, name))
        self.errors.extend(other.errors)
        self.retryable = self.retryable or other.retryable


class AlertIngestionStore:
    """Small PostgreSQL store for alert mapping, inserts, and quarantine."""

    def __init__(self, uri: str) -> None:
        if psycopg is None:
            raise RuntimeError("Alert ingestion requires the psycopg package.")
        self.uri = uri.strip()
        if not self.uri:
            raise ValueError("APP_POSTGRES_URI is required for alert ingestion.")
        self._pool = create_connection_pool(self.uri)
        self._lock_connection = None

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "AlertIngestionStore | None":
        bootstrap = PostgresBootstrap.from_env(env)
        return cls(bootstrap.uri) if bootstrap else None

    def _connect(self):
        if self._pool is not None:
            return self._pool.connection()
        return psycopg.connect(self.uri, connect_timeout=5, options="-c statement_timeout=15000")

    def close(self) -> None:
        self.release_worker_lock()
        if self._pool is not None:
            self._pool.close()
            self._pool = None

    # -- CID/AID/EID registration -----------------------------------------

    @staticmethod
    def _registration_columns() -> tuple[str, ...]:
        return (
            "id", "customer_id", "cid", "aid", "aid_sequence", "deployment", "app",
            "owner", "saved_search_name", "stable_id", "source_indexes",
            "definition_fingerprint", "definition_revision", "registration_state",
            "delivery_state", "origin", "last_error", "delivery_enabled",
            "presence_state", "publication_state", "last_discovered_at",
            "created_at", "updated_at",
        )

    @staticmethod
    def _registration_dict(row: Sequence[Any]) -> dict[str, Any]:
        values = dict(zip(AlertIngestionStore._registration_columns(), row, strict=True))
        for key in ("id", "customer_id"):
            if values.get(key) is not None:
                values[key] = str(values[key])
        values["source_indexes"] = list(values.get("source_indexes") or [])
        return values

    @staticmethod
    def _registration_select() -> str:
        return """
            SELECT r.id::text, r.customer_id::text, c.cid, r.aid, r.aid_sequence,
                   r.splunk_deployment, r.app, r.owner, r.saved_search_name,
                   r.stable_id, r.source_indexes, r.definition_fingerprint,
                   r.definition_revision, r.registration_state, r.delivery_state,
                   r.origin, r.last_error, r.delivery_enabled, r.presence_state,
                   r.publication_state, r.last_discovered_at, r.created_at, r.updated_at
            FROM sec_alert_registrations AS r
            JOIN customers AS c ON c.id = r.customer_id
        """

    @staticmethod
    def _source_indexes(value: Any) -> tuple[str, ...]:
        if value is None:
            return ()
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
            return (_INVALID_SOURCE_INDEX,)
        result: list[str] = []
        invalid = False
        for item in value:
            text = str(item or "").strip()
            if text == _INVALID_SOURCE_INDEX:
                invalid = True
                result.append(text)
                continue
            if not text or len(text) > 255 or text in result:
                invalid = invalid or not text or len(text) > 255
                continue
            # Keep malformed assertions in the comparison set. Silently
            # dropping a wildcard or macro could make a sender-supplied list
            # appear to agree with the parsed SPL and bypass scope review.
            if any(token in text for token in ("*", "?", "$", "`")):
                invalid = True
            result.append(text)
        if invalid:
            result.append(_INVALID_SOURCE_INDEX)
        return tuple(result)

    @staticmethod
    def _review_key(
        deployment: str,
        app: str,
        owner: str,
        name: str,
        stable_id: str,
        indexes: Sequence[str],
        fingerprint: str,
    ) -> str:
        value = "|".join((deployment, app, owner, name, stable_id, ",".join(indexes), fingerprint))
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def _resolve_index_customer(
        self,
        connection: Any,
        deployment: str,
        indexes: Sequence[str],
    ) -> tuple[str, str] | None:
        normalized = tuple(dict.fromkeys(str(item).strip() for item in indexes if str(item).strip()))
        if not normalized or _INVALID_SOURCE_INDEX in normalized:
            return None
        rows = connection.execute(
            """
            SELECT DISTINCT ownership.customer_id::text, customer.cid
            FROM sec_alert_index_ownership AS ownership
            JOIN customers AS customer ON customer.id = ownership.customer_id
            WHERE ownership.splunk_deployment = %s
              AND ownership.index_name = ANY(%s)
              AND ownership.status = 'active'
              AND customer.status = 'active'
              AND COALESCE(customer.cid, '') <> ''
            """,
            (deployment, list(normalized)),
        ).fetchall()
        owned_count = connection.execute(
            """
            SELECT COUNT(DISTINCT index_name)
            FROM sec_alert_index_ownership
            WHERE splunk_deployment = %s
              AND index_name = ANY(%s)
              AND status = 'active'
            """,
            (deployment, list(normalized)),
        ).fetchone()
        if not owned_count or int(owned_count[0] or 0) != len(normalized) or len(rows) != 1:
            return None
        customer_id, cid = rows[0]
        try:
            return str(customer_id), normalize_cid(cid)
        except AlertIdentityError:
            return None

    def sync_catalog_indexes(self, deployment: str) -> int:
        """Return explicit ownership rows without copying catalog declarations.

        ``soc_customer.splunk_indexes`` is a compatibility/catalog field.  It
        is not deployment-scoped and therefore cannot be used to route an
        alert.  Administrators must call :meth:`set_index_ownership` after an
        approved integration verifies the exact deployment and index.
        """

        deployment = normalize_deployment(deployment)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*)
                FROM sec_alert_index_ownership
                WHERE splunk_deployment = %s AND status = 'active'
                """,
                (deployment,),
            ).fetchone()
            return int(row[0] or 0) if row else 0

    def start_discovery_run(self, deployment: str) -> str:
        """Persist the start of one saved-search catalog pass."""

        deployment = normalize_deployment(deployment)
        with self._connect() as connection:
            row = connection.execute(
                """
                INSERT INTO sec_alert_discovery_runs (deployment, status)
                VALUES (%s, 'running')
                RETURNING id::text
                """,
                (deployment,),
            ).fetchone()
        if row is None:
            raise RuntimeError("could not create the alert discovery run")
        return str(row[0])

    def finish_discovery_run(
        self,
        run_id: str,
        *,
        status: str,
        discovered_count: int = 0,
        page_count: int = 0,
        error: str = "",
    ) -> None:
        status = str(status or "failed").strip().casefold()
        if status not in {"complete", "incomplete", "failed"}:
            raise ValueError("invalid discovery run status")
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_alert_discovery_runs
                SET status = %s, discovered_count = %s, page_count = %s,
                    completed_at = NOW(), error = NULLIF(%s, '')
                WHERE id = %s::uuid
                """,
                (
                    status,
                    max(0, int(discovered_count)),
                    max(0, int(page_count)),
                    str(error or "")[:2_000],
                    run_id,
                ),
            )

    def attach_discovery_run(self, registration_id: str, run_id: str) -> None:
        """Associate a discovered registration with the completed pass record."""

        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_alert_registrations
                SET last_discovery_run_id = %s::uuid, updated_at = NOW()
                WHERE id = %s::uuid
                """,
                (run_id, registration_id),
            )

    def set_index_ownership(
        self,
        *,
        deployment: str,
        index_name: str,
        customer_id: str,
        status: str = "active",
        actor: str = "",
    ) -> dict[str, Any]:
        """Persist one administrator-approved deployment/index assignment."""

        deployment = normalize_deployment(deployment)
        index_name = str(index_name or "").strip()
        if (
            not index_name
            or index_name == _INVALID_SOURCE_INDEX
            or len(index_name) > 255
            or any(token in index_name for token in ("*", "?", "$", "`"))
        ):
            raise AlertIdentityError("invalid_index", "an exact Splunk index name is required")
        status = str(status or "active").strip().casefold()
        if status not in {"active", "review", "retired"}:
            raise AlertIdentityError("invalid_index_status", "index ownership status is invalid")
        with self._connect() as connection:
            customer = connection.execute(
                "SELECT id::text, cid, status FROM customers WHERE id = %s::uuid FOR SHARE",
                (customer_id,),
            ).fetchone()
            if customer is None:
                raise AlertIdentityError("unknown_customer", "customer was not found")
            cid = normalize_cid(customer[1])
            if status == "active" and str(customer[2]).casefold() != "active":
                raise AlertIdentityError("inactive_customer", "an inactive customer cannot own an active index")
            row = connection.execute(
                """
                INSERT INTO sec_alert_index_ownership (
                    splunk_deployment, index_name, customer_id, status, created_by, updated_by
                ) VALUES (%s, %s, %s::uuid, %s, %s, %s)
                ON CONFLICT (splunk_deployment, index_name) DO UPDATE SET
                    customer_id = EXCLUDED.customer_id, status = EXCLUDED.status,
                    updated_by = EXCLUDED.updated_by, updated_at = NOW()
                RETURNING id::text, splunk_deployment, index_name, customer_id::text,
                          status, updated_at
                """,
                (deployment, index_name, customer_id, status, actor[:320], actor[:320]),
            ).fetchone()
        return {
            "id": str(row[0]), "deployment": row[1], "index_name": row[2],
            "customer_id": str(row[3]), "cid": cid, "status": row[4],
            "updated_at": row[5],
        }

    @staticmethod
    def _record_review_action(
        connection: Any,
        *,
        action: str,
        actor: str,
        event_id: str | None = None,
        registration_id: str | None = None,
        details: Mapping[str, Any] | None = None,
    ) -> None:
        """Write an immutable administrator action audit record."""
        connection.execute(
            """
            INSERT INTO sec_alert_delivery_review_actions (
                event_id, registration_id, action, actor, details
            ) VALUES (%s::uuid, %s::uuid, %s, %s, %s::jsonb)
            """,
            (
                event_id,
                registration_id,
                action,
                str(actor or "")[:320],
                json.dumps(_safe_value(dict(details or {})), separators=(",", ":")),
            ),
        )

    def set_registration_delivery_enabled(
        self,
        registration_id: str,
        enabled: bool,
        *,
        actor: str = "",
    ) -> dict[str, Any]:
        """Enable or disable future delivery for one registered alert.

        Disabling is immediate and holds any not-yet-sent event. Enabling does
        not release held events; that remains an explicit review action.
        """
        if not isinstance(enabled, bool):
            raise AlertIdentityError("invalid_delivery_flag", "alert delivery enabled must be a boolean")
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id::text, customer_id::text, delivery_enabled
                FROM sec_alert_registrations
                WHERE id = %s::uuid
                FOR UPDATE
                """,
                (registration_id,),
            ).fetchone()
            if row is None:
                raise AlertIdentityError("unknown_registration", "alert registration was not found")
            connection.execute(
                """
                UPDATE sec_alert_registrations
                SET delivery_enabled = %s, updated_by = %s, updated_at = NOW()
                WHERE id = %s::uuid
                """,
                (enabled, str(actor or "")[:320], registration_id),
            )
            if not enabled:
                connection.execute(
                    """
                    UPDATE sec_event_email_outbox AS outbox
                    SET status = 'held', next_attempt_at = NULL,
                        last_error = 'alert delivery was disabled by an administrator',
                        claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
                    FROM sec_events AS event
                    WHERE event.id = outbox.event_id
                      AND event.alert_registration_id = %s::uuid
                      AND COALESCE(event.eid, '') <> ''
                      AND outbox.status IN ('pending', 'failed')
                    """,
                    (registration_id,),
                )
            self._record_review_action(
                connection,
                action="enable" if enabled else "disable",
                actor=str(actor or ""),
                registration_id=registration_id,
                details={"enabled": enabled},
            )
            result = connection.execute(
                self._registration_select() + " WHERE r.id = %s::uuid",
                (registration_id,),
            ).fetchone()
        if result is None:
            raise RuntimeError("alert registration disappeared during update")
        return self._registration_dict(result)

    def relink_registration(
        self,
        registration_id: str,
        *,
        customer_id: str,
        source_indexes: Sequence[str],
        actor: str = "",
        review_id: str | None = None,
    ) -> dict[str, Any]:
        """Resolve an ambiguous registration after explicit administrator review.

        A relink may repair scope and identity evidence, but it cannot silently
        move an alert between customers. Customer moves require a retired
        source registration and a separately registered definition so its AID
        history remains unambiguous.
        """
        indexes = self._source_indexes(source_indexes)
        if not indexes or len(indexes) != len(tuple(source_indexes or ())):
            raise AlertIdentityError("invalid_scope", "relink requires a non-empty list of exact source indexes")
        with self._connect() as connection:
            registration_row = connection.execute(
                self._registration_select() + " WHERE r.id = %s::uuid FOR UPDATE",
                (registration_id,),
            ).fetchone()
            if registration_row is None:
                raise AlertIdentityError("unknown_registration", "alert registration was not found")
            registration = self._registration_dict(registration_row)
            customer = connection.execute(
                "SELECT id::text, cid, status FROM customers WHERE id = %s::uuid FOR SHARE",
                (customer_id,),
            ).fetchone()
            if customer is None:
                raise AlertIdentityError("unknown_customer", "customer was not found")
            if str(customer[0]) != registration["customer_id"]:
                raise AlertIdentityError(
                    "customer_move_requires_new_registration",
                    "moving an alert to another customer requires retiring this registration and creating a new one",
                )
            if str(customer[2]).casefold() != "active":
                raise AlertIdentityError("inactive_customer", "an inactive customer cannot own an active alert scope")
            resolved = self._resolve_index_customer(connection, registration["deployment"], indexes)
            if resolved is None or resolved[0] != registration["customer_id"]:
                raise AlertIdentityError(
                    "scope_conflict",
                    "the selected indexes are not completely and uniquely owned by the selected customer",
                )
            current_state = registration["registration_state"]
            publication = registration.get("publication_state")
            if current_state in {"retired", "inactive"}:
                next_state = current_state
                next_delivery = "blocked"
            elif publication == "pending":
                next_state = "pending"
                next_delivery = "blocked"
            elif publication == "published":
                next_state = "active"
                next_delivery = "ready"
            else:
                next_state = "needs_review"
                next_delivery = "action_missing"
            connection.execute(
                """
                UPDATE sec_alert_registrations
                SET source_indexes = %s, registration_state = %s,
                    delivery_state = %s, last_error = NULL,
                    updated_by = %s, updated_at = NOW()
                WHERE id = %s::uuid
                """,
                (list(indexes), next_state, next_delivery, str(actor or "")[:320], registration_id),
            )
            review_where = [
                "splunk_deployment = %s",
                "app = %s",
                "owner = %s",
                "saved_search_name = %s",
                "resolved_at IS NULL",
            ]
            review_params: list[Any] = [
                registration["deployment"], registration["app"], registration["owner"], registration["saved_search_name"],
            ]
            if review_id:
                review_where.append("id = %s::uuid")
                review_params.append(review_id)
            connection.execute(
                "UPDATE sec_alert_registration_review SET resolved_at = NOW(), updated_at = NOW() WHERE "
                + " AND ".join(review_where),
                review_params,
            )
            self._record_review_action(
                connection,
                action="relink",
                actor=str(actor or ""),
                registration_id=registration_id,
                details={"customer_id": registration["customer_id"], "source_indexes": list(indexes), "review_id": review_id},
            )
            result = connection.execute(
                self._registration_select() + " WHERE r.id = %s::uuid",
                (registration_id,),
            ).fetchone()
        return self._registration_dict(result)

    def release_held_event(
        self,
        event_id: str,
        *,
        customer_id: str,
        actor: str = "",
    ) -> dict[str, Any]:
        """Release one reviewed registered event without changing its EID."""
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT e.id::text, e.customer_id::text, e.eid, e.event_data,
                       e.alert_registration_id::text, e.historical_email_suppressed,
                       c.status, c.alert_delivery_enabled, c.email_config,
                       r.registration_state, r.delivery_state, r.delivery_enabled,
                       r.presence_state, r.source_indexes, r.splunk_deployment,
                       o.status
                FROM sec_events AS e
                JOIN customers AS c ON c.id = e.customer_id
                LEFT JOIN sec_alert_registrations AS r ON r.id = e.alert_registration_id
                LEFT JOIN sec_event_email_outbox AS o ON o.event_id = e.id
                WHERE e.id = %s::uuid AND e.customer_id = %s::uuid
                FOR UPDATE OF e
                """,
                (event_id, customer_id),
            ).fetchone()
            if row is None:
                raise AlertIdentityError("event_not_found", "held event was not found for this customer")
            if not row[2] or not row[4]:
                raise AlertIdentityError("legacy_event", "only registered events with an EID can be released")
            if row[5]:
                raise AlertIdentityError("historical_event", "historical migration events cannot be released into email")
            if row[15] in {"sent", "accepted", "processing"}:
                return {"status": "already_delivered", "event_id": str(row[0]), "eid": str(row[2]), "outbox_status": row[15]}
            source_indexes = list(row[13] or [])
            ownership_ok = bool(
                connection.execute(
                    """
                    SELECT cardinality(%s::text[]) > 0
                       AND NOT EXISTS (
                           SELECT 1
                           FROM unnest(%s::text[]) AS source(index_name)
                           WHERE NOT EXISTS (
                               SELECT 1 FROM sec_alert_index_ownership AS ownership
                               WHERE ownership.splunk_deployment = %s
                                 AND ownership.index_name = source.index_name
                                 AND ownership.customer_id = %s::uuid
                                 AND ownership.status = 'active'
                           )
                       )
                    """,
                    (source_indexes, source_indexes, row[14], customer_id),
                ).fetchone()[0]
            )
            config = row[8] if isinstance(row[8], Mapping) else {}
            recipients_ok = isinstance(config.get("recipients"), list) and bool(config.get("recipients"))
            eligible = (
                str(row[6]).casefold() == "active"
                and bool(row[7])
                and str(row[9]).casefold() == "active"
                and str(row[10]).casefold() == "ready"
                and bool(row[11])
                and str(row[12]).casefold() in {"unknown", "present"}
                and ownership_ok
                and recipients_ok
            )
            if not eligible:
                raise AlertIdentityError(
                    "held_event_not_eligible",
                    "customer authorization, registration action, recipients, or source ownership is still invalid",
                )
            event_data = dict(row[3]) if isinstance(row[3], Mapping) else {}
            event_data["email_held"] = False
            event_data.pop("email_hold_reason", None)
            event_data["email_released_by"] = str(actor or "")[:320]
            # A run held because recipients were absent has an intentionally
            # empty snapshot.  Once an administrator fixes the customer
            # configuration, release must snapshot the now-approved
            # recipients.  A valid original snapshot remains immutable so a
            # retry cannot silently change its destination.
            from .alert_email import normalize_email_config

            snapshot_candidate = event_data.get("recipient_snapshot")
            try:
                recipient_snapshot = normalize_email_config(
                    snapshot_candidate,
                    require_recipient=True,
                )
            except (TypeError, ValueError):
                try:
                    recipient_snapshot = normalize_email_config(config, require_recipient=True)
                except (TypeError, ValueError) as exc:
                    raise AlertIdentityError(
                        "held_event_not_eligible",
                        "customer recipients are still invalid or empty",
                    ) from exc
            event_data["recipient_snapshot"] = recipient_snapshot
            connection.execute(
                "UPDATE sec_events SET event_data = %s::jsonb WHERE id = %s::uuid",
                (json.dumps(_safe_value(event_data), separators=(",", ":")), event_id),
            )
            policy_snapshot = event_data.get("email_policy")
            if not isinstance(policy_snapshot, Mapping):
                policy_snapshot = {}
            outbox = connection.execute(
                """
                INSERT INTO sec_event_email_outbox (
                    event_id, customer_id, eid, status, next_attempt_at,
                    recipient_snapshot, rendering_policy_snapshot
                ) VALUES (%s::uuid, %s::uuid, %s, 'pending', NOW(), %s::jsonb, %s::jsonb)
                ON CONFLICT (event_id) DO UPDATE SET
                    status = CASE WHEN sec_event_email_outbox.status IN ('held', 'disabled', 'failed')
                                  THEN 'pending' ELSE sec_event_email_outbox.status END,
                    next_attempt_at = CASE WHEN sec_event_email_outbox.status IN ('held', 'disabled', 'failed')
                                           THEN NOW() ELSE sec_event_email_outbox.next_attempt_at END,
                    last_error = CASE WHEN sec_event_email_outbox.status IN ('held', 'disabled', 'failed')
                                      THEN NULL ELSE sec_event_email_outbox.last_error END,
                    claimed_at = NULL, claimed_by = NULL,
                    recipient_snapshot = COALESCE(sec_event_email_outbox.recipient_snapshot, EXCLUDED.recipient_snapshot),
                    rendering_policy_snapshot = COALESCE(sec_event_email_outbox.rendering_policy_snapshot, EXCLUDED.rendering_policy_snapshot)
                RETURNING id::text, status
                """,
                (event_id, customer_id, str(row[2]), json.dumps(_safe_value(dict(recipient_snapshot)), separators=(",", ":")),
                 json.dumps(_safe_value(dict(policy_snapshot)), separators=(",", ":"))),
            ).fetchone()
            self._record_review_action(
                connection,
                action="release",
                actor=str(actor or ""),
                event_id=event_id,
                registration_id=row[4],
                details={"eid": str(row[2]), "outbox_status": outbox[1] if outbox else None},
            )
        return {"status": "released", "event_id": str(row[0]), "eid": str(row[2]), "outbox_id": str(outbox[0]) if outbox else None, "outbox_status": outbox[1] if outbox else None}

    def _record_registration_review(
        self,
        connection: Any,
        *,
        deployment: str,
        app: str,
        owner: str,
        name: str,
        stable_id: str,
        indexes: Sequence[str],
        definition: Mapping[str, Any],
        reason: str,
        fingerprint: str,
    ) -> dict[str, Any]:
        review_key = self._review_key(deployment, app, owner, name, stable_id, indexes, fingerprint)
        connection.execute(
            """
            INSERT INTO sec_alert_registration_review (
                review_key, splunk_deployment, app, owner, saved_search_name,
                stable_id, source_indexes, definition, reason
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            ON CONFLICT (review_key) DO UPDATE SET
                source_indexes = EXCLUDED.source_indexes,
                definition = EXCLUDED.definition,
                reason = EXCLUDED.reason,
                updated_at = NOW()
            """,
            (
                review_key,
                deployment,
                app,
                owner,
                name,
                stable_id or None,
                list(indexes),
                json.dumps(_safe_value(dict(definition)), separators=(",", ":")),
                reason[:2_000],
            ),
        )
        return {
            "status": "needs_review",
            "review_key": review_key,
            "reason": reason[:2_000],
            "aid": None,
            "cid": None,
        }

    def _existing_definition_registration(
        self,
        connection: Any,
        *,
        deployment: str,
        app: str,
        owner: str,
        name: str,
        stable_id: str,
    ) -> Any:
        if stable_id:
            row = connection.execute(
                self._registration_select()
                + " WHERE r.splunk_deployment = %s AND r.stable_id = %s FOR UPDATE",
                (deployment, stable_id),
            ).fetchone()
            return row
        return connection.execute(
            self._registration_select()
            + " WHERE r.splunk_deployment = %s AND r.app = %s AND r.owner = %s"
            " AND r.saved_search_name = %s FOR UPDATE",
            (deployment, app, owner, name),
        ).fetchone()

    @staticmethod
    def _block_registration_for_review(
        connection: Any,
        existing: Sequence[Any],
        *,
        source_indexes: Sequence[str],
        fingerprint: str,
        reason: str,
    ) -> None:
        registration = AlertIngestionStore._registration_dict(existing)
        connection.execute(
            """
            UPDATE sec_alert_registrations
            SET source_indexes = %s, definition_fingerprint = %s,
                registration_state = 'needs_review', delivery_state = 'blocked',
                last_error = %s, updated_at = NOW()
            WHERE id = %s::uuid
            """,
            (list(source_indexes), fingerprint, reason[:2_000], registration["id"]),
        )

    def register_definition(
        self,
        definition: Mapping[str, Any],
        *,
        deployment: str,
        source_indexes: Sequence[str] | None = None,
        origin: str = "discovery",
        actor: str = "",
        action_configured: bool = False,
        publication_pending: bool = False,
        delivery_enabled: bool | None = None,
    ) -> dict[str, Any]:
        """Resolve ownership and create or revise one alert registration.

        AID allocation and the registration row are committed together.  A
        failed publication never gives the number back because the counter is
        advanced in the same transaction as the failed registration state.
        """

        if not isinstance(definition, Mapping):
            raise AlertIdentityError("invalid_definition", "alert definition must be an object")
        deployment = normalize_deployment(deployment)
        name = str(definition.get("saved_search_name") or definition.get("name") or "").strip()
        if not name or len(name) > 255:
            raise AlertIdentityError("invalid_alert_name", "saved-search name is required")
        app = str(definition.get("app") or "").strip()[:255]
        owner = str(definition.get("owner") or "").strip()[:255]
        stable_id = str(
            definition.get("stable_id")
            or definition.get("guid")
            or definition.get("uid")
            or ""
        ).strip()[:512]
        supplied_indexes = self._source_indexes(
            source_indexes if source_indexes is not None else definition.get("source_indexes")
        )
        parsed_indexes, index_error = extract_static_indexes(
            definition.get("spl") or definition.get("search")
        )
        indexes = parsed_indexes
        if not index_error and supplied_indexes and set(supplied_indexes) != set(parsed_indexes):
            index_error = "supplied source indexes disagree with the saved-search SPL"
        computed_fingerprint = definition_fingerprint(definition)
        supplied_fingerprint = str(definition.get("definition_fingerprint") or "").strip()
        fingerprint = supplied_fingerprint or computed_fingerprint
        fingerprint_error = None
        if supplied_fingerprint and supplied_fingerprint != computed_fingerprint:
            fingerprint_error = "definition fingerprint does not match the canonical definition"
        if fingerprint_error:
            index_error = index_error or fingerprint_error
        try:
            origin = origin if origin in {"human", "agent", "discovery", "unknown"} else "unknown"
        except TypeError:
            origin = "unknown"
        with self._connect() as connection:
            existing = self._existing_definition_registration(
                connection,
                deployment=deployment,
                app=app,
                owner=owner,
                name=name,
                stable_id=stable_id,
            )
            if index_error or not indexes:
                if existing is not None:
                    self._block_registration_for_review(
                        connection,
                        existing,
                        source_indexes=indexes,
                        fingerprint=fingerprint,
                        reason=index_error or "source indexes could not be resolved exactly",
                    )
                return self._record_registration_review(
                    connection,
                    deployment=deployment,
                    app=app,
                    owner=owner,
                    name=name,
                    stable_id=stable_id,
                    indexes=indexes,
                    definition=definition,
                    reason=index_error or "source indexes could not be resolved exactly",
                    fingerprint=fingerprint,
                )
            customer = self._resolve_index_customer(connection, deployment, indexes)
            if customer is None:
                reason = "source indexes are unknown, shared, or owned by different customers"
                if existing is not None:
                    self._block_registration_for_review(
                        connection,
                        existing,
                        source_indexes=indexes,
                        fingerprint=fingerprint,
                        reason=reason,
                    )
                return self._record_registration_review(
                    connection,
                    deployment=deployment,
                    app=app,
                    owner=owner,
                    name=name,
                    stable_id=stable_id,
                    indexes=indexes,
                    definition=definition,
                    reason=reason,
                    fingerprint=fingerprint,
                )
            customer_id, cid = customer
            if existing is not None:
                current = self._registration_dict(existing)
                # A name/app/owner match without a stable Splunk identity is
                # not enough evidence for a rename, recreation, or copy.  A
                # definition with the same fingerprint is safe to refresh;
                # a changed definition must be explicitly relinked.
                if not stable_id and fingerprint != current["definition_fingerprint"]:
                    reason = "saved-search identity is ambiguous; administrator relinking is required"
                    self._block_registration_for_review(
                        connection,
                        existing,
                        source_indexes=indexes,
                        fingerprint=fingerprint,
                        reason=reason,
                    )
                    return self._record_registration_review(
                        connection,
                        deployment=deployment,
                        app=app,
                        owner=owner,
                        name=name,
                        stable_id=stable_id,
                        indexes=indexes,
                        definition=definition,
                        reason=reason,
                        fingerprint=fingerprint,
                    )
                if current["customer_id"] != customer_id:
                    reason = "alert definition ownership conflicts with its existing registration"
                    self._block_registration_for_review(
                        connection,
                        existing,
                        source_indexes=indexes,
                        fingerprint=fingerprint,
                        reason=reason,
                    )
                    return self._record_registration_review(
                        connection,
                        deployment=deployment,
                        app=app,
                        owner=owner,
                        name=name,
                        stable_id=stable_id,
                        indexes=indexes,
                        definition=definition,
                        reason=reason,
                        fingerprint=fingerprint,
                    )
                revision = int(current["definition_revision"] or 1)
                if fingerprint != current["definition_fingerprint"]:
                    revision += 1
                    connection.execute(
                        """
                        INSERT INTO sec_alert_registration_revisions (
                            registration_id, revision, definition_fingerprint, definition, actor
                        ) VALUES (%s::uuid, %s, %s, %s::jsonb, %s)
                        ON CONFLICT (registration_id, revision) DO NOTHING
                        """,
                        (current["id"], revision, fingerprint,
                         json.dumps(_safe_value(dict(definition)), separators=(",", ":")), actor[:320]),
                    )
                delivery_state = "ready" if action_configured else "action_missing"
                if current["registration_state"] in {"pending", "needs_review", "failed", "inactive", "retired"}:
                    delivery_state = "blocked"
                if current["registration_state"] in {"needs_review", "inactive", "retired"}:
                    # A refresh is not an administrator relink.  In
                    # particular, a repeated discovery/action request must
                    # not revive an ambiguous rename or a retired alert.
                    registration_state = current["registration_state"]
                elif publication_pending:
                    registration_state = "pending"
                elif current["registration_state"] in {"pending", "failed"}:
                    registration_state = current["registration_state"]
                else:
                    registration_state = "active"
                if delivery_enabled is None:
                    enabled_for_delivery = bool(current.get("delivery_enabled", False))
                else:
                    enabled_for_delivery = bool(delivery_enabled)
                current_publication_state = str(current.get("publication_state") or "").casefold()
                # A refresh is not proof that a separate publication operation
                # completed.  Preserve pending/failed publication states until
                # mark_registration_publication() records the operator's
                # verified result.  Likewise, removing an action changes the
                # delivery state but does not erase publication history.
                if current["registration_state"] in {"needs_review", "inactive", "retired"}:
                    publication_state = current_publication_state or "unpublished"
                elif publication_pending:
                    publication_state = "pending"
                elif current["registration_state"] in {"pending", "failed"}:
                    publication_state = current_publication_state or "unpublished"
                elif current_publication_state in {"pending", "failed"}:
                    publication_state = current_publication_state
                elif action_configured:
                    publication_state = "published"
                else:
                    publication_state = current_publication_state or "unpublished"
                preserved_error = (
                    current.get("last_error")
                    if current["registration_state"] in {"needs_review", "pending", "failed", "inactive", "retired"}
                    else None
                )
                updated = connection.execute(
                    """
                    UPDATE sec_alert_registrations
                    SET app = %s, owner = %s, saved_search_name = %s,
                        stable_id = COALESCE(NULLIF(%s, ''), stable_id),
                        source_indexes = %s, definition_fingerprint = %s,
                        definition_revision = %s, registration_state = %s,
                        delivery_state = %s, delivery_enabled = %s,
                        presence_state = CASE WHEN %s = 'discovery' THEN 'present' ELSE presence_state END,
                        publication_state = %s,
                        action_verified_at = CASE WHEN %s THEN NOW() ELSE action_verified_at END,
                        origin = %s, last_error = %s,
                        last_discovered_at = CASE WHEN %s = 'discovery' THEN NOW() ELSE last_discovered_at END,
                        updated_by = %s, updated_at = NOW()
                    WHERE id = %s::uuid
                    RETURNING id::text, customer_id::text,
                              (SELECT cid FROM customers WHERE id = sec_alert_registrations.customer_id),
                              aid, aid_sequence, splunk_deployment, app, owner,
                              saved_search_name, stable_id, source_indexes,
                              definition_fingerprint, definition_revision,
                              registration_state, delivery_state, origin, last_error,
                              delivery_enabled, presence_state, publication_state,
                              last_discovered_at, created_at, updated_at
                    """,
                    (app, owner, name, stable_id, list(indexes), fingerprint, revision,
                     registration_state, delivery_state, enabled_for_delivery, origin,
                     publication_state, action_configured, origin, preserved_error, origin,
                     actor[:320], current["id"]),
                ).fetchone()
                return self._registration_dict(updated)

            counter = connection.execute(
                """
                INSERT INTO sec_alert_aid_counters (customer_id, next_sequence)
                VALUES (%s::uuid, 0)
                ON CONFLICT (customer_id) DO NOTHING
                """,
                (customer_id,),
            )
            del counter
            counter_row = connection.execute(
                """
                SELECT next_sequence
                FROM sec_alert_aid_counters
                WHERE customer_id = %s::uuid
                FOR UPDATE
                """,
                (customer_id,),
            ).fetchone()
            # The counter lock serializes distinct allocations.  Recheck the
            # definition identity after acquiring it so concurrent discovery,
            # human, and agent registrations share one existing AID.
            existing_after_lock = self._existing_definition_registration(
                connection,
                deployment=deployment,
                app=app,
                owner=owner,
                name=name,
                stable_id=stable_id,
            )
            if existing_after_lock is not None:
                return self._registration_dict(existing_after_lock)
            sequence = int(counter_row[0]) if counter_row else 10_000
            if sequence > 9_999:
                raise AlertIdentityError("aid_capacity_exhausted", f"CID {cid} has exhausted AID capacity")
            connection.execute(
                """
                UPDATE sec_alert_aid_counters
                SET next_sequence = next_sequence + 1, updated_at = NOW()
                WHERE customer_id = %s::uuid
                """,
                (customer_id,),
            )
            aid = f"{cid}-{sequence:04d}"
            delivery_state = "ready" if action_configured else "action_missing"
            registration_state = "pending" if publication_pending else "active"
            publication_state = "pending" if publication_pending else (
                "published" if action_configured else "unpublished"
            )
            enabled_for_delivery = bool(delivery_enabled) if delivery_enabled is not None else False
            row = connection.execute(
                """
                INSERT INTO sec_alert_registrations (
                    customer_id, aid, aid_sequence, splunk_deployment, app, owner,
                    saved_search_name, stable_id, source_indexes, definition_fingerprint,
                    definition_revision, registration_state, delivery_state, delivery_enabled,
                    presence_state, publication_state, action_verified_at, origin,
                    last_discovered_at, created_by, updated_by
                ) VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, NULLIF(%s, ''), %s,
                          %s, 1, %s, %s, %s, %s,
                          %s, CASE WHEN %s THEN NOW() END, %s,
                          CASE WHEN %s = 'discovery' THEN NOW() END, %s, %s)
                RETURNING id::text, customer_id::text,
                          (SELECT cid FROM customers WHERE id = sec_alert_registrations.customer_id),
                          aid, aid_sequence, splunk_deployment, app, owner,
                          saved_search_name, stable_id, source_indexes,
                          definition_fingerprint, definition_revision,
                          registration_state, delivery_state, origin, last_error,
                          delivery_enabled, presence_state, publication_state,
                          last_discovered_at, created_at, updated_at
                """,
                (customer_id, aid, sequence, deployment, app, owner, name, stable_id,
                 list(indexes), fingerprint, registration_state, delivery_state,
                 enabled_for_delivery, "present" if origin == "discovery" else "unknown",
                 publication_state, action_configured, origin, origin,
                 actor[:320], actor[:320]),
            ).fetchone()
            registration = self._registration_dict(row)
            connection.execute(
                """
                INSERT INTO sec_alert_registration_revisions (
                    registration_id, revision, definition_fingerprint, definition, actor
                ) VALUES (%s::uuid, 1, %s, %s::jsonb, %s)
                """,
                (registration["id"], fingerprint,
                 json.dumps(_safe_value(dict(definition)), separators=(",", ":")), actor[:320]),
            )
            return registration

    def list_alert_registrations(self, *, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                self._registration_select() +
                " ORDER BY r.created_at, r.id LIMIT %s OFFSET %s",
                (max(1, min(int(limit), 1_000)), max(0, int(offset))),
            ).fetchall()
        return [self._registration_dict(row) for row in rows]

    def retire_unseen_discoveries(self, deployment: str, before: datetime) -> int:
        """Mark definitions absent from a complete catalog pass inactive.

        Only registrations previously observed by discovery are eligible. A
        new human/agent registration that has not reached the next catalog
        pass must not be retired merely because it has no discovery timestamp.
        """

        deployment = normalize_deployment(deployment)
        with self._connect() as connection:
            result = connection.execute(
                """
                UPDATE sec_alert_registrations
                SET registration_state = 'inactive', delivery_state = 'blocked',
                    last_error = 'saved-search definition was absent from a complete discovery pass',
                    updated_at = NOW()
                WHERE splunk_deployment = %s
                  AND last_discovered_at IS NOT NULL
                  AND last_discovered_at < %s
                  AND registration_state IN ('active', 'needs_review', 'failed')
                """,
                (deployment, before),
            )
            return int(getattr(result, "rowcount", 0) or 0)

    def mark_registration_publication(
        self,
        registration_id: str,
        *,
        success: bool,
        error: str = "",
        principal: str = "",
    ) -> dict[str, Any] | None:
        """Finalize a pending alert publication without changing its AID."""

        with self._connect() as connection:
            current = connection.execute(
                """
                SELECT registration_state, last_error
                FROM sec_alert_registrations
                WHERE id = %s::uuid
                FOR UPDATE
                """,
                (registration_id,),
            ).fetchone()
            if current is None:
                return None
            state = str(current[0] or "").casefold()
            preserved_state = state in {"needs_review", "inactive", "retired"}
            connection.execute(
                """
                UPDATE sec_alert_registrations
                SET registration_state = CASE
                        WHEN %s THEN registration_state
                        ELSE %s
                    END,
                    delivery_state = CASE
                        WHEN %s OR NOT %s THEN 'blocked'
                        ELSE 'ready'
                    END,
                    publication_state = CASE WHEN %s THEN 'published' ELSE 'failed' END,
                    action_verified_at = CASE WHEN %s THEN NOW() ELSE action_verified_at END,
                    last_error = CASE
                        WHEN %s THEN last_error
                        WHEN %s THEN NULL
                        ELSE %s
                    END,
                    updated_by = %s,
                    updated_at = NOW()
                WHERE id = %s::uuid
                """,
                (
                    preserved_state,
                    "active" if success else "failed",
                    preserved_state,
                    success,
                    success,
                    success,
                    preserved_state,
                    success,
                    error[:2_000] or "saved-search publication failed",
                    str(principal or "")[:320],
                    registration_id,
                ),
            )
            row = connection.execute(
                self._registration_select() + " WHERE r.id = %s::uuid",
                (registration_id,),
            ).fetchone()
        return self._registration_dict(row) if row is not None else None

    def mark_registration_action_configured(
        self,
        registration_id: str,
        *,
        actor: str = "splunk-alert-action",
    ) -> dict[str, Any] | None:
        """Record an operator-selected action on a discovered definition."""
        with self._connect() as connection:
            current = connection.execute(
                """
                SELECT registration_state, presence_state, publication_state
                FROM sec_alert_registrations
                WHERE id = %s::uuid
                FOR UPDATE
                """,
                (registration_id,),
            ).fetchone()
            if current is None:
                return None
            state = str(current[0] or "").casefold()
            presence = str(current[1] or "unknown").casefold()
            delivery_state = "ready" if state == "active" and presence not in {"missing", "incomplete"} else "blocked"
            current_publication_state = str(current[2] or "unpublished")
            publication_state = (
                current_publication_state
                if state in {"needs_review", "pending", "failed", "inactive", "retired"}
                or current_publication_state in {"pending", "failed"}
                else "published"
            )
            row = connection.execute(
                """
                UPDATE sec_alert_registrations
                SET delivery_state = %s,
                    publication_state = %s,
                    action_verified_at = NOW(),
                    updated_by = %s,
                    updated_at = NOW()
                WHERE id = %s::uuid
                RETURNING id::text, customer_id::text,
                          (SELECT cid FROM customers WHERE id = sec_alert_registrations.customer_id),
                          aid, aid_sequence, splunk_deployment, app, owner,
                          saved_search_name, stable_id, source_indexes,
                          definition_fingerprint, definition_revision,
                          registration_state, delivery_state, origin, last_error,
                          delivery_enabled, presence_state, publication_state,
                          last_discovered_at, created_at, updated_at
                """,
                (delivery_state, publication_state, str(actor or "")[:320], registration_id),
            ).fetchone()
        return self._registration_dict(row) if row is not None else None

    def resolve_alert_action_context(
        self,
        payload: Mapping[str, Any],
        *,
        authenticated_deployment: str | None = None,
        replay_id: str | None = None,
    ) -> dict[str, Any]:
        """Resolve policy/action parameters for a direct Splunk Web action."""
        if not isinstance(payload, Mapping):
            raise AlertIdentityError("invalid_action_context", "alert action context must be an object")
        deployment = normalize_deployment(authenticated_deployment or payload.get("deployment"))
        asserted_deployment = str(payload.get("deployment") or "").strip()
        if asserted_deployment and asserted_deployment != deployment:
            raise AlertIdentityError("deployment_mismatch", "alert action deployment does not match authentication")
        request_replay_id = str(replay_id or payload.get("_authenticated_replay_id") or "").strip()
        if not request_replay_id or len(request_replay_id) > 256:
            raise AlertIdentityError("missing_replay_id", "authenticated replay identifier is required")
        with self._connect() as connection:
            self._record_webhook_replay(
                connection,
                deployment=deployment,
                replay_id=request_replay_id,
                payload_hash=self._payload_hash(payload),
            )
        name = str(
            payload.get("alert_name")
            or payload.get("saved_search_name")
            or payload.get("search_name")
            or payload.get("name")
            or ""
        ).strip()
        if not name or len(name) > 255:
            raise AlertIdentityError("invalid_alert_name", "saved-search name is required")
        app = str(payload.get("app") or "").strip()[:255]
        owner = str(payload.get("owner") or "").strip()[:255]
        stable_id = str(payload.get("stable_id") or payload.get("guid") or payload.get("uid") or "").strip()[:512]
        registration_hint = str(payload.get("registration_id") or "").strip()
        definition = dict(payload.get("definition")) if isinstance(payload.get("definition"), Mapping) else {}
        definition.setdefault("name", name)
        definition.setdefault("app", app)
        definition.setdefault("owner", owner)
        if stable_id:
            definition.setdefault("stable_id", stable_id)
        spl = payload.get("spl") or payload.get("search")
        if spl:
            definition.setdefault("spl", spl)
        source_indexes = self._source_indexes(payload.get("source_indexes"))
        if source_indexes:
            definition.setdefault("source_indexes", list(source_indexes))

        def identity_matches(registration: Mapping[str, Any]) -> bool:
            return bool(
                registration.get("saved_search_name") == name
                and (not app or registration.get("app") == app)
                and (not owner or registration.get("owner") == owner)
                and (
                    not stable_id
                    or not registration.get("stable_id")
                    or registration.get("stable_id") == stable_id
                )
            )

        candidate: dict[str, Any] | None = None
        hint_conflict = False
        stable_conflict = False
        with self._connect() as connection:
            if registration_hint:
                try:
                    row = connection.execute(
                        self._registration_select()
                        + " WHERE r.id = %s::uuid AND r.splunk_deployment = %s",
                        (registration_hint, deployment),
                    ).fetchone()
                except Exception:
                    row = None
                if row is not None:
                    possible = self._registration_dict(row)
                    if identity_matches(possible):
                        candidate = possible
                    else:
                        hint_conflict = True
            if candidate is None and stable_id:
                row = connection.execute(
                    self._registration_select()
                    + " WHERE r.splunk_deployment = %s AND r.stable_id = %s",
                    (deployment, stable_id),
                ).fetchone()
                if row is not None:
                    possible = self._registration_dict(row)
                    if identity_matches(possible):
                        candidate = possible
                    else:
                        stable_conflict = True
            if candidate is None:
                clauses = ["r.splunk_deployment = %s", "r.saved_search_name = %s"]
                params: list[Any] = [deployment, name]
                if app:
                    clauses.append("r.app = %s")
                    params.append(app)
                if owner:
                    clauses.append("r.owner = %s")
                    params.append(owner)
                rows = connection.execute(
                    self._registration_select()
                    + " WHERE " + " AND ".join(clauses) + " ORDER BY r.id LIMIT 2",
                    params,
                ).fetchall()
                if len(rows) == 1:
                    possible = self._registration_dict(rows[0])
                    if identity_matches(possible):
                        candidate = possible

        has_spl = bool(str(definition.get("spl") or definition.get("search") or "").strip())
        # Older publisher versions used the registration UUID as a synthetic
        # stable_id.  It is not a Splunk identity and must not cause a copied
        # action to collide with its parent's registration.  Once a matching
        # registration has been found, a missing native stable identity means
        # the exact name/app/owner key is the strongest available evidence.
        if registration_hint and (stable_id == registration_hint or hint_conflict):
            definition.pop("stable_id", None)
            stable_id = ""
        if stable_conflict:
            definition.pop("stable_id", None)
            stable_id = ""
        if candidate is not None and not candidate.get("stable_id"):
            definition.pop("stable_id", None)
            stable_id = ""
        if candidate is None:
            if not has_spl:
                raise AlertIdentityError(
                    "alert_registration_required",
                    "the saved search is not registered and its exact SPL source is unavailable",
                )
            candidate = self.register_definition(
                definition,
                deployment=deployment,
                source_indexes=source_indexes or definition.get("source_indexes"),
                origin="unknown",
                actor="splunk-alert-action",
                action_configured=True,
            )
            if candidate.get("status") == "needs_review" or not candidate.get("id"):
                raise AlertIdentityError(
                    "alert_registration_review",
                    str(candidate.get("reason") or "alert registration requires administrator review"),
                )
        elif has_spl:
            refreshed = self.register_definition(
                definition,
                deployment=deployment,
                source_indexes=source_indexes or definition.get("source_indexes"),
                origin="unknown",
                actor="splunk-alert-action",
                action_configured=True,
            )
            if refreshed.get("status") == "needs_review" or not refreshed.get("id"):
                raise AlertIdentityError(
                    "alert_registration_review",
                    str(refreshed.get("reason") or "alert registration requires administrator review"),
                )
            candidate = refreshed
        else:
            candidate = self.mark_registration_action_configured(
                candidate["id"],
                actor="splunk-alert-action",
            ) or candidate

        policy_record = self.ensure_alert_policy(
            candidate["customer_id"],
            candidate["id"],
            actor="splunk-alert-action",
        )
        policy = normalize_alert_policy(policy_record.get("policy"), defaults=DEFAULT_ALERT_POLICY)
        columns: list[str] = []
        for value in (
            list(policy.get("detail_columns", []))
            + list(policy.get("required_columns", []))
            + list(policy.get("optional_columns", []))
            + [
                str(item.get("source") or "").strip()
                for item in policy.get("field_mappings", [])
                if isinstance(item, Mapping)
            ]
            + [
                str(item.get("source") or "").strip()
                for item in policy.get("row_filters", [])
                if isinstance(item, Mapping)
            ]
            + [str(policy.get("severity_source") or "").strip()]
        ):
            if value and value != "_raw" and value not in columns:
                columns.append(value)
        return {
            "deployment": deployment,
            "registration_id": candidate["id"],
            "stable_id": candidate.get("stable_id") or "",
            "cid": candidate.get("cid") or "",
            "aid": candidate.get("aid") or "",
            "alert_name": candidate["saved_search_name"],
            "app": candidate.get("app") or "",
            "owner": candidate.get("owner") or "",
            "source_indexes": list(candidate.get("source_indexes") or []),
            "policy_id": policy_record["id"],
            "policy_revision": int(policy_record["revision"] or 1),
            "definition_revision": int(candidate.get("definition_revision") or 1),
            "selected_columns": columns,
            "row_filters": list(policy.get("row_filters", [])),
            "max_stored_rows": int(policy.get("max_stored_rows", 1_000) or 1_000),
        }

    def list_alert_registration_review(self, *, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id::text, review_key, splunk_deployment, app, owner,
                       saved_search_name, stable_id, source_indexes, reason,
                       attempt_count, created_at, updated_at
                FROM sec_alert_registration_review
                WHERE resolved_at IS NULL
                ORDER BY created_at, id
                LIMIT %s OFFSET %s
                """,
                (max(1, min(int(limit), 1_000)), max(0, int(offset))),
            ).fetchall()
        keys = (
            "id", "review_key", "deployment", "app", "owner", "saved_search_name",
            "stable_id", "source_indexes", "reason", "attempt_count", "created_at", "updated_at",
        )
        return [dict(zip(keys, row, strict=True)) for row in rows]

    def list_alert_index_ownership(
        self,
        *,
        deployment: str = "",
        limit: int = 1_000,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        params: list[Any] = []
        where = ""
        if deployment.strip():
            where = "WHERE ownership.splunk_deployment = %s"
            params.append(deployment.strip())
        params.extend((max(1, min(int(limit), 5_000)), max(0, int(offset))))
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT ownership.id::text, ownership.splunk_deployment,
                       ownership.index_name, ownership.customer_id::text,
                       customer.cid, ownership.status, ownership.updated_at
                FROM sec_alert_index_ownership AS ownership
                JOIN customers AS customer ON customer.id = ownership.customer_id
                {where}
                ORDER BY ownership.splunk_deployment, ownership.index_name
                LIMIT %s OFFSET %s
                """,
                params,
            ).fetchall()
        keys = ("id", "deployment", "index_name", "customer_id", "cid", "status", "updated_at")
        return [dict(zip(keys, row, strict=True)) for row in rows]

    def migration_report(self, *, sample_limit: int = 100) -> dict[str, Any]:
        """Return a bounded, read-only view of legacy-to-new identity coverage."""

        sample_limit = max(1, min(int(sample_limit), 1_000))
        with self._connect() as connection:
            customer_rows = connection.execute(
                """
                SELECT id::text, gid, cid, name, status
                FROM customers
                ORDER BY id
                LIMIT %s
                """,
                (sample_limit,),
            ).fetchall()
            customer_counts = connection.execute(
                """
                SELECT COUNT(*), COUNT(*) FILTER (WHERE COALESCE(cid, '') <> ''),
                       COUNT(*) FILTER (WHERE COALESCE(gid, '') <> '')
                FROM customers
                """
            ).fetchone()
            index_rows = connection.execute(
                """
                SELECT splunk_deployment, index_name, customer_id::text, status
                FROM sec_alert_index_ownership
                ORDER BY splunk_deployment, index_name
                LIMIT %s
                """,
                (sample_limit,),
            ).fetchall()
            index_counts = connection.execute(
                """
                SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'active'),
                       COUNT(*) FILTER (WHERE status = 'review'),
                       COUNT(*) FILTER (WHERE status = 'retired')
                FROM sec_alert_index_ownership
                """
            ).fetchone()
            registration_rows = connection.execute(
                """
                SELECT id::text, customer_id::text, aid, saved_search_name,
                       registration_state, delivery_state, splunk_deployment
                FROM sec_alert_registrations
                ORDER BY created_at, id
                LIMIT %s
                """,
                (sample_limit,),
            ).fetchall()
            registration_counts = connection.execute(
                """
                SELECT COUNT(*), COUNT(*) FILTER (WHERE registration_state = 'active'),
                       COUNT(*) FILTER (WHERE registration_state IN ('needs_review', 'failed', 'inactive')),
                       COUNT(*) FILTER (WHERE delivery_state = 'action_missing')
                FROM sec_alert_registrations
                """
            ).fetchone()
            unresolved = connection.execute(
                """
                SELECT COUNT(*) FROM sec_alert_registration_review WHERE resolved_at IS NULL
                """
            ).fetchone()
            legacy_events = connection.execute(
                """
                SELECT COUNT(*), COUNT(*) FILTER (WHERE COALESCE(eid, '') <> ''),
                       COUNT(*) FILTER (WHERE COALESCE(eid, '') = '')
                FROM sec_events
                """
            ).fetchone()
        return {
            "customers": {
                "total": int(customer_counts[0] or 0),
                "with_cid": int(customer_counts[1] or 0),
                "with_legacy_gid": int(customer_counts[2] or 0),
                "sample": [dict(id=r[0], gid=r[1], cid=r[2], name=r[3], status=r[4]) for r in customer_rows],
            },
            "indexes": {
                "total": int(index_counts[0] or 0),
                "active": int(index_counts[1] or 0),
                "review": int(index_counts[2] or 0),
                "retired": int(index_counts[3] or 0),
                "sample": [dict(deployment=r[0], index_name=r[1], customer_id=r[2], status=r[3]) for r in index_rows],
            },
            "alerts": {
                "total": int(registration_counts[0] or 0),
                "active": int(registration_counts[1] or 0),
                "review_or_inactive": int(registration_counts[2] or 0),
                "action_missing": int(registration_counts[3] or 0),
                "sample": [dict(id=r[0], customer_id=r[1], aid=r[2], name=r[3], state=r[4], delivery=r[5], deployment=r[6]) for r in registration_rows],
            },
            "unresolved_registration_reviews": int(unresolved[0] or 0),
            "events": {
                "total": int(legacy_events[0] or 0),
                "with_eid": int(legacy_events[1] or 0),
                "legacy_without_eid": int(legacy_events[2] or 0),
            },
            "historical_email_replay": False,
        }

    def migration_preview(self, *, actor: str = "", limit: int = 1_000) -> dict[str, Any]:
        """Create a repeatable, bounded reconciliation report.

        The preview is deliberately read-only with respect to customer,
        ownership, registration, and event identities.  It records the report
        itself so an operator can review exactly what was evaluated before a
        separate backfill command is run.
        """
        limit = max(1, min(int(limit), 5_000))
        with self._connect() as connection:
            customer_rows = connection.execute(
                """
                SELECT id::text, cid, gid, name, status
                FROM customers
                ORDER BY id
                LIMIT %s
                """,
                (limit + 1,),
            ).fetchall()
            customer_count = int(connection.execute("SELECT COUNT(*) FROM customers").fetchone()[0] or 0)
            index_rows = connection.execute(
                """
                SELECT o.splunk_deployment, o.index_name, o.customer_id::text,
                       c.cid, o.status
                FROM sec_alert_index_ownership AS o
                JOIN customers AS c ON c.id = o.customer_id
                ORDER BY o.splunk_deployment, o.index_name
                LIMIT %s
                """,
                (limit + 1,),
            ).fetchall()
            index_count = int(connection.execute("SELECT COUNT(*) FROM sec_alert_index_ownership").fetchone()[0] or 0)
            registration_rows = connection.execute(
                """
                SELECT r.id::text, r.customer_id::text, c.cid, r.aid,
                       r.splunk_deployment, r.app, r.owner, r.saved_search_name,
                       r.registration_state, r.delivery_state
                FROM sec_alert_registrations AS r
                JOIN customers AS c ON c.id = r.customer_id
                ORDER BY r.created_at, r.id
                LIMIT %s
                """,
                (limit + 1,),
            ).fetchall()
            registration_count = int(connection.execute("SELECT COUNT(*) FROM sec_alert_registrations").fetchone()[0] or 0)
            review_rows = connection.execute(
                """
                SELECT id::text, review_key, splunk_deployment, app, owner,
                       saved_search_name, source_indexes, reason
                FROM sec_alert_registration_review
                WHERE resolved_at IS NULL
                ORDER BY created_at, id
                LIMIT %s
                """,
                (limit + 1,),
            ).fetchall()
            conflict_rows = connection.execute(
                """
                SELECT r.id::text, r.aid, r.splunk_deployment, r.saved_search_name,
                       r.last_error
                FROM sec_alert_registrations AS r
                WHERE r.registration_state IN ('needs_review', 'failed', 'inactive')
                   OR r.delivery_state <> 'ready'
                ORDER BY r.updated_at DESC, r.id
                LIMIT %s
                """,
                (limit + 1,),
            ).fetchall()
            conflict_count = int(connection.execute(
                """
                SELECT COUNT(*)
                FROM sec_alert_registrations AS r
                WHERE r.registration_state IN ('needs_review', 'failed', 'inactive')
                   OR r.delivery_state <> 'ready'
                """
            ).fetchone()[0] or 0)
            review_count = int(connection.execute(
                "SELECT COUNT(*) FROM sec_alert_registration_review WHERE resolved_at IS NULL"
            ).fetchone()[0] or 0)
            historical_rows = connection.execute(
                """
                SELECT e.id::text, e.customer_id::text, e.alert_name,
                       e.splunk_sid, e.trigger_time, r.aid
                FROM sec_events AS e
                LEFT JOIN sec_alert_registrations AS r ON r.id = e.alert_registration_id
                WHERE COALESCE(e.eid, '') = ''
                ORDER BY e.created_at, e.id
                LIMIT %s
                """,
                (limit + 1,),
            ).fetchall()
            historical_total = int(connection.execute(
                "SELECT COUNT(*) FROM sec_events WHERE COALESCE(eid, '') = ''"
            ).fetchone()[0] or 0)
            eligible_total = int(connection.execute(
                """
                SELECT COUNT(*)
                FROM sec_events AS e
                JOIN sec_alert_registrations AS r ON r.id = e.alert_registration_id
                WHERE COALESCE(e.eid, '') = ''
                  AND e.splunk_sid IS NOT NULL AND btrim(e.splunk_sid) <> ''
                  AND e.trigger_time IS NOT NULL
                  AND r.aid IS NOT NULL AND r.aid <> ''
                """
            ).fetchone()[0] or 0)

        def trim(rows: Sequence[Any]) -> tuple[list[Any], bool]:
            return list(rows[:limit]), len(rows) > limit

        customers, customers_truncated = trim(customer_rows)
        indexes, indexes_truncated = trim(index_rows)
        registrations, registrations_truncated = trim(registration_rows)
        reviews, reviews_truncated = trim(review_rows)
        conflicts, conflicts_truncated = trim(conflict_rows)
        historical, historical_truncated = trim(historical_rows)
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "complete": not any((customers_truncated, indexes_truncated, registrations_truncated, reviews_truncated, conflicts_truncated, historical_truncated)),
            "limit": limit,
            "customer_mappings": {
                "total": customer_count,
                "rows": [dict(id=r[0], cid=r[1], legacy_gid=r[2], name=r[3], status=r[4],
                               resolvable=bool(r[1]) and not str(r[1]).startswith("legacy-")) for r in customers],
                "truncated": customers_truncated,
            },
            "index_mappings": {
                "total": index_count,
                "rows": [dict(deployment=r[0], index_name=r[1], customer_id=r[2], cid=r[3], status=r[4]) for r in indexes],
                "truncated": indexes_truncated,
            },
            "definition_matches": {
                "total": registration_count,
                "rows": [dict(id=r[0], customer_id=r[1], cid=r[2], aid=r[3], deployment=r[4], app=r[5], owner=r[6],
                              saved_search_name=r[7], registration_state=r[8], delivery_state=r[9]) for r in registrations],
                "truncated": registrations_truncated,
            },
            "conflicts": {
                "total": conflict_count,
                "rows": [dict(id=r[0], aid=r[1], deployment=r[2], saved_search_name=r[3], reason=r[4]) for r in conflicts],
                "truncated": conflicts_truncated,
            },
            "proposed_registrations": {
                "total": review_count,
                "rows": [dict(id=r[0], review_key=r[1], deployment=r[2], app=r[3], owner=r[4],
                              saved_search_name=r[5], source_indexes=r[6], reason=r[7]) for r in reviews],
                "truncated": reviews_truncated,
            },
            "historical_backfill": {
                "total_legacy_events": historical_total,
                "eligible_events": eligible_total,
                "ineligible_events": max(0, historical_total - eligible_total),
                "rows": [dict(id=r[0], customer_id=r[1], alert_name=r[2], splunk_sid=r[3], trigger_time=r[4], aid=r[5]) for r in historical],
                "truncated": historical_truncated,
                "email_replay_suppressed": True,
            },
        }
        with self._connect() as connection:
            row = connection.execute(
                """
                INSERT INTO sec_alert_migration_runs (mode, actor, report, historical_email_suppressed)
                VALUES ('preview', %s, %s::jsonb, TRUE)
                RETURNING id::text, created_at
                """,
                (str(actor or "")[:320], json.dumps(_safe_value(report), separators=(",", ":"))),
            ).fetchone()
        return {"run_id": str(row[0]), "mode": "preview", "historical_email_suppressed": True, "report": report}

    def migration_backfill(self, *, actor: str = "") -> dict[str, Any]:
        """Backfill only events with reliable registered identity and time.

        All legacy rows are marked as historical-email-suppressed in the same
        transaction.  No outbox row is created by this operation.
        """
        backfilled = 0
        skipped = 0
        with self._connect() as connection:
            candidates = connection.execute(
                """
                SELECT e.id::text, e.customer_id::text, e.event_id, e.event_data,
                       e.alert_registration_id::text, e.splunk_sid, e.trigger_time,
                       r.aid, c.cid, r.splunk_deployment, r.definition_revision
                FROM sec_events AS e
                JOIN sec_alert_registrations AS r ON r.id = e.alert_registration_id
                JOIN customers AS c ON c.id = r.customer_id
                WHERE COALESCE(e.eid, '') = ''
                  AND e.splunk_sid IS NOT NULL AND btrim(e.splunk_sid) <> ''
                  AND e.trigger_time IS NOT NULL
                  AND r.aid IS NOT NULL AND r.aid <> ''
                ORDER BY e.trigger_time, e.id
                FOR UPDATE OF e
                """
            ).fetchall()
            for candidate in candidates:
                event_id, customer_id, legacy_event_id, raw_data, registration_id, sid, trigger_time, aid, cid, deployment, definition_revision = candidate
                existing_receipt = connection.execute(
                    """
                    SELECT eid FROM sec_alert_run_receipts
                    WHERE registration_id = %s::uuid AND splunk_sid = %s
                    FOR UPDATE
                    """,
                    (registration_id, sid),
                ).fetchone()
                if existing_receipt and existing_receipt[0]:
                    eid = str(existing_receipt[0])
                else:
                    counter = connection.execute(
                        "SELECT next_run_sequence FROM sec_alert_registrations WHERE id = %s::uuid FOR UPDATE",
                        (registration_id,),
                    ).fetchone()
                    sequence = int(counter[0]) if counter else 1
                    eid = format_eid(str(aid), trigger_time, sequence)
                    connection.execute(
                        "UPDATE sec_alert_registrations SET next_run_sequence = %s, updated_at = NOW() WHERE id = %s::uuid",
                        (sequence + 1, registration_id),
                    )
                    connection.execute(
                        """
                        INSERT INTO sec_alert_run_receipts (
                            registration_id, splunk_sid, trigger_time, eid, event_id,
                            payload_hash, status, deployment, definition_revision
                        ) VALUES (%s::uuid, %s, %s, %s, %s::uuid, '', 'processed', %s, %s)
                        ON CONFLICT (registration_id, splunk_sid) DO UPDATE SET
                            eid = COALESCE(sec_alert_run_receipts.eid, EXCLUDED.eid),
                            event_id = COALESCE(sec_alert_run_receipts.event_id, EXCLUDED.event_id),
                            status = 'processed'
                        """,
                        (registration_id, sid, trigger_time, eid, event_id, deployment, definition_revision),
                    )
                data = dict(raw_data) if isinstance(raw_data, Mapping) else {}
                data.update({
                    "cid": str(cid), "aid": str(aid), "eid": eid,
                    "historical_email_suppressed": True,
                    "email_held": True,
                    "email_hold_reason": "historical migration event; customer email replay is suppressed",
                })
                connection.execute(
                    """
                    UPDATE sec_events
                    SET event_id = %s, cid = %s, aid = %s, eid = %s,
                        historical_email_suppressed = TRUE,
                        alert_registration_id = %s::uuid,
                        definition_revision = COALESCE(definition_revision, %s),
                        event_data = %s::jsonb
                    WHERE id = %s::uuid
                    """,
                    (eid, cid, aid, eid, registration_id, definition_revision,
                     json.dumps(_safe_value(data), separators=(",", ":")), event_id),
                )
                backfilled += 1
            skipped = int(connection.execute(
                "SELECT COUNT(*) FROM sec_events WHERE COALESCE(eid, '') = ''"
            ).fetchone()[0] or 0)
            connection.execute(
                """
                UPDATE sec_events
                SET historical_email_suppressed = TRUE
                WHERE COALESCE(eid, '') = '' AND historical_email_suppressed = FALSE
                """
            )
            connection.execute(
                """
                UPDATE sec_event_email_outbox AS outbox
                SET status = 'disabled', next_attempt_at = NULL,
                    last_error = 'historical migration event; email replay is suppressed',
                    claimed_at = NULL, claimed_by = NULL, updated_at = NOW()
                FROM sec_events AS event
                WHERE event.id = outbox.event_id
                  AND event.historical_email_suppressed
                  AND outbox.status IN ('pending', 'failed', 'held')
                """
            )
            report = {"backfilled": backfilled, "legacy_suppressed": skipped, "historical_email_replay": False}
            row = connection.execute(
                """
                INSERT INTO sec_alert_migration_runs (mode, actor, report, historical_email_suppressed)
                VALUES ('backfill', %s, %s::jsonb, TRUE)
                RETURNING id::text
                """,
                (str(actor or "")[:320], json.dumps(report, separators=(",", ":"))),
            ).fetchone()
        return {"run_id": str(row[0]), "mode": "backfill", "historical_email_suppressed": True, **report}

    def get_alert_policy(
        self,
        customer_id: str,
        registration_id: str | None = None,
    ) -> tuple[dict[str, Any], int]:
        record = self.get_alert_policy_record(customer_id, registration_id)
        if record is None:
            return dict(DEFAULT_ALERT_POLICY), 0
        return record["policy"], int(record["revision"] or 0)

    def get_alert_policy_record(
        self,
        customer_id: str,
        registration_id: str | None = None,
    ) -> dict[str, Any] | None:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id::text, policy, revision, customer_id::text, registration_id::text,
                       updated_by, created_at, updated_at
                FROM sec_alert_email_policies
                WHERE customer_id = %s::uuid
                  AND (registration_id IS NULL OR registration_id = %s::uuid)
                ORDER BY CASE WHEN registration_id = %s::uuid THEN 0 ELSE 1 END, updated_at DESC
                LIMIT 1
                """,
                (customer_id, registration_id or str(uuid.uuid4()), registration_id or str(uuid.uuid4())),
            ).fetchone()
        if not rows:
            return None
        stored = rows[1] if isinstance(rows[1], Mapping) else {}
        try:
            policy = normalize_alert_policy(stored, defaults=DEFAULT_ALERT_POLICY)
        except AlertIdentityError as exc:
            return {
                "id": str(rows[0]),
                "customer_id": str(rows[3]),
                "registration_id": str(rows[4]) if rows[4] else None,
                "policy": {},
                "revision": int(rows[2] or 0),
                "invalid_reason": str(exc),
                "updated_by": rows[5],
                "created_at": rows[6],
                "updated_at": rows[7],
            }
        return {
            "id": str(rows[0]),
            "customer_id": str(rows[3]),
            "registration_id": str(rows[4]) if rows[4] else None,
            "policy": policy,
            "revision": int(rows[2] or 0),
            "updated_by": rows[5],
            "created_at": rows[6],
            "updated_at": rows[7],
        }

    def ensure_alert_policy(
        self,
        customer_id: str,
        registration_id: str | None = None,
        *,
        actor: str = "system",
    ) -> dict[str, Any]:
        """Return a valid policy identity for a newly registered alert.

        Registration payloads always carry a policy ID/revision.  A customer
        or alert with no administrator-authored detail columns still needs an
        immutable empty policy so the sender cannot fall back to columns
        chosen by Splunk.  The empty policy is deliberately non-delivering
        with respect to detail fields; customer delivery enablement and
        recipients remain separate administrator controls.
        """
        with self._connect() as connection:
            def select_existing() -> Any:
                if registration_id:
                    return connection.execute(
                        """
                        SELECT id::text, customer_id::text, registration_id::text, policy,
                               revision, updated_by, created_at, updated_at
                        FROM sec_alert_email_policies
                        WHERE registration_id = %s::uuid
                        FOR UPDATE
                        """,
                        (registration_id,),
                    ).fetchone()
                return connection.execute(
                    """
                    SELECT id::text, customer_id::text, registration_id::text, policy,
                           revision, updated_by, created_at, updated_at
                    FROM sec_alert_email_policies
                    WHERE customer_id = %s::uuid AND registration_id IS NULL
                    FOR UPDATE
                    """,
                    (customer_id,),
                ).fetchone()

            def as_record(row: Any) -> dict[str, Any]:
                try:
                    policy = normalize_alert_policy(row[3], defaults=DEFAULT_ALERT_POLICY)
                except AlertIdentityError as exc:
                    raise AlertIdentityError(
                        "invalid_policy",
                        "the registered alert has an invalid administrator email policy",
                    ) from exc
                return {
                    "id": str(row[0]),
                    "customer_id": str(row[1]),
                    "registration_id": str(row[2]) if row[2] else None,
                    "policy": policy,
                    "revision": int(row[4] or 0),
                    "updated_by": row[5],
                    "created_at": row[6],
                    "updated_at": row[7],
                }

            if registration_id:
                owner = connection.execute(
                    "SELECT customer_id::text FROM sec_alert_registrations WHERE id = %s::uuid",
                    (registration_id,),
                ).fetchone()
                if owner is None or str(owner[0]) != str(customer_id):
                    raise AlertIdentityError(
                        "policy_registration_mismatch",
                        "alert policy registration does not belong to the selected customer",
                    )
            existing = select_existing()
            if existing:
                return as_record(existing)
            normalized = normalize_alert_policy({}, defaults=DEFAULT_ALERT_POLICY)
            row = connection.execute(
                """
                INSERT INTO sec_alert_email_policies (
                    customer_id, registration_id, policy, revision, updated_by
                ) VALUES (%s::uuid, %s::uuid, %s::jsonb, 1, %s)
                ON CONFLICT DO NOTHING
                RETURNING id::text, customer_id::text, registration_id::text,
                          policy, revision, updated_by, created_at, updated_at
                """,
                (
                    customer_id,
                    registration_id,
                    json.dumps(normalized, separators=(",", ":")),
                    str(actor or "system")[:320],
                ),
            ).fetchone()
            if row is None:
                row = select_existing()
                if row is None:
                    raise RuntimeError("alert email policy was not created")
            return as_record(row)

    def list_alert_policies(self, *, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id::text, customer_id::text, registration_id::text, policy,
                       revision, updated_by, created_at, updated_at
                FROM sec_alert_email_policies
                ORDER BY customer_id, registration_id NULLS FIRST, updated_at DESC
                LIMIT %s OFFSET %s
                """,
                (max(1, min(int(limit), 1_000)), max(0, int(offset))),
            ).fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            try:
                policy = normalize_alert_policy(row[3], defaults=DEFAULT_ALERT_POLICY)
                invalid_reason = None
            except AlertIdentityError as exc:
                policy = {}
                invalid_reason = str(exc)
            result.append({
                "id": str(row[0]), "customer_id": str(row[1]),
                "registration_id": str(row[2]) if row[2] else None,
                "policy": policy, "revision": int(row[4] or 0),
                "updated_by": row[5], "created_at": row[6], "updated_at": row[7],
                "invalid_reason": invalid_reason,
            })
        return result

    def save_alert_policy(
        self,
        customer_id: str,
        policy: Mapping[str, Any],
        *,
        registration_id: str | None = None,
        actor: str = "",
    ) -> dict[str, Any]:
        if not isinstance(policy, Mapping):
            raise AlertIdentityError("invalid_policy", "alert email policy must be an object")
        normalized = normalize_alert_policy(policy, defaults=DEFAULT_ALERT_POLICY)
        with self._connect() as connection:
            if registration_id:
                owner = connection.execute(
                    "SELECT customer_id::text FROM sec_alert_registrations WHERE id = %s::uuid",
                    (registration_id,),
                ).fetchone()
                if owner is None or str(owner[0]) != str(customer_id):
                    raise AlertIdentityError(
                        "policy_registration_mismatch",
                        "alert policy registration does not belong to the selected customer",
                    )
                existing = connection.execute(
                    "SELECT id::text, revision FROM sec_alert_email_policies WHERE registration_id = %s::uuid FOR UPDATE",
                    (registration_id,),
                ).fetchone()
            else:
                existing = connection.execute(
                    "SELECT id::text, revision FROM sec_alert_email_policies WHERE customer_id = %s::uuid AND registration_id IS NULL FOR UPDATE",
                    (customer_id,),
                ).fetchone()
            revision = int(existing[1]) + 1 if existing else 1
            if existing:
                row = connection.execute(
                    """
                    UPDATE sec_alert_email_policies
                    SET policy = %s::jsonb, revision = %s, updated_by = %s, updated_at = NOW()
                    WHERE id = %s::uuid
                    RETURNING id::text, customer_id::text, registration_id::text, policy, revision, updated_at
                    """,
                    (json.dumps(normalized, separators=(",", ":")), revision, actor[:320], existing[0]),
                ).fetchone()
            else:
                row = connection.execute(
                    """
                    INSERT INTO sec_alert_email_policies (
                        customer_id, registration_id, policy, revision, updated_by
                    ) VALUES (%s::uuid, %s::uuid, %s::jsonb, %s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING id::text, customer_id::text, registration_id::text, policy, revision, updated_at
                    """,
                    (customer_id, registration_id, json.dumps(normalized, separators=(",", ":")), revision, actor[:320]),
                ).fetchone()
                if row is None:
                    if registration_id:
                        existing = connection.execute(
                            "SELECT id::text, revision FROM sec_alert_email_policies WHERE registration_id = %s::uuid FOR UPDATE",
                            (registration_id,),
                        ).fetchone()
                    else:
                        existing = connection.execute(
                            "SELECT id::text, revision FROM sec_alert_email_policies WHERE customer_id = %s::uuid AND registration_id IS NULL FOR UPDATE",
                            (customer_id,),
                        ).fetchone()
                    if existing is None:
                        raise RuntimeError("alert email policy was not created")
                    revision = int(existing[1]) + 1
                    row = connection.execute(
                        """
                        UPDATE sec_alert_email_policies
                        SET policy = %s::jsonb, revision = %s, updated_by = %s, updated_at = NOW()
                        WHERE id = %s::uuid
                        RETURNING id::text, customer_id::text, registration_id::text, policy, revision, updated_at
                        """,
                        (json.dumps(normalized, separators=(",", ":")), revision, actor[:320], existing[0]),
                    ).fetchone()
        if row is None:
            raise RuntimeError("alert email policy was not created")
        return dict(zip(("id", "customer_id", "registration_id", "policy", "revision", "updated_at"), row, strict=True))

    def _quarantine_alert_run_on_connection(
        self,
        connection: Any,
        payload: Mapping[str, Any],
        reason: str,
    ) -> dict[str, Any]:
        safe = _safe_value(dict(payload)) if isinstance(payload, Mapping) else {}
        deployment = str((payload or {}).get("deployment") or "unknown").strip()[:512]
        sid = str((payload or {}).get("sid") or (payload or {}).get("search_id") or "").strip()[:1_024] or None
        name = str((payload or {}).get("alert_name") or (payload or {}).get("name") or "").strip()[:255] or None
        trigger = _timestamp((payload or {}).get("trigger_time") or (payload or {}).get("triggerTime"))
        if sid:
            dedup_value = json.dumps(
                {"deployment": deployment, "sid": sid, "name": name, "trigger": trigger.isoformat() if trigger else None},
                sort_keys=True,
                separators=(",", ":"),
            )
        else:
            dedup_value = json.dumps(
                {"deployment": deployment, "name": name, "trigger": trigger.isoformat() if trigger else None, "payload": safe},
                sort_keys=True,
                separators=(",", ":"),
                default=str,
            )
        dedup_key = hashlib.sha256(dedup_value.encode("utf-8")).hexdigest()
        row = connection.execute(
            """
            INSERT INTO sec_alert_run_quarantine (
                dedup_key, splunk_deployment, splunk_sid, alert_name,
                trigger_time, payload, reason
            ) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
            ON CONFLICT (dedup_key) DO UPDATE SET
                reason = EXCLUDED.reason, updated_at = NOW()
            RETURNING id::text, dedup_key, reason
            """,
            (dedup_key, deployment or "unknown", sid, name, trigger,
             json.dumps(safe, separators=(",", ":")), reason[:2_000]),
        ).fetchone()
        return {"status": "quarantined", "id": str(row[0]), "dedup_key": row[1], "reason": row[2]}

    def quarantine_alert_run(self, payload: Mapping[str, Any], reason: str) -> dict[str, Any]:
        with self._connect() as connection:
            return self._quarantine_alert_run_on_connection(connection, payload, reason)

    def _find_registration(self, connection: Any, run: AlertRunPayload, *, lock: bool = False) -> Any:
        suffix = " FOR UPDATE" if lock else ""
        if run.registration_id:
            try:
                row = connection.execute(
                    self._registration_select()
                    + " WHERE r.id = %s::uuid AND r.splunk_deployment = %s"
                    + suffix,
                    (run.registration_id, run.deployment),
                ).fetchone()
            except Exception:
                return None
            return row
        if run.stable_id:
            row = connection.execute(
                self._registration_select() +
                " WHERE r.splunk_deployment = %s AND r.stable_id = %s" + suffix,
                (run.deployment, run.stable_id),
            ).fetchone()
            return row
        return connection.execute(
            self._registration_select() +
            " WHERE r.splunk_deployment = %s AND r.app = %s AND r.owner = %s"
            " AND r.saved_search_name = %s" + suffix,
            (run.deployment, run.app, run.owner, run.alert_name),
        ).fetchone()

    @staticmethod
    def _business_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
        return {
            str(key): value
            for key, value in payload.items()
            if not str(key).startswith("_")
        }

    @classmethod
    def _payload_hash(cls, payload: Mapping[str, Any]) -> str:
        encoded = json.dumps(
            _safe_value(cls._business_payload(payload)),
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def _record_webhook_replay(
        connection: Any,
        *,
        deployment: str,
        replay_id: str,
        payload_hash: str,
    ) -> None:
        """Persist one authenticated request key and reject hash reuse."""
        row = connection.execute(
            """
            INSERT INTO sec_alert_webhook_replays (
                deployment, replay_id, payload_hash
            ) VALUES (%s, %s, %s)
            ON CONFLICT (deployment, replay_id) DO UPDATE SET
                last_seen_at = NOW()
            RETURNING payload_hash
            """,
            (deployment, replay_id, payload_hash),
        ).fetchone()
        if row is not None and str(row[0]) != payload_hash:
            raise AlertIdentityError(
                "replay_conflict",
                "replay identifier was reused with different payload content",
            )

    @staticmethod
    def _policy_severity(run: AlertRunPayload, rows: Sequence[Mapping[str, Any]], policy: Mapping[str, Any]) -> str:
        source = str(policy.get("severity_source") or "").strip()
        mapping = policy.get("severity_mapping")
        if source and isinstance(mapping, Mapping):
            for row in rows:
                if source not in row:
                    continue
                key = str(row.get(source) or "").strip().casefold()
                mapped = str(mapping.get(key, "")).strip().casefold()
                if mapped in ALLOWED_SEVERITIES:
                    return mapped
        # Severity is an administrator-controlled projection.  Never trust a
        # sender-provided fallback (especially a stale or forged ``high``)
        # when the approved policy does not map a source field.
        fallback = str(policy.get("severity_fallback") or "unknown").casefold()
        return fallback if fallback in ALLOWED_SEVERITIES else "unknown"

    def receive_alert_run(
        self,
        payload: Mapping[str, Any],
        *,
        authenticated_deployment: str | None = None,
        replay_id: str | None = None,
    ) -> dict[str, Any]:
        """Persist one custom-action run and deduplicate by registration/SID."""

        try:
            run = AlertRunPayload.from_mapping(payload)
        except AlertIdentityError as exc:
            return self.quarantine_alert_run(payload, f"{exc.code}: {exc}")
        try:
            trusted_deployment = normalize_deployment(
                authenticated_deployment or payload.get("_authenticated_deployment")
            )
        except AlertIdentityError as exc:
            return self.quarantine_alert_run(payload, f"{exc.code}: authenticated deployment is required")
        if trusted_deployment != run.deployment:
            return self.quarantine_alert_run(payload, "payload deployment does not match the authenticated deployment")
        replay_id = str(replay_id or payload.get("_authenticated_replay_id") or "").strip()
        if not replay_id or len(replay_id) > 256:
            return self.quarantine_alert_run(payload, "authenticated replay identifier is required")
        payload_hash = self._payload_hash(payload)

        # A custom action can race discovery.  The same ownership checks are
        # performed here before an AID is allocated.
        with self._connect() as connection:
            try:
                self._record_webhook_replay(
                    connection,
                    deployment=run.deployment,
                    replay_id=replay_id,
                    payload_hash=payload_hash,
                )
            except AlertIdentityError as exc:
                return self._quarantine_alert_run_on_connection(connection, payload, str(exc))
            existing = self._find_registration(connection, run)
            resolved_registration_id = str(existing[0]) if existing is not None else None
            if existing is not None:
                existing_registration = self._registration_dict(existing)
                receipt = connection.execute(
                    """
                    SELECT eid, event_id::text, payload_hash
                    FROM sec_alert_run_receipts
                    WHERE registration_id = %s::uuid AND splunk_sid = %s
                    FOR UPDATE
                    """,
                    (existing_registration["id"], run.sid),
                ).fetchone()
                if receipt is not None:
                    if receipt[2] and receipt[2] != payload_hash:
                        connection.execute(
                            """
                            UPDATE sec_alert_run_receipts
                            SET conflict_count = conflict_count + 1,
                                last_error = 'conflicting content for an existing registration/SID run'
                            WHERE registration_id = %s::uuid AND splunk_sid = %s
                            """,
                            (existing_registration["id"], run.sid),
                        )
                        return self._quarantine_alert_run_on_connection(
                            connection,
                            payload,
                            "conflicting content for an existing registered run",
                        )
                    if receipt[0]:
                        return {
                            "status": "duplicate",
                            "duplicate": True,
                            "cid": existing_registration["cid"],
                            "aid": existing_registration["aid"],
                            "eid": str(receipt[0]),
                            "event_id": str(receipt[1]) if receipt[1] else None,
                        }
        if existing is None or (
            run.definition
            and (run.definition.get("spl") or run.definition.get("search") or run.definition.get("source_indexes"))
        ):
            try:
                self.sync_catalog_indexes(run.deployment)
            except Exception as exc:
                return self.quarantine_alert_run(
                    payload,
                    "customer index ownership could not be synchronized: " + str(exc)[:500],
                )
        if existing is not None and run.definition and (
            run.definition.get("spl")
            or run.definition.get("search")
            or run.definition.get("source_indexes")
        ):
            definition = dict(run.definition)
            definition.setdefault("name", run.alert_name)
            definition.setdefault("app", run.app)
            definition.setdefault("owner", run.owner)
            definition.setdefault("stable_id", run.stable_id)
            registration = self.register_definition(
                definition,
                deployment=run.deployment,
                source_indexes=definition.get("source_indexes") or payload.get("source_indexes"),
                origin="unknown",
                actor="splunk-alert-action",
                action_configured=True,
            )
            if registration.get("status") == "needs_review":
                return self.quarantine_alert_run(
                    payload,
                    str(registration.get("reason") or "alert registration requires review"),
                )
            resolved_registration_id = registration.get("id")
        if existing is None:
            definition = dict(run.definition or {})
            definition.setdefault("name", run.alert_name)
            definition.setdefault("app", run.app)
            definition.setdefault("owner", run.owner)
            definition.setdefault("stable_id", run.stable_id)
            registration = self.register_definition(
                definition,
                deployment=run.deployment,
                source_indexes=definition.get("source_indexes") or payload.get("source_indexes"),
                origin="unknown",
                actor="splunk-alert-action",
                action_configured=True,
            )
            if registration.get("status") == "needs_review" or not registration.get("id"):
                return self.quarantine_alert_run(payload, str(registration.get("reason") or "alert registration requires review"))
            resolved_registration_id = registration.get("id")

        with self._connect() as connection:
            if resolved_registration_id:
                row = connection.execute(
                    self._registration_select()
                    + " WHERE r.id = %s::uuid AND r.splunk_deployment = %s FOR UPDATE",
                    (resolved_registration_id, run.deployment),
                ).fetchone()
            else:
                row = self._find_registration(connection, run, lock=True)
            if row is None:
                return self._quarantine_alert_run_on_connection(connection, payload, "registered alert could not be found")
            registration = self._registration_dict(row)
            if registration["deployment"] != trusted_deployment:
                return self._quarantine_alert_run_on_connection(
                    connection, payload, "registration deployment does not match the authenticated deployment"
                )
            identity_conflicts = []
            if run.alert_name != registration["saved_search_name"]:
                identity_conflicts.append("saved-search name")
            if run.app and run.app != registration["app"]:
                identity_conflicts.append("app")
            if run.owner and run.owner != registration["owner"]:
                identity_conflicts.append("owner")
            if run.stable_id and registration["stable_id"] and run.stable_id != registration["stable_id"]:
                identity_conflicts.append("stable registration identity")
            receipt = connection.execute(
                """
                SELECT eid, event_id::text, status, payload_hash
                FROM sec_alert_run_receipts
                WHERE registration_id = %s::uuid AND splunk_sid = %s
                FOR UPDATE
                """,
                (registration["id"], run.sid),
            ).fetchone()
            if receipt is not None and receipt[3] and receipt[3] != payload_hash:
                connection.execute(
                    """
                    UPDATE sec_alert_run_receipts
                    SET conflict_count = conflict_count + 1,
                        last_error = 'conflicting content for an existing registration/SID run'
                    WHERE registration_id = %s::uuid AND splunk_sid = %s
                    """,
                    (registration["id"], run.sid),
                )
                return self._quarantine_alert_run_on_connection(
                    connection, payload, "conflicting content for an existing registered run"
                )
            if receipt is not None and receipt[0]:
                return {
                    "status": "duplicate",
                    "duplicate": True,
                    "cid": registration["cid"],
                    "aid": registration["aid"],
                    "eid": str(receipt[0]),
                    "event_id": str(receipt[1]) if receipt[1] else None,
                }
            # A retry of a run must return its original EID even if the
            # saved-search was renamed after the trigger.  Content conflicts
            # were handled above; a first delivery still goes through the
            # normal identity assertions below.
            if identity_conflicts:
                return self._quarantine_alert_run_on_connection(
                    connection,
                    payload,
                    "payload alert identity conflicts with registration: " + ", ".join(identity_conflicts),
                )
            if run.asserted_cid and run.asserted_cid != registration["cid"]:
                return self._quarantine_alert_run_on_connection(connection, payload, "payload CID assertion conflicts with registration")
            if run.asserted_aid and run.asserted_aid != registration["aid"]:
                return self._quarantine_alert_run_on_connection(connection, payload, "payload AID assertion conflicts with registration")
            if registration["registration_state"] in {"pending", "needs_review", "failed", "inactive", "retired"}:
                return self._quarantine_alert_run_on_connection(connection, payload, "registered alert is not active for delivery")
            if run.definition_revision != registration["definition_revision"]:
                return self._quarantine_alert_run_on_connection(connection, payload, "payload definition revision is stale")

            policy_row = connection.execute(
                """
                SELECT id::text, policy, revision
                FROM sec_alert_email_policies
                WHERE customer_id = %s::uuid
                  AND (registration_id IS NULL OR registration_id = %s::uuid)
                ORDER BY CASE WHEN registration_id = %s::uuid THEN 0 ELSE 1 END, updated_at DESC
                LIMIT 1
                """,
                (registration["customer_id"], registration["id"], registration["id"]),
            ).fetchone()
            if policy_row is None or str(policy_row[0]) != run.policy_id or int(policy_row[2] or 0) != int(run.policy_revision or 0):
                return self._quarantine_alert_run_on_connection(
                    connection,
                    payload,
                    "alert email policy identity or revision is stale",
                )
            policy_value = policy_row[1] if isinstance(policy_row[1], Mapping) else {}
            try:
                policy = normalize_alert_policy(policy_value, defaults=DEFAULT_ALERT_POLICY)
            except AlertIdentityError as exc:
                return self._quarantine_alert_run_on_connection(
                    connection,
                    payload,
                    f"invalid administrator alert email policy: {exc}",
                )
            policy_id = str(policy_row[0])
            policy_revision = int(policy_row[2] or 0)
            approved_transport_columns = {
                str(value).strip()
                for value in (
                    list(policy.get("detail_columns", []))
                    + list(policy.get("required_columns", []))
                    + list(policy.get("optional_columns", []))
                    + [
                        str(item.get("source") or "").strip()
                        for item in policy.get("field_mappings", [])
                        if isinstance(item, Mapping)
                    ]
                    + [
                        str(item.get("source") or "").strip()
                        for item in policy.get("row_filters", [])
                        if isinstance(item, Mapping)
                    ]
                    + [str(policy.get("severity_source") or "").strip()]
                )
                if value and value != "_raw"
            }
            supplied_transport_columns = set(run.selected_columns)
            if not supplied_transport_columns.issubset(approved_transport_columns):
                return self._quarantine_alert_run_on_connection(
                    connection,
                    payload,
                    "payload selected columns exceed the administrator-approved policy",
                )
            if not approved_transport_columns.issubset(supplied_transport_columns):
                return self._quarantine_alert_run_on_connection(
                    connection,
                    payload,
                    "custom alert action projection is stale; republish the alert policy",
                )
            retained, source_total, matching_total, stored, truncated, columns = project_selected_rows_with_counts(
                run.rows,
                policy=policy,
                include_positions=True,
                row_positions=run.row_positions,
            )
            if run.retained_count != stored:
                return self._quarantine_alert_run_on_connection(
                    connection,
                    payload,
                    "payload retained count conflicts with the approved row projection",
                )
            if run.matching_count is not None:
                if run.matching_count < matching_total or (not run.truncated and run.matching_count != matching_total):
                    return self._quarantine_alert_run_on_connection(
                        connection,
                        payload,
                        "payload matching count conflicts with the approved row filter",
                    )
                matching_total = run.matching_count
            truncated = bool(truncated or run.truncated)
            # Validate against the original result rows.  The projected rows
            # intentionally contain configured columns with blank values, so
            # checking them would hide a genuinely missing required source.
            missing = required_columns_missing(run.rows, policy)
            display_limit = max(1, min(int(policy.get("max_display_rows", 50) or 50), 1_000))
            displayed = min(stored, display_limit)
            severity = self._policy_severity(run, run.rows, policy)
            customer_row = connection.execute(
                """
                SELECT status, alert_delivery_enabled, email_config, cid
                FROM customers
                WHERE id = %s::uuid
                FOR SHARE
                """,
                (registration["customer_id"],),
            ).fetchone()
            ownership_ok = bool(
                connection.execute(
                    """
                    SELECT cardinality(%s::text[]) > 0
                       AND NOT EXISTS (
                           SELECT 1
                           FROM unnest(%s::text[]) AS source(index_name)
                           WHERE NOT EXISTS (
                               SELECT 1
                               FROM sec_alert_index_ownership AS ownership
                               WHERE ownership.splunk_deployment = %s
                                 AND ownership.index_name = source.index_name
                                 AND ownership.customer_id = %s::uuid
                                 AND ownership.status = 'active'
                           )
                       )
                    """,
                    (list(registration["source_indexes"]), list(registration["source_indexes"]),
                     registration["deployment"], registration["customer_id"]),
                ).fetchone()[0]
            )
            customer_active = bool(customer_row and str(customer_row[0]).casefold() == "active")
            customer_delivery_enabled = bool(customer_row and customer_row[1])
            recipient_snapshot: dict[str, Any] = {}
            email_config_ok = False
            if customer_row and isinstance(customer_row[2], Mapping):
                try:
                    # Match the worker's address validation before creating
                    # an outbox row; a present-but-invalid address must hold
                    # the event for review instead of failing during send.
                    from .alert_email import normalize_email_config

                    recipient_snapshot = normalize_email_config(customer_row[2], require_recipient=True)
                    email_config_ok = True
                except (TypeError, ValueError):
                    email_config_ok = False
            next_sequence = int(
                connection.execute(
                    "SELECT next_run_sequence FROM sec_alert_registrations WHERE id = %s::uuid FOR UPDATE",
                    (registration["id"],),
                ).fetchone()[0]
            )
            eid = format_eid(registration["aid"], run.trigger_time, next_sequence)
            connection.execute(
                "UPDATE sec_alert_registrations SET next_run_sequence = next_run_sequence + 1, updated_at = NOW() WHERE id = %s::uuid",
                (registration["id"],),
            )
            hold_reasons: list[str] = []
            if missing:
                hold_reasons.append(f"missing required result columns: {', '.join(missing)}")
            if not customer_active:
                hold_reasons.append("customer is not active")
            if not customer_delivery_enabled:
                hold_reasons.append("customer alert delivery is disabled")
            if not registration["delivery_enabled"]:
                hold_reasons.append("alert delivery is disabled for this registration")
            if registration["delivery_state"] != "ready":
                hold_reasons.append("CITIC Alert Delivery action is not configured")
            if registration["presence_state"] in {"missing", "incomplete"}:
                hold_reasons.append("saved-search presence is not verified")
            if not ownership_ok:
                hold_reasons.append("source index ownership is not complete and active")
            if not email_config_ok:
                hold_reasons.append("customer recipients are not configured")
            email_held = bool(hold_reasons)
            hold_reason = "; ".join(hold_reasons)[:2_000] or None
            event_data = {
                "schema_version": 1,
                "cid": registration["cid"],
                "aid": registration["aid"],
                "eid": eid,
                "alert_name": run.alert_name,
                "splunk_sid": run.sid,
                "source_indexes": list(registration["source_indexes"]),
                "detail_columns": list(columns),
                "source_result_count": run.result_count,
                "observed_row_count": source_total,
                "original_row_positions": list(run.row_positions),
                "detail_total": matching_total,
                "detail_matching": matching_total,
                "detail_stored": stored,
                "detail_displayed": displayed,
                "detail_truncated": truncated,
                "email_policy_id": policy_id,
                "email_policy": policy,
                "email_policy_revision": policy_revision,
                "recipient_snapshot": recipient_snapshot,
                "email_held": email_held,
                "email_hold_reason": hold_reason,
                "severity_display": severity or "unknown",
            }
            event_row = connection.execute(
                """
                INSERT INTO sec_events (
                    customer_id, event_id, title, severity, status, event_time,
                    splunk_sid, alert_name, trigger_time, result_count, event_data,
                    custom_fields, cid, aid, eid, alert_registration_id,
                    trigger_received_at, definition_revision, detail_total,
                    detail_stored, detail_displayed, detail_truncated,
                    delivery_completeness, email_policy_id, email_policy_revision,
                    source_result_count, trigger_time_precision
                ) VALUES (
                    %s::uuid, %s, %s, %s, 'new', %s, %s, %s, %s, %s,
                    %s::jsonb, '{}'::jsonb, %s, %s, %s, %s::uuid, NOW(), %s,
                    %s, %s, %s, %s, %s, %s::uuid, %s, %s, %s
                )
                ON CONFLICT (eid) WHERE eid IS NOT NULL AND eid <> '' DO NOTHING
                RETURNING id::text
                """,
                (
                    registration["customer_id"], eid, run.alert_name, severity,
                    run.trigger_time, run.sid, run.alert_name, run.trigger_time,
                    run.result_count, json.dumps(event_data, separators=(",", ":")),
                    registration["cid"], registration["aid"], eid, registration["id"],
                    registration["definition_revision"], matching_total, stored, displayed,
                    truncated, "partial" if email_held else "truncated" if truncated else "complete",
                    policy_id, policy_revision, run.result_count, run.trigger_time_precision,
                ),
            ).fetchone()
            event_id = str(event_row[0]) if event_row else None
            if event_id is None:
                event_row = connection.execute("SELECT id::text FROM sec_events WHERE eid = %s", (eid,)).fetchone()
                event_id = str(event_row[0]) if event_row else None
            if event_id is None:
                raise RuntimeError("event insert did not return an event UUID")
            for position, details in retained:
                connection.execute(
                    """
                    INSERT INTO sec_event_details (event_id, row_position, details)
                    VALUES (%s::uuid, %s, %s::jsonb)
                    ON CONFLICT (event_id, row_position) DO NOTHING
                    """,
                    (event_id, position, json.dumps(details, separators=(",", ":"))),
                )
            receipt_row = connection.execute(
                """
                INSERT INTO sec_alert_run_receipts (
                    registration_id, splunk_sid, trigger_time, eid, event_id,
                    payload_hash, status, deployment, definition_revision,
                    policy_id, policy_revision, trigger_time_precision
                ) VALUES (%s::uuid, %s, %s, %s, %s::uuid, %s, 'processed', %s,
                          %s, %s::uuid, %s, %s)
                ON CONFLICT (registration_id, splunk_sid) DO UPDATE SET
                    eid = COALESCE(sec_alert_run_receipts.eid, EXCLUDED.eid),
                    event_id = COALESCE(sec_alert_run_receipts.event_id, EXCLUDED.event_id),
                    payload_hash = CASE WHEN sec_alert_run_receipts.payload_hash = ''
                                        THEN EXCLUDED.payload_hash
                                        ELSE sec_alert_run_receipts.payload_hash END,
                    status = 'processed'
                RETURNING eid, event_id::text
                """,
                (registration["id"], run.sid, run.trigger_time, eid, event_id, payload_hash,
                 run.deployment, registration["definition_revision"], policy_id, policy_revision,
                 run.trigger_time_precision),
            ).fetchone()
            return {
                "status": "stored",
                "duplicate": False,
                "cid": registration["cid"],
                "aid": registration["aid"],
                "eid": str(receipt_row[0] if receipt_row else eid),
                "event_id": str(receipt_row[1] if receipt_row else event_id),
                "total_count": run.result_count,
                "matching_count": matching_total,
                "stored_count": stored,
                "displayed_count": displayed,
                "truncated": truncated,
                "email_held": email_held,
                "email_hold_reason": hold_reason,
            }

    def acquire_worker_lock(self, lock_name: str = "citic_soc_alert_ingestion") -> bool:
        """Hold a PostgreSQL advisory lock for the lifetime of one worker."""
        if self._lock_connection is not None:
            return True
        # psycopg_pool.connection() is a context manager, so use a dedicated
        # direct connection for a session-scoped advisory lock.
        connection = psycopg.connect(self.uri, connect_timeout=5, options="-c statement_timeout=15000")
        try:
            acquired = connection.execute(
                "SELECT pg_try_advisory_lock(hashtext(%s))",
                (lock_name,),
            ).fetchone()
            if not acquired or not bool(acquired[0]):
                connection.close()
                return False
        except Exception:
            connection.close()
            raise
        self._lock_connection = connection
        return True

    def release_worker_lock(self, lock_name: str = "citic_soc_alert_ingestion") -> None:
        connection = self._lock_connection
        self._lock_connection = None
        if connection is None:
            return
        try:
            connection.execute("SELECT pg_advisory_unlock(hashtext(%s))", (lock_name,))
        except Exception:
            pass
        finally:
            connection.close()

    def record_cycle_started(self, worker_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sec_alert_ingestion_status (id, worker_id, last_started_at, heartbeat_at)
                VALUES (TRUE, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    worker_id = EXCLUDED.worker_id,
                    last_started_at = EXCLUDED.last_started_at,
                    heartbeat_at = EXCLUDED.heartbeat_at,
                    last_error = NULL
                """,
                (worker_id,),
            )

    def record_cycle_completed(self, worker_id: str, report: IngestReport) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sec_alert_ingestion_status (
                    id, worker_id, last_completed_at, last_success_at, heartbeat_at,
                    last_found, last_inserted, last_skipped, last_quarantined, last_failed
                ) VALUES (TRUE, %s, NOW(), NOW(), NOW(), %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    worker_id = EXCLUDED.worker_id,
                    last_completed_at = EXCLUDED.last_completed_at,
                    last_success_at = CASE
                        WHEN EXCLUDED.last_failed = 0 THEN EXCLUDED.last_success_at
                        ELSE sec_alert_ingestion_status.last_success_at
                    END,
                    heartbeat_at = EXCLUDED.heartbeat_at,
                    last_found = EXCLUDED.last_found,
                    last_inserted = EXCLUDED.last_inserted,
                    last_skipped = EXCLUDED.last_skipped,
                    last_quarantined = EXCLUDED.last_quarantined,
                    last_failed = EXCLUDED.last_failed,
                    last_error = CASE
                        WHEN EXCLUDED.last_failed = 0 THEN NULL
                        ELSE sec_alert_ingestion_status.last_error
                    END
                """,
                (
                    worker_id,
                    report.found,
                    report.inserted,
                    report.skipped,
                    report.quarantined,
                    report.failed,
                ),
            )

    def record_cycle_error(self, worker_id: str, error: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sec_alert_ingestion_status (
                    id, worker_id, last_error_at, last_error, heartbeat_at
                ) VALUES (TRUE, %s, NOW(), %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    worker_id = EXCLUDED.worker_id,
                    last_error_at = EXCLUDED.last_error_at,
                    last_error = EXCLUDED.last_error,
                    heartbeat_at = EXCLUDED.heartbeat_at
                """,
                (worker_id, error[:2_000]),
            )

    def reconcile_polled_alert(self, deployment: str, alert: NormalizedAlert) -> str:
        """Reconcile polling observations without creating a second event.

        The custom action is the only creator of registered events.  Polling
        only records whether a known SID already has an action receipt, which
        makes either arrival order safe and leaves missed action deliveries
        visible to administrators.
        """
        deployment = normalize_deployment(deployment)
        app = str(alert.event_data.get("app") or "").strip()
        owner = str(alert.event_data.get("owner") or "").strip()
        with self._connect() as connection:
            clauses = [
                "r.splunk_deployment = %s",
                "r.saved_search_name = %s",
            ]
            params: list[Any] = [deployment, alert.alert_name or ""]
            if app:
                clauses.append("r.app = %s")
                params.append(app)
            if owner:
                clauses.append("r.owner = %s")
                params.append(owner)
            registrations = connection.execute(
                "SELECT r.id::text FROM sec_alert_registrations AS r WHERE "
                + " AND ".join(clauses)
                + " ORDER BY r.id LIMIT 2",
                params,
            ).fetchall()
            if len(registrations) != 1 or not alert.splunk_sid:
                return "unregistered"
            registration_id = str(registrations[0][0])
            receipt = connection.execute(
                """
                SELECT 1 FROM sec_alert_run_receipts
                WHERE registration_id = %s::uuid AND splunk_sid = %s
                """,
                (registration_id, alert.splunk_sid),
            ).fetchone()
            status = "received" if receipt else "missing"
            reason = "custom action receipt exists" if receipt else "polling observed a run without an action receipt"
            connection.execute(
                """
                INSERT INTO sec_alert_delivery_reconciliation (
                    registration_id, splunk_sid, trigger_time, status, reason
                ) VALUES (%s::uuid, %s, %s, %s, %s)
                ON CONFLICT (registration_id, splunk_sid) DO UPDATE SET
                    trigger_time = EXCLUDED.trigger_time,
                    observed_at = NOW(), status = EXCLUDED.status, reason = EXCLUDED.reason
                """,
                (registration_id, alert.splunk_sid, alert.trigger_time, status, reason),
            )
            return status

    def resolve(self, event_gid: str, event_rulenum: str) -> tuple[str, str] | None:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT customer.id::text, ruleset.id::text
                FROM customers AS customer
                JOIN rulesets AS ruleset ON ruleset.customer_id = customer.id
                WHERE customer.gid = %s
                  AND customer.status = 'active'
                  AND ruleset.rule_number = %s
                ORDER BY customer.id, ruleset.id
                """,
                (event_gid, event_rulenum),
            ).fetchall()
        if len(rows) != 1:
            return None
        return str(rows[0][0]), str(rows[0][1])

    def event_exists(self, alert: NormalizedAlert) -> bool:
        if not alert.splunk_sid:
            return False
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT 1
                FROM sec_events
                WHERE splunk_sid = %s
                  AND alert_name IS NOT DISTINCT FROM %s
                  AND trigger_time IS NOT DISTINCT FROM %s
                LIMIT 1
                """,
                (alert.splunk_sid, alert.alert_name, alert.trigger_time),
            ).fetchone()
        return row is not None

    def quarantine_exists(self, alert: NormalizedAlert) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT 1 FROM sec_event_quarantine WHERE dedup_key = %s LIMIT 1",
                (alert.dedup_key,),
            ).fetchone()
        return row is not None

    def insert_event(self, alert: NormalizedAlert, customer_id: str, ruleset_id: str) -> bool:
        event_data = dict(alert.event_data)
        event_data["legacy_ingestion_mode"] = "explicit"
        with self._connect() as connection:
            row = connection.execute(
                """
                INSERT INTO sec_events (
                    customer_id, ruleset_id, event_id, title, severity, status,
                    event_time, splunk_sid, alert_name, trigger_time, result_count,
                    event_data, custom_fields
                ) VALUES (
                    %s, %s, %s, %s, %s, 'new', %s, %s, %s, %s, %s, %s::jsonb, '{}'::jsonb
                )
                ON CONFLICT (splunk_sid, alert_name, trigger_time)
                    WHERE splunk_sid IS NOT NULL AND alert_registration_id IS NULL
                DO NOTHING
                RETURNING id
                """,
                (
                    customer_id,
                    ruleset_id,
                    alert.splunk_sid,
                    alert.alert_name,
                    alert.severity,
                    alert.trigger_time,
                    alert.splunk_sid,
                    alert.alert_name,
                    alert.trigger_time,
                    alert.result_count,
                    json.dumps(event_data, separators=(",", ":")),
                ),
            ).fetchone()
        return row is not None

    def insert_quarantine(self, alert: NormalizedAlert, reason: str) -> bool:
        payload = dict(alert.event_data)
        payload["quarantine_reason"] = reason
        with self._connect() as connection:
            row = connection.execute(
                """
                INSERT INTO sec_event_quarantine (
                    dedup_key, splunk_sid, alert_name, trigger_time, result_count,
                    event_gid, event_rulenum, event_data, reason
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (dedup_key) DO NOTHING
                RETURNING id
                """,
                (
                    alert.dedup_key,
                    alert.splunk_sid,
                    alert.alert_name,
                    alert.trigger_time,
                    alert.result_count,
                    alert.event_gid,
                    alert.event_rulenum,
                    json.dumps(payload, separators=(",", ":")),
                    reason,
                ),
            ).fetchone()
        return row is not None

    def list_unresolved_quarantine(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id::text, dedup_key, splunk_sid, alert_name, trigger_time, result_count,
                       event_gid, event_rulenum, event_data, reason
                FROM sec_event_quarantine
                WHERE resolved_at IS NULL
                ORDER BY created_at, id
                LIMIT %s OFFSET %s
                """,
                (max(1, min(int(limit), 1_000)), max(0, int(offset))),
            ).fetchall()
        keys = (
            "id", "dedup_key", "splunk_sid", "alert_name", "trigger_time", "result_count",
            "event_gid", "event_rulenum", "event_data", "reason",
        )
        return [dict(zip(keys, row, strict=True)) for row in rows]

    def touch_quarantine_attempt(self, quarantine_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_event_quarantine
                SET attempt_count = attempt_count + 1, last_attempt_at = NOW()
                WHERE id = %s::uuid AND resolved_at IS NULL
                """,
                (quarantine_id,),
            )

    def resolve_quarantine(self, quarantine_id: str, alert: NormalizedAlert) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_event_quarantine AS quarantine
                SET resolved_at = NOW(),
                    resolved_event_id = (
                        SELECT event.id
                        FROM sec_events AS event
                        WHERE event.splunk_sid = quarantine.splunk_sid
                          AND event.alert_name IS NOT DISTINCT FROM quarantine.alert_name
                          AND event.trigger_time IS NOT DISTINCT FROM quarantine.trigger_time
                        ORDER BY event.created_at DESC
                        LIMIT 1
                    ),
                    attempt_count = attempt_count + 1,
                    last_attempt_at = NOW()
                WHERE quarantine.id = %s::uuid
                  AND quarantine.resolved_at IS NULL
                """,
                (quarantine_id,),
            )


class AlertIngestionService:
    """Fetch current fired alerts, normalize metadata, and persist decisions."""

    def __init__(
        self,
        client: Any,
        store: AlertIngestionStore,
        *,
        max_pages: int = 100,
        legacy_mode: bool = False,
    ) -> None:
        self.client = client
        self.store = store
        self.max_pages = max(1, int(max_pages))
        self.legacy_mode = bool(legacy_mode)

    async def _pages(self, method: Any, *, page_size: int):
        """Yield paged MCP results without trusting a single response page."""
        offset = 0
        seen_offsets: set[int] = set()
        for _ in range(self.max_pages):
            if offset in seen_offsets:
                return
            seen_offsets.add(offset)
            try:
                page = await method(limit=page_size, offset=offset)
            except TypeError:
                if offset:
                    raise
                page = await method(limit=page_size)
            if not isinstance(page, Mapping):
                raise RuntimeError("Splunk returned a malformed fired-alert page.")
            items = page.get("items", [])
            if not isinstance(items, list):
                raise RuntimeError("Splunk returned malformed fired-alert items.")
            if not items:
                return
            yield items
            next_offset = page.get("next_offset")
            total = page.get("total")
            try:
                next_offset = int(next_offset) if next_offset is not None else None
            except (TypeError, ValueError):
                next_offset = None
            try:
                total = int(total) if total is not None else None
            except (TypeError, ValueError):
                total = None
            if total is not None and offset + len(items) >= total:
                return
            if next_offset is None:
                next_offset = offset + len(items) if len(items) >= page_size else None
                if total is not None and offset + len(items) < total:
                    next_offset = offset + len(items)
            if next_offset is None or next_offset <= offset:
                return
            offset = next_offset

    async def _catalogs(self, page_size: int):
        async for items in self._pages(self.client.get_fired_alerts, page_size=page_size):
            for item in items:
                yield item

    async def _instances(self, name: str, page_size: int):
        page_method = getattr(self.client, "get_fired_alert_page", None)
        if page_method is None:
            # Compatibility for small test doubles and older clients.
            values = await self.client.get_fired_alert(name)
            if not isinstance(values, list):
                raise RuntimeError(f"Splunk returned malformed fired-alert instances for {name}")
            yield values
            return
        async for items in self._pages(
            lambda **kwargs: page_method(name, **kwargs),
            page_size=page_size,
        ):
            yield items

    async def discover_alerts(self, *, limit: int = 100) -> list[dict[str, Any]]:
        """Register alert definitions without enabling any Splunk action.

        The official MCP catalog includes disabled saved searches.  Only
        alert-shaped or action-bearing definitions are considered here; an
        ordinary scheduled report is not silently registered as a customer
        alert. All ownership decisions still happen in PostgreSQL.
        """

        method = getattr(self.client, "get_saved_searches", None)
        sync_indexes = getattr(self.store, "sync_catalog_indexes", None)
        if method is None:
            return []
        deployment = str(
            getattr(self.client, "deployment_identity", "")
            or getattr(self.client, "config", {}).get("splunk_deployment_id", "")
            or "splunk-default"
        ).strip()
        if sync_indexes is not None:
            await asyncio.to_thread(sync_indexes, deployment)
        start_run = getattr(self.store, "start_discovery_run", None)
        finish_run = getattr(self.store, "finish_discovery_run", None)
        attach_run = getattr(self.store, "attach_discovery_run", None)
        discovery_run_id: str | None = None
        if callable(start_run):
            discovery_run_id = await asyncio.to_thread(start_run, deployment)
        discovery_started = datetime.now(timezone.utc)
        # The official client pages through the complete saved-search catalog;
        # ``limit`` controls the registration work batch, not catalog safety.
        registered: list[dict[str, Any]] = []
        definitions: list[dict[str, Any]] = []
        try:
            definitions_result = await method(count=100_000)
            if not isinstance(definitions_result, list):
                raise RuntimeError("Splunk returned malformed saved-search definitions.")
            definitions = definitions_result
            register = getattr(self.store, "register_definition", None)
            if register is not None:
                for raw in definitions:
                    if not isinstance(raw, Mapping):
                        continue
                    actions = raw.get("actions", "")
                    action_text = ",".join(str(item) for item in actions) if isinstance(actions, Sequence) and not isinstance(actions, (str, bytes, bytearray)) else str(actions or "")
                    has_alert_fields = any(
                        raw.get(key) not in (None, "", False)
                        for key in ("alert_type", "alert_comparator", "alert_threshold", "alert_condition")
                    )
                    # A saved search with an arbitrary action (for example,
                    # email or summary indexing) is still an ordinary report.
                    # Discovery may register only alert-shaped definitions or
                    # definitions that explicitly carry the approved CITIC
                    # delivery action.
                    if not has_alert_fields and not _has_delivery_action(actions):
                        continue
                    definition = dict(raw)
                    definition.setdefault("saved_search_name", raw.get("name", ""))
                    indexes, index_error = extract_static_indexes(raw.get("search", raw.get("spl", "")))
                    result = await asyncio.to_thread(
                        register,
                        definition,
                        deployment=deployment,
                        source_indexes=indexes,
                        origin="discovery",
                        actor="discovery-worker",
                        action_configured=_has_delivery_action(actions),
                    )
                    if discovery_run_id and callable(attach_run) and result.get("id"):
                        await asyncio.to_thread(attach_run, result["id"], discovery_run_id)
                    if index_error and result.get("status") != "needs_review":
                        result["warning"] = index_error
                    registered.append(result)
            catalog_complete = bool(getattr(self.client, "last_saved_search_catalog_complete", False))
            catalog_error = str(getattr(self.client, "last_saved_search_catalog_error", "") or "")
            retire = getattr(self.store, "retire_unseen_discoveries", None)
            if retire is not None and catalog_complete:
                await asyncio.to_thread(retire, deployment, discovery_started)
            if discovery_run_id and callable(finish_run):
                await asyncio.to_thread(
                    finish_run,
                    discovery_run_id,
                    status="complete" if catalog_complete else "incomplete",
                    discovered_count=len(definitions),
                    page_count=int(getattr(self.client, "last_saved_search_catalog_page_count", 0) or 0),
                    error=catalog_error,
                )
            return registered
        except Exception as exc:
            if discovery_run_id and callable(finish_run):
                try:
                    await asyncio.to_thread(
                        finish_run,
                        discovery_run_id,
                        status="failed",
                        discovered_count=len(definitions),
                        page_count=int(getattr(self.client, "last_saved_search_catalog_page_count", 0) or 0),
                        error=str(exc),
                    )
                except Exception:
                    LOGGER.exception("failed to persist alert discovery failure")
            raise

    def _field_pair(self, payload: Mapping[str, Any]) -> tuple[str | None, str | None, str | None]:
        direct_gid = _text(_first(payload, "Event_GID", "event_gid", "GID"), limit=128)
        direct_rule = _text(_first(payload, "Event_Rulenum", "event_rulenum", "rulename"), limit=128)
        pairs: set[tuple[str, str]] = set()
        if direct_gid and direct_rule:
            pairs.add((direct_gid, direct_rule))
        if len(pairs) == 1:
            gid, rule = next(iter(pairs))
            return gid, rule, None
        if not pairs:
            return direct_gid, direct_rule, "Event_GID and Event_Rulenum are required in the alert result."
        return None, None, "alert result contains multiple Event_GID/Event_Rulenum pairs."

    async def _normalize(
        self,
        catalog: Mapping[str, Any],
        instance: Mapping[str, Any],
        *,
        require_legacy_identity: bool = False,
    ) -> tuple[NormalizedAlert, str | None]:
        catalog_data = _content(catalog)
        instance_data = _content(instance)
        payload = {**catalog_data, **instance_data}
        alert_name = _text(
            _first(
                payload,
                "alert_name",
                "savedsearch_name",
                "search_name",
                "detection_name",
            )
            or catalog.get("name")
        )
        sid = _text(_first(payload, "sid", "search_id", "searchId"), limit=1_024)
        trigger_time = _timestamp(_first(payload, "trigger_time", "triggerTime", "triggered_time"))
        result_count = _count(_first(payload, "result_count", "event_count", "triggered_alert_count"))
        event_gid, event_rulenum, mapping_error = self._field_pair(payload)
        if not require_legacy_identity and mapping_error and alert_name and sid and trigger_time:
            mapping_error = None
        data = _event_data(payload, event_gid=event_gid, event_rulenum=event_rulenum)
        alert = NormalizedAlert(
            splunk_sid=sid,
            alert_name=alert_name,
            trigger_time=trigger_time,
            result_count=result_count,
            severity=_severity(_first(payload, "severity", "urgency")),
            event_gid=event_gid,
            event_rulenum=event_rulenum,
            event_data=data,
            dedup_key=_dedup_key(
                splunk_sid=sid,
                alert_name=alert_name,
                trigger_time=trigger_time,
                payload=payload,
            ),
        )
        if not sid:
            mapping_error = mapping_error or "Splunk fired alert has no search SID."
        if not alert_name:
            mapping_error = mapping_error or "Splunk fired alert has no alert name."
        if not trigger_time:
            mapping_error = mapping_error or "Splunk fired alert has no valid trigger time."
        return alert, mapping_error

    async def ingest(self, *, limit: int = 100, dry_run: bool = False) -> IngestReport:
        report = IngestReport()
        page_size = max(1, min(int(limit), 201))
        seen_names: set[str] = set()
        async for catalog in self._catalogs(page_size):
            if not isinstance(catalog, Mapping):
                report.failed += 1
                report.errors.append("malformed fired-alert catalog item")
                continue
            name = _text(_first(catalog, "name", "alert_name")) or _text(_content(catalog).get("name"))
            if not name or name == "-" or name in seen_names:
                continue
            seen_names.add(name)
            async for instances in self._instances(name, page_size):
                for instance in instances:
                    await self._ingest_instance(report, catalog, instance, dry_run=dry_run, name=name)

        return report

    async def _ingest_instance(
        self,
        report: IngestReport,
        catalog: Mapping[str, Any],
        instance: Any,
        *,
        dry_run: bool,
        name: str,
    ) -> None:
        if not isinstance(instance, Mapping):
            report.failed += 1
            report.errors.append(f"malformed fired-alert instance for {name}")
            return
        report.found += 1
        try:
            alert, error = await self._normalize(
                catalog,
                instance,
                require_legacy_identity=self.legacy_mode,
            )
            if error:
                if dry_run:
                    report.quarantined += 1
                elif self.store.quarantine_exists(alert):
                    report.skipped += 1
                elif self.store.insert_quarantine(alert, error):
                    report.quarantined += 1
                return
            if not self.legacy_mode:
                reconcile = getattr(self.store, "reconcile_polled_alert", None)
                if reconcile is None:
                    report.quarantined += 1
                    report.errors.append("polling reconciliation is unavailable; no event was created")
                else:
                    deployment = str(
                        getattr(self.client, "deployment_identity", "")
                        or getattr(self.client, "config", {}).get("splunk_deployment_id", "")
                        or "splunk-default"
                    )
                    status = await asyncio.to_thread(reconcile, deployment, alert)
                    if status == "missing":
                        report.quarantined += 1
                    else:
                        report.skipped += 1
                return
            mapping = self.store.resolve(alert.event_gid or "", alert.event_rulenum or "")
            if mapping is None:
                reason = "Event_GID/Event_Rulenum did not resolve to one active customer/ruleset."
                if dry_run:
                    report.quarantined += 1
                elif self.store.quarantine_exists(alert):
                    report.skipped += 1
                elif self.store.insert_quarantine(alert, reason):
                    report.quarantined += 1
                return
            if dry_run:
                if self.store.event_exists(alert):
                    report.skipped += 1
                else:
                    report.would_insert += 1
            elif self.store.insert_event(alert, *mapping):
                report.inserted += 1
            else:
                report.skipped += 1
        except Exception as exc:  # keep one bad alert from losing the batch
            report.failed += 1
            report.errors.append(str(exc)[:240])

    async def retry_quarantined(self, *, limit: int = 100) -> IngestReport:
        """Retry only persisted mapping failures after catalog data changes."""
        report = IngestReport()
        list_rows = getattr(self.store, "list_unresolved_quarantine", None)
        if list_rows is None:
            return report
        rows = list_rows(limit)
        for row in rows:
            quarantine_id = _text(row.get("id"), limit=128)
            event_data = row.get("event_data")
            if isinstance(event_data, str):
                try:
                    event_data = json.loads(event_data)
                except (TypeError, ValueError):
                    event_data = {}
            if not isinstance(event_data, Mapping):
                event_data = {}
            alert = NormalizedAlert(
                splunk_sid=_text(row.get("splunk_sid"), limit=1_024),
                alert_name=_text(row.get("alert_name")),
                trigger_time=_timestamp(row.get("trigger_time")),
                result_count=_count(row.get("result_count")),
                severity=_severity(event_data.get("severity")),
                event_gid=_text(row.get("event_gid"), limit=128),
                event_rulenum=_text(row.get("event_rulenum"), limit=128),
                event_data=dict(event_data),
                dedup_key=_text(row.get("dedup_key"), limit=2_000) or "",
            )
            if not quarantine_id:
                continue
            try:
                mapping = self.store.resolve(alert.event_gid or "", alert.event_rulenum or "")
                if mapping is None:
                    self.store.touch_quarantine_attempt(quarantine_id)
                    continue
                report.found += 1
                inserted = self.store.insert_event(alert, *mapping)
                if inserted:
                    report.inserted += 1
                else:
                    report.skipped += 1
                self.store.resolve_quarantine(quarantine_id, alert)
            except Exception as exc:
                report.failed += 1
                report.errors.append(str(exc)[:240])
        return report


class AlertIngestionWorker:
    """One non-overlapping, read-only polling loop owned by the backend."""

    def __init__(
        self,
        client: OfficialSplunkMCPClient,
        store: AlertIngestionStore,
        *,
        interval_seconds: int = 60,
        limit: int = 100,
        max_backoff_seconds: int = 300,
    ) -> None:
        self.client = client
        self.store = store
        self.interval_seconds = max(1, int(interval_seconds))
        self.limit = max(1, min(int(limit), 201))
        self.max_backoff_seconds = max(self.interval_seconds, int(max_backoff_seconds))
        self.worker_id = f"{os.getpid()}-{uuid.uuid4().hex[:12]}"
        self._stop = asyncio.Event()
        self._task: asyncio.Task | None = None
        self._status: dict[str, Any] = {
            "enabled": True,
            "running": False,
            "lock_acquired": False,
            "worker_id": self.worker_id,
            "interval_seconds": self.interval_seconds,
            "limit": self.limit,
            "last_started_at": None,
            "last_completed_at": None,
            "last_error": None,
            "last_report": IngestReport().to_dict(),
        }

    @classmethod
    def from_settings(cls, settings: ServerSettings) -> "AlertIngestionWorker | None":
        store = AlertIngestionStore.from_env()
        if store is None:
            LOGGER.warning("Alert ingestion is enabled but APP_POSTGRES_URI is not configured.")
            return None
        return cls(
            OfficialSplunkMCPClient(settings.splunk.client_config()),
            store,
            interval_seconds=settings.alert_ingest_interval_seconds,
            limit=settings.alert_ingest_limit,
            max_backoff_seconds=settings.alert_ingest_max_backoff_seconds,
        )

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._stop.clear()
            self._task = asyncio.create_task(self._run(), name="soc-alert-ingestion")

    async def stop(self) -> None:
        self._stop.set()
        task = self._task
        if task is not None:
            try:
                if not task.done():
                    await asyncio.wait_for(task, timeout=10)
                else:
                    task.result()
            except asyncio.TimeoutError:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            except asyncio.CancelledError:
                pass
            except Exception as exc:
                LOGGER.warning("Alert ingestion worker stopped after an error: %s", str(exc)[:240])
        await self.client.disconnect()
        self.store.close()

    def status(self) -> dict[str, Any]:
        return {
            **self._status,
            "last_report": dict(self._status["last_report"]),
        }

    async def _wait(self, seconds: int) -> bool:
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=max(0, seconds))
        except asyncio.TimeoutError:
            return False
        return True

    async def _store_call(self, method: str, *args: Any) -> None:
        try:
            await asyncio.to_thread(getattr(self.store, method), *args)
        except Exception as exc:  # status persistence must not stop ingestion
            LOGGER.warning("Alert ingestion status update failed: %s", str(exc)[:240])

    async def _run(self) -> None:
        self._status["running"] = True
        try:
            try:
                acquired = await asyncio.to_thread(self.store.acquire_worker_lock)
            except Exception as exc:
                self._status["last_error"] = str(exc)[:500]
                LOGGER.warning("Alert ingestion worker could not acquire its lock: %s", str(exc)[:240])
                return
            self._status["lock_acquired"] = acquired
            if not acquired:
                LOGGER.info("Alert ingestion worker is already running elsewhere.")
                return

            delay = 0
            backoff = self.interval_seconds
            while not self._stop.is_set():
                if delay and await self._wait(delay):
                    break
                started = datetime.now(timezone.utc)
                self._status["last_started_at"] = started.isoformat()
                await self._store_call("record_cycle_started", self.worker_id)
                try:
                    if getattr(self.client, "_session", None) is None and getattr(self.client, "_client", None) is None:
                        await self.client.connect()
                    service = AlertIngestionService(self.client, self.store)
                    await service.discover_alerts(limit=self.limit)
                    report = await service.ingest(limit=self.limit)
                    if service.legacy_mode:
                        report.merge(await service.retry_quarantined(limit=self.limit))
                    self._status["last_report"] = report.to_dict()
                    self._status["last_completed_at"] = datetime.now(timezone.utc).isoformat()
                    self._status["last_error"] = report.errors[0] if report.errors else None
                    await self._store_call("record_cycle_completed", self.worker_id, report)
                    if report.errors:
                        await self._store_call("record_cycle_error", self.worker_id, report.errors[0])
                    if report.retryable:
                        await self.client.disconnect()
                        delay = backoff
                        backoff = min(self.max_backoff_seconds, max(self.interval_seconds, backoff * 2))
                    else:
                        delay = self.interval_seconds
                        backoff = self.interval_seconds
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    error = str(exc)[:500]
                    self._status["last_error"] = error
                    await self._store_call("record_cycle_error", self.worker_id, error)
                    LOGGER.warning("Alert ingestion cycle failed: %s", error)
                    await self.client.disconnect()
                    delay = backoff
                    backoff = min(self.max_backoff_seconds, max(self.interval_seconds, backoff * 2))
        finally:
            self._status["running"] = False



async def _run(args: argparse.Namespace) -> int:
    load_server_env()
    settings = ServerSettings.from_env()
    store = AlertIngestionStore.from_env()
    if store is None:
        raise SystemExit("APP_POSTGRES_URI is required for alert ingestion.")
    client = OfficialSplunkMCPClient(settings.splunk.client_config())
    try:
        await client.connect()
        print("[OK] Connected to Splunk")
        report = await AlertIngestionService(client, store).ingest(
            limit=args.limit,
            dry_run=args.dry_run,
        )
        print(f"[FOUND] {report.found} triggered alerts")
        if args.dry_run:
            print(f"[WOULD INSERT] {report.would_insert} new sec_events")
        else:
            print(f"[INSERTED] {report.inserted} new sec_events")
        print(f"[SKIPPED] {report.skipped} already recorded")
        print(f"[QUARANTINED] {report.quarantined} alerts")
        print(f"[FAILED] {report.failed} alerts")
        return 1 if report.failed else 0
    finally:
        await client.disconnect()
        store.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest current Splunk fired alerts into PostgreSQL.")
    parser.add_argument("--limit", type=int, default=100, help="maximum catalog/instance page size")
    parser.add_argument("--dry-run", action="store_true", help="resolve and report without PostgreSQL writes")
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be positive")
    raise SystemExit(asyncio.run(_run(args)))


__all__ = [
    "AlertIngestionService",
    "AlertIngestionStore",
    "AlertIngestionWorker",
    "IngestReport",
    "NormalizedAlert",
    "main",
]


if __name__ == "__main__":
    main()
