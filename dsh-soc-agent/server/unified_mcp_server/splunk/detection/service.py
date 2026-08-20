"""Splunk detection review, backtesting, and action operations."""

from __future__ import annotations

from typing import Any

from ..core.service import SplunkCore
from .model import DetectionDraft, validate_detection
from unified_mcp_server.errors import ServiceError


class SplunkDetectionService:
    def __init__(self, core: SplunkCore) -> None:
        self.core = core

    @staticmethod
    def _flag(value: Any) -> bool:
        return value is True or str(value).strip().lower() in {"1", "true", "yes", "on"}

    async def get_detection(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        result = await self.core.request(lambda client: client.get_saved_search(name))
        result = self.core.sanitize(result)
        content = result.get("content", {})
        return {
            "name": result.get("name", name),
            "description": content.get("description", ""),
            "spl": content.get("search", ""),
            "earliest_time": content.get("dispatch.earliest_time", ""),
            "latest_time": content.get("dispatch.latest_time", ""),
            "cron_schedule": content.get("cron_schedule", ""),
            "is_scheduled": self._flag(content.get("is_scheduled", False)),
            "disabled": self._flag(content.get("disabled", False)),
            "actions": content.get("actions", ""),
            "acl": result.get("acl", {}),
        }

    def validate_detection(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            draft = DetectionDraft.from_payload(payload)
        except ValueError as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        query_validation = self.core.validate_query(draft.spl, draft.earliest_time, draft.latest_time)
        return validate_detection(draft, query_validation=query_validation)

    async def backtest_detection(
        self,
        payload: dict[str, Any],
        earliest_time: str = "-7d",
        latest_time: str = "now",
        max_count: int = 100,
    ) -> dict[str, Any]:
        validation = self.validate_detection({**payload, "earliest_time": earliest_time, "latest_time": latest_time})
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        query = payload.get("spl", payload.get("search", ""))
        if not self.core.validate_query(query, earliest_time, latest_time)["would_execute"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        limit = min(max(1, int(max_count)), self.core.settings.max_events)
        events = await self.core.request(
            lambda client: client.search_oneshot(query, earliest_time, latest_time, limit)
        )
        events = self.core.sanitize(events)
        return {
            "detection": validation["detection"],
            "window": {"earliest_time": earliest_time, "latest_time": latest_time},
            "match_count": len(events),
            "sample_events": events,
            "validation": validation,
            "note": "Backtests are read-only samples; review volume, deduplication, and suppression before enabling.",
        }

    def _write_fields(self, draft: DetectionDraft) -> dict[str, Any]:
        settings = self.core.settings
        return {
            "name": draft.name,
            "search": draft.spl,
            "description": draft.description,
            "is_scheduled": "1" if draft.cron_schedule else "0",
            "cron_schedule": draft.cron_schedule,
            "dispatch.earliest_time": draft.earliest_time,
            "dispatch.latest_time": draft.latest_time,
            "disabled": "1",
            "actions": "",
            "app": settings.detection_app,
            "owner": settings.detection_owner,
        }

    def _require_write(self, *, enabling: bool = False) -> None:
        settings = self.core.settings
        if not settings.detection_write_enabled:
            raise ServiceError(
                "operation_disabled",
                "Detection writes are disabled. Set SPLUNK_ALLOW_DETECTION_WRITE=true after review.",
            )
        if enabling and not settings.detection_enable_enabled:
            raise ServiceError(
                "operation_disabled",
                "Detection enablement is disabled. Set SPLUNK_ALLOW_DETECTION_ENABLE=true only in a controlled environment.",
            )

    async def create_detection_draft(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._require_write()
        validation = self.validate_detection({**payload, "enabled": False})
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload({**payload, "enabled": False})
        result = await self.core.request(lambda client: client.create_saved_search(self._write_fields(draft)))
        return {"created": True, "enabled": False, "detection": validation["detection"], "splunk": result}

    async def update_detection_draft(self, name: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._require_write()
        current = await self.get_detection(name)
        merged = {**current, **payload, "name": name, "enabled": False}
        validation = self.validate_detection(merged)
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload(merged)
        result = await self.core.request(lambda client: client.update_saved_search(name, self._write_fields(draft)))
        return {"updated": True, "enabled": False, "detection": validation["detection"], "splunk": result}

    async def set_detection_enabled(self, name: str, enabled: bool) -> dict[str, Any]:
        self._require_write(enabling=enabled)
        current = await self.get_detection(name)
        if enabled:
            validation = self.validate_detection({
                "name": current["name"],
                "spl": current["spl"],
                "description": current.get("description", ""),
                "earliest_time": current.get("earliest_time") or "-10m",
                "latest_time": current.get("latest_time") or "now",
                "cron_schedule": current.get("cron_schedule", ""),
                "enabled": False,
            })
            if not validation["valid"]:
                raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        result = await self.core.request(
            lambda client: client.update_saved_search(name, {"disabled": "0" if enabled else "1"})
        )
        return {"updated": True, "name": name, "enabled": enabled, "splunk": result}
