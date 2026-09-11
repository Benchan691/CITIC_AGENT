"""Read-only Splunk detection review, validation, and backtesting."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from ..core.service import SplunkCore
from ..search.executor import SearchExecutor
from .citic_format import (
    validate_citic_detection_spl,
)
from .compiler import compile_citic_detection
from .model import (
    DetectionDraft,
    public_alert_fields,
    validate_detection,
)
from unified_mcp_server.errors import ServiceError


class SplunkDetectionService:
    """Provide read-only detection inspection and validation."""

    def __init__(
        self,
        core: SplunkCore,
        executor: SearchExecutor | None = None,
    ) -> None:
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
                "disabled", "actions", "app", "owner",
            )
        }
        fields.update(public_alert_fields(detection))
        encoded = json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def _normalize_name(name: str) -> str:
        if not isinstance(name, str) or not name.strip():
            raise ServiceError("invalid_input", "name cannot be empty")
        return name.strip()

    @staticmethod
    def _reject_dual_spl_payload(payload: dict[str, Any]) -> None:
        supplied = [key for key in ("production_spl", "backtest_spl", "detection_logic") if key in payload]
        if supplied:
            raise ServiceError(
                "invalid_input",
                "Use the compiler output's production SPL as detection.spl; dual SPL payloads are not accepted.",
                details={"unsupported_fields": supplied},
            )

    async def get_detection(self, name: str) -> dict[str, Any]:
        name = self._normalize_name(name)
        result = await self.core.request(
            lambda client: client.get_saved_search(
                name,
                self.core.settings.detection_app,
                self.core.settings.detection_owner,
            )
        )
        result = self.core.sanitize(result)
        content = result.get("content", {}) if isinstance(result, dict) else {}
        if not isinstance(content, dict):
            content = {}
        acl = result.get("acl", {}) if isinstance(result, dict) and isinstance(result.get("acl"), dict) else {}
        alert_fields = public_alert_fields(content)
        detection = {
            "name": result.get("name", name) if isinstance(result, dict) else name,
            "description": content.get("description", ""),
            "spl": content.get("search", ""),
            "earliest_time": alert_fields.get("dispatch.earliest_time", ""),
            "latest_time": alert_fields.get("dispatch.latest_time", ""),
            "disabled": self._flag(content.get("disabled", False)),
            "actions": content.get("actions", ""),
            # The request is scoped to these configured values; never let a
            # response ACL redirect a later authenticated editor save elsewhere.
            "app": self.core.settings.detection_app,
            "owner": self.core.settings.detection_owner,
            "sharing": acl.get("sharing", ""),
        }
        detection.update(alert_fields)
        # Keep the legacy aliases in reads while exposing the raw REST names
        # beside them. The raw values are the canonical source for editor drafts.
        detection["actions"] = alert_fields.get("actions", detection["actions"]) or ""
        detection["fingerprint"] = self._fingerprint(detection)
        return detection

    def validate_detection(
        self,
        payload: dict[str, Any],
        *,
        allow_outputcsv: bool = True,
        require_citic_format: bool = True,
    ) -> dict[str, Any]:
        if isinstance(payload, dict):
            self._reject_dual_spl_payload(payload)
        try:
            draft = DetectionDraft.from_payload(payload)
        except ValueError as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        query_validation = self.core.validate_query(
            draft.spl,
            draft.earliest_time,
            draft.latest_time,
            allow_outputcsv=allow_outputcsv,
        )
        result = validate_detection(draft, query_validation=query_validation)
        citic_format = (
            validate_citic_detection_spl(draft.spl)
            if require_citic_format
            else {"valid": True, "errors": [], "warnings": []}
        )
        if require_citic_format:
            result["errors"].extend(citic_format["errors"])
            result["warnings"].extend(citic_format["warnings"])
        result["citic_format"] = citic_format
        result["valid"] = not result["errors"]
        return result

    def compile_citic_detection(
        self,
        *,
        detection_logic: str,
        rulename: str,
        threat_name: str,
        threat_type: str,
        case_prefix: str,
        event_field_mappings: dict[str, str],
        extra_table_fields: list[str] | None = None,
    ) -> dict[str, Any]:
        try:
            compiled = compile_citic_detection(
                detection_logic=detection_logic,
                rulename=rulename,
                threat_name=threat_name,
                threat_type=threat_type,
                case_prefix=case_prefix,
                event_field_mappings=event_field_mappings,
                extra_table_fields=extra_table_fields,
            )
        except ValueError as exc:
            raise ServiceError("invalid_input", str(exc)) from exc

        production_format = validate_citic_detection_spl(compiled["production_spl"])
        production_query = self.core.validate_query(
            compiled["production_spl"], allow_outputcsv=True
        )
        backtest_query = self.core.validate_query(
            compiled["backtest_spl"], allow_outputcsv=False
        )
        production_errors = list(production_format["errors"])
        if production_query["decision"] != "allow":
            production_errors.append("production SPL is not allowed by the safety policy")
        backtest_errors: list[str] = []
        if backtest_query["decision"] != "allow":
            backtest_errors.append("backtest SPL is not allowed by the safety policy")
        production_warnings = list(production_format["warnings"])
        if "outputcsv" in production_query.get("allowed_commands", []):
            production_warnings.append(
                "outputcsv is definition-only: it is not executed, exported, or emailed by MCP"
            )
        return {
            **compiled,
            "production_validation": {
                "valid": not production_errors,
                "errors": production_errors,
                "warnings": production_warnings,
                "citic_format": production_format,
                "query_validation": production_query,
            },
            "backtest_validation": {
                "valid": not backtest_errors,
                "errors": backtest_errors,
                "warnings": [],
                "query_validation": backtest_query,
            },
        }

    async def backtest_detection(
        self,
        payload: dict[str, Any],
        earliest_time: str = "-7d",
        latest_time: str = "now",
        max_count: int = 50,
        fields: list[str] | None = None,
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "detection must be a JSON object")
        validation = self.validate_detection(
            {**payload, "earliest_time": earliest_time, "latest_time": latest_time},
            allow_outputcsv=False,
            require_citic_format=False,
        )
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        query = payload.get("spl", payload.get("search", ""))
        execution = await self.executor.execute(
            query,
            earliest_time,
            latest_time,
            max_count,
            fields,
            principal_id=principal_id,
            workload_type="backtest",
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

__all__ = ["SplunkDetectionService"]
