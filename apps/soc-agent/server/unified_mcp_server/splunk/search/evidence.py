"""Process-lifetime retention and coalescing of completed search evidence.

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
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from time import monotonic
from typing import Any, Awaitable, Callable

from unified_mcp_server.errors import ServiceError


def fingerprint_request(
    *,
    query: str,
    earliest_time: str,
    latest_time: str,
    max_count: int,
    fields: list[str] | None,
    principal_id: str | None,
) -> str:
    """Stable identity of one exact search request within this process."""
    encoded = json.dumps(
        [query, earliest_time, latest_time, int(max_count), list(fields or []), principal_id or ""],
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

    def summary(self, *, reused: bool = False) -> dict[str, Any]:
        return {
            "id": self.evidence_id,
            "reused": reused,
            "retrieved_at": self.retrieved_at,
            "age_seconds": round(max(0.0, monotonic() - self.created_monotonic), 3),
            "result_count": len(self.events),
            "columns": list(self.columns),
            "checksum": self.checksum,
            "query": self.query,
        }


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
    ) -> None:
        self.max_records = max(1, int(max_records))
        self.max_total_bytes = max(1, int(max_total_bytes))
        self.reuse_ttl_seconds = max(0, int(reuse_ttl_seconds))
        self._records: OrderedDict[str, EvidenceRecord] = OrderedDict()
        self._latest_by_fingerprint: dict[str, str] = {}
        self._in_flight: dict[str, asyncio.Future] = {}
        self._lock = asyncio.Lock()
        self._total_bytes = 0

    def stats(self) -> dict[str, Any]:
        return {
            "records": len(self._records),
            "approximate_bytes": self._total_bytes,
            "in_flight": len(self._in_flight),
            "reuse_ttl_seconds": self.reuse_ttl_seconds,
        }

    def get_record(self, evidence_id: str) -> EvidenceRecord:
        record = self._records.get(str(evidence_id or ""))
        if record is None:
            raise ServiceError(
                "evidence_not_found",
                "The requested evidence snapshot is no longer retained; rerun the search.",
                details={"evidence_id": str(evidence_id or "")},
            )
        self._records.move_to_end(record.evidence_id)
        return record

    def get_latest(self, fingerprint: str) -> EvidenceRecord | None:
        """Latest retained record for a fingerprint, or None once evicted."""
        evidence_id = self._latest_by_fingerprint.get(fingerprint)
        if evidence_id is None:
            return None
        return self._records.get(evidence_id)

    def read_page(self, evidence_id: str, *, offset: int = 0, limit: int = 50) -> dict[str, Any]:
        record = self.get_record(evidence_id)
        offset = max(0, int(offset))
        limit = max(1, min(int(limit), 200))
        page = record.events[offset : offset + limit]
        return {
            "evidence": record.summary(),
            "offset": offset,
            "returned_count": len(page),
            "total_count": len(record.events),
            "result_type": record.result_type,
            "columns": list(record.columns),
            "rows": page,
            "complete": offset + len(page) >= len(record.events),
        }

    async def execute_coalesced(
        self,
        fingerprint: str,
        runner: Callable[[], Awaitable[dict[str, Any]]],
    ) -> tuple[dict[str, Any], EvidenceRecord | None, bool]:
        """Run one search, reusing a fresh snapshot or an in-flight twin.

        Returns ``(execution, reused_record, coalesced)``. ``reused_record`` is
        set when a completed snapshot satisfied the request; ``coalesced`` is
        set when the caller joined an identical in-flight dispatch instead of
        issuing its own.
        """
        async with self._lock:
            record = self._latest_by_fingerprint.get(fingerprint)
            if record is not None:
                existing = self._records.get(record)
                if (
                    existing is not None
                    and self.reuse_ttl_seconds > 0
                    and monotonic() - existing.created_monotonic <= self.reuse_ttl_seconds
                ):
                    self._records.move_to_end(existing.evidence_id)
                    return existing.execution, existing, False
            future = self._in_flight.get(fingerprint)
            if future is None:
                future = asyncio.get_running_loop().create_future()
                self._in_flight[fingerprint] = future
                owner = True
            else:
                owner = False
        if not owner:
            try:
                execution, record = await future
            except BaseException:
                raise
            return execution, record, True
        try:
            execution = await runner()
        except Exception as exc:
            future.set_exception(exc)
            raise
        except BaseException:
            future.cancel()
            raise
        finally:
            async with self._lock:
                self._in_flight.pop(fingerprint, None)
        record = self._store(fingerprint, execution)
        future.set_result((execution, record))
        return execution, None, False

    def _store(self, fingerprint: str, execution: dict[str, Any]) -> EvidenceRecord:
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
        )
        record.checksum = evidence_checksum(record.events)
        record.approximate_bytes = len(json.dumps(record.events, separators=(",", ":"), ensure_ascii=True).encode())
        record.execution = execution
        self._records[record.evidence_id] = record
        self._total_bytes += record.approximate_bytes
        self._latest_by_fingerprint[fingerprint] = record.evidence_id
        self._prune()
        return record

    def _prune(self) -> None:
        while len(self._records) > self.max_records or (
            self._total_bytes > self.max_total_bytes and len(self._records) > 1
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
