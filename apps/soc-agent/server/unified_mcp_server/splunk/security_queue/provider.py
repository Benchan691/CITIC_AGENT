"""Provider contract and shared normalization helpers for the security queue."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
import re
from typing import Any, Protocol

from unified_mcp_server.errors import ServiceError

from .model import (
    FindingFilters,
    FindingPage,
    FindingSummary,
    OpaqueIdCodec,
    QueueCapabilities,
    normalize_array,
    normalize_disposition,
    normalize_severity,
    normalize_status,
    normalize_urgency,
)


class FindingProvider(Protocol):
    source: str

    async def capabilities(self) -> QueueCapabilities:
        ...

    async def list_findings(self, filters: FindingFilters) -> FindingPage:
        ...

    async def get_finding(self, reference: Mapping[str, Any]) -> dict[str, Any]:
        ...

    async def get_investigation(self, reference: Mapping[str, Any]) -> dict[str, Any]:
        ...


def first_value(value: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in value and value[key] not in (None, ""):
            return value[key]
    return None


def nested_value(value: Mapping[str, Any], *paths: tuple[str, ...]) -> Any:
    for path in paths:
        current: Any = value
        for key in path:
            if not isinstance(current, Mapping):
                current = None
                break
            current = current.get(key)
        if current not in (None, ""):
            return current
    return None


def entry_content(entry: Mapping[str, Any]) -> dict[str, Any]:
    content = entry.get("content")
    if isinstance(content, Mapping):
        # Splunk entry envelopes sometimes carry identifiers or ACL fields
        # outside ``content``. Preserve those fields while flattening the
        # response for provider normalization.
        result = {key: value for key, value in entry.items() if key != "content"}
        result.update(content)
        return result
    return dict(entry)


def text_value(value: Any, *, limit: int = 2_000) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, Mapping):
        value = first_value(value, "name", "username", "display_name", "label", "status", "value", "id")
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:limit]


def count_value(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def normalize_timestamp(value: Any) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        if isinstance(value, (int, float)):
            timestamp = float(value)
            if abs(timestamp) > 100_000_000_000:
                timestamp /= 1_000
            return datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace("+00:00", "Z")
        text = str(value).strip()
        if not text:
            return None
        if re.fullmatch(r"\d+(?:\.\d+)?", text):
            timestamp = float(text)
            if abs(timestamp) > 100_000_000_000:
                timestamp /= 1_000
            return datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace("+00:00", "Z")
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, OverflowError):
        return None


def timestamp_value(value: Any) -> float | None:
    normalized = normalize_timestamp(value)
    if normalized is None:
        return None
    try:
        return datetime.fromisoformat(normalized.replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError, OverflowError):
        return None


def time_bound(value: str, *, now: datetime | None = None) -> float | None:
    """Parse common absolute and relative Splunk time arguments for local filters."""
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    current = now or datetime.now(timezone.utc)
    if raw in {"now", "latest"}:
        return current.timestamp()
    if raw in {"@d", "today"}:
        return current.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    relative = re.fullmatch(r"-(\d+)([smhdw])(?:@[smhdw])?", raw)
    if relative:
        amount, unit = int(relative.group(1)), relative.group(2)
        seconds = amount * {"s": 1, "m": 60, "h": 3_600, "d": 86_400, "w": 604_800}[unit]
        return (current - timedelta(seconds=seconds)).timestamp()
    return timestamp_value(raw)


def values_for(raw: Mapping[str, Any], *keys: str) -> list[Any]:
    value = first_value(raw, *keys)
    return normalize_array(value)


def owner_value(raw: Mapping[str, Any]) -> str | None:
    return text_value(
        first_value(raw, "owner", "assignee", "assigned_to")
        or nested_value(raw, ("acl", "owner"), ("assignment", "owner"))
    )


def mitre_values(raw: Mapping[str, Any]) -> list[Any]:
    value = first_value(raw, "mitre_attack", "mitreAttack", "mitre")
    if value is None:
        annotations = raw.get("annotations")
        if isinstance(annotations, Mapping):
            value = first_value(annotations, "mitre_attack", "mitreAttack", "mitre", "attack")
        elif annotations is not None:
            value = annotations
    return normalize_array(value)


def common_summary(
    *,
    provider: str,
    source_type: str,
    synthetic: bool,
    codec: OpaqueIdCodec,
    raw: Mapping[str, Any],
    reference: Mapping[str, Any],
    finding_id: str | None = None,
    fallback_title: str | None = None,
    fallback_detection: str | None = None,
    fallback_owner: str | None = None,
    fallback_event_count: int | None = None,
) -> FindingSummary:
    raw_id = text_value(
        first_value(raw, "id", "finding_id", "findingId", "display_id", "displayId", "name"),
        limit=1_024,
    )
    title = text_value(first_value(raw, "title", "name", "finding_title", "findingTitle", "description")) or fallback_title or raw_id
    detection = text_value(
        first_value(raw, "detection_name", "detectionName", "analytic_name", "analyticName", "savedsearch_name", "search_name")
    ) or fallback_detection
    raw_status = first_value(raw, "status", "state")
    raw_type = text_value(first_value(raw, "type", "finding_type"), limit=64)
    normalized_type = raw_type.casefold().replace(" ", "_") if raw_type else ""
    event_count = count_value(
        first_value(
            raw,
            "event_count",
            "eventCount",
            "risk_event_count",
            "riskEventCount",
            "contributing_event_count",
            "total_event_count",
            "triggered_alert_count",
            "triggered_alerts",
        )
    )
    return FindingSummary(
        finding_id=finding_id or codec.encode(provider, "finding", {**reference, "id": raw_id or ""}),
        source=provider,
        source_type=source_type,
        synthetic=synthetic,
        type=normalized_type if normalized_type in {"finding", "finding_group", "investigation"} else (
            "finding_group" if raw.get("is_finding_group") is True else "finding"
        ),
        title=title,
        detection_name=detection,
        trigger_time=normalize_timestamp(
            first_value(raw, "trigger_time", "triggerTime", "event_time", "eventTime", "created_time", "createdTime", "_time")
        ),
        severity=normalize_severity(first_value(raw, "severity", "priority")),
        urgency=normalize_urgency(first_value(raw, "urgency")),
        status=normalize_status(raw_status),
        owner=owner_value(raw) or fallback_owner,
        disposition=normalize_disposition(first_value(raw, "disposition")),
        entities=values_for(raw, "entities", "entity", "affected_entities", "affectedEntities"),
        risk_objects=values_for(raw, "risk_objects", "riskObjects", "threat_objects", "threatObjects", "risk_object"),
        mitre_attack=mitre_values(raw),
        supporting_sid=text_value(first_value(raw, "supporting_sid", "supportingSid", "sid", "search_id", "searchId"), limit=1_024),
        event_count=event_count if event_count is not None else fallback_event_count,
        source_status=text_value(raw_status),
    )


def matches_filters(summary: FindingSummary, filters: FindingFilters) -> bool:
    if filters.status and summary.status != filters.status:
        return False
    if filters.urgency and summary.urgency != filters.urgency:
        return False
    if filters.owner and filters.owner.casefold() not in (summary.owner or "").casefold():
        return False
    if filters.detection and filters.detection.casefold() not in (summary.detection_name or "").casefold():
        return False
    trigger = timestamp_value(summary.trigger_time)
    earliest = time_bound(filters.earliest_time)
    latest = time_bound(filters.latest_time)
    if trigger is not None and earliest is not None and trigger < earliest:
        return False
    if trigger is not None and latest is not None and trigger > latest:
        return False
    return True


def sort_findings(findings: list[FindingSummary]) -> list[FindingSummary]:
    ranks = {"informational": 0, "low": 1, "medium": 2, "high": 3, "critical": 4, "unknown": -1}
    return sorted(
        findings,
        key=lambda item: (ranks.get(item.urgency or "unknown", -1), timestamp_value(item.trigger_time) or 0),
        reverse=True,
    )


def decode_offset(codec: OpaqueIdCodec, provider: str, cursor: str) -> int:
    if not cursor:
        return 0
    try:
        values = codec.decode(cursor, provider=provider, kind="cursor")
        offset = values.get("offset")
        if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
            raise ValueError
        return offset
    except ValueError as exc:
        raise ServiceError("invalid_input", "cursor is invalid or expired.") from exc


def encode_offset(codec: OpaqueIdCodec, provider: str, offset: int, **extra: Any) -> str:
    return codec.encode(provider, "cursor", {"offset": max(0, int(offset)), **extra})


def bounded_detail(
    summary: FindingSummary,
    raw: Mapping[str, Any],
    *,
    source_metadata: Mapping[str, Any] | None = None,
    evidence: Mapping[str, Any] | None = None,
    detection: Any = None,
    timeline: Any = None,
    notes: Any = None,
) -> dict[str, Any]:
    """Build a provider-neutral detail record from selected, bounded fields."""
    result: dict[str, Any] = {
        "finding": summary.to_dict(),
        "detection": detection,
        "entities": list(summary.entities),
        "risk_objects": list(summary.risk_objects),
        "mitre_attack": list(summary.mitre_attack),
        "supporting_sid": summary.supporting_sid,
        "event_count": summary.event_count,
        "evidence": dict(evidence or {}),
        "source_metadata": dict(source_metadata or {}),
    }
    if timeline is not None:
        result["timeline"] = normalize_array(timeline)
    if notes is not None:
        result["notes"] = normalize_array(notes)
    return result
