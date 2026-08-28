"""Enterprise Security Mission Control provider."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from unified_mcp_server.errors import ServiceError
from ..core.service import SplunkCore
from ..search.executor import SearchExecutor

from .model import (
    FindingFilters,
    FindingPage,
    FindingSummary,
    OpaqueIdCodec,
    QueueCapabilities,
    normalize_array,
    normalize_disposition,
    normalize_status,
    normalize_urgency,
)
from .provider import (
    bounded_detail,
    common_summary,
    decode_offset,
    encode_offset,
    first_value,
    matches_filters,
    normalize_timestamp,
    sort_findings,
    text_value,
)


class EnterpriseSecurityProvider:
    source = "enterprise_security"
    source_type = "enterprise_security"

    def __init__(self, core: SplunkCore, codec: OpaqueIdCodec, executor: SearchExecutor | None = None) -> None:
        self.core = core
        self.codec = codec
        self.executor = executor

    async def capabilities(self) -> QueueCapabilities:
        return QueueCapabilities(
            source=self.source,
            native_findings=True,
            native_investigations=True,
            status=True,
            owner=True,
            urgency=True,
            disposition=True,
            persistent_history=True,
            history_complete=True,
            retention_limited=False,
        )

    @staticmethod
    def _payload(raw: Mapping[str, Any]) -> dict[str, Any]:
        result = dict(raw)
        for key in ("finding", "investigation", "attributes", "data"):
            nested = raw.get(key)
            if isinstance(nested, Mapping):
                merged = dict(nested)
                merged.update(result)
                result = merged
        content = result.get("content")
        if isinstance(content, Mapping):
            merged = dict(content)
            merged.update(result)
            result = merged
        for key in ("finding", "investigation", "attributes", "data"):
            nested = result.get(key)
            if isinstance(nested, Mapping):
                merged = dict(nested)
                merged.update(result)
                result = merged
        return result

    def _summary(self, raw: Mapping[str, Any]) -> FindingSummary:
        payload = self._payload(raw)
        raw_id = text_value(
            first_value(payload, "id", "finding_id", "findingId", "display_id", "displayId", "name"),
            limit=1_024,
        )
        if not raw_id:
            raise ServiceError("splunk_api_error", "Enterprise Security returned a finding without an identifier.")
        reference = {"id": raw_id}
        return common_summary(
            provider=self.source,
            source_type=self.source_type,
            synthetic=False,
            codec=self.codec,
            raw=payload,
            reference=reference,
            fallback_title=text_value(first_value(payload, "analytic_name", "detection_name")),
        )

    @staticmethod
    def _raw_ids(value: Any) -> list[str]:
        if isinstance(value, Mapping):
            nested = first_value(value, "items", "entry", "findings", "investigations", "results")
            value = nested if nested is not None else [value]
        values = value if isinstance(value, list) else [value]
        result: list[str] = []
        for item in values:
            if isinstance(item, Mapping):
                item = first_value(
                    item,
                    "id",
                    "finding_id",
                    "findingId",
                    "investigation_id",
                    "investigationId",
                    "display_id",
                    "displayId",
                    "name",
                )
            text = text_value(item, limit=1_024)
            if text and text not in result:
                result.append(text)
        return result

    def _opaque_ids(self, provider: str, kind: str, value: Any) -> list[str]:
        return [self.codec.encode(provider, kind, {"id": item}) for item in self._raw_ids(value)]

    @staticmethod
    def _records(value: Any) -> list[Any]:
        if isinstance(value, list):
            return value
        if isinstance(value, Mapping):
            nested = first_value(value, "items", "entry", "findings", "results")
            return nested if isinstance(nested, list) else [value]
        return [value] if value is not None else []

    async def list_findings(self, filters: FindingFilters) -> FindingPage:
        offset = decode_offset(self.codec, self.source, filters.cursor)
        page_size = min(filters.limit + 1, 201)
        raw_page = await self.core.request(
            lambda client: client.get_es_findings(
                limit=page_size,
                offset=offset,
                filters={
                    key: value
                    for key, value in {
                        "status": filters.status,
                        "urgency": filters.urgency,
                        "owner": filters.owner,
                        "detection": filters.detection,
                    }.items()
                    if value
                },
            )
        )
        if not isinstance(raw_page, Mapping):
            raise ServiceError("splunk_api_error", "Enterprise Security returned malformed findings.")
        raw_items = raw_page.get("items", [])
        if not isinstance(raw_items, list):
            raise ServiceError("splunk_api_error", "Enterprise Security returned malformed findings.")
        if any(not isinstance(item, Mapping) for item in raw_items):
            raise ServiceError("splunk_api_error", "Enterprise Security returned malformed findings.")
        findings = [self._summary(item) for item in raw_items]
        findings = sort_findings([item for item in findings if matches_filters(item, filters)])
        raw_next = raw_page.get("next_offset")
        total = raw_page.get("total")
        has_more = (
            len(raw_items) >= page_size
            or (isinstance(raw_next, int) and not isinstance(raw_next, bool))
            or (isinstance(total, int) and not isinstance(total, bool) and offset + len(raw_items) < total)
        )
        findings = findings[: filters.limit]
        next_cursor = None
        if has_more:
            next_offset = raw_next if isinstance(raw_next, int) and not isinstance(raw_next, bool) else offset + len(raw_items)
            if next_offset <= offset:
                next_offset = offset + max(1, len(raw_items))
            next_cursor = encode_offset(self.codec, self.source, next_offset)
        return FindingPage(
            findings,
            next_cursor,
            has_more,
            total if isinstance(total, int) and not isinstance(total, bool) else None,
        )

    async def _supporting_events(self, raw: Mapping[str, Any]) -> dict[str, Any]:
        value = first_value(raw, "contributing_events", "contributingEvents", "events", "event")
        raw_events = value if isinstance(value, list) else [value] if value is not None else []
        if any(not isinstance(item, Mapping) for item in raw_events):
            raise ServiceError("splunk_api_error", "Enterprise Security returned malformed contributing events.")
        events = list(raw_events)
        result: dict[str, Any] = {}
        if events:
            sanitized = self.core.sanitize(events[:50])
            if isinstance(sanitized, list) and all(isinstance(item, dict) for item in sanitized):
                bounded, budget = self.core.bound_events(sanitized)
                result["contributing_events"] = bounded
                result["event_budget"] = budget
            return result

        drilldown = text_value(first_value(raw, "drilldown_search", "drilldownSearch"), limit=20_000)
        if not drilldown or self.executor is None:
            return result
        earliest = text_value(first_value(raw, "drilldown_earliest", "drilldownEarliest")) or "-24h"
        latest = text_value(first_value(raw, "drilldown_latest", "drilldownLatest")) or "now"
        try:
            execution = await self.executor.execute(
                drilldown,
                earliest_time=earliest,
                latest_time=latest,
                limit=50,
                fields=None,
            )
        except ServiceError as exc:
            result["supporting_search_error"] = {"code": exc.code, "message": exc.message}
            return result
        result["contributing_events"] = execution["events"]
        result["event_budget"] = execution["event_budget"]
        result["search_metadata"] = execution["search_metadata"]
        return result

    async def get_finding(self, reference: Mapping[str, Any]) -> dict[str, Any]:
        raw_id = text_value(reference.get("id"), limit=1_024)
        if not raw_id:
            raise ServiceError("invalid_input", "finding_id is invalid.")
        try:
            raw = await self.core.request(lambda client: client.get_es_finding(raw_id))
        except ServiceError as exc:
            status = exc.details.get("status_code") if isinstance(exc.details, Mapping) else None
            if status == 404:
                raise ServiceError("not_found", "The Enterprise Security finding was not found.") from exc
            raise
        payload = self._payload(raw)
        payload.setdefault("id", raw_id)
        summary = self._summary(payload)
        evidence = await self._supporting_events(payload)
        investigation_values = first_value(payload, "investigations", "investigation_ids", "investigationIds")
        related_values = first_value(payload, "related_findings", "relatedFindings")
        evidence["investigation_ids"] = self._opaque_ids(self.source, "investigation", investigation_values)
        evidence["related_findings"] = self._opaque_ids(self.source, "finding", related_values)
        detection = payload.get("detection") or payload.get("analytic")
        if not isinstance(detection, Mapping):
            detection = None
        source_metadata = {
            "provider": self.source,
            "display_id": text_value(first_value(payload, "display_id", "displayId"), limit=1_024),
        }
        return bounded_detail(
            summary,
            payload,
            source_metadata=source_metadata,
            evidence=evidence,
            detection=dict(detection) if detection is not None else None,
        )

    async def get_investigation(self, reference: Mapping[str, Any]) -> dict[str, Any]:
        raw_id = text_value(reference.get("id"), limit=1_024)
        if not raw_id:
            raise ServiceError("invalid_input", "investigation_id is invalid.")
        try:
            raw = await self.core.request(lambda client: client.get_es_investigation(raw_id))
        except ServiceError as exc:
            status = exc.details.get("status_code") if isinstance(exc.details, Mapping) else None
            if status == 404:
                raise ServiceError("not_found", "The Enterprise Security investigation was not found.") from exc
            raise
        payload = self._payload(raw)
        payload.setdefault("id", raw_id)
        findings_raw = first_value(
            payload,
            "findings",
            "finding_groups",
            "findingGroups",
            "finding_ids",
            "findingIds",
            "contributing_findings",
        )
        findings: list[dict[str, Any]] = []
        for item in self._records(findings_raw):
            if isinstance(item, Mapping):
                findings.append(self._summary(item).to_dict())
            else:
                item_id = text_value(item, limit=1_024)
                if item_id:
                    findings.append({"finding_id": self.codec.encode(self.source, "finding", {"id": item_id})})
        investigation = {
            "investigation_id": self.codec.encode(self.source, "investigation", {"id": raw_id}),
            "title": text_value(first_value(payload, "title", "name", "description")),
            "created_time": normalize_timestamp(first_value(payload, "created_time", "createdTime", "created_at")),
            "updated_time": normalize_timestamp(first_value(payload, "updated_time", "updatedTime", "updated_at")),
            "status": normalize_status(first_value(payload, "status", "state")),
            "source_status": text_value(first_value(payload, "status", "state")),
            "urgency": normalize_urgency(payload.get("urgency")),
            "owner": text_value(payload.get("owner")),
            "disposition": normalize_disposition(payload.get("disposition")),
        }
        return {
            "supported": True,
            "source": self.source,
            "capabilities": (await self.capabilities()).to_dict(),
            "investigation": investigation,
            "findings": findings[:100],
            "entities": normalize_array(first_value(payload, "entities", "entity"))[:100],
            "risk_objects": normalize_array(first_value(payload, "risk_objects", "riskObjects", "risk_object"))[:100],
            "mitre_attack": normalize_array(first_value(payload, "mitre_attack", "mitreAttack", "mitre"))[:100],
            "timeline": normalize_array(first_value(payload, "timeline", "events"))[:100],
            "notes": normalize_array(payload.get("notes"))[:100],
            "source_metadata": {"provider": self.source},
        }
