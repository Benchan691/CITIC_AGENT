"""Detection-rule data model and local validation helpers.

The model deliberately maps to the portable subset of Splunk saved-search
fields.  Enterprise Security-specific fields are retained as metadata so the
agent can review them without pretending that the generic Splunk endpoint
understands every ES adaptive-response setting.
"""

from dataclasses import dataclass, field
import re
from typing import Any


_SEVERITIES = {"informational", "low", "medium", "high", "critical"}
_MITRE_ID = re.compile(r"^T\d{4}(?:\.\d{3})?$", re.IGNORECASE)


@dataclass(frozen=True)
class DetectionDraft:
    name: str
    spl: str
    description: str = ""
    earliest_time: str = "-10m"
    latest_time: str = "now"
    cron_schedule: str = ""
    severity: str = "medium"
    mitre_attack: tuple[str, ...] = field(default_factory=tuple)
    risk_score: int = 0
    risk_objects: tuple[str, ...] = field(default_factory=tuple)
    suppression_window: str = ""
    enabled: bool = False

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "DetectionDraft":
        if not isinstance(payload, dict):
            raise ValueError("detection must be a JSON object")

        def text(key: str, default: str = "") -> str:
            value = payload.get(key, default)
            return str(value).strip() if value is not None else default

        mitre = payload.get("mitre_attack", ())
        objects = payload.get("risk_objects", ())
        if isinstance(mitre, str):
            mitre = [mitre]
        if isinstance(objects, str):
            objects = [objects]
        if not isinstance(mitre, (list, tuple)) or not isinstance(objects, (list, tuple)):
            raise ValueError("mitre_attack and risk_objects must be arrays of strings")
        try:
            score = int(payload.get("risk_score", 0))
        except (TypeError, ValueError) as exc:
            raise ValueError("risk_score must be an integer") from exc
        return cls(
            name=text("name"),
            spl=text("spl", text("search")),
            description=text("description"),
            earliest_time=text("earliest_time", "-10m"),
            latest_time=text("latest_time", "now"),
            cron_schedule=text("cron_schedule"),
            severity=text("severity", "medium").lower(),
            mitre_attack=tuple(str(item).strip() for item in mitre if str(item).strip()),
            risk_score=score,
            risk_objects=tuple(str(item).strip() for item in objects if str(item).strip()),
            suppression_window=text("suppression_window"),
            enabled=(
                payload.get("enabled", False)
                if isinstance(payload.get("enabled", False), bool)
                else str(payload.get("enabled", "")).strip().lower() in {"1", "true", "yes", "on"}
            ),
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "spl": self.spl,
            "earliest_time": self.earliest_time,
            "latest_time": self.latest_time,
            "cron_schedule": self.cron_schedule,
            "severity": self.severity,
            "mitre_attack": list(self.mitre_attack),
            "risk_score": self.risk_score,
            "risk_objects": list(self.risk_objects),
            "suppression_window": self.suppression_window,
            "enabled": self.enabled,
        }


def validate_detection(draft: DetectionDraft, *, query_validation: dict[str, Any]) -> dict[str, Any]:
    """Return machine-readable errors and warnings without contacting Splunk."""
    errors: list[str] = []
    warnings: list[str] = []
    if not draft.name:
        errors.append("name is required")
    elif len(draft.name) > 255:
        errors.append("name must be 255 characters or fewer")
    if not draft.spl:
        errors.append("spl is required")
    if draft.severity not in _SEVERITIES:
        errors.append(f"severity must be one of {sorted(_SEVERITIES)}")
    if not 0 <= draft.risk_score <= 100:
        errors.append("risk_score must be between 0 and 100")
    if draft.enabled:
        errors.append("new drafts must be disabled; use the explicit enable tool after review")
    if draft.cron_schedule and len(draft.cron_schedule.split()) not in {5, 6}:
        errors.append("cron_schedule must contain five or six fields")
    for technique in draft.mitre_attack:
        if not _MITRE_ID.match(technique):
            errors.append(f"invalid MITRE ATT&CK technique: {technique}")
    if not draft.risk_objects and draft.risk_score:
        warnings.append("risk_score is set but risk_objects is empty")
    decision = query_validation.get("decision")
    if decision == "deny":
        errors.append("SPL is denied by the safety policy")
    elif decision == "require_approval":
        errors.append("SPL requires approval before execution")
    elif decision != "allow":
        errors.append("SPL policy could not establish safe execution")
    if "index=" not in draft.spl.lower():
        warnings.append("SPL does not name an index; confirm the data scope before deployment")
    if "| tstats" not in draft.spl.lower() and "| datamodel" not in draft.spl.lower():
        warnings.append("consider tstats or a data model for scheduled detections at scale")
    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "query_validation": query_validation,
        "detection": draft.as_dict(),
    }
