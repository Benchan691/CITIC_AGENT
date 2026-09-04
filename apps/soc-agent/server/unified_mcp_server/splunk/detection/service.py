"""Splunk detection review, backtesting, and authenticated editor saves."""

from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any

from ..core.service import SplunkCore
from ..search.executor import SearchExecutor
from .citic_format import (
    build_log_event_template,
    extract_final_table_fields,
    validate_citic_detection_spl,
)
from .compiler import compile_citic_detection
from .model import (
    DetectionDraft,
    canonical_alert_fields,
    public_alert_fields,
    validate_detection,
)
from unified_mcp_server.errors import ServiceError


class SplunkDetectionService:
    """Keep detection writes behind an explicit, authenticated editor save."""

    _EDITOR_DEFAULTS = {
        "dispatch.rt_backfill": "0",
        "dispatch.indexedRealtime": "0",
        "dispatch.indexedRealtimeOffset": "",
        "dispatch.indexedRealtimeMinSpan": "",
        "dispatch.rt_maximum_span": "",
        "alert_type": "",
        "alert_comparator": "",
        "alert_threshold": "",
        "alert_condition": "",
        "alert.digest_mode": "0",
        "alert.suppress": "0",
        "alert.suppress.period": "",
        "alert.suppress.fields": "",
        "alert.suppress.group_name": "",
        "alert.expires": "",
        "alert.track": "auto",
    }

    def __init__(
        self,
        core: SplunkCore,
        executor: SearchExecutor | None = None,
    ) -> None:
        self.core = core
        self.executor = executor if executor is not None else SearchExecutor(core)
        self._save_lock = asyncio.Lock()

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
        fields.update(public_alert_fields(detection))
        encoded = json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def _normalize_name(name: str) -> str:
        if not isinstance(name, str) or not name.strip():
            raise ServiceError("invalid_input", "name cannot be empty")
        return name.strip()

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

    @staticmethod
    def _actor_id(actor_id: str | None, *, required: bool = False) -> str:
        if isinstance(actor_id, str) and actor_id.strip():
            return actor_id.strip()
        if required:
            raise ServiceError("not_authorized", "An authenticated SOC user is required for this operation.")
        # Direct service construction is retained for trusted in-process
        # compatibility callers. MCP callers always pass the authenticated
        # Runtime identity through the tool wrapper.
        return "internal-service"

    @staticmethod
    def _state_from_source(
        source: dict[str, Any],
        *,
        app: str,
        owner: str,
        disabled: bool | None = None,
    ) -> dict[str, Any]:
        if not isinstance(source, dict):
            raise ServiceError("detection_malformed", "The detection state is malformed.")
        payload = dict(source)
        payload["spl"] = source.get("spl", source.get("search", ""))
        payload.setdefault("app", app)
        payload.setdefault("owner", owner)
        payload.setdefault("actions", "")
        try:
            draft = DetectionDraft.from_payload(payload)
        except ValueError as exc:
            raise ServiceError("detection_malformed", "The detection state is malformed.") from exc
        actual_disabled = (
            disabled
            if disabled is not None
            else SplunkDetectionService._flag(
                source.get("disabled", not SplunkDetectionService._flag(source.get("enabled", False)))
            )
        )
        state = draft.as_dict()
        state.update(
            {
                "is_scheduled": SplunkDetectionService._flag(
                    source.get("is_scheduled", bool(str(draft.cron_schedule).strip()))
                ),
                "disabled": actual_disabled,
                "enabled": not actual_disabled,
                "actions": source.get("actions", "") or "",
                "app": source.get("app") or app,
                "owner": source.get("owner") or owner,
                "sharing": source.get("sharing", "") or "",
            }
        )
        return state

    def _scoped_state(self, state: dict[str, Any]) -> dict[str, Any]:
        """Keep browser-provided metadata from redirecting the write target."""
        scoped = dict(state)
        scoped.update(
            {
                "app": self.core.settings.detection_app,
                "owner": self.core.settings.detection_owner,
                "disabled": True,
                "enabled": False,
            }
        )
        return scoped

    @classmethod
    def _complete_editor_state(cls, state: dict[str, Any]) -> dict[str, Any]:
        """Materialize every supported non-secret setting for the browser editor."""
        complete = dict(state)
        complete.setdefault("is_scheduled", False)
        complete.setdefault("cron_schedule", "")
        complete.setdefault("dispatch.earliest_time", complete.get("earliest_time", "-10m"))
        complete.setdefault("dispatch.latest_time", complete.get("latest_time", "now"))
        complete.setdefault("actions", "")
        complete.update({key: complete.get(key, default) for key, default in cls._EDITOR_DEFAULTS.items()})
        return complete

    @staticmethod
    def _merge_detection_payload(
        current: dict[str, Any],
        payload: dict[str, Any],
        *,
        name: str,
    ) -> dict[str, Any]:
        try:
            alert_fields = canonical_alert_fields(payload)
        except ValueError as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        merged = {**current, **payload, "name": name, "enabled": False}
        # Apply canonical values after the shallow merge so an alias such as
        # earliest_time or counttype cannot be masked by the current raw REST
        # field. Empty canonical values intentionally clear the setting.
        merged.update(alert_fields)
        return merged

    @staticmethod
    def _actions_changed(before: dict[str, Any], after: dict[str, Any]) -> bool:
        keys = set(public_alert_fields(before)) | set(public_alert_fields(after))
        return any(
            (key == "actions" or key.startswith("action."))
            for key in keys
            if before.get(key) != after.get(key)
        )

    @staticmethod
    def _reject_dual_spl_payload(payload: dict[str, Any]) -> None:
        supplied = [key for key in ("production_spl", "backtest_spl", "detection_logic") if key in payload]
        if supplied:
            raise ServiceError(
                "invalid_input",
                "Use the compiler output's production SPL as detection.spl; dual SPL payloads are not accepted.",
                details={"unsupported_fields": supplied},
            )

    @staticmethod
    def _with_company_log_event(
        payload: dict[str, Any], *, default_tracking: bool = False
    ) -> dict[str, Any]:
        """Apply the team's fixed Log Event action to a production payload."""
        normalized = dict(payload)
        if default_tracking:
            normalized.setdefault("alert.track", True)
        actions = [item.strip() for item in str(normalized.get("actions", "") or "").split(",") if item.strip()]
        if "logevent" not in actions:
            actions.append("logevent")
        normalized["actions"] = ",".join(actions)
        normalized["action.logevent"] = True
        normalized["action.logevent.param.source"] = "$name$"
        normalized["action.logevent.param.sourcetype"] = "ticket_details"
        normalized["action.logevent.param.host"] = ""
        normalized["action.logevent.param.index"] = "ticket_summary"
        fields = extract_final_table_fields(str(normalized.get("spl", normalized.get("search", "")) or ""))
        if fields:
            normalized["action.logevent.param.event"] = build_log_event_template(fields)
        return normalized

    @staticmethod
    def _reject_enablement(payload: dict[str, Any]) -> None:
        if "enabled" in payload and SplunkDetectionService._flag(payload.get("enabled")):
            raise ServiceError(
                "invalid_input",
                "Detection saves cannot enable a detection; leave it disabled for review.",
            )
        if (
            "disabled" in payload
            and payload.get("disabled") is not None
            and not SplunkDetectionService._flag(payload.get("disabled"))
        ):
            raise ServiceError(
                "invalid_input",
                "Detection saves cannot enable a detection; leave it disabled for review.",
            )

    @staticmethod
    def _draft_response(
        operation: str,
        state: dict[str, Any],
        *,
        expected_fingerprint: str | None = None,
        **extra: Any,
    ) -> dict[str, Any]:
        return {
            "status": "draft",
            "draft": state,
            "operation": operation,
            "target_id": state["name"],
            "expected_fingerprint": expected_fingerprint,
            "current_fingerprint": expected_fingerprint,
            "enabled": False,
            "save_requires_explicit_action": True,
            **extra,
        }

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
            "earliest_time": content.get("dispatch.earliest_time", ""),
            "latest_time": content.get("dispatch.latest_time", ""),
            "cron_schedule": content.get("cron_schedule", ""),
            "is_scheduled": self._flag(content.get("is_scheduled", False)),
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
        detection["earliest_time"] = alert_fields.get(
            "dispatch.earliest_time", detection["earliest_time"]
        )
        detection["latest_time"] = alert_fields.get(
            "dispatch.latest_time", detection["latest_time"]
        )
        detection["cron_schedule"] = alert_fields.get(
            "cron_schedule", detection["cron_schedule"]
        )
        detection["is_scheduled"] = self._flag(
            alert_fields.get("is_scheduled", detection["is_scheduled"])
        )
        detection["actions"] = alert_fields.get("actions", detection["actions"]) or ""
        detection["fingerprint"] = self._fingerprint(detection)
        return detection

    async def _get_optional_detection(self, name: str) -> dict[str, Any] | None:
        try:
            return await self.get_detection(name)
        except ServiceError as exc:
            if exc.code == "splunk_api_error" and exc.details.get("status_code") == 404:
                return None
            raise

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

    def _write_fields_from_state(self, state: dict[str, Any], *, creating: bool = False) -> dict[str, Any]:
        fields = {
            "name": state["name"],
            "search": state["spl"],
            "description": state.get("description", ""),
            "is_scheduled": "1" if state.get("is_scheduled") else "0",
            "cron_schedule": state.get("cron_schedule", ""),
            "dispatch.earliest_time": state.get(
                "dispatch.earliest_time", state.get("earliest_time", "-10m")
            ),
            "dispatch.latest_time": state.get(
                "dispatch.latest_time", state.get("latest_time", "now")
            ),
            "disabled": "1",
            "app": self.core.settings.detection_app,
            "owner": self.core.settings.detection_owner,
        }
        try:
            alert_fields = canonical_alert_fields(state)
            # The editor uses "auto" as a display-only sentinel when Splunk
            # has no explicit tracking setting; do not send that sentinel to
            # the REST API as a saved-search value.
            if alert_fields.get("alert.track") == "auto":
                alert_fields.pop("alert.track")
            fields.update(alert_fields)
        except ValueError as exc:
            raise ServiceError("invalid_input", "The detection state contains an invalid alert field.") from exc
        # These fields are always explicit so update writes cannot accidentally
        # leave a stale timing or enabled value in Splunk.
        fields.update(
            {
                "is_scheduled": "1" if state.get("is_scheduled") else "0",
                "cron_schedule": state.get("cron_schedule", ""),
                "dispatch.earliest_time": state.get(
                    "dispatch.earliest_time", state.get("earliest_time", "-10m")
                ),
                "dispatch.latest_time": state.get(
                    "dispatch.latest_time", state.get("latest_time", "now")
                ),
                "disabled": "1",
            }
        )
        if creating:
            fields.setdefault("actions", "")
        return fields

    def _require_write(self) -> None:
        settings = self.core.settings
        if not settings.detection_write_enabled:
            raise ServiceError(
                "operation_disabled",
                "Detection writes are disabled. Set SPLUNK_ALLOW_DETECTION_WRITE=true after review.",
            )

    def _prepare_write(self, payload: dict[str, Any]) -> tuple[dict[str, Any], DetectionDraft, dict[str, Any]]:
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "detection must be a JSON object")
        self._reject_dual_spl_payload(payload)
        self._reject_enablement(payload)
        payload = self._with_company_log_event(payload, default_tracking=True)
        validation = self.validate_detection({**payload, "enabled": False})
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload({**payload, "enabled": False})
        state = self._complete_editor_state(self._scoped_state(
            self._state_from_source(
                draft.as_dict(),
                app=self.core.settings.detection_app,
                owner=self.core.settings.detection_owner,
                disabled=True,
            )
        ))
        return state, draft, validation

    async def _prepare_update(
        self,
        name: str,
        payload: dict[str, Any],
        expected_fingerprint: str,
    ) -> tuple[str, dict[str, Any], dict[str, Any], dict[str, Any], DetectionDraft, dict[str, Any], bool]:
        name = self._normalize_name(name)
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "detection must be a JSON object")
        self._reject_dual_spl_payload(payload)
        self._reject_enablement(payload)
        current = await self.get_detection(name)
        self._require_expected(expected_fingerprint, current)
        merged = self._merge_detection_payload(current, payload, name=name)
        merged = self._with_company_log_event(merged)
        validation = self.validate_detection(merged)
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload(merged)
        before = self._state_from_source(
            current,
            app=self.core.settings.detection_app,
            owner=self.core.settings.detection_owner,
        )
        after = self._complete_editor_state(self._scoped_state(
            self._state_from_source(
                {
                    **merged,
                    **draft.as_dict(),
                },
                app=self.core.settings.detection_app,
                owner=self.core.settings.detection_owner,
                disabled=True,
            )
        ))
        return name, current, before, after, draft, validation, self._actions_changed(before, after)

    async def write_detection(
        self,
        payload: dict[str, Any],
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        state, draft, validation = self._prepare_write(payload)
        return self._draft_response(
            "write",
            state,
            expected_fingerprint=None,
            review_only_metadata=self._review_only_metadata(draft),
            requires_action_configuration=not bool(str(state.get("actions", "")).strip()),
            validation_warnings=validation["warnings"],
        )

    async def update_detection(
        self,
        name: str,
        payload: dict[str, Any],
        expected_fingerprint: str,
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        name, _current, _before, after, draft, validation, actions_changed = await self._prepare_update(
            name, payload, expected_fingerprint
        )
        return self._draft_response(
            "update",
            after,
            expected_fingerprint=expected_fingerprint,
            review_only_metadata=self._review_only_metadata(draft),
            actions_preserved=not actions_changed,
            actions_updated=actions_changed,
            validation_warnings=validation["warnings"],
        )

    async def save_detection(
        self,
        operation: str,
        payload: dict[str, Any],
        *,
        name: str | None = None,
        expected_fingerprint: str | None = None,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        if not isinstance(operation, str) or operation not in {"write", "update"}:
            raise ServiceError(
                "operation_not_supported",
                "Only write and update detection saves are supported.",
            )
        self._require_write()
        self._actor_id(actor_id, required=True)
        async with self._save_lock:
            if operation == "write":
                state, draft, validation = self._prepare_write(payload)
                if name is not None and self._normalize_name(name) != state["name"]:
                    raise ServiceError("target_mismatch", "The detection name changed before it was saved.")
                target = state["name"]
                if await self._get_optional_detection(target) is not None:
                    raise ServiceError("target_mismatch", "The detection target already exists.")
                await self.core.request(
                    lambda client: client.create_saved_search(
                        self._write_fields_from_state(state, creating=True)
                    )
                )
                persisted = await self.get_detection(target)
                return {
                    "status": "saved",
                    "saved": True,
                    "created": True,
                    "enabled": False,
                    "detection": persisted,
                    "review_only_metadata": self._review_only_metadata(draft),
                    "requires_action_configuration": not bool(str(persisted.get("actions", "")).strip()),
                    "validation_warnings": validation["warnings"],
                }

            target, _current, _before, after, draft, validation, actions_changed = await self._prepare_update(
                name or "", payload, expected_fingerprint or ""
            )
            fresh = await self._get_optional_detection(target)
            if fresh is None:
                raise ServiceError("target_mismatch", "The detection target no longer exists.")
            self._require_expected(expected_fingerprint or "", fresh)
            await self.core.request(
                lambda client: client.update_saved_search(
                    target,
                    self._write_fields_from_state(after),
                )
            )
            persisted = await self.get_detection(target)
            return {
                "status": "saved",
                "saved": True,
                "updated": True,
                "enabled": False,
                "detection": persisted,
                "review_only_metadata": self._review_only_metadata(draft),
                "actions_preserved": not actions_changed,
                "actions_updated": actions_changed,
                "validation_warnings": validation["warnings"],
            }


__all__ = ["SplunkDetectionService"]
