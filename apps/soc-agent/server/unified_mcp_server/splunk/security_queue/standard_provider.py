"""Provider for standard Splunk fired alerts."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from datetime import datetime, timezone
import hashlib
import json
from typing import Any

from unified_mcp_server.errors import ServiceError
from ..core.service import SplunkCore
from ..search.executor import SearchExecutor

from .model import FindingFilters, FindingPage, FindingSummary, OpaqueIdCodec, QueueCapabilities
from .provider import (
    backend_page_next_offset,
    bounded_detail,
    common_summary,
    encode_offset,
    entry_content,
    filter_fingerprint,
    first_value,
    matches_filters_at,
    sort_findings,
    text_value,
)


class StandardSplunkProvider:
    source = "standard"
    source_type = "standard_alert"

    def __init__(self, core: SplunkCore, codec: OpaqueIdCodec, executor: SearchExecutor | None = None) -> None:
        self.core = core
        self.codec = codec
        self.executor = executor
        queue_config = getattr(core.settings, "security_queue", None)
        concurrency = getattr(queue_config, "standard_concurrency", 5)
        self._instance_semaphore = asyncio.Semaphore(max(1, int(concurrency)))

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

    async def _instances_bounded(
        self,
        catalog_entries: list[Mapping[str, Any]],
        cache: dict[str, list[tuple[str, dict[str, Any]]]] | None = None,
    ) -> list[list[tuple[str, dict[str, Any]]]]:
        instance_cache = cache if cache is not None else {}
        unique_entries: list[Mapping[str, Any]] = []
        names: list[str | None] = []
        scheduled: set[str] = set()
        for entry in catalog_entries:
            name = self._catalog_name(entry)
            names.append(name)
            if name and name not in instance_cache and name not in scheduled:
                unique_entries.append(entry)
                scheduled.add(name)

        async def fetch(entry: Mapping[str, Any]) -> list[tuple[str, dict[str, Any]]]:
            async with self._instance_semaphore:
                return await self._instances(entry)

        results = await asyncio.gather(
            *(fetch(entry) for entry in unique_entries),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, BaseException):
                raise result
        for entry, result in zip(unique_entries, results):
            name = self._catalog_name(entry)
            if name:
                instance_cache[name] = result  # type: ignore[assignment]
        return [instance_cache.get(name, []) if name else [] for name in names]

    def _definition_matches(self, entry: Mapping[str, Any], filters: FindingFilters) -> bool:
        """Apply only reliable catalog filters before the instance request."""
        content = entry_content(entry)
        if filters.detection:
            detection = text_value(
                first_value(content, "detection_name", "detectionName", "savedsearch_name", "search_name"),
                limit=1_024,
            )
            if detection and filters.detection.casefold() not in detection.casefold():
                return False
        if filters.owner:
            owner = text_value(
                first_value(entry, "owner")
                or self._acl_owner(entry)
                or first_value(content, "owner"),
                limit=256,
            )
            if owner and filters.owner.casefold() not in owner.casefold():
                return False
        return True

    async def list_findings(self, filters: FindingFilters) -> FindingPage:
        filter_key = filter_fingerprint(filters)
        offset, resume = self._decode_cursor(filters.cursor, filter_key)
        queue_config = getattr(self.core.settings, "security_queue", None)
        max_pages = getattr(queue_config, "max_backend_pages_per_request", 10)
        max_records = getattr(queue_config, "max_backend_records_per_request", 1_000)
        page_size = min(filters.limit + 1, 50, max_records)
        now = datetime.now(timezone.utc)
        current_offset = offset
        findings: list[FindingSummary] = []
        backend_pages = 0
        catalog_records_seen = 0
        instance_records_seen = 0
        local_filtered = 0
        seen_references: set[tuple[Any, ...]] = set()
        continuation: tuple[int, int | None, Mapping[str, Any] | None] | None = None
        exhausted = False
        partial = False
        partial_reason: str | None = None
        instance_cache: dict[str, list[tuple[str, dict[str, Any]]]] = {}

        while len(findings) < filters.limit and backend_pages < max_pages and catalog_records_seen < max_records:
            requested_count = min(page_size, max_records - catalog_records_seen)
            raw_page = await self.core.request(
                lambda client: client.get_fired_alerts(limit=requested_count, offset=current_offset)
            )
            if not isinstance(raw_page, Mapping):
                raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert catalog.")
            catalog = raw_page.get("items", [])
            if not isinstance(catalog, list) or any(not isinstance(item, Mapping) for item in catalog):
                raise ServiceError("splunk_api_error", "Splunk returned malformed fired-alert catalog.")
            if len(catalog) > requested_count:
                catalog = catalog[:requested_count]
            backend_pages += 1
            catalog_records_seen += len(catalog)
            next_offset, backend_more = backend_page_next_offset(
                raw_page,
                current_offset,
                len(catalog),
                requested_count,
            )
            if not catalog:
                if backend_more:
                    raise ServiceError("splunk_api_error", "Splunk returned an inconsistent fired-alert page.")
                exhausted = True
                break

            start_index = 0
            resume_after = None
            if resume is not None:
                raw_index = resume.get("catalog_index")
                after = resume.get("after")
                alert_name = after.get("alert_name") if isinstance(after, Mapping) else None
                if isinstance(alert_name, str) and alert_name:
                    start_index = next(
                        (
                            index
                            for index, item in enumerate(catalog)
                            if isinstance(alert_name, str) and self._catalog_name(item) == alert_name
                        ),
                        -1,
                    )
                    if start_index < 0:
                        raise ServiceError("invalid_input", "cursor is invalid or expired.")
                elif isinstance(raw_index, int) and not isinstance(raw_index, bool) and 0 <= raw_index < len(catalog):
                    start_index = raw_index
                else:
                    raise ServiceError("invalid_input", "cursor is invalid or expired.")
                resume_after = resume.get("after") if isinstance(resume.get("after"), Mapping) else None

            candidates: list[tuple[int, Mapping[str, Any]]] = []
            for index, catalog_entry in enumerate(catalog):
                if index < start_index:
                    continue
                # Always refetch the cursor's source entry. Its catalog
                # metadata may have changed since the previous page, but the
                # instance marker is still the only safe resume point.
                if (resume is not None and index == start_index) or self._definition_matches(catalog_entry, filters):
                    candidates.append((index, catalog_entry))
                else:
                    local_filtered += 1

            instance_results = await self._instances_bounded(
                [entry for _, entry in candidates],
                instance_cache,
            )
            stop_page = False
            for (catalog_index, catalog_entry), instances in zip(candidates, instance_results):
                alert_name = self._catalog_name(catalog_entry)
                if not alert_name:
                    continue
                marker = resume_after if resume is not None and catalog_index == start_index else None
                marker_seen = marker is None
                last_reference: Mapping[str, Any] | None = marker
                for _instance_index, (instance_alert_name, payload) in enumerate(instances):
                    candidate_reference = self._reference(instance_alert_name, payload)
                    if not marker_seen:
                        if self._references_equal(candidate_reference, marker):
                            marker_seen = True
                        continue
                    if instance_records_seen >= max_records:
                        continuation = (current_offset, catalog_index, last_reference)
                        partial = True
                        partial_reason = "backend_record_limit"
                        stop_page = True
                        break
                    instance_records_seen += 1
                    reference_key = tuple(
                        candidate_reference.get(key)
                        for key in ("alert_name", "sid", "trigger_time", "fingerprint")
                    )
                    if reference_key in seen_references:
                        last_reference = candidate_reference
                        continue
                    seen_references.add(reference_key)
                    summary = self._summary(
                        instance_alert_name,
                        payload,
                        catalog=catalog_entry,
                    )
                    if matches_filters_at(summary, filters, now=now):
                        findings.append(summary)
                    else:
                        local_filtered += 1
                    last_reference = candidate_reference
                    if len(findings) >= filters.limit:
                        has_instance_more = _instance_index + 1 < len(instances)
                        has_candidate_more = any(index > catalog_index for index, _ in candidates)
                        if has_instance_more or has_candidate_more or backend_more:
                            continuation = (current_offset, catalog_index, last_reference)
                        else:
                            exhausted = True
                        stop_page = True
                        break
                if marker is not None and not marker_seen:
                    raise ServiceError("invalid_input", "cursor is invalid or expired.")
                if stop_page:
                    break

            if stop_page:
                break
            resume = None
            if not backend_more:
                exhausted = True
                break
            if next_offset is None or next_offset <= current_offset:
                raise ServiceError("splunk_api_error", "Splunk returned an invalid fired-alert cursor.")
            current_offset = next_offset
            if backend_pages >= max_pages or catalog_records_seen >= max_records or instance_records_seen >= max_records:
                continuation = (current_offset, None, None)
                partial = True
                partial_reason = "backend_page_limit" if backend_pages >= max_pages else "backend_record_limit"
                break

        if not exhausted and continuation is None:
            continuation = (current_offset, None, None)
            partial = True
            partial_reason = "backend_page_limit" if backend_pages >= max_pages else "backend_record_limit"

        has_more = continuation is not None
        next_cursor = None
        if continuation is not None:
            next_offset, catalog_index, after = continuation
            cursor_values: dict[str, Any] = {"filter_key": filter_key}
            if catalog_index is None:
                cursor_offset = next_offset
            else:
                cursor_offset = next_offset
                cursor_values["catalog_index"] = catalog_index
                if after is not None:
                    cursor_values["after"] = dict(after)
            next_cursor = encode_offset(self.codec, self.source, cursor_offset, **cursor_values)

        # The catalog's total counts fired-alert resources, while each
        # resource can expand into multiple live instances.  It is therefore
        # never an exact total for canonical findings.
        total_count = None
        return FindingPage(
            sort_findings(findings[: filters.limit]),
            next_cursor,
            has_more,
            total_count,
            exhausted and not partial and not filters.cursor,
            partial,
            partial_reason,
            backend_pages,
            catalog_records_seen + instance_records_seen,
            local_filtered,
        )

    def _decode_cursor(
        self,
        cursor: str,
        expected_filter_key: str | None = None,
    ) -> tuple[int, Mapping[str, Any] | None]:
        if not cursor:
            return 0, None
        try:
            values = self.codec.decode(cursor, provider=self.source, kind="cursor")
            offset = values.get("offset")
            if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
                raise ValueError
            filter_key = values.get("filter_key")
            if filter_key not in (None, expected_filter_key):
                raise ValueError
            after = values.get("after")
            if after is not None and not isinstance(after, Mapping):
                raise ValueError
            catalog_index = values.get("catalog_index")
            if catalog_index is not None and (
                isinstance(catalog_index, bool)
                or not isinstance(catalog_index, int)
                or catalog_index < 0
            ):
                raise ValueError
            if after is None and catalog_index is None:
                return offset, None
            return offset, {"catalog_index": catalog_index, "after": after}
        except ValueError as exc:
            raise ServiceError("invalid_input", "cursor is invalid or expired.") from exc

    def _same_reference(self, summary: FindingSummary, reference: Mapping[str, Any]) -> bool:
        candidate = self._reference_from_id(summary.finding_id)
        return self._references_equal(candidate, reference)

    @staticmethod
    def _references_equal(candidate: Mapping[str, Any], reference: Mapping[str, Any] | None) -> bool:
        if reference is None:
            return False
        return all(
            candidate.get(key) == reference.get(key)
            for key in ("alert_name", "sid", "trigger_time", "fingerprint")
        )

    def _reference_from_id(self, finding_id: str) -> dict[str, Any]:
        try:
            return self.codec.decode(finding_id, provider=self.source, kind="finding")
        except ValueError as exc:
            raise ServiceError("splunk_api_error", "Standard provider produced an invalid finding reference.") from exc

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
        evidence = {"contributing_events": [], "related_findings": []}
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
