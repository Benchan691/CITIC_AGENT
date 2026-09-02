"""Detection-rule data model and local validation helpers."""

from collections.abc import Mapping
from dataclasses import dataclass, field
import math
import re
from typing import Any


_SEVERITIES = {"informational", "low", "medium", "high", "critical"}
_MITRE_ID = re.compile(r"^T\d{4}(?:\.\d{3})?$", re.IGNORECASE)
_ALERT_TYPES = {"always", "custom", "number of events", "number of hosts", "number of sources"}
_ALERT_COMPARATORS = {
    "greater than", "less than", "equal to", "not equal to",
    "rises by", "drops by", "rises by perc", "drops by perc",
}
_ACTION_NAME = re.compile(r"^[A-Za-z0-9_.-]+$")
_ACTION_FIELD = re.compile(r"^action\.[A-Za-z0-9_.-]+$")
_INTEGER_OR_PERCENT = re.compile(r"^\d+%?$")
_TIME_SPEC = re.compile(r"^\d+(?:s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)?$", re.IGNORECASE)
_REALTIME_TIME = re.compile(r"^rt(?:$|[+-]|@)", re.IGNORECASE)
_SECRET_FIELD = re.compile(
    r"(?:password|passwd|secret|token|credential|private[_-]?key|api[_-]?key|"
    r"auth[_-]?(?:user(?:name)?|login)|username|user[_-]?name)",
    re.IGNORECASE,
)

# These are the saved-search settings used by Splunk Web's alert editor.  The
# action prefix is intentionally open so installed Splunk apps can provide
# custom alert actions without an MCP code change.
_ALERT_FIELDS = frozenset({
    "is_scheduled",
    "cron_schedule",
    "dispatch.earliest_time",
    "dispatch.latest_time",
    "dispatch.rt_backfill",
    "dispatch.indexedRealtime",
    "dispatch.indexedRealtimeOffset",
    "dispatch.indexedRealtimeMinSpan",
    "dispatch.rt_maximum_span",
    "alert_type",
    "alert_comparator",
    "alert_threshold",
    "alert_condition",
    "alert.digest_mode",
    "alert.suppress",
    "alert.suppress.period",
    "alert.suppress.fields",
    "alert.suppress.group_name",
    "alert.expires",
    "alert.track",
    "actions",
})
_FIELD_ALIASES = {
    "earliest_time": "dispatch.earliest_time",
    "latest_time": "dispatch.latest_time",
    "counttype": "alert_type",
    "relation": "alert_comparator",
    "quantity": "alert_threshold",
}


def canonical_alert_field_name(key: Any) -> str | None:
    """Return the supported REST field name for one payload/content key."""
    if not isinstance(key, str):
        return None
    if key in _FIELD_ALIASES:
        return _FIELD_ALIASES[key]
    if key in _ALERT_FIELDS or _ACTION_FIELD.fullmatch(key):
        return key
    return None


def is_secret_alert_field(key: Any) -> bool:
    return isinstance(key, str) and bool(_SECRET_FIELD.search(key))


def _scalar_value(key: str, value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, str)):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(f"{key} must be a finite scalar")
        return str(value)
    raise ValueError(f"{key} must be a scalar value")


def canonical_alert_fields(payload: Mapping[str, Any]) -> dict[str, str]:
    """Extract supported alert fields and normalize them for REST writes."""
    if not isinstance(payload, Mapping):
        raise ValueError("detection must be a JSON object")
    fields: dict[str, str] = {}
    priorities: dict[str, int] = {}
    for key, value in payload.items():
        if isinstance(key, str) and key.startswith("action.") and not _ACTION_FIELD.fullmatch(key):
            raise ValueError(f"invalid alert action field: {key}")
        if is_secret_alert_field(key):
            raise ValueError(f"secret-like alert field is not accepted: {key}")
        canonical = canonical_alert_field_name(key)
        if canonical is None:
            continue
        if is_secret_alert_field(canonical):
            raise ValueError(f"secret-like alert field is not accepted: {canonical}")
        priority = 2 if key == canonical else 1
        if priority < priorities.get(canonical, 0):
            continue
        fields[canonical] = _scalar_value(canonical, value)
        priorities[canonical] = priority
    return fields


