"""Pure helpers for the CID/AID/EID alert-delivery contract.

The database remains the authority for allocation and ownership.  This module
only validates bounded payloads, extracts safe static index references, and
formats identifiers after PostgreSQL has allocated their sequence numbers.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


CID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
SUPPORTED_ALERT_PAYLOAD_VERSION = 1
SAFE_INDEX_RE = re.compile(
    r"(?i)(?<![A-Za-z0-9_])index\s*=\s*(?:\"([^\"]+)\"|'([^']+)'|([A-Za-z0-9][A-Za-z0-9_.:-]*))"
)
INDEX_IN_RE = re.compile(r"(?i)(?<![A-Za-z0-9_])index\s+in\s*\(([^()]*)\)")
INDEX_TOKEN_RE = re.compile(r"(?i)(?<![A-Za-z0-9_])index\b")
WILDCARD_RE = re.compile(
    r"[*?\$`]|\b(?:inputlookup|metadata|makeresults|loadjob|savedsearch|datamodel|pivot)\b",
    re.IGNORECASE,
)
_NON_SOURCE_INDEX_COMMANDS = {
    "eval", "rename", "rex", "table", "fields", "where", "stats", "sort",
    "dedup", "head", "tail", "lookup", "join", "outputcsv", "convert",
}
_SOURCE_INDEX_COMMANDS = {"search", "tstats", "mstats", "from", "union"}
MAX_DETAIL_ROWS = 1_000
MAX_DETAIL_BYTES = 5 * 1024 * 1024
DEFAULT_DISPLAY_ROWS = 50
_POLICY_LIST_LIMIT = 100
_FILTER_OPERATORS = {
    "eq": "equals",
    "==": "equals",
    "equals": "equals",
    "ne": "not_equals",
    "!=": "not_equals",
    "not_equals": "not_equals",
    "contains": "contains",
    "not_contains": "not_contains",
    "exists": "exists",
    "not_exists": "not_exists",
}
_DEFAULT_POLICY = {
    "detail_columns": [],
    "field_mappings": [],
    "required_columns": [],
    "optional_columns": [],
    "max_display_rows": DEFAULT_DISPLAY_ROWS,
    "max_stored_rows": MAX_DETAIL_ROWS,
    "row_filters": [],
    "severity_source": "",
    "severity_mapping": {},
    "severity_fallback": "unknown",
}


class AlertIdentityError(ValueError):
    """A bounded, operator-readable alert identity validation failure."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


def normalize_cid(value: Any) -> str:
    cid = str(value or "").strip()
    if not CID_RE.fullmatch(cid):
        raise AlertIdentityError("invalid_cid", "customer_code must be a safe CID identifier")
    return cid


def normalize_deployment(value: Any) -> str:
    deployment = str(value or "").strip()
    if not deployment or len(deployment) > 512:
        raise AlertIdentityError("invalid_deployment", "Splunk deployment identity is required")
    return deployment


def _split_unquoted(value: str, delimiter: str) -> list[str]:
    """Split on an unquoted character or Boolean word."""

    parts: list[str] = []
    start = 0
    quote = ""
    escaped = False
    index = 0
    word = delimiter.isalpha()
    while index < len(value):
        character = value[index]
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = ""
            index += 1
            continue
        if character in {'"', "'"}:
            quote = character
            index += 1
            continue
        if word:
            candidate = value[index:index + len(delimiter)]
            before = value[index - 1] if index else " "
            after_at = index + len(delimiter)
            after = value[after_at] if after_at < len(value) else " "
            matched = (
                candidate.casefold() == delimiter.casefold()
                and not (before.isalnum() or before == "_")
                and not (after.isalnum() or after == "_")
            )
        else:
            matched = character == delimiter
        if matched:
            parts.append(value[start:index])
            index += len(delimiter)
            start = index
            continue
        index += 1
    parts.append(value[start:])
    return parts


def _extract_subsearches(value: str) -> tuple[str, list[str], str | None]:
    """Remove balanced unquoted subsearches and return their contents."""

    visible = list(value)
    stack: list[int] = []
    subsearches: list[str] = []
    quote = ""
    escaped = False
    for index, character in enumerate(value):
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = ""
            continue
        if character in {'"', "'"}:
            quote = character
        elif character == "[":
            stack.append(index)
        elif character == "]":
            if not stack:
                return value, [], "saved search contains an unmatched subsearch bracket"
            start = stack.pop()
            if not stack:
                subsearches.append(value[start + 1:index])
                visible[start:index + 1] = " " * (index + 1 - start)
    if quote:
        return value, [], "saved search contains an unterminated quoted value"
    if stack:
        return value, [], "saved search contains an incomplete nested source"
    return "".join(visible), subsearches, None


