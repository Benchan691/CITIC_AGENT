"""Exact, short-lived approvals for Splunk detection changes.

The host approval service is intentionally tool-oriented.  Detection writes
need a stronger boundary, so this module keeps the proposal and approval
records in the server process and binds every approval to one immutable
before/after state.

The store is deliberately in-memory.  A process restart invalidates pending
approvals, which is safer than accidentally replaying an approval whose
operator context is no longer present.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from types import MappingProxyType
from typing import Any, Literal

from unified_mcp_server.errors import ServiceError


DetectionOperation = Literal["write", "update"]
_OPERATIONS = frozenset({"write", "update"})
logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _timestamp(value: datetime) -> str:
    return _as_utc(value).isoformat().replace("+00:00", "Z")


def _normalize(value: Any) -> Any:
    """Return the restricted JSON value used for proposal hashing."""
    if isinstance(value, Mapping):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError("proposal object keys must be strings")
            normalized[key] = _normalize(item)
        return normalized
    if isinstance(value, (list, tuple)):
        return [_normalize(item) for item in value]
    if isinstance(value, (str, int, bool)) or value is None:
        return value
    if isinstance(value, float):
        # json.dumps(..., allow_nan=False) provides the final finite-value
        # check; retaining this branch makes the intended JSON boundary clear.
        return value
    raise ValueError(f"proposal contains unsupported value {type(value).__name__}")


def canonical_json(value: Mapping[str, Any]) -> str:
    """Serialize one security payload deterministically."""
    return json.dumps(
        _normalize(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


def compute_proposal_hash(security_payload: Mapping[str, Any]) -> str:
    return hashlib.sha256(canonical_json(security_payload).encode("utf-8")).hexdigest()


def build_security_payload(
    *,
    operation: str,
    target_id: str | None,
    current_fingerprint: str | None,
    before: Mapping[str, Any] | None,
    after: Mapping[str, Any] | None,
) -> dict[str, Any]:
    if operation not in _OPERATIONS:
        raise ValueError(f"unsupported detection operation: {operation}")
    return _normalize(
        {
            "operation": operation,
            "target_id": target_id,
            "current_fingerprint": current_fingerprint,
            "before": before,
            "after": after,
        }
    )


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


def _thaw(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _thaw(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw(item) for item in value]
    return value


def _diff(
    before: Mapping[str, Any] | None,
    after: Mapping[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    before_value = dict(before or {})
    after_value = dict(after or {})
    keys = list(after_value)
    keys.extend(key for key in before_value if key not in after_value)
    return {
        key: {"before": before_value.get(key), "after": after_value.get(key)}
        for key in keys
        if before_value.get(key) != after_value.get(key)
    }


@dataclass(frozen=True)
class DetectionChangeProposal:
    proposal_id: str
    operation: DetectionOperation
    target_id: str | None
    current_fingerprint: str | None
    before: Mapping[str, Any] | None
    after: Mapping[str, Any] | None
    proposal_hash: str
    created_by: str
    created_at: datetime
    expires_at: datetime
    security_payload: Mapping[str, Any]

    @classmethod
    def create(
        cls,
        *,
        operation: DetectionOperation,
        target_id: str | None,
        current_fingerprint: str | None,
        before: Mapping[str, Any] | None,
        after: Mapping[str, Any] | None,
        created_by: str,
        created_at: datetime,
        expires_at: datetime,
    ) -> "DetectionChangeProposal":
        payload = build_security_payload(
            operation=operation,
            target_id=target_id,
            current_fingerprint=current_fingerprint,
            before=before,
            after=after,
        )
        normalized_before = _normalize(before) if before is not None else None
        normalized_after = _normalize(after) if after is not None else None
        return cls(
            proposal_id=f"dcp_{uuid.uuid4().hex}",
            operation=operation,
            target_id=target_id,
            current_fingerprint=current_fingerprint,
            before=_freeze(normalized_before),
            after=_freeze(normalized_after),
            proposal_hash=compute_proposal_hash(payload),
            created_by=created_by,
            created_at=_as_utc(created_at),
            expires_at=_as_utc(expires_at),
            security_payload=_freeze(payload),
        )

    def public(self) -> dict[str, Any]:
        before = _thaw(self.before)
        after = _thaw(self.after)
        return {
            "proposal_id": self.proposal_id,
            "operation": self.operation,
            "target_id": self.target_id,
            "current_fingerprint": self.current_fingerprint,
            "before": before,
            "after": after,
            "proposal_hash": self.proposal_hash,
            "created_by": self.created_by,
            "created_at": _timestamp(self.created_at),
            "expires_at": _timestamp(self.expires_at),
            "diff": _diff(before, after),
        }


@dataclass(frozen=True)
class DetectionApproval:
    approval_id: str
    proposal_id: str
    proposal_hash: str
    target_id: str | None
    operation: DetectionOperation
    approved_by: str
    approved_at: datetime
    expires_at: datetime
    consumed: bool = False
    consumed_at: datetime | None = None
    in_progress: bool = False

    def public(self) -> dict[str, Any]:
        return {
            "approval_id": self.approval_id,
            "proposal_id": self.proposal_id,
            "proposal_hash": self.proposal_hash,
            "target_id": self.target_id,
            "operation": self.operation,
            "approved_by": self.approved_by,
            "approved_at": _timestamp(self.approved_at),
            "expires_at": _timestamp(self.expires_at),
            "consumed": self.consumed,
        }


class DetectionApprovalStore:
    """Thread-safe in-memory proposal/approval registry."""

    def __init__(
        self,
        ttl_seconds: int = 600,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        if isinstance(ttl_seconds, bool) or not isinstance(ttl_seconds, int) or ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be a positive integer")
        self.ttl_seconds = ttl_seconds
        self._clock = clock or _utc_now
        self._lock = threading.RLock()
        self._proposals: dict[str, DetectionChangeProposal] = {}
        self._approvals: dict[str, DetectionApproval] = {}
        self._approval_by_proposal: dict[str, str] = {}

    def _now(self) -> datetime:
        return _as_utc(self._clock())

    @staticmethod
    def _require_identity(value: str | None, role: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ServiceError("not_authorized", f"An authenticated {role} is required.")
        return value.strip()

    def create_proposal(
        self,
        *,
        operation: DetectionOperation,
        target_id: str | None,
        current_fingerprint: str | None,
        before: Mapping[str, Any] | None,
        after: Mapping[str, Any] | None,
        created_by: str,
    ) -> DetectionChangeProposal:
        creator = self._require_identity(created_by, "detection proposal creator")
        now = self._now()
        try:
            proposal = DetectionChangeProposal.create(
                operation=operation,
                target_id=target_id,
                current_fingerprint=current_fingerprint,
                before=before,
                after=after,
                created_by=creator,
                created_at=now,
                expires_at=now + timedelta(seconds=self.ttl_seconds),
            )
        except (TypeError, ValueError) as exc:
            raise ServiceError("proposal_payload_mismatch", "The detection proposal is not valid JSON.") from exc
        with self._lock:
            self._proposals[proposal.proposal_id] = proposal
        logger.info(
            "detection_change_proposal_created proposal_id=%s proposal_hash=%s operation=%s target_id=%s created_by=%s current_fingerprint=%s expires_at=%s",
            proposal.proposal_id,
            proposal.proposal_hash,
            proposal.operation,
            proposal.target_id,
            proposal.created_by,
            proposal.current_fingerprint,
            _timestamp(proposal.expires_at),
        )
        return proposal

    def get_proposal(self, proposal_id: str) -> DetectionChangeProposal:
        with self._lock:
            proposal = self._proposals.get(proposal_id)
        if proposal is None:
            raise ServiceError("proposal_not_found", "The detection proposal was not found.")
        return proposal

    def approve(
        self,
        proposal_id: str,
        *,
        approved_by: str,
        proposal_hash: str | None = None,
    ) -> DetectionApproval:
        approver = self._require_identity(approved_by, "detection approver")
        with self._lock:
            proposal = self._proposals.get(proposal_id)
            if proposal is None:
                raise ServiceError("proposal_not_found", "The detection proposal was not found.")
            now = self._now()
            if now >= proposal.expires_at:
                raise ServiceError("approval_expired", "The detection proposal has expired; create a new proposal.")
            if proposal_hash is not None and (
                not isinstance(proposal_hash, str)
                or (proposal_hash.strip() and proposal_hash.strip() != proposal.proposal_hash)
            ):
                raise ServiceError(
                    "proposal_hash_mismatch",
                    "The supplied proposal hash does not match the stored proposal.",
                    details={"proposal_hash": proposal.proposal_hash},
                )
            existing_id = self._approval_by_proposal.get(proposal_id)
            if existing_id is not None:
                existing = self._approvals[existing_id]
                if existing.consumed or existing.in_progress:
                    raise ServiceError("approval_consumed", "The detection approval has already been used.")
                if existing.approved_by != approver:
                    raise ServiceError("not_authorized", "The detection proposal is already approved by another user.")
                return existing
            approval = DetectionApproval(
                approval_id=f"dca_{uuid.uuid4().hex}",
                proposal_id=proposal.proposal_id,
                proposal_hash=proposal.proposal_hash,
                target_id=proposal.target_id,
                operation=proposal.operation,
                approved_by=approver,
                approved_at=now,
                expires_at=min(proposal.expires_at, now + timedelta(seconds=self.ttl_seconds)),
            )
            self._approvals[approval.approval_id] = approval
            self._approval_by_proposal[proposal_id] = approval.approval_id
        logger.info(
            "detection_change_approved approval_id=%s proposal_id=%s proposal_hash=%s operation=%s target_id=%s approved_by=%s expires_at=%s",
            approval.approval_id,
            approval.proposal_id,
            approval.proposal_hash,
            approval.operation,
            approval.target_id,
            approval.approved_by,
            _timestamp(approval.expires_at),
        )
        return approval

    def get_approval(self, approval_id: str) -> DetectionApproval:
        with self._lock:
            approval = self._approvals.get(approval_id)
        if approval is None:
            raise ServiceError("approval_not_found", "The detection approval was not found.")
        return approval

    def claim(
        self,
        approval_id: str,
        *,
        actor_id: str,
        operation: str | None = None,
        target_id: str | None = None,
        proposal_hash: str | None = None,
    ) -> tuple[DetectionApproval, DetectionChangeProposal]:
        actor = self._require_identity(actor_id, "detection approver")
        with self._lock:
            approval = self._approvals.get(approval_id)
            if approval is None:
                raise ServiceError("approval_not_found", "The detection approval was not found.")
            now = self._now()
            if now >= approval.expires_at:
                raise ServiceError("approval_expired", "The detection approval has expired; create a new proposal.")
            if approval.consumed or approval.in_progress:
                raise ServiceError("approval_consumed", "The detection approval has already been used.")
            if approval.approved_by != actor:
                raise ServiceError("not_authorized", "Only the approving user may apply this detection change.")
            proposal = self._proposals.get(approval.proposal_id)
            if proposal is None:
                raise ServiceError("proposal_not_found", "The detection proposal was not found.")
            if approval.proposal_id != proposal.proposal_id:
                raise ServiceError("proposal_payload_mismatch", "The approval is not bound to its stored proposal.")
            if approval.proposal_hash != proposal.proposal_hash:
                raise ServiceError("proposal_hash_mismatch", "The approval hash does not match the stored proposal.")
            if approval.operation != proposal.operation:
                raise ServiceError("operation_mismatch", "The approval operation does not match the stored proposal.")
            if approval.target_id != proposal.target_id:
                raise ServiceError("target_mismatch", "The approval target does not match the stored proposal.")
            if operation is not None and operation and operation != proposal.operation:
                raise ServiceError("operation_mismatch", "The requested operation does not match the approved proposal.")
            if target_id is not None and target_id and target_id != proposal.target_id:
                raise ServiceError("target_mismatch", "The requested target does not match the approved proposal.")
            if proposal_hash is not None and proposal_hash and proposal_hash != proposal.proposal_hash:
                raise ServiceError("proposal_hash_mismatch", "The requested proposal hash does not match the approved proposal.")
            claimed = replace(approval, in_progress=True)
            self._approvals[approval_id] = claimed
        return claimed, proposal

    def consume(self, approval_id: str, *, result: str) -> DetectionApproval:
        with self._lock:
            approval = self._approvals.get(approval_id)
            if approval is None:
                raise ServiceError("approval_not_found", "The detection approval was not found.")
            if approval.consumed:
                return approval
            consumed = replace(
                approval,
                consumed=True,
                in_progress=False,
                consumed_at=self._now(),
            )
            self._approvals[approval_id] = consumed
        logger.info(
            "detection_change_application approval_id=%s proposal_id=%s proposal_hash=%s operation=%s target_id=%s approved_by=%s result=%s consumed_at=%s",
            consumed.approval_id,
            consumed.proposal_id,
            consumed.proposal_hash,
            consumed.operation,
            consumed.target_id,
            consumed.approved_by,
            result,
            _timestamp(consumed.consumed_at or self._now()),
        )
        return consumed


__all__ = [
    "DetectionApproval",
    "DetectionApprovalStore",
    "DetectionChangeProposal",
    "DetectionOperation",
    "build_security_payload",
    "canonical_json",
    "compute_proposal_hash",
]
