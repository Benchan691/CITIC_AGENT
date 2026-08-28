"""Canonical, provider-neutral security queue models."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass, field
from typing import Any, Literal, Mapping


Severity = Literal["informational", "low", "medium", "high", "critical", "unknown"]
Urgency = Literal["informational", "low", "medium", "high", "critical", "unknown"]
Status = Literal["new", "in_progress", "pending", "resolved", "closed", "unknown"]
Disposition = Literal["true_positive", "false_positive", "benign", "undetermined", "unknown"]

SEVERITIES = frozenset({"informational", "low", "medium", "high", "critical", "unknown"})
URGENCIES = frozenset({"informational", "low", "medium", "high", "critical", "unknown"})
STATUSES = frozenset({"new", "in_progress", "pending", "resolved", "closed", "unknown"})
DISPOSITIONS = frozenset({"true_positive", "false_positive", "benign", "undetermined", "unknown"})


@dataclass(frozen=True)
class SecurityQueueConfig:
    """Safety limits for one logical security-queue request."""

    max_backend_pages_per_request: int = 10
    max_backend_records_per_request: int = 1_000
    standard_concurrency: int = 5

    def __post_init__(self) -> None:
        for name in (
            "max_backend_pages_per_request",
            "max_backend_records_per_request",
            "standard_concurrency",
        ):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                raise ValueError(f"{name} must be a positive integer")

    def to_dict(self) -> dict[str, Any]:
        return {
            "max_backend_pages_per_request": self.max_backend_pages_per_request,
            "max_backend_records_per_request": self.max_backend_records_per_request,
            "standard_concurrency": self.standard_concurrency,
        }


def normalize_enum(value: Any, aliases: Mapping[str, str], allowed: frozenset[str]) -> str | None:
    """Normalize a vendor value while leaving absent values absent."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, Mapping):
        for key in ("value", "name", "label", "code"):
            if value.get(key) not in (None, ""):
                value = value[key]
                break
    text = str(value).strip()
    if not text:
        return None
    normalized = aliases.get(text.casefold(), text.casefold().replace(" ", "_"))
    return normalized if normalized in allowed else "unknown"


def normalize_severity(value: Any) -> Severity | None:
    aliases = {
        "info": "informational",
        "informative": "informational",
        "informational": "informational",
        "1": "informational",
        "low": "low",
        "2": "low",
        "medium": "medium",
        "med": "medium",
        "3": "medium",
        "high": "high",
        "4": "high",
        "critical": "critical",
        "crit": "critical",
        "5": "critical",
    }
    return normalize_enum(value, aliases, SEVERITIES)  # type: ignore[return-value]


def normalize_urgency(value: Any) -> Urgency | None:
    aliases = {"info": "informational", "informative": "informational"}
    return normalize_enum(value, aliases, URGENCIES)  # type: ignore[return-value]


def normalize_status(value: Any) -> Status | None:
    aliases = {
        "in progress": "in_progress",
        "in-progress": "in_progress",
        "in_progress": "in_progress",
    }
    return normalize_enum(value, aliases, STATUSES)  # type: ignore[return-value]


def normalize_disposition(value: Any) -> Disposition | None:
    aliases = {
        "true positive": "true_positive",
        "true-positive": "true_positive",
        "false positive": "false_positive",
        "false-positive": "false_positive",
    }
    return normalize_enum(value, aliases, DISPOSITIONS)  # type: ignore[return-value]


def normalize_array(value: Any) -> list[Any]:
    """Keep useful provider arrays while removing duplicate JSON values."""
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    output: list[Any] = []
    seen: set[str] = set()
    for item in values:
        if item is None or item == "":
            continue
        try:
            marker = json.dumps(item, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
        except (TypeError, ValueError):
            marker = repr(item)
        if marker not in seen:
            seen.add(marker)
            output.append(item)
    return output


@dataclass(frozen=True)
class QueueCapabilities:
    source: str
    native_findings: bool
    native_investigations: bool
    status: bool
    owner: bool
    urgency: bool
    disposition: bool
    persistent_history: bool = False
    history_complete: bool = False
    retention_limited: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "native_findings": self.native_findings,
            "native_investigations": self.native_investigations,
            "status": self.status,
            "owner": self.owner,
            "urgency": self.urgency,
            "disposition": self.disposition,
            "persistent_history": self.persistent_history,
            "history_complete": self.history_complete,
            "retention_limited": self.retention_limited,
        }