def _source_indexes(stage: str) -> tuple[list[str], str | None]:
    """Extract exact indexes from one source-producing search branch."""

    if re.search(r"\bNOT\b", stage, re.IGNORECASE):
        return [], "negated source branches require administrator review"
    indexes: list[str] = []
    spans: list[tuple[int, int]] = []
    for match in SAFE_INDEX_RE.finditer(stage):
        value = next((item for item in match.groups() if item), "").strip()
        if not value or len(value) > 255:
            return [], "saved search contains an invalid index reference"
        indexes.append(value)
        spans.append(match.span())
    for match in INDEX_IN_RE.finditer(stage):
        body = match.group(1).strip()
        if not body:
            return [], "saved search contains an empty index list"
        token_pattern = re.compile(r'"([^"\\]+)"|\'([^\'\\]+)\'|([A-Za-z0-9][A-Za-z0-9_.:-]*)')
        values = list(token_pattern.finditer(body))
        if not values or token_pattern.sub("", body).strip(" ,\t\r\n"):
            return [], "saved search contains a dynamic or invalid index list"
        indexes.extend(next(item for item in value.groups() if item) for value in values)
        spans.append(match.span())
    if any(not any(start <= token.start() < end for start, end in spans) for token in INDEX_TOKEN_RE.finditer(stage)):
        return [], "saved search contains an unsupported or unresolved index expression"
    branches = _split_unquoted(stage, "OR")
    if len(branches) > 1 and any(not INDEX_TOKEN_RE.search(branch) for branch in branches):
        return [], "every Boolean source branch must contain an exact index restriction"
    if not indexes:
        return [], "saved search source index could not be resolved exactly"
    return list(dict.fromkeys(indexes)), None


def extract_static_indexes(spl: Any) -> tuple[tuple[str, ...], str | None]:
    """Return exact ``index=...`` references or a review reason.

    A missing or dynamic index is intentionally not treated as a wildcard
    ownership match.  The caller must place the definition into review until
    an administrator establishes its scope.
    """

    text = str(spl or "").strip()
    if not text:
        return (), "saved search has no SPL definition"
    if WILDCARD_RE.search(text):
        return (), "saved search uses a dynamic, wildcard, or non-index source"
    visible, subsearches, error = _extract_subsearches(text)
    if error:
        return (), error
    indexes: list[str] = []
    stages = [stage.strip() for stage in _split_unquoted(visible, "|") if stage.strip()]
    for position, stage in enumerate(stages):
        command_match = re.match(r"([A-Za-z][A-Za-z0-9_]*)", stage)
        command = command_match.group(1).casefold() if command_match else ""
        if command == "outputcsv" and subsearches:
            return (), "outputcsv subsearches are legacy identity wrappers and require review"
        source_stage = (
            (position == 0 and command not in _NON_SOURCE_INDEX_COMMANDS)
            or command in {"tstats", "mstats", "from", "union"}
        )
        if source_stage:
            stage_indexes, error = _source_indexes(stage)
            if error and not (command == "union" and subsearches):
                return (), error
            indexes.extend(stage_indexes)
        elif INDEX_TOKEN_RE.search(stage):
            return (), "saved search contains an index field expression outside its source clause"
    for subsearch in subsearches:
        nested_indexes, error = extract_static_indexes(subsearch)
        if error:
            return (), error
        indexes.extend(nested_indexes)
    indexes = list(dict.fromkeys(indexes))
    return (tuple(indexes), None) if indexes else ((), "saved search source index could not be resolved exactly")


