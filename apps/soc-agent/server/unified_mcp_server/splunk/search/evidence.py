"""Bounded retention and coalescing of completed investigation evidence.

Repeated evidence reads must not re-dispatch provider work: identical search
requests reuse the retained snapshot within a bounded TTL unless explicitly
refreshed, identical in-flight searches share one dispatch, and every retained
snapshot stays readable in pages through ``soc_evidence_read``. Retention is
bounded by record count and total bytes with oldest-first eviction; snapshots
are timestamped so a caller can always judge staleness.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import sqlite3
import re
from threading import RLock
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field, fields as dataclass_fields
from datetime import datetime, timezone
from time import monotonic, time
from typing import Any, Awaitable, Callable

from unified_mcp_server.errors import ServiceError
from unified_mcp_server.request_context import operation_context
from .evidence_store import EvidenceStore

logger = logging.getLogger(__name__)


def resolve_time_window(earliest: str, latest: str) -> tuple[str, str, bool]:
    """Resolve plain offsets once at dispatch; leave Splunk calendar snaps intact.

    Calendar snaps depend on the provider timezone and are never guessed here.
    Such requests can still run, but completed-snapshot reuse is disabled.
    """
    now = operation_context.get().scheduled_at or time()
    def resolve(value):
        if value == "now":
            return f"{now:.6f}", True
        match = re.fullmatch(r"([+-]?\d+)(s|m|h|d|w)", value)
        if match:
            seconds = int(match[1]) * {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}[match[2]]
            return f"{now + seconds:.6f}", True
        if re.fullmatch(r"\d+(?:\.\d+)?", value):
            return value, True
        return value, False
    start, a = resolve(earliest)
    end, b = resolve(latest)
    return start, end, a and b


def fingerprint_request(
    *,
    query: str,
    earliest_time: str,
    latest_time: str,
    max_count: int,
    fields: list[str] | None,
    principal_id: str | None,
) -> str:
    """Stable identity of one exact request in its host-resolved scope."""
    encoded = json.dumps(
        [query, earliest_time, latest_time, int(max_count), list(fields or []), principal_id or "",
         operation_context.get().evidence_scope, operation_context.get().config_revision],
        separators=(",", ":"),
        sort_keys=True,
        ensure_ascii=True,
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def evidence_checksum(rows: list[dict[str, Any]]) -> str:
    encoded = json.dumps(rows, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    return hashlib.sha256(encoded).hexdigest()


@dataclass
class EvidenceRecord:
    evidence_id: str
    fingerprint: str
    created_monotonic: float
    retrieved_at: str
    query: str
    earliest_time: str
    latest_time: str
    fields: list[str]
    result_type: str
    events: list[dict[str, Any]]
    columns: list[str]
    metadata: dict[str, Any]
    approximate_bytes: int = 0
    checksum: str = field(default="")
    execution: dict[str, Any] = field(default_factory=dict)
    scope: str = ""
    created_at: float = field(default_factory=time)
    durable: bool = False

    def snapshot(self) -> dict[str, Any]:
        # Retained rows already live in events; do not serialize them twice.
        return {
            **{item.name: getattr(self, item.name) for item in dataclass_fields(self)},
            "execution": {key: value for key, value in self.execution.items() if key != "retained_events"},
        }

    def summary(self, *, reused: bool = False) -> dict[str, Any]:
        return {
            "id": self.evidence_id,
            "reused": reused,
            "retrieved_at": self.retrieved_at,
            "age_seconds": round(max(0.0, time() - self.created_at), 3),
            "result_count": len(self.events),
            "columns": list(self.columns),
            "checksum": self.checksum,
            "query": self.query[:4096],
            "query_truncated": len(self.query) > 4096,
            "earliest_time": self.earliest_time,
            "latest_time": self.latest_time,
            "durable": self.durable,
            "source_complete": self.metadata.get("splunk_result_truncated") is False,
        }


@dataclass
class _Flight:
    task: asyncio.Task
    readers: int = 0


class SearchEvidenceCoordinator:
    """Retain, coalesce, and page completed ad-hoc search executions.

    ``reuse_ttl_seconds`` bounds snapshot reuse; ``0`` disables reuse so every
    identical request dispatches fresh.
    """

    def __init__(
        self,
        *,
        max_records: int = 32,
        max_total_bytes: int = 64_000_000,
        reuse_ttl_seconds: int = 300,
        store_path: str = "",
    ) -> None:
        self.max_records = max(1, int(max_records))
        self.max_total_bytes = max(1, int(max_total_bytes))
        self.reuse_ttl_seconds = max(0, int(reuse_ttl_seconds))
        self._records: OrderedDict[str, EvidenceRecord] = OrderedDict()
        self._latest_by_fingerprint: dict[str, str] = {}
        self._in_flight: dict[str, _Flight] = {}
        self._lock = asyncio.Lock()
        self._total_bytes = 0
        self._cache_lock = RLock()
        self._store_backend = EvidenceStore(store_path, max_records=self.max_records, max_bytes=self.max_total_bytes) if store_path else None

    def stats(self) -> dict[str, Any]:
        return {
            "records": len(self._records),
            "approximate_bytes": self._total_bytes,
            "in_flight": len(self._in_flight),
            "reuse_ttl_seconds": self.reuse_ttl_seconds,
        }

    def get_record(self, evidence_id: str) -> EvidenceRecord:
        with self._cache_lock:
            record = self._records.get(str(evidence_id or ""))
        scope = operation_context.get().evidence_scope
        if record is None and self._store_backend:
            stored = self._store_backend.get(scope, str(evidence_id or ""))
            if stored:
                record = self._restore(stored)
        if record is None or record.scope != scope:
            raise ServiceError(
                "evidence_not_found",
                "The requested evidence snapshot is no longer retained; rerun the search.",
                details={"evidence_id": str(evidence_id or "")},
            )
        with self._cache_lock:
            if record.evidence_id in self._records:
                self._records.move_to_end(record.evidence_id)
        return record

    def get_latest(self, fingerprint: str) -> EvidenceRecord | None:
        """Latest retained record for a fingerprint, or None once evicted."""
        with self._cache_lock:
            evidence_id = self._latest_by_fingerprint.get(fingerprint)
            record = self._records.get(evidence_id) if evidence_id else None
            return record if record is not None and record.scope == operation_context.get().evidence_scope else None

    def read_page(self, evidence_id: str, *, offset: int = 0, limit: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        record = self.get_record(evidence_id)
        offset = max(0, int(offset))
        limit = max(1, min(int(limit), 200))
        page = record.events[offset : offset + limit]
        if fields:
            page = [{key: row[key] for key in fields if key in row} for row in page]
        response = {
            "evidence": record.summary(),
            "offset": offset,
            "returned_count": len(page),
            "total_count": len(record.events),
            "result_type": record.result_type,
            "columns": list(fields or record.columns),
            "rows": page,
            "complete": offset + len(page) >= len(record.events),
            "source_metadata": record.metadata,
            "next_offset": None if offset + len(page) >= len(record.events) else offset + len(page),
        }
        while page and len(json.dumps(response, ensure_ascii=True).encode()) > 24_000:
            page.pop()
            response.update(returned_count=len(page), complete=False, next_offset=offset + len(page))
        if (offset < len(record.events) and not page) or len(json.dumps(response, ensure_ascii=True).encode()) > 24_000:
            raise ServiceError("evidence_page_too_large", "Select fewer fields to read this evidence within the response limit.")
        return response

    async def execute_coalesced(
        self,
        fingerprint: str,
        runner: Callable[[], Awaitable[dict[str, Any]]],
        *,
        fresh: bool = False,
    ) -> tuple[dict[str, Any], EvidenceRecord | None, bool]:
        """Run one search, reusing a fresh snapshot or an in-flight twin.

        Returns ``(execution, reused_record, coalesced)``. ``reused_record`` is
        set when a completed snapshot satisfied the request; ``coalesced`` is
        set when the caller joined an identical in-flight dispatch instead of
        issuing its own.
        """
        async with self._lock:
            existing = None if fresh else self.get_latest(fingerprint)
            if not fresh and self._store_backend and existing is None:
                try:
                    stored = await asyncio.to_thread(self._store_backend.latest, operation_context.get().evidence_scope, fingerprint)
                except (OSError, sqlite3.Error):
                    stored = None
                    logger.warning("Evidence reuse unavailable; dispatching a new search.")
                if stored:
                    existing = self._restore(stored)
            if existing is not None and self.reuse_ttl_seconds > 0 and time() - existing.created_at <= self.reuse_ttl_seconds:
                with self._cache_lock:
                    if existing.evidence_id in self._records:
                        self._records.move_to_end(existing.evidence_id)
                return existing.execution, existing, False
            flight_key = f"{fingerprint}:{uuid.uuid4().hex}" if fresh else fingerprint
            flight = self._in_flight.get(flight_key)
            if flight is None:
                async def run():
                    execution = await runner()
                    record = await asyncio.to_thread(self._store, fingerprint, execution)
                    if record is not None and self._store_backend:
                        try:
                            record.durable = await asyncio.to_thread(self._store_backend.put, {**record.snapshot(), "durable": True})
                        except (OSError, sqlite3.Error):
                            record.durable = False
                            logger.warning("Evidence persistence failed; snapshot remains available in memory.")
                    return execution, record

                flight = _Flight(asyncio.create_task(run()))
                self._in_flight[flight_key] = flight
                owner = True
            else:
                owner = False
            flight.readers += 1
        try:
            # Every reader, including the first, owns only its wait. The shared
            # provider job remains alive until all readers have left.
            execution, record = await asyncio.shield(flight.task)
            return execution, None if owner else record, not owner
        finally:
            async with self._lock:
                flight.readers -= 1
                last_reader = flight.readers == 0
                if last_reader:
                    self._in_flight.pop(flight_key, None)
                    if not flight.task.done():
                        flight.task.cancel()
            if last_reader:
                # Drain cancellation so backend admission slots and search jobs
                # are released before reporting this operation finished.
                await asyncio.gather(flight.task, return_exceptions=True)

    def _store(self, fingerprint: str, execution: dict[str, Any]) -> EvidenceRecord | None:
        events = execution.get("retained_events")
        if not isinstance(events, list):
            events = execution.get("events") or []
        record = EvidenceRecord(
            evidence_id=uuid.uuid4().hex,
            fingerprint=fingerprint,
            created_monotonic=monotonic(),
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            query=str(execution.get("validation", {}).get("query", "")),
            earliest_time=str(execution.get("earliest_time", "")),
            latest_time=str(execution.get("latest_time", "")),
            fields=list(execution.get("fields") or []),
            result_type=str(execution.get("result_type", "events")),
            events=list(events),
            columns=list(execution.get("columns") or []),
            metadata=dict(execution.get("search_metadata") or {}),
            scope=operation_context.get().evidence_scope,
        )
        record.checksum = evidence_checksum(record.events)
        execution["_evidence_id"] = record.evidence_id
        record.execution = execution
        record.approximate_bytes = len(json.dumps(record.snapshot(), separators=(",", ":"), ensure_ascii=True).encode()) + 64
        if record.approximate_bytes > self.max_total_bytes:
            return None
        self._remember(record)
        return record

    def _restore(self, stored: dict[str, Any]) -> EvidenceRecord:
        record = EvidenceRecord(**stored)
        record.execution["retained_events"] = record.events
        record.created_monotonic = monotonic() - max(0, time() - record.created_at)
        self._remember(record)
        return record

    def _remember(self, record: EvidenceRecord) -> None:
        with self._cache_lock:
            previous = self._records.get(record.evidence_id)
            if previous:
                self._total_bytes -= previous.approximate_bytes
            self._records[record.evidence_id] = record
            self._total_bytes += record.approximate_bytes
            latest_id = self._latest_by_fingerprint.get(record.fingerprint)
            latest = self._records.get(latest_id) if latest_id else None
            if latest is None or latest.created_at <= record.created_at:
                self._latest_by_fingerprint[record.fingerprint] = record.evidence_id
            self._prune()

    def _prune(self) -> None:
        while len(self._records) > self.max_records or (
            self._total_bytes > self.max_total_bytes and self._records
        ):
            _, dropped = self._records.popitem(last=False)
            self._total_bytes = max(0, self._total_bytes - dropped.approximate_bytes)
            if self._latest_by_fingerprint.get(dropped.fingerprint) == dropped.evidence_id:
                self._latest_by_fingerprint.pop(dropped.fingerprint, None)


__all__ = [
    "EvidenceRecord",
    "SearchEvidenceCoordinator",
    "evidence_checksum",
    "fingerprint_request",
]