@dataclass(frozen=True)
class FindingFilters:
    status: str = ""
    urgency: str = ""
    owner: str = ""
    detection: str = ""
    earliest_time: str = "-24h"
    latest_time: str = "now"
    limit: int = 50
    cursor: str = ""


@dataclass(frozen=True)
class FindingSummary:
    finding_id: str
    source: str
    source_type: str
    synthetic: bool
    type: str
    title: str | None
    detection_name: str | None
    trigger_time: str | None
    severity: Severity | None
    urgency: Urgency | None
    status: Status | None
    owner: str | None
    disposition: Disposition | None
    entities: list[Any] = field(default_factory=list)
    risk_objects: list[Any] = field(default_factory=list)
    mitre_attack: list[Any] = field(default_factory=list)
    supporting_sid: str | None = None
    event_count: int | None = None
    source_status: str | None = None
    schema_version: int = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "finding_id": self.finding_id,
            "source": self.source,
            "source_type": self.source_type,
            "synthetic": self.synthetic,
            "type": self.type,
            "title": self.title,
            "detection_name": self.detection_name,
            "trigger_time": self.trigger_time,
            "severity": self.severity,
            "urgency": self.urgency,
            "status": self.status,
            "owner": self.owner,
            "disposition": self.disposition,
            "entities": list(self.entities),
            "risk_objects": list(self.risk_objects),
            "mitre_attack": list(self.mitre_attack),
            "supporting_sid": self.supporting_sid,
            "event_count": self.event_count,
            "source_status": self.source_status,
        }


@dataclass(frozen=True)
class FindingPage:
    findings: list[FindingSummary]
    next_cursor: str | None
    truncated: bool
    total_count: int | None = None
    total_count_exact: bool = False
    partial: bool = False
    partial_reason: str | None = None
    backend_pages_fetched: int = 0
    backend_records_seen: int = 0
    local_filtered_count: int = 0


class OpaqueIdCodec:
    """Sign short-lived provider references without exposing REST paths."""

    def __init__(self, secret: bytes | None = None) -> None:
        self._secret = secret or secrets.token_bytes(32)

    def encode(self, provider: str, kind: str, values: Mapping[str, Any]) -> str:
        payload = {
            "version": 1,
            "provider": provider,
            "kind": kind,
            "values": dict(values),
        }
        body = self._b64(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode())
        signature = self._b64(hmac.new(self._secret, body.encode(), hashlib.sha256).digest())
        return f"{provider}:{kind}:{body}.{signature}"

    def decode(self, value: str, *, provider: str | None = None, kind: str | None = None) -> dict[str, Any]:
        if not isinstance(value, str) or len(value) > 8_192:
            raise ValueError("reference is invalid")
        prefix_provider, separator, remainder = value.partition(":")
        prefix_kind, separator2, token = remainder.partition(":")
        if not separator or not separator2 or not prefix_provider or not prefix_kind:
            raise ValueError("reference is invalid")
        if provider is not None and prefix_provider != provider:
            raise ValueError("reference belongs to another provider")
        if kind is not None and prefix_kind != kind:
            raise ValueError("reference kind is invalid")
        body, separator3, signature = token.partition(".")
        if not separator3 or not body or not signature:
            raise ValueError("reference is invalid")
        expected = self._b64(hmac.new(self._secret, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, signature):
            raise ValueError("reference signature is invalid")
        try:
            payload = json.loads(self._unb64(body))
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            raise ValueError("reference payload is invalid") from exc
        if not isinstance(payload, dict):
            raise ValueError("reference payload is invalid")
        if payload.get("version") != 1 or payload.get("provider") != prefix_provider or payload.get("kind") != prefix_kind:
            raise ValueError("reference payload is invalid")
        values = payload.get("values")
        if not isinstance(values, dict):
            raise ValueError("reference payload is invalid")
        return values

    @staticmethod
    def _b64(value: bytes) -> str:
        return base64.urlsafe_b64encode(value).decode().rstrip("=")

    @staticmethod
    def _unb64(value: str) -> bytes:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
