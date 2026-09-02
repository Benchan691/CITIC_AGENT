"""Splunk detection review, backtesting, and approved action operations."""

from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any

from ..core.service import SplunkCore
from ..search.executor import SearchExecutor
from .approval import (
    DetectionApprovalStore,
    DetectionChangeProposal,
    build_security_payload,
    canonical_json,
    compute_proposal_hash,
)
from .model import (
    DetectionDraft,
    canonical_alert_fields,
    public_alert_fields,
    validate_detection,
)
from unified_mcp_server.errors import ServiceError


class SplunkDetectionService:
    """Keep detection writes behind exact, server-side proposals."""

    def __init__(
        self,
        core: SplunkCore,
        executor: SearchExecutor | None = None,
        approval_store: DetectionApprovalStore | None = None,
    ) -> None:
        self.core = core
        self.executor = executor if executor is not None else SearchExecutor(core)
        self.approval_store = (
            approval_store
            if approval_store is not None
            else DetectionApprovalStore(getattr(core.settings, "detection_approval_ttl_seconds", 600))
        )
        # The store's atomic claim is authoritative. This additional
        # process-local lock keeps the final read and write together for
        # concurrent service calls targeting the same process.
        self._apply_lock = asyncio.Lock()

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
    def _review_only_metadata_from_state(state: dict[str, Any]) -> dict[str, Any]:
        return {
            "severity": state.get("severity", "medium"),
            "mitre_attack": list(state.get("mitre_attack", [])),
            "risk_score": state.get("risk_score", 0),
            "risk_objects": list(state.get("risk_objects", [])),
            "suppression_window": state.get("suppression_window", ""),
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
            raise ServiceError("proposal_payload_mismatch", "The detection state is malformed.")
        payload = dict(source)
        payload["spl"] = source.get("spl", source.get("search", ""))
        payload.setdefault("app", app)
        payload.setdefault("owner", owner)
        payload.setdefault("actions", "")
        try:
            draft = DetectionDraft.from_payload(payload)
        except ValueError as exc:
            raise ServiceError("proposal_payload_mismatch", "The detection state is malformed.") from exc
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
    def _proposal_response(proposal: DetectionChangeProposal, **extra: Any) -> dict[str, Any]:
        public = proposal.public()
        return {
            "status": "approval_required",
            "approval_required": True,
            "proposal": public,
            "proposal_id": proposal.proposal_id,
            "proposal_hash": proposal.proposal_hash,
            "operation": proposal.operation,
            "target_id": proposal.target_id,
            "current_fingerprint": proposal.current_fingerprint,
            "expires_at": public["expires_at"],
            "diff": public["diff"],
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
            # response ACL redirect a later approved write elsewhere.
            "app": self.core.settings.detection_app,
            "owner": self.core.settings.detection_owner,
            "sharing": acl.get("sharing", ""),
        }
        detection.update(alert_fields)
        # Keep the legacy aliases in reads while exposing the raw REST names
        # beside them. The raw values are the canonical source for proposals.
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
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "detection must be a JSON object")
        validation = self.validate_detection({**payload, "earliest_time": earliest_time, "latest_time": latest_time})
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
            "app": state["app"],
            "owner": state["owner"],
        }
        try:
            fields.update(canonical_alert_fields(state))
        except ValueError as exc:
            raise ServiceError("proposal_payload_mismatch", "The detection state contains an invalid alert field.") from exc
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

    async def create_detection_draft(
        self,
        payload: dict[str, Any],
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        self._require_write()
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "detection must be a JSON object")
        validation = self.validate_detection({**payload, "enabled": False})
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload({**payload, "enabled": False})
        state = self._state_from_source(
            draft.as_dict(),
            app=self.core.settings.detection_app,
            owner=self.core.settings.detection_owner,
            disabled=True,
        )
        proposal = self.approval_store.create_proposal(
            operation="create",
            target_id=draft.name,
            current_fingerprint=None,
            before=None,
            after=state,
            created_by=self._actor_id(actor_id),
        )
        return self._proposal_response(
            proposal,
            enabled=False,
            review_only_metadata=self._review_only_metadata(draft),
            requires_action_configuration=not bool(str(state.get("actions", "")).strip()),
        )

    async def update_detection_draft(
        self,
        name: str,
        payload: dict[str, Any],
        expected_fingerprint: str,
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        self._require_write()
        name = self._normalize_name(name)
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "detection must be a JSON object")
        current = await self.get_detection(name)
        self._require_expected(expected_fingerprint, current)
        merged = self._merge_detection_payload(current, payload, name=name)
        validation = self.validate_detection(merged)
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload(merged)
        before = self._state_from_source(
            current,
            app=self.core.settings.detection_app,
            owner=self.core.settings.detection_owner,
        )
        after = self._state_from_source(
            {
                **merged,
                **draft.as_dict(),
            },
            app=self.core.settings.detection_app,
            owner=self.core.settings.detection_owner,
            disabled=True,
        )
        actions_changed = self._actions_changed(before, after)
        proposal = self.approval_store.create_proposal(
            operation="update",
            target_id=name,
            current_fingerprint=current["fingerprint"],
            before=before,
            after=after,
            created_by=self._actor_id(actor_id),
        )
        return self._proposal_response(
            proposal,
            enabled=False,
            review_only_metadata=self._review_only_metadata(draft),
            actions_preserved=not actions_changed,
            actions_updated=actions_changed,
        )

    async def set_detection_enabled(
        self,
        name: str,
        enabled: bool,
        expected_fingerprint: str,
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        if not isinstance(enabled, bool):
            raise ServiceError("invalid_input", "enabled must be a boolean")
        self._require_write(enabling=enabled)
        name = self._normalize_name(name)
        current = await self.get_detection(name)
        self._require_expected(expected_fingerprint, current)
        if enabled:
            if not current.get("is_scheduled"):
                raise ServiceError(
                    "detection_not_runnable",
                    "The persisted Splunk detection must be scheduled before it can be enabled.",
                )
            earliest = str(
                current.get("dispatch.earliest_time", current.get("earliest_time", ""))
            ).strip().lower()
            latest = str(
                current.get("dispatch.latest_time", current.get("latest_time", ""))
            ).strip().lower()
            realtime = earliest.startswith("rt") or latest.startswith("rt")
            if realtime and not (earliest.startswith("rt") and latest.startswith("rt")):
                raise ServiceError(
                    "detection_not_runnable",
                    "Real-time detections must have rt-prefixed earliest and latest times.",
                )
            if not realtime and not str(current.get("cron_schedule", "")).strip():
                raise ServiceError(
                    "detection_not_runnable",
                    "The persisted Splunk detection must have an active schedule before it can be enabled.",
                )
            if not str(current.get("actions", "")).strip():
                raise ServiceError(
                    "detection_not_runnable",
                    "The persisted Splunk detection must have at least one alert action before it can be enabled.",
                )
            validation_payload = {**current, "enabled": False}
            # Splunk may omit these optional dispatch values. Preserve the
            # legacy defaults used by the enable guard in that case.
            if not validation_payload.get("earliest_time"):
                validation_payload["earliest_time"] = "-10m"
                if "dispatch.earliest_time" in validation_payload:
                    validation_payload["dispatch.earliest_time"] = "-10m"
            if not validation_payload.get("latest_time"):
                validation_payload["latest_time"] = "now"
                if "dispatch.latest_time" in validation_payload:
                    validation_payload["dispatch.latest_time"] = "now"
            validation = self.validate_detection(validation_payload)
            if not validation["valid"]:
                raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        before = self._state_from_source(
            current,
            app=self.core.settings.detection_app,
            owner=self.core.settings.detection_owner,
        )
        after = self._state_from_source(
            current,
            app=self.core.settings.detection_app,
            owner=self.core.settings.detection_owner,
            disabled=not enabled,
        )
        proposal = self.approval_store.create_proposal(
            operation="enable" if enabled else "disable",
            target_id=name,
            current_fingerprint=current["fingerprint"],
            before=before,
            after=after,
            created_by=self._actor_id(actor_id),
        )
        return self._proposal_response(proposal, name=name, enabled=enabled)

    async def approve_detection_change(
        self,
        proposal_id: str,
        proposal_hash: str = "",
        *,
        actor_id: str | None = None,
        approved_by: str | None = None,
    ) -> dict[str, Any]:
        actor = self._actor_id(approved_by or actor_id, required=True)
        approval = self.approval_store.approve(
            self._normalize_id(proposal_id, "proposal_id"),
            approved_by=actor,
            proposal_hash=proposal_hash,
        )
        public = approval.public()
        return {
            "status": "approved",
            "approval": public,
            "approval_id": approval.approval_id,
            "proposal_id": approval.proposal_id,
            "proposal_hash": approval.proposal_hash,
            "operation": approval.operation,
            "target_id": approval.target_id,
            "expires_at": public["expires_at"],
        }

    @staticmethod
    def _normalize_id(value: str, field: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ServiceError("invalid_input", f"{field} cannot be empty")
        return value.strip()

    async def apply_approved_detection_change(
        self,
        approval_id: str,
        *,
        operation: str | None = None,
        target_id: str | None = None,
        proposal_hash: str | None = None,
        actor_id: str | None = None,
        approved_by: str | None = None,
    ) -> dict[str, Any]:
        approval_id = self._normalize_id(approval_id, "approval_id")
        # Read the immutable record first so an unknown approval reports the
        # precise failure instead of being hidden by a global kill switch.
        approval_record = self.approval_store.get_approval(approval_id)
        self._require_write(enabling=approval_record.operation == "enable")
        actor = self._actor_id(approved_by or actor_id, required=True)

        claimed = None
        result = "failed"
        async with self._apply_lock:
            try:
                claimed, proposal = self.approval_store.claim(
                    approval_id,
                    actor_id=actor,
                    operation=operation,
                    target_id=target_id,
                    proposal_hash=proposal_hash,
                )
                fresh_payload = build_security_payload(
                    operation=proposal.operation,
                    target_id=proposal.target_id,
                    current_fingerprint=proposal.current_fingerprint,
                    before=proposal.before,
                    after=proposal.after,
                )
                recomputed_hash = compute_proposal_hash(fresh_payload)
                if recomputed_hash != proposal.proposal_hash or claimed.proposal_hash != recomputed_hash:
                    raise ServiceError(
                        "proposal_hash_mismatch",
                        "The stored detection proposal hash no longer matches its payload.",
                    )
                if proposal.after is None:
                    raise ServiceError("proposal_payload_mismatch", "The approved proposal has no after state.")
                validation = self.validate_detection({**dict(proposal.after), "enabled": False})
                if not validation["valid"]:
                    raise ServiceError("detection_invalid", "The approved detection proposal is no longer valid.", details=validation)

                # Re-read after claiming so the fingerprint check is as close
                # to the write as possible. No caller-supplied payload is used.
                current = await self._get_optional_detection(proposal.target_id or "")
                if proposal.operation == "create":
                    if proposal.before is not None or proposal.current_fingerprint is not None:
                        raise ServiceError("proposal_payload_mismatch", "The create proposal has an invalid prior state.")
                    if current is not None:
                        raise ServiceError("target_mismatch", "The detection target already exists.")
                    await self.core.request(
                        lambda client: client.create_saved_search(
                            self._write_fields_from_state(dict(proposal.after), creating=True)
                        )
                    )
                    persisted = await self.get_detection(proposal.target_id or "")
                    result_payload = {
                        "created": True,
                        "enabled": False,
                        "detection": persisted,
                        "review_only_metadata": self._review_only_metadata_from_state(dict(proposal.after)),
                        "requires_action_configuration": not bool(str(persisted.get("actions", "")).strip()),
                    }
                else:
                    if current is None:
                        raise ServiceError("target_mismatch", "The approved detection target no longer exists.")
                    if current.get("fingerprint") != proposal.current_fingerprint:
                        raise ServiceError(
                            "stale_fingerprint",
                            "The detection changed after this proposal was approved; create a new proposal.",
                            details={"current_fingerprint": current.get("fingerprint")},
                        )
                    current_state = self._state_from_source(
                        current,
                        app=self.core.settings.detection_app,
                        owner=self.core.settings.detection_owner,
                    )
                    if canonical_json({"state": proposal.before or {}}) != canonical_json({"state": current_state}):
                        raise ServiceError(
                            "proposal_payload_mismatch",
                            "The current detection state does not match the approved prior state.",
                        )
                    if proposal.operation == "update":
                        await self.core.request(
                            lambda client: client.update_saved_search(
                                proposal.target_id or "",
                                self._write_fields_from_state(dict(proposal.after)),
                            )
                        )
                    elif proposal.operation in {"enable", "disable"}:
                        await self.core.request(
                            lambda client: client.update_saved_search(
                                proposal.target_id or "",
                                {
                                    "disabled": "0" if proposal.operation == "enable" else "1",
                                    "app": proposal.after["app"],
                                    "owner": proposal.after["owner"],
                                },
                            )
                        )
                    else:
                        raise ServiceError("operation_mismatch", "The approved detection operation is not supported.")
                    persisted = await self.get_detection(proposal.target_id or "")
                    if proposal.operation == "update":
                        actions_changed = self._actions_changed(
                            dict(proposal.before or {}), dict(proposal.after or {})
                        )
                        result_payload = {
                            "updated": True,
                            "enabled": False,
                            "detection": persisted,
                            "review_only_metadata": self._review_only_metadata_from_state(dict(proposal.after)),
                            "actions_preserved": not actions_changed,
                            "actions_updated": actions_changed,
                        }
                    else:
                        result_payload = {
                            "updated": True,
                            "name": proposal.target_id,
                            "enabled": not persisted["disabled"],
                            "app": proposal.after["app"],
                            "owner": proposal.after["owner"],
                            "fingerprint": persisted["fingerprint"],
                        }
                result = "applied"
                return {
                    "status": "applied",
                    "applied": True,
                    "approval_id": claimed.approval_id,
                    "proposal_id": proposal.proposal_id,
                    "proposal_hash": proposal.proposal_hash,
                    **result_payload,
                }
            except ServiceError as exc:
                result = exc.code
                raise
            except Exception:
                result = "internal_error"
                raise
            finally:
                if claimed is not None:
                    # Consume even when the remote outcome is uncertain. This
                    # prevents a timeout/transport error from being replayed
                    # into a duplicate detection write.
                    self.approval_store.consume(approval_id, result=result)


__all__ = ["SplunkDetectionService"]
