"""Business logic for the read-only Splunk security queue tools."""

from __future__ import annotations

import json
from typing import Any

from unified_mcp_server.errors import ServiceError

from ..core.service import SplunkCore
from ..search.executor import SearchExecutor
from .standard_provider import StandardSplunkProvider
from .model import (
    SEVERITIES,
    STATUSES,
    URGENCIES,
    FindingFilters,
    OpaqueIdCodec,
)
from .provider import FindingProvider


class SplunkSecurityQueueService:
    """Expose one bounded canonical queue contract for standard Splunk alerts."""

    MAX_LIMIT = 200
    MAX_FILTER_CHARS = 256
    MAX_REFERENCE_CHARS = 8_192
    MAX_DETAIL_ITEMS = 100
    MAX_DETAIL_STRING_CHARS = 4_000

    def __init__(
        self,
        core: SplunkCore,
        executor: SearchExecutor | None = None,
        *,
        codec: OpaqueIdCodec | None = None,
    ) -> None:
        self.core = core
        self.executor = executor if executor is not None else SearchExecutor(core)
        self.codec = codec or OpaqueIdCodec()
        self._provider: FindingProvider = StandardSplunkProvider(self.core, self.codec, self.executor)

    @property
    def provider(self) -> FindingProvider:
        return self._provider

    @staticmethod
    def _text(name: str, value: Any, *, required: bool = False, limit: int = MAX_FILTER_CHARS) -> str:
        if value is None:
            if required:
                raise ServiceError("invalid_input", f"{name} is required.")
            return ""
        if not isinstance(value, str):
            raise ServiceError("invalid_input", f"{name} must be a string.")
        value = value.strip()
        if required and not value:
            raise ServiceError("invalid_input", f"{name} cannot be empty.")
        if len(value) > limit:
            raise ServiceError("invalid_input", f"{name} is too long.")
        return value

    @staticmethod
    def _limit(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ServiceError("invalid_input", "limit must be an integer.")
        parsed = value
        if parsed < 1:
            raise ServiceError("invalid_input", "limit must be at least 1.")
        return min(parsed, SplunkSecurityQueueService.MAX_LIMIT)

    @staticmethod
    def _enum(name: str, value: Any, allowed: frozenset[str]) -> str:
        normalized = SplunkSecurityQueueService._text(name, value)
        if normalized and normalized.casefold() not in allowed:
            raise ServiceError("invalid_input", f"{name} is not a supported queue value.")
        return normalized.casefold()

    def _filters(
        self,
        status: Any,
        urgency: Any,
        owner: Any,
        detection: Any,
        earliest_time: Any,
        latest_time: Any,
        limit: Any,
        cursor: Any,
    ) -> FindingFilters:
        return FindingFilters(
            status=self._enum("status", status, STATUSES),
            urgency=self._enum("urgency", urgency, URGENCIES),
            owner=self._text("owner", owner),
            detection=self._text("detection", detection),
            earliest_time=self._text("earliest_time", earliest_time, required=True, limit=128),
            latest_time=self._text("latest_time", latest_time, required=True, limit=128),
            limit=self._limit(limit),
            cursor=self._text("cursor", cursor, limit=self.MAX_REFERENCE_CHARS),
        )

    async def list_security_findings(
        self,
        status: str = "",
        urgency: str = "",
        owner: str = "",
        detection: str = "",
        earliest_time: str = "-24h",
        latest_time: str = "now",
        limit: int = 50,
        cursor: str = "",
    ) -> dict[str, Any]:
        filters = self._filters(status, urgency, owner, detection, earliest_time, latest_time, limit, cursor)
        provider = self.provider
        try:
            page = await provider.list_findings(filters)
        except ServiceError as exc:
            raise self._translate_provider_error(exc) from exc
        capabilities = await provider.capabilities()
        raw_findings = [item.to_dict() for item in page.findings]
        sanitized = self.core.sanitize(raw_findings)
        if not isinstance(sanitized, list) or any(not isinstance(item, dict) for item in sanitized):
            raise ServiceError("splunk_api_error", "Splunk returned malformed security findings.")
        bounded, budget = self.core.bound_events(sanitized)
        return {
            "source": provider.source,
            "capabilities": capabilities.to_dict(),
            "findings": bounded,
            "count": len(bounded),
            "total_count": page.total_count,
            "total_count_exact": page.total_count_exact,
            "next_cursor": page.next_cursor,
            "truncated": page.truncated or budget["truncated"],
            "partial": page.partial,
            "partial_reason": page.partial_reason,
            "backend_pages_fetched": page.backend_pages_fetched,
            "backend_records_seen": page.backend_records_seen,
            "local_filtered_count": page.local_filtered_count,
            "truncation": {
                "row_limit": page.truncated,
                "context_limit": budget["truncated"],
            },
            "mcp_context_truncated": budget["truncated"],
            "history_complete": capabilities.history_complete,
            "retention_limited": capabilities.retention_limited,
        }

    async def get_security_finding(self, finding_id: str) -> dict[str, Any]:
        provider, reference = await self._reference(finding_id, "finding")
        try:
            result = await provider.get_finding(reference)
        except ServiceError as exc:
            raise self._translate_provider_error(exc) from exc
        capabilities = await provider.capabilities()
        return self._bounded_public_result(result, provider, capabilities.to_dict())

    @staticmethod
    def _translate_provider_error(exc: ServiceError) -> ServiceError:
        status = exc.details.get("status_code") if isinstance(exc.details, dict) else None
        if status in {401, 403}:
            return ServiceError(
                "insufficient_permissions",
                "The Splunk account cannot read the security queue.",
                details={"status_code": status},
            )
        return exc

    async def _reference(self, value: str, kind: str) -> tuple[FindingProvider, dict[str, Any]]:
        if not isinstance(value, str) or not value.strip() or len(value) > self.MAX_REFERENCE_CHARS:
            raise ServiceError("invalid_input", f"{kind}_id is invalid.")
        prefix = value.split(":", 1)[0]
        if prefix != self.provider.source:
            raise ServiceError("invalid_input", f"{kind}_id is invalid.")
        try:
            reference = self.codec.decode(value, provider=prefix, kind=kind)
        except ValueError as exc:
            raise ServiceError("invalid_input", f"{kind}_id is invalid or expired.") from exc
        return self.provider, reference

    def _bounded_public_result(
        self,
        value: Any,
        provider: FindingProvider,
        capabilities: dict[str, Any],
    ) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ServiceError("splunk_api_error", "Splunk returned a malformed security queue response.")
        sanitized = self.core.sanitize(value)
        bounded = self._bound_value(sanitized)
        if not isinstance(bounded, dict):
            raise ServiceError("splunk_api_error", "Splunk returned a malformed security queue response.")

        evidence = bounded.get("evidence")
        if "evidence" in bounded and not isinstance(evidence, dict):
            raise ServiceError("splunk_api_error", "Splunk returned malformed security queue evidence.")
        if isinstance(evidence, dict):
            if "contributing_events" in evidence:
                events = evidence["contributing_events"]
                if not isinstance(events, list) or any(not isinstance(item, dict) for item in events):
                    raise ServiceError("splunk_api_error", "Splunk returned malformed contributing events.")
                evidence["contributing_events"], budget = self.core.bound_events(events)
                evidence["mcp_context_truncated"] = budget["truncated"]
        bounded["source"] = provider.source
        bounded["capabilities"] = capabilities
        return self._fit_detail(bounded)

    def _fit_detail(self, value: dict[str, Any]) -> dict[str, Any]:
        """Keep expanded queue responses inside the same context budget as searches."""
        limit = self.core.MAX_RESULT_CHARS

        def size() -> int:
            return len(json.dumps(value, ensure_ascii=True, separators=(",", ":")))

        if size() <= limit:
            return value

        truncated = False
        collections = [
            (value, "notes"),
            (value, "timeline"),
            (value, "findings"),
            (value, "entities"),
            (value, "risk_objects"),
            (value, "mitre_attack"),
        ]
        finding = value.get("finding")
        if isinstance(finding, dict):
            collections.extend([
                (finding, "entities"),
                (finding, "risk_objects"),
                (finding, "mitre_attack"),
            ])
        evidence = value.get("evidence")
        if isinstance(evidence, dict):
            collections.extend([
                (evidence, "related_findings"),
            ])
        for container, key in collections:
            items = container.get(key)
            if not isinstance(items, list):
                continue
            while items and size() > limit:
                items.pop()
                truncated = True

        if size() > limit:
            # Optional descriptive payloads can be removed while preserving the
            # canonical finding and its bounded evidence.
            for key in ("notes", "timeline", "detection", "source_metadata"):
                if key in value and value[key] not in (None, {}, []):
                    value[key] = [] if isinstance(value[key], list) else None
                    truncated = True
                if size() <= limit:
                    break

        if truncated:
            value["mcp_context_truncated"] = True
        return value

    def _bound_value(self, value: Any, depth: int = 0) -> Any:
        if depth > 8:
            return "[nested value omitted]"
        if isinstance(value, str):
            return value[: self.MAX_DETAIL_STRING_CHARS]
        if isinstance(value, list):
            return [self._bound_value(item, depth + 1) for item in value[: self.MAX_DETAIL_ITEMS]]
        if isinstance(value, dict):
            return {
                str(key)[:256]: self._bound_value(item, depth + 1)
                for key, item in list(value.items())[: self.MAX_DETAIL_ITEMS]
            }
        return value