def definition_fingerprint(definition: Mapping[str, Any]) -> str:
    """Hash one canonical saved-search definition representation.

    Editor drafts, discovery rows, and exact saved-search reads expose the
    same Splunk fields under slightly different aliases. Keep only persisted,
    meaningful definition fields here so UI-only metadata, action transport
    parameters, activation state, and next-run timestamps cannot manufacture
    a revision change.
    """
    flattened = dict(definition)
    content = flattened.pop("content", None)
    if isinstance(content, Mapping):
        flattened = {**content, **flattened}
    aliases = {
        "name": ("name", "saved_search_name"),
        "search": ("search", "spl"),
        "description": ("description",),
        "is_scheduled": ("is_scheduled",),
        "cron_schedule": ("cron_schedule",),
        "dispatch.earliest_time": ("dispatch.earliest_time", "earliest_time"),
        "dispatch.latest_time": ("dispatch.latest_time", "latest_time"),
        "dispatch.rt_backfill": ("dispatch.rt_backfill",),
        "dispatch.indexedrealtime": ("dispatch.indexedRealtime", "dispatch.indexedrealtime"),
        "dispatch.indexedrealtimeoffset": (
            "dispatch.indexedRealtimeOffset", "dispatch.indexedrealtimeoffset",
        ),
        "dispatch.indexedrealtimeminspan": (
            "dispatch.indexedRealtimeMinSpan", "dispatch.indexedrealtimeminspan",
        ),
        "dispatch.rt_maximum_span": ("dispatch.rt_maximum_span",),
        "alert_type": ("alert_type", "counttype"),
        "alert_comparator": ("alert_comparator", "relation"),
        "alert_threshold": ("alert_threshold", "quantity"),
        "alert_condition": ("alert_condition",),
        "alert.digest_mode": ("alert.digest_mode",),
        "alert.suppress": ("alert.suppress",),
        "alert.suppress.period": ("alert.suppress.period",),
        "alert.suppress.fields": ("alert.suppress.fields",),
        "alert.suppress.group_name": ("alert.suppress.group_name",),
        "alert.expires": ("alert.expires",),
    }
    casefolded = {str(key).casefold(): value for key, value in flattened.items()}
    boolean_fields = {
        "is_scheduled", "dispatch.rt_backfill", "dispatch.indexedrealtime",
        "alert.digest_mode", "alert.suppress",
    }
    normalized: dict[str, Any] = {}
    for name, source_names in aliases.items():
        value: Any = ""
        for source_name in source_names:
            if source_name.casefold() in casefolded:
                value = casefolded[source_name.casefold()]
                break
        if name in boolean_fields:
            value = value is True or str(value).strip().casefold() in {"1", "true", "yes", "on"}
        elif value is None:
            value = ""
        if isinstance(value, str):
            value = value.replace("\r\n", "\n").strip()
        normalized[name] = value
    encoded = json.dumps(normalized, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def format_eid(aid: str, trigger_time: datetime, run_sequence: int) -> str:
    """Format one EID from a PostgreSQL-assigned AID/run sequence."""

    if not isinstance(aid, str) or not re.fullmatch(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}-[0-9]{4}$", aid):
        raise AlertIdentityError("invalid_aid", "AID is not in the registered format")
    if not isinstance(run_sequence, int) or run_sequence < 1:
        raise AlertIdentityError("invalid_run_sequence", "run sequence must be positive")
    if trigger_time.tzinfo is None:
        trigger_time = trigger_time.replace(tzinfo=timezone.utc)
    trigger_time = trigger_time.astimezone(timezone.utc)
    stamp = trigger_time.strftime("%Y%m%dT%H%M%S") + f"{trigger_time.microsecond:06d}Z"
    return f"{aid}-{stamp}-{run_sequence:06d}"


def _bounded_json(value: Any, *, depth: int = 0) -> Any:
    if depth > 3:
        return str(value)[:500]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {
            str(key)[:128]: _bounded_json(item, depth=depth + 1)
            for key, item in list(value.items())[:100]
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_bounded_json(item, depth=depth + 1) for item in list(value)[:100]
        ]
    return str(value)[:500]


def _field_mappings(policy: Mapping[str, Any]) -> tuple[tuple[str, str, bool], ...]:
    configured = policy.get("field_mappings", [])
    if not isinstance(configured, Sequence) or isinstance(configured, (str, bytes, bytearray)):
        return ()
    result: list[tuple[str, str, bool]] = []
    for value in configured[:100]:
        if not isinstance(value, Mapping):
            continue
        source = str(value.get("source") or value.get("field") or value.get("name") or "").strip()
        label = str(value.get("label") or source).strip()[:255]
        if source and len(source) <= 255 and source != "_raw":
            item = (source, label or source, bool(value.get("required", False)))
            if item not in result:
                result.append(item)
    return tuple(result)


def _policy_columns_list(value: Any, *, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise AlertIdentityError("invalid_policy", f"{field_name} must be a list")
    if len(value) > _POLICY_LIST_LIMIT:
        raise AlertIdentityError("invalid_policy", f"{field_name} has too many entries")
    columns: list[str] = []
    for item in value:
        if isinstance(item, Mapping):
            item = item.get("source") or item.get("field") or item.get("name")
        if not isinstance(item, str):
            raise AlertIdentityError("invalid_policy", f"{field_name} must contain field names")
        item = item.strip()
        if not item or len(item) > 255 or item == "_raw":
            raise AlertIdentityError("invalid_policy", f"{field_name} contains an invalid field")
        if item not in columns:
            columns.append(item)
    return columns


def normalize_alert_policy(
    value: Mapping[str, Any] | None,
    *,
    defaults: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Normalize and validate the administrator-approved alert policy.

    This is intentionally a small data contract rather than an expression
    language.  Row filters are explicit field comparisons and never execute
    SPL, SQL, or Python supplied by a caller.
    """

    if value is not None and not isinstance(value, Mapping):
        raise AlertIdentityError("invalid_policy", "alert email policy must be an object")
    source = value or {}
    base = {**_DEFAULT_POLICY, **(dict(defaults) if isinstance(defaults, Mapping) else {})}
    normalized: dict[str, Any] = {}
    for key in ("detail_columns", "required_columns", "optional_columns"):
        raw = source.get(key, base.get(key, []))
        normalized[key] = _policy_columns_list(raw, field_name=key)

    raw_mappings = source.get("field_mappings", base.get("field_mappings", []))
    if raw_mappings is None:
        raw_mappings = []
    if not isinstance(raw_mappings, Sequence) or isinstance(raw_mappings, (str, bytes, bytearray)):
        raise AlertIdentityError("invalid_policy", "field_mappings must be a list")
    if len(raw_mappings) > _POLICY_LIST_LIMIT:
        raise AlertIdentityError("invalid_policy", "field_mappings has too many entries")
    mappings: list[dict[str, Any]] = []
    for item in raw_mappings:
        if not isinstance(item, Mapping):
            raise AlertIdentityError("invalid_policy", "field_mappings must contain objects")
        field = item.get("source") or item.get("field") or item.get("name")
        label = item.get("label", field)
        if (
            not isinstance(field, str)
            or not field.strip()
            or len(field.strip()) > 255
            or field.strip() == "_raw"
            or not isinstance(label, str)
            or not label.strip()
            or len(label.strip()) > 255
            or ("required" in item and not isinstance(item["required"], bool))
        ):
            raise AlertIdentityError("invalid_policy", "field_mappings contains an invalid mapping")
        mapping = {
            "source": field.strip(),
            "label": label.strip(),
            "required": item.get("required") is True,
        }
        if mapping not in mappings:
            mappings.append(mapping)
    normalized["field_mappings"] = mappings

    for key, default in (("max_display_rows", DEFAULT_DISPLAY_ROWS), ("max_stored_rows", MAX_DETAIL_ROWS)):
        raw = source.get(key, base.get(key, default))
        if isinstance(raw, bool):
            raise AlertIdentityError("invalid_policy", f"{key} must be an integer")
        try:
            number = int(raw)
        except (TypeError, ValueError) as exc:
            raise AlertIdentityError("invalid_policy", f"{key} must be an integer") from exc
        if number < 1 or number > MAX_DETAIL_ROWS:
            raise AlertIdentityError("invalid_policy", f"{key} must be between 1 and {MAX_DETAIL_ROWS}")
        normalized[key] = number

    raw_filters = source.get("row_filters", base.get("row_filters", []))
    if raw_filters is None:
        raw_filters = []
    if not isinstance(raw_filters, Sequence) or isinstance(raw_filters, (str, bytes, bytearray)):
        raise AlertIdentityError("invalid_policy", "row_filters must be a list")
    if len(raw_filters) > _POLICY_LIST_LIMIT:
        raise AlertIdentityError("invalid_policy", "row_filters has too many entries")
    filters: list[dict[str, Any]] = []
    for item in raw_filters:
        if not isinstance(item, Mapping):
            raise AlertIdentityError("invalid_policy", "row_filters must contain objects")
        field = item.get("source") or item.get("field") or item.get("name")
        operator = str(item.get("operator", item.get("op", "equals"))).strip().casefold()
        operator = _FILTER_OPERATORS.get(operator, "")
        if not isinstance(field, str) or not field.strip() or len(field.strip()) > 255 or field.strip() == "_raw":
            raise AlertIdentityError("invalid_policy", "row_filters contains an invalid field")
        if not operator:
            raise AlertIdentityError("invalid_policy", "row_filters contains an invalid operator")
        filter_value = item.get("value")
        if filter_value is not None and not isinstance(filter_value, (str, int, float, bool)):
            raise AlertIdentityError("invalid_policy", "row_filters values must be scalar")
        if isinstance(filter_value, float) and not math.isfinite(filter_value):
            raise AlertIdentityError("invalid_policy", "row_filters values must be finite")
        if isinstance(filter_value, str) and len(filter_value) > 1_000:
            raise AlertIdentityError("invalid_policy", "row_filters value is too long")
        normalized_filter = {"source": field.strip(), "operator": operator}
        if operator not in {"exists", "not_exists"} or "value" in item:
            normalized_filter["value"] = filter_value
        filters.append(normalized_filter)
    normalized["row_filters"] = filters

    severity_source = source.get("severity_source", base.get("severity_source", ""))
    if severity_source is None:
        severity_source = ""
    if not isinstance(severity_source, str) or len(severity_source.strip()) > 255 or severity_source.strip() == "_raw":
        raise AlertIdentityError("invalid_policy", "severity_source is invalid")
    normalized["severity_source"] = severity_source.strip()
    severity_mapping = source.get("severity_mapping", base.get("severity_mapping", {}))
    if severity_mapping is None:
        severity_mapping = {}
    if not isinstance(severity_mapping, Mapping) or len(severity_mapping) > _POLICY_LIST_LIMIT:
        raise AlertIdentityError("invalid_policy", "severity_mapping must be an object")
    normalized_mapping: dict[str, str] = {}
    for source_value, target_value in severity_mapping.items():
        key = str(source_value).strip().casefold()
        target = str(target_value).strip().casefold()
        if not key or len(key) > 255 or target not in {"info", "low", "medium", "high", "critical", "unknown"}:
            raise AlertIdentityError("invalid_policy", "severity_mapping contains an invalid value")
        normalized_mapping[key] = target
    normalized["severity_mapping"] = normalized_mapping

    fallback = str(source.get("severity_fallback", base.get("severity_fallback", "unknown")) or "unknown").strip().casefold()
    if fallback not in {"info", "low", "medium", "high", "critical", "unknown"}:
        raise AlertIdentityError("invalid_policy", "severity_fallback must be a valid severity or unknown")
    normalized["severity_fallback"] = fallback
    return normalized


def _policy_columns(policy: Mapping[str, Any], fallback: Any) -> tuple[str, ...]:
    del fallback
    columns: list[str] = []
    for key in ("detail_columns", "required_columns", "optional_columns"):
        configured = policy.get(key)
        if not isinstance(configured, Sequence) or isinstance(configured, (str, bytes, bytearray)):
            continue
        for value in configured:
            if isinstance(value, Mapping):
                value = value.get("source") or value.get("field") or value.get("name")
            text = str(value or "").strip()
            if text and len(text) <= 255 and text not in columns and text != "_raw":
                columns.append(text)
    for source, _label, _required in _field_mappings(policy):
        if source not in columns:
            columns.append(source)
    return tuple(columns[:100])


def _row_matches_filters(row: Mapping[str, Any], filters: Sequence[Mapping[str, Any]]) -> bool:
    for item in filters:
        source = str(item.get("source", ""))
        operator = str(item.get("operator", "equals"))
        exists = source in row and row.get(source) not in (None, "")
        if operator == "exists":
            if not exists:
                return False
            continue
        if operator == "not_exists":
            if exists:
                return False
            continue
        left = row.get(source)
        right = item.get("value")
        if isinstance(left, str) or isinstance(right, str):
            left_value = "" if left is None else str(left).casefold()
            right_value = "" if right is None else str(right).casefold()
        else:
            left_value, right_value = left, right
        if operator == "equals":
            matched = left_value == right_value
        elif operator == "not_equals":
            matched = left_value != right_value
        elif operator == "contains":
            matched = right_value in left_value
        elif operator == "not_contains":
            matched = right_value not in left_value
        else:  # normalize_alert_policy prevents this branch for stored policies.
            matched = False
        if not matched:
            return False
    return True


def project_selected_rows(
    rows: Any,
    *,
    policy: Mapping[str, Any] | None = None,
    fallback_columns: Any = (),
    include_positions: bool = False,
    row_positions: Sequence[int] | None = None,
) -> tuple[list[Any], int, int, bool, tuple[str, ...]]:
    """Project bounded result rows according to the approved policy.

    Returns ``(retained_rows, total_rows, retained_count, truncated, columns)``.
    Missing fields are kept as blank values by the email renderer; required
    field enforcement is performed by :func:`required_columns_missing`.
    """

    projected, _source_total, matching_total, stored, truncated, columns = project_selected_rows_with_counts(
        rows,
        policy=policy,
        fallback_columns=fallback_columns,
        include_positions=include_positions,
        row_positions=row_positions,
    )
    return projected, matching_total, stored, truncated, columns


def project_selected_rows_with_counts(
    rows: Any,
    *,
    policy: Mapping[str, Any] | None = None,
    fallback_columns: Any = (),
    include_positions: bool = False,
    row_positions: Sequence[int] | None = None,
) -> tuple[list[Any], int, int, int, bool, tuple[str, ...]]:
    """Project rows and preserve source, matching, and retained counts.

    ``project_selected_rows`` keeps its original five-value compatibility
    contract and returns the matching count as its ``total`` value.  New
    ingestion code uses this function so an event can distinguish the count
    reported by Splunk, rows matching the administrator filter, and rows
    retained after the row/byte limits.
    """

    if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes, bytearray)):
        raise AlertIdentityError("invalid_rows", "alert result rows must be a list")
    values = [row for row in rows if isinstance(row, Mapping)]
    source_total = len(rows)
    if len(values) != source_total:
        raise AlertIdentityError("invalid_rows", "alert result rows must contain objects")
    if row_positions is None:
        positions = list(range(source_total))
    else:
        if len(row_positions) != source_total:
            raise AlertIdentityError("invalid_rows", "row_positions must match the result rows")
        positions = []
        for value in row_positions:
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise AlertIdentityError("invalid_rows", "row_positions must be non-negative integers")
            positions.append(value)
        if positions != sorted(set(positions)):
            raise AlertIdentityError("invalid_rows", "row_positions must be strictly increasing")
    approved = normalize_alert_policy(policy if isinstance(policy, Mapping) else {})
    del fallback_columns
    columns = _policy_columns(approved, ())
    max_rows = approved.get("max_stored_rows", MAX_DETAIL_ROWS)
    try:
        max_rows = max(1, min(int(max_rows), MAX_DETAIL_ROWS))
    except (TypeError, ValueError):
        max_rows = MAX_DETAIL_ROWS
    filtered = [
        (position, row)
        for position, row in zip(positions, values, strict=True)
        if _row_matches_filters(row, approved["row_filters"])
    ]
    matching_total = len(filtered)
    if not columns:
        return [], source_total, matching_total, 0, False, columns
    retained: list[Any] = []
    used_bytes = 0
    truncated = matching_total > max_rows
    for position, row in filtered[:max_rows]:
        projected = {
            column: _bounded_json(row.get(column))
            for column in columns
        }
        encoded = json.dumps(projected, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8")
        if used_bytes + len(encoded) > MAX_DETAIL_BYTES:
            truncated = True
            break
        retained.append((position, projected) if include_positions else projected)
        used_bytes += len(encoded)
    if len(retained) < matching_total:
        truncated = True
    return retained, source_total, matching_total, len(retained), truncated, columns


def required_columns_missing(
    rows: Sequence[Mapping[str, Any]],
    policy: Mapping[str, Any] | None,
) -> tuple[str, ...]:
    normalized = normalize_alert_policy(policy if isinstance(policy, Mapping) else {})
    configured = normalized.get("required_columns", [])
    if not isinstance(configured, Sequence) or isinstance(configured, (str, bytes, bytearray)):
        required = []
    else:
        required = [str(value).strip() for value in configured if str(value).strip()]
    required.extend(source for source, _label, is_required in _field_mappings(normalized) if is_required)
    required = list(dict.fromkeys(required))
    return tuple(
        column
        for column in dict.fromkeys(required)
        if any(column not in row for row in rows)
    )


@dataclass(frozen=True)
class AlertRunPayload:
    deployment: str
    sid: str
    alert_name: str
    trigger_time: datetime
    rows: tuple[dict[str, Any], ...]
    row_positions: tuple[int, ...]
    result_count: int
    severity: str | None = None
    app: str = ""
    owner: str = ""
    stable_id: str = ""
    registration_id: str = ""
    policy_id: str = ""
    policy_revision: int | None = None
    asserted_cid: str = ""
    asserted_aid: str = ""
    definition_revision: int | None = None
    matching_count: int | None = None
    retained_count: int | None = None
    truncated: bool = False
    trigger_time_precision: int = 0
    definition: dict[str, Any] | None = None
    selected_columns: tuple[str, ...] = ()

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "AlertRunPayload":
        if not isinstance(value, Mapping):
            raise AlertIdentityError("invalid_payload", "alert run payload must be an object")
        version = value.get("version")
        if version != SUPPORTED_ALERT_PAYLOAD_VERSION:
            raise AlertIdentityError(
                "unsupported_payload_version",
                f"alert run payload version {version!r} is not supported",
            )
        deployment = normalize_deployment(value.get("deployment") or value.get("deployment_id"))
        sid = str(value.get("sid") or value.get("search_id") or "").strip()
        name = str(value.get("alert_name") or value.get("saved_search_name") or value.get("name") or "").strip()
        if not sid or len(sid) > 1024:
            raise AlertIdentityError("invalid_sid", "Splunk SID is required")
        if not name or len(name) > 255:
            raise AlertIdentityError("invalid_alert_name", "saved-search name is required")
        raw_time = value.get("trigger_time") or value.get("triggerTime")
        trigger_precision = 0
        if isinstance(raw_time, datetime):
            trigger_time = raw_time
        else:
            text = str(raw_time or "").strip()
            fraction = re.search(r"\.(\d+)(?:Z|[+-]\d{2}:?\d{2})?$", text)
            trigger_precision = len(fraction.group(1)) if fraction else 0
            try:
                trigger_time = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except ValueError as exc:
                raise AlertIdentityError("invalid_trigger_time", "original trigger time is required") from exc
        if trigger_time.tzinfo is None:
            trigger_time = trigger_time.replace(tzinfo=timezone.utc)
        trigger_time = trigger_time.astimezone(timezone.utc)
        rows = value.get("rows", value.get("results", []))
        if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes, bytearray)):
            raise AlertIdentityError("invalid_rows", "alert result rows must be a list")
        if len(rows) > MAX_DETAIL_ROWS:
            raise AlertIdentityError(
                "invalid_rows",
                f"alert result rows cannot exceed {MAX_DETAIL_ROWS} retained rows",
            )
        normalized_rows = tuple(dict(row) for row in rows if isinstance(row, Mapping))
        if len(normalized_rows) != len(rows):
            raise AlertIdentityError("invalid_rows", "alert result rows must contain objects")
        result_count = value.get("result_count", len(rows))
        try:
            result_count = int(result_count)
        except (TypeError, ValueError) as exc:
            raise AlertIdentityError("invalid_result_count", "result_count must be a non-negative integer") from exc
        if result_count < 0 or result_count > 10_000_000:
            raise AlertIdentityError("invalid_result_count", "result_count must be a non-negative integer")
        if result_count < len(normalized_rows):
            raise AlertIdentityError("invalid_result_count", "result_count cannot be less than retained rows")
        raw_matching = value.get("matching_count")
        if raw_matching is None:
            matching_count = len(normalized_rows)
        else:
            try:
                matching_count = int(raw_matching)
            except (TypeError, ValueError) as exc:
                raise AlertIdentityError("invalid_result_count", "matching_count must be a non-negative integer") from exc
            if matching_count < len(normalized_rows) or matching_count > result_count:
                raise AlertIdentityError("invalid_result_count", "matching_count is outside the source result count")
        raw_retained = value.get("retained_count")
        if raw_retained is None:
            retained_count = len(normalized_rows)
        else:
            try:
                retained_count = int(raw_retained)
            except (TypeError, ValueError) as exc:
                raise AlertIdentityError("invalid_result_count", "retained_count must be a non-negative integer") from exc
            if retained_count != len(normalized_rows) or retained_count > matching_count:
                raise AlertIdentityError("invalid_result_count", "retained_count does not match the result rows")
        raw_truncated = value.get("truncated", False)
        if not isinstance(raw_truncated, bool):
            raise AlertIdentityError("invalid_result_count", "truncated must be boolean")
        raw_selected = value.get("selected_columns", [])
        has_selected_columns = bool(
            isinstance(raw_selected, Sequence)
            and not isinstance(raw_selected, (str, bytes, bytearray))
            and any(str(item).strip() for item in raw_selected)
        )
        if retained_count < matching_count and has_selected_columns and not raw_truncated:
            raise AlertIdentityError("invalid_result_count", "truncated must be true when matching results were retained partially")
        raw_positions = value.get("original_row_positions", value.get("row_positions"))
        if raw_positions is None:
            positions = tuple(range(len(normalized_rows)))
        elif isinstance(raw_positions, Sequence) and not isinstance(raw_positions, (str, bytes, bytearray)):
            parsed_positions: list[int] = []
            for item in raw_positions:
                if isinstance(item, bool):
                    raise AlertIdentityError("invalid_rows", "row positions must be integers")
                try:
                    parsed = int(item)
                except (TypeError, ValueError) as exc:
                    raise AlertIdentityError("invalid_rows", "row positions must be integers") from exc
                if parsed < 0:
                    raise AlertIdentityError("invalid_rows", "row positions must be non-negative")
                parsed_positions.append(parsed)
            positions = tuple(parsed_positions)
            if len(positions) != len(normalized_rows) or list(positions) != sorted(set(positions)):
                raise AlertIdentityError("invalid_rows", "row positions must be strictly increasing")
        else:
            raise AlertIdentityError("invalid_rows", "row positions must be a list")
        if positions and positions[-1] >= result_count:
            raise AlertIdentityError("invalid_rows", "row position is outside the original result count")
        severity = str(value.get("severity") or value.get("urgency") or "").strip().casefold() or None
        if severity not in {None, "info", "low", "medium", "high", "critical"}:
            severity = None
        selected = raw_selected
        if not isinstance(selected, Sequence) or isinstance(selected, (str, bytes, bytearray)):
            selected = []
        columns = tuple(dict.fromkeys(str(item).strip() for item in selected if str(item).strip()))[:100]
        if any(not column or len(column) > 255 or column == "_raw" for column in columns):
            raise AlertIdentityError("invalid_columns", "selected columns contain an invalid field")
        definition = value.get("definition")
        if not isinstance(definition, Mapping):
            definition = {}
        revision = value.get("definition_revision")
        try:
            revision = int(revision)
        except (TypeError, ValueError) as exc:
            raise AlertIdentityError("invalid_definition_revision", "definition revision is required") from exc
        if revision < 1:
            raise AlertIdentityError("invalid_definition_revision", "definition revision is invalid")
        policy_id = str(value.get("policy_id") or value.get("email_policy_id") or "").strip()[:128]
        if not policy_id:
            raise AlertIdentityError("missing_policy_identity", "approved email policy ID is required")
        policy_revision = value.get("policy_revision", value.get("email_policy_revision"))
        try:
            policy_revision = int(policy_revision)
        except (TypeError, ValueError) as exc:
            raise AlertIdentityError("invalid_policy_revision", "approved email policy revision is required") from exc
        if policy_revision < 1:
            raise AlertIdentityError("invalid_policy_revision", "approved email policy revision is invalid")
        return cls(
            deployment=deployment,
            sid=sid,
            alert_name=name,
            trigger_time=trigger_time,
            rows=normalized_rows,
            row_positions=positions,
            result_count=result_count,
            severity=severity,
            app=str(value.get("app") or "").strip()[:255],
            owner=str(value.get("owner") or "").strip()[:255],
            stable_id=str(value.get("stable_id") or "").strip()[:512],
            registration_id=str(value.get("registration_id") or "").strip()[:128],
            policy_id=policy_id,
            policy_revision=policy_revision,
            asserted_cid=str(value.get("cid") or "").strip()[:64],
            asserted_aid=str(value.get("aid") or "").strip()[:128],
            definition_revision=revision,
            matching_count=matching_count,
            retained_count=retained_count,
            truncated=raw_truncated,
            trigger_time_precision=trigger_precision,
            definition=dict(definition),
            selected_columns=columns,
        )


__all__ = [
    "AlertIdentityError",
    "AlertRunPayload",
    "DEFAULT_DISPLAY_ROWS",
    "MAX_DETAIL_BYTES",
    "MAX_DETAIL_ROWS",
    "definition_fingerprint",
    "extract_static_indexes",
    "format_eid",
    "normalize_cid",
    "normalize_deployment",
    "normalize_alert_policy",
    "project_selected_rows",
    "project_selected_rows_with_counts",
    "required_columns_missing",
]
