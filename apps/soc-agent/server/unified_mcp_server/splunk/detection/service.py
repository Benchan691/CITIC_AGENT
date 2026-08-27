"""Splunk detection review, backtesting, and action operations."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from ..core.service import SplunkCore
from .model import DetectionDraft, validate_detection
from ..search.executor import SearchExecutor
from unified_mcp_server.errors import ServiceError


class SplunkDetectionService:
    def __init__(self, core: SplunkCore, executor: SearchExecutor | None = None) -> None:
        self.core = core
        self.executor = executor if executor is not None else SearchExecutor(core)

    @staticmethod
    def _flag(value: Any) -> bool:
        return value is True or str(value).strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _fingerprint(detection: dict[str, Any]) -> str:
        fields = {
            key: detection.get(key)
            for key in (
                "name", "description", "spl", "earliest_time", "latest_time",
                "cron_schedule", "is_scheduled", "disabled", "actions", "app", "owner",
            )
        }
        encoded = json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def _require_expected(expected_fingerprint: str, current: dict[str, Any]) -> None:
        if not isinstance(expected_fingerprint, str) or not expected_fingerprint.strip():
            raise ServiceError(
                "expected_fingerprint_required",
                "expected_fingerprint is required for detection modifications.",
            )
        if expected_fingerprint != current["fingerprint"]:
            raise ServiceError(
                "detection_changed",
                "The Splunk detection changed since it was read; refresh and retry.",
                details={"current_fingerprint": current["fingerprint"]},
            )

    @staticmethod
    def _review_only_metadata(draft: DetectionDraft) -> dict[str, Any]:
        return {
            "severity": draft.severity,
            "mitre_attack": list(draft.mitre_attack),
            "risk_score": draft.risk_score,
            "risk_objects": list(draft.risk_objects),
            "suppression_window": draft.suppression_window,
            "persisted": False,
        }

    async def get_detection(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        result = await self.core.request(
            lambda client: client.get_saved_search(
                name,
                self.core.settings.detection_app,
                self.core.settings.detection_owner,
            )
        )
        result = self.core.sanitize(result)
        content = result.get("content", {})
        acl = result.get("acl", {}) if isinstance(result.get("acl"), dict) else {}
        detection = {
            "name": result.get("name", name),
            "description": content.get("description", ""),
            "spl": content.get("search", ""),
            "earliest_time": content.get("dispatch.earliest_time", ""),
            "latest_time": content.get("dispatch.latest_time", ""),
            "cron_schedule": content.get("cron_schedule", ""),
            "is_scheduled": self._flag(content.get("is_scheduled", False)),
            "disabled": self._flag(content.get("disabled", False)),
            "actions": content.get("actions", ""),
            "app": acl.get("app") or self.core.settings.detection_app,
            "owner": acl.get("owner") or self.core.settings.detection_owner,
            "sharing": acl.get("sharing", ""),
        }
        detection["fingerprint"] = self._fingerprint(detection)
        return detection

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
        max_count: int = 50,
        fields: list[str] | None = None,
    ) -> dict[str, Any]:
        validation = self.validate_detection({**payload, "earliest_time": earliest_time, "latest_time": latest_time})
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        query = payload.get("spl", payload.get("search", ""))
        execution = await self.executor.execute(
            query, earliest_time, latest_time, max_count, fields
        )
        events = execution["events"]
        return {
            "detection_name": validation["detection"]["name"],
            "window": {"earliest_time": earliest_time, "latest_time": latest_time},
            "sample_count": len(events),
            "sample_limit_reached": execution["event_budget"]["received_count"] >= execution["limit"],
            "sample_events": events,
            "sample_budget": execution["event_budget"],
            "search_metadata": execution["search_metadata"],
            "fields": execution["fields"],
            "warnings": validation["warnings"],
            "note": "Backtests are read-only samples; review volume, deduplication, and suppression before enabling.",
        }

    def _write_fields(self, draft: DetectionDraft, *, creating: bool = False) -> dict[str, Any]:
        settings = self.core.settings
        fields = {
            "name": draft.name,
            "search": draft.spl,
            "description": draft.description,
            "is_scheduled": "1" if draft.cron_schedule else "0",
            "cron_schedule": draft.cron_schedule,
            "dispatch.earliest_time": draft.earliest_time,
            "dispatch.latest_time": draft.latest_time,
            "disabled": "1",
            "app": settings.detection_app,
            "owner": settings.detection_owner,
        }
        if creating:
            fields["actions"] = ""
        return fields

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
        await self.core.request(lambda client: client.create_saved_search(self._write_fields(draft, creating=True)))
        persisted = await self.get_detection(draft.name)
        return {
            "created": True,
            "enabled": False,
            "detection": persisted,
            "review_only_metadata": self._review_only_metadata(draft),
            "requires_action_configuration": not bool(str(persisted.get("actions", "")).strip()),
        }

    async def update_detection_draft(
        self,
        name: str,
        payload: dict[str, Any],
        expected_fingerprint: str,
    ) -> dict[str, Any]:
        self._require_write()
        current = await self.get_detection(name)
        self._require_expected(expected_fingerprint, current)
        merged = {**current, **payload, "name": name, "enabled": False}
        validation = self.validate_detection(merged)
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload(merged)
        await self.core.request(lambda client: client.update_saved_search(name, self._write_fields(draft)))
        persisted = await self.get_detection(name)
        return {
            "updated": True,
            "enabled": False,
            "detection": persisted,
            "review_only_metadata": self._review_only_metadata(draft),
            "actions_preserved": True,
        }

    async def set_detection_enabled(
        self,
        name: str,
        enabled: bool,
        expected_fingerprint: str,
    ) -> dict[str, Any]:
        self._require_write(enabling=enabled)
        current = await self.get_detection(name)
        self._require_expected(expected_fingerprint, current)
        if enabled:
            if not current.get("is_scheduled") or not str(current.get("cron_schedule", "")).strip():
                raise ServiceError(
                    "detection_not_runnable",
                    "The persisted Splunk detection must have an active schedule before it can be enabled.",
                )
            if not str(current.get("actions", "")).strip():
                raise ServiceError(
                    "detection_not_runnable",
                    "The persisted Splunk detection must have at least one alert action before it can be enabled.",
                )
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
        settings = self.core.settings
        await self.core.request(
            lambda client: client.update_saved_search(
                name,
                {
                    "disabled": "0" if enabled else "1",
                    "app": settings.detection_app,
                    "owner": settings.detection_owner,
                },
            )
        )
        persisted = await self.get_detection(name)
        return {
            "updated": True,
            "name": name,
            "enabled": not persisted["disabled"],
            "app": settings.detection_app,
            "owner": settings.detection_owner,
            "fingerprint": persisted["fingerprint"],
        }
