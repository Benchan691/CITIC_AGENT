"""Read-only Splunk MCP fired-alert ingestion into PostgreSQL.

The Splunk side of this module only calls the official fired-alert catalog and
detail tools. PostgreSQL receives alert metadata after the required
``Event_GID``/``Event_Rulenum`` contract resolves to one active
customer/ruleset pair; everything else is retained in the quarantine table for
operator review.

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
from .postgres_store import PostgresBootstrap, create_connection_pool
from .splunk.official_mcp_client import OfficialSplunkMCPClient

try:
    import psycopg
except ImportError:  # pragma: no cover - optional runtime guard
    psycopg = None  # type: ignore[assignment]


LOGGER = logging.getLogger(__name__)
ALLOWED_SEVERITIES = {"info", "low", "medium", "high", "critical"}
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
                    WHERE splunk_sid IS NOT NULL
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
                    json.dumps(alert.event_data, separators=(",", ":")),
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

    def list_unresolved_quarantine(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id::text, dedup_key, splunk_sid, alert_name, trigger_time, result_count,
                       event_gid, event_rulenum, event_data, reason
                FROM sec_event_quarantine
                WHERE resolved_at IS NULL
                ORDER BY created_at, id
                LIMIT %s
                """,
                (max(1, min(int(limit), 1_000)),),
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

    def __init__(self, client: Any, store: AlertIngestionStore, *, max_pages: int = 100) -> None:
        self.client = client
        self.store = store
        self.max_pages = max(1, int(max_pages))

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

    async def _normalize(self, catalog: Mapping[str, Any], instance: Mapping[str, Any]) -> tuple[NormalizedAlert, str | None]:
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
            alert, error = await self._normalize(catalog, instance)
            if error:
                if dry_run:
                    report.quarantined += 1
                elif self.store.quarantine_exists(alert):
                    report.skipped += 1
                elif self.store.insert_quarantine(alert, error):
                    report.quarantined += 1
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
                    if getattr(self.client, "_client", None) is None:
                        await self.client.connect()
                    service = AlertIngestionService(self.client, self.store)
                    report = await service.ingest(limit=self.limit)
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