def public_alert_fields(content: Mapping[str, Any]) -> dict[str, str]:
    """Return supported saved-search alert fields without secret-like values."""
    if not isinstance(content, Mapping):
        return {}
    fields: dict[str, str] = {}
    priorities: dict[str, int] = {}
    for key, value in content.items():
        canonical = canonical_alert_field_name(key)
        if canonical is None or is_secret_alert_field(canonical):
            continue
        try:
            normalized = _scalar_value(canonical, value)
        except ValueError:
            continue
        priority = 2 if key == canonical else 1
        if priority < priorities.get(canonical, 0):
            continue
        fields[canonical] = normalized
        priorities[canonical] = priority
    return fields


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
    alert_fields: tuple[tuple[str, str], ...] = field(default_factory=tuple)

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
        alert_fields = canonical_alert_fields(payload)
        earliest_time = alert_fields.get("dispatch.earliest_time", text("earliest_time", "-10m"))
        latest_time = alert_fields.get("dispatch.latest_time", text("latest_time", "now"))
        return cls(
            name=text("name"),
            spl=text("spl", text("search")),
            description=text("description"),
            earliest_time=earliest_time,
            latest_time=latest_time,
            cron_schedule=alert_fields.get("cron_schedule", text("cron_schedule")),
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
            alert_fields=tuple(sorted(alert_fields.items())),
        )

    def as_dict(self) -> dict[str, Any]:
        result = {
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
        result.update(dict(self.alert_fields))
        return result


def _boolean_field(fields: Mapping[str, str], key: str, errors: list[str]) -> bool | None:
    value = fields.get(key, "").strip().lower()
    if not value:
        return None
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    errors.append(f"{key} must be a boolean")
    return None


def _validate_alert_fields(draft: DetectionDraft, errors: list[str], warnings: list[str]) -> None:
    fields = dict(draft.alert_fields)
    is_scheduled = _boolean_field(fields, "is_scheduled", errors)
    realtime = bool(_REALTIME_TIME.match(draft.earliest_time)) or bool(_REALTIME_TIME.match(draft.latest_time))
    if realtime and not (_REALTIME_TIME.match(draft.earliest_time) and _REALTIME_TIME.match(draft.latest_time)):
        errors.append("real-time alerts require rt-prefixed earliest and latest times")
    if is_scheduled is True:
        if not realtime and not draft.cron_schedule.strip():
            errors.append("scheduled alerts require cron_schedule")
        if realtime:
            warnings.append("real-time alerts can consume more Splunk search resources than scheduled alerts")
    elif is_scheduled is False and draft.cron_schedule.strip():
        errors.append("cron_schedule cannot be set when is_scheduled is false")
    elif realtime:
        errors.append("real-time alert time ranges require is_scheduled=true")

    trigger_keys = {"alert_type", "alert_comparator", "alert_threshold", "alert_condition"}
    has_trigger_configuration = any(key in fields and fields[key].strip() for key in trigger_keys)
    alert_type = fields.get("alert_type", "").strip().lower()
    comparator = fields.get("alert_comparator", "").strip().lower()
    threshold = fields.get("alert_threshold", "").strip()
    condition = fields.get("alert_condition", "").strip()
    if has_trigger_configuration:
        if alert_type not in _ALERT_TYPES:
            errors.append(f"alert_type must be one of {sorted(_ALERT_TYPES)}")
        if comparator and comparator not in _ALERT_COMPARATORS:
            errors.append(f"alert_comparator must be one of {sorted(_ALERT_COMPARATORS)}")
        if condition:
            if alert_type != "custom":
                errors.append("alert_condition requires alert_type=custom")
            if comparator or threshold:
                errors.append("alert_condition cannot be combined with alert_comparator or alert_threshold")
        elif alert_type == "custom":
            errors.append("alert_type=custom requires alert_condition")
        elif alert_type == "always":
            if comparator or threshold:
                errors.append("alert_type=always cannot have alert_comparator or alert_threshold")
        elif alert_type in _ALERT_TYPES - {"always", "custom"}:
            if not comparator:
                errors.append("alert_comparator is required for a count-based alert")
            if not threshold:
                errors.append("alert_threshold is required for a count-based alert")

    if threshold:
        if not _INTEGER_OR_PERCENT.fullmatch(threshold):
            errors.append("alert_threshold must be an integer or percentage")
        elif threshold.endswith("%"):
            try:
                percentage = int(threshold[:-1])
            except ValueError:
                percentage = -1
            if percentage > 100:
                errors.append("percentage alert_threshold must be between 0% and 100%")
            if comparator not in {"rises by perc", "drops by perc"}:
                errors.append("percentage alert_threshold requires a percentage comparator")
        elif comparator in {"rises by perc", "drops by perc"}:
            errors.append("percentage comparator requires an alert_threshold ending in %")

    digest_mode = _boolean_field(fields, "alert.digest_mode", errors)
    suppress = _boolean_field(fields, "alert.suppress", errors)
    period = fields.get("alert.suppress.period", "").strip()
    suppress_fields = fields.get("alert.suppress.fields", "").strip()
    suppress_group = fields.get("alert.suppress.group_name", "").strip()
    if period and (not _TIME_SPEC.fullmatch(period) or period.startswith("0")):
        errors.append("alert.suppress.period must be a positive Splunk time specifier")
    if suppress is True:
        if not period:
            errors.append("alert.suppress.period is required when alert.suppress is enabled")
        if digest_mode is False and not suppress_fields:
            errors.append("alert.suppress.fields is required for per-result throttling")
    elif (period or suppress_fields or suppress_group) and suppress is False:
        warnings.append("throttle fields are ignored while alert.suppress is disabled")

    expires = fields.get("alert.expires", "").strip()
    if expires and (not _TIME_SPEC.fullmatch(expires) or expires.startswith("0")):
        errors.append("alert.expires must be a positive Splunk time specifier")
    track = fields.get("alert.track", "").strip().lower()
    if track and track not in {"auto", "1", "0", "true", "false", "yes", "no", "on", "off"}:
        errors.append("alert.track must be auto or a boolean")
    if expires and track in {"0", "false", "no", "off"}:
        warnings.append("alert.expires is only used when alert tracking is enabled")

    actions = fields.get("actions")
    if actions is not None:
        for action in (item.strip() for item in actions.split(",")):
            if action and not _ACTION_NAME.fullmatch(action):
                errors.append(f"invalid alert action name: {action}")
    for key, value in fields.items():
        if key.startswith("action.") and key.count(".") == 1 and value.strip():
            _boolean_field(fields, key, errors)


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
    _validate_alert_fields(draft, errors, warnings)
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
