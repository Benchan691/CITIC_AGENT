"""Compatibility provider for classic Splunk fired alerts."""

from __future__ import annotations

from collections.abc import Mapping
import hashlib
import json
from typing import Any

from unified_mcp_server.errors import ServiceError
from ..core.service import SplunkCore
from ..search.executor import SearchExecutor

from .model import FindingFilters, FindingPage, FindingSummary, OpaqueIdCodec, QueueCapabilities
from .provider import (
    bounded_detail,
    common_summary,
    encode_offset,
    entry_content,
    first_value,
    matches_filters,
    sort_findings,
    text_value,
)


class ClassicSplunkProvider:
    source = "classic"
    source_type = "classic_alert"

    def __init__(self, core: SplunkCore, codec: OpaqueIdCodec, executor: SearchExecutor | None = None) -> None:
        self.core = core
        self.codec = codec
        self.executor = executor

    async def capabilities(self) -> QueueCapabilities:
        return QueueCapabilities(
            source=self.source,
            native_findings=False,
            native_investigations=False,
            status=False,
            owner=False,
            urgency=False,
            disposition=False,
            persistent_history=False,
            history_complete=False,
            retention_limited=True,
        )

    @staticmethod
    def _acl_owner(entry: Mapping[str, Any]) -> Any:
        acl = entry.get("acl")
        if not isinstance(acl, Mapping):
            acl = entry_content(entry).get("eai:acl")
        return acl.get("owner") if isinstance(acl, Mapping) else None

    @staticmethod
    def _instance_payload(entry: Mapping[str, Any], *, catalog: Mapping[str, Any] | None = None) -> dict[str, Any]:
        payload = entry_content(entry)
        acl = entry.get("acl")
        if not isinstance(acl, Mapping):
            acl = entry_content(entry).get("eai:acl")
        if isinstance(acl, Mapping) and "owner" not in payload:
            payload["owner"] = acl.get("owner")
        if catalog:
            acl = catalog.get("acl")
            if not isinstance(acl, Mapping):
                acl = entry_content(catalog).get("eai:acl")
            if isinstance(acl, Mapping) and "owner" not in payload:
                payload["owner"] = acl.get("owner")
            catalog_content = entry_content(catalog)
            for key in ("savedsearch_name", "search_name", "detection_name", "severity", "triggered_alerts"):
                if key not in payload and catalog_content.get(key) not in (None, ""):
                    payload[key] = catalog_content[key]
            for key in ("name", "title"):
                if key not in payload and entry.get(key) is not None:
                    payload[key] = entry.get(key)
        return payload

    @staticmethod
    def _fingerprint(payload: Mapping[str, Any]) -> str:
        # ACL/name decoration can be present in the catalog response but not
        # in the per-alert response. Exclude those transport-only fields so a
        # SID-less reference remains resolvable across both calls.
        stable = {
            key: value
            for key, value in payload.items()
            if key not in {"acl", "links", "owner", "name", "title"}
        }
        encoded = json.dumps(stable, sort_keys=True, default=str, separators=(",", ":"))
        return hashlib.sha256(encoded.encode()).hexdigest()[:24]

    def _reference(self, alert_name: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        return {
            "alert_name": alert_name,
            "sid": text_value(first_value(payload, "sid", "search_id"), limit=1_024) or "",
            "trigger_time": text_value(first_value(payload, "trigger_time", "triggerTime"), limit=128) or "",
            "fingerprint": self._fingerprint(payload),
        }

    def _summary(self, alert_name: str, payload: Mapping[str, Any], catalog: Mapping[str, Any] | None = None) -> FindingSummary:
        reference = self._reference(alert_name, payload)
        fallback_count = None
        if catalog:
            fallback_count = self._count(
                first_value(entry_content(catalog), "triggered_alert_count", "triggered_alerts")
            )
        return common_summary(
            provider=self.source,
            source_type=self.source_type,
            synthetic=False,
            codec=self.codec,
            raw=payload,
            reference=reference,
            fallback_title=alert_name,
            fallback_detection=text_value(
                first_value(entry_content(catalog or {}), "savedsearch_name", "search_name", "detection_name"),
                limit=1_024,
            ) or alert_name,
            fallback_owner=text_value(
                first_value(catalog or {}, "owner")
                or (self._acl_owner(catalog) if isinstance(catalog, Mapping) else None),
                limit=256,
            ),
            fallback_event_count=fallback_count,
        )

    @staticmethod
    def _count(value: Any) -> int | None:
        if value is None or isinstance(value, bool):
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed >= 0 else None

    @staticmethod
    def _catalog_name(entry: Mapping[str, Any]) -> str | None:
        content = entry_content(entry)
        return text_value(first_value(entry, "name", "title") or first_value(content, "savedsearch_name", "search_name"), limit=1_024)

    async def _instances(self, catalog_entry: Mapping[str, Any]) -> list[tuple[str, dict[str, Any]]]:
        alert_name = self._catalog_name(catalog_entry)
        if not alert_name:
            return []
        try:
            raw_instances = await self.core.request(lambda client: client.get_fired_alert(alert_name))
        except ServiceError as exc:
            status = exc.details.get("status_code") if isinstance(exc.details, Mapping) else None
            if status == 404:
                # The catalog can outlive the unexpired fired-alert instance.
                return []
            raise
        if not isinstance(raw_instances, list):
            raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert instances.")
        values: list[tuple[str, dict[str, Any]]] = []
        for entry in raw_instances:
            if not isinstance(entry, Mapping):
                raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert records.")
            payload = self._instance_payload(entry, catalog=catalog_entry)
            values.append((alert_name, payload))
        return values

    async def list_findings(self, filters: FindingFilters) -> FindingPage:
        offset, after = self._decode_cursor(filters.cursor)
        page_size = min(filters.limit + 1, 201)
        raw_page = await self.core.request(
            lambda client: client.get_fired_alerts(limit=page_size, offset=offset)
        )
        if not isinstance(raw_page, Mapping):
            raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert catalog.")
        catalog = raw_page.get("items", [])
        if not isinstance(catalog, list):
            raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert catalog.")

        summaries: list[FindingSummary] = []
        for catalog_entry in catalog:
            if not isinstance(catalog_entry, Mapping):
                raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert catalog entries.")
            for alert_name, payload in await self._instances(catalog_entry):
                summary = self._summary(alert_name, payload, catalog=catalog_entry)
                if matches_filters(summary, filters):
                    summaries.append(summary)
        summaries = sort_findings(summaries)

        if after is not None:
            marker_index = next(
                (index for index, summary in enumerate(summaries) if self._same_reference(summary, after)),
                None,
            )
            if marker_index is None:
                raise ServiceError("invalid_input", "cursor is invalid or expired.")
            summaries = summaries[marker_index + 1:]

        raw_next = raw_page.get("next_offset")
        total = raw_page.get("total")
        has_more_catalog = (
            len(catalog) >= page_size
            or (isinstance(raw_next, int) and not isinstance(raw_next, bool))
            or (isinstance(total, int) and not isinstance(total, bool) and offset + len(catalog) < total)
        )
        has_more = len(summaries) > filters.limit or has_more_catalog
        returned = summaries[: filters.limit]
        next_cursor = None
        if has_more:
            if len(summaries) > filters.limit:
                marker = self._reference_from_id(returned[-1].finding_id)
                next_cursor = encode_offset(self.codec, self.source, offset, after=marker)
            else:
                next_offset = raw_next if isinstance(raw_next, int) and not isinstance(raw_next, bool) else offset + len(catalog)
                if next_offset <= offset:
                    next_offset = offset + max(1, len(catalog))
                next_cursor = encode_offset(self.codec, self.source, next_offset)
        # The catalog total counts fired-alert resources, while one resource
        # can expand into multiple unexpired instances. Do not present it as
        # an exact finding total.
        return FindingPage(returned, next_cursor, has_more, None)

    def _decode_cursor(self, cursor: str) -> tuple[int, Mapping[str, Any] | None]:
        if not cursor:
            return 0, None
        try:
            values = self.codec.decode(cursor, provider=self.source, kind="cursor")
            offset = values.get("offset")
            if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
                raise ValueError
            after = values.get("after")
            if after is not None and not isinstance(after, Mapping):
                raise ValueError
            return offset, after
        except ValueError as exc:
            raise ServiceError("invalid_input", "cursor is invalid or expired.") from exc

    def _same_reference(self, summary: FindingSummary, reference: Mapping[str, Any]) -> bool:
        candidate = self._reference_from_id(summary.finding_id)
        return all(
            candidate.get(key) == reference.get(key)
            for key in ("alert_name", "sid", "trigger_time", "fingerprint")
        )

    def _reference_from_id(self, finding_id: str) -> dict[str, Any]:
        try:
            return self.codec.decode(finding_id, provider=self.source, kind="finding")
        except ValueError as exc:
            raise ServiceError("splunk_api_error", "Classic provider produced an invalid finding reference.") from exc

    async def get_finding(self, reference: Mapping[str, Any]) -> dict[str, Any]:
        alert_name = text_value(reference.get("alert_name"), limit=1_024)
        if not alert_name:
            raise ServiceError("invalid_input", "finding_id is invalid.")
        try:
            raw_instances = await self.core.request(lambda client: client.get_fired_alert(alert_name))
        except ServiceError as exc:
            status = exc.details.get("status_code") if isinstance(exc.details, Mapping) else None
            if status == 404:
                raise ServiceError("not_found", "The fired alert is no longer available in Splunk.") from exc
            raise
        if not isinstance(raw_instances, list):
            raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert instances.")
        wanted_sid = text_value(reference.get("sid"), limit=1_024) or ""
        wanted_trigger = text_value(reference.get("trigger_time"), limit=128) or ""
        wanted_fingerprint = text_value(reference.get("fingerprint"), limit=128) or ""
        selected: dict[str, Any] | None = None
        for entry in raw_instances:
            if not isinstance(entry, Mapping):
                raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert records.")
            payload = self._instance_payload(entry)
            candidate = self._reference(alert_name, payload)
            if (
                (wanted_sid and candidate["sid"] == wanted_sid)
                or (not wanted_sid and wanted_fingerprint and candidate["fingerprint"] == wanted_fingerprint)
                or (not wanted_sid and not wanted_fingerprint and candidate["trigger_time"] == wanted_trigger)
            ):
                selected = payload
                break
        if selected is None:
            raise ServiceError("not_found", "The fired alert is no longer available in Splunk.")
        summary = self._summary(alert_name, selected)
        evidence = {"contributing_events": [], "related_findings": [], "investigation_ids": []}
        return bounded_detail(
            summary,
            selected,
            source_metadata={
                "provider": self.source,
                "history_complete": False,
                "retention_limited": True,
                "alert_type": text_value(selected.get("alert_type"), limit=64),
            },
            evidence=evidence,
            detection={"name": summary.detection_name} if summary.detection_name else None,
        )

    async def get_investigation(self, reference: Mapping[str, Any]) -> dict[str, Any]:
        return {
            "supported": False,
            "source": self.source,
            "capabilities": (await self.capabilities()).to_dict(),
            "investigation": None,
            "reason": "Classic Splunk does not provide a native investigation object.",
        }
