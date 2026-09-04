"""Server-side compiler for CITIC production and backtest SPL."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from .citic_format import (
    REQUIRED_CITIC_FIELDS,
    build_log_event_template,
    validate_citic_detection_spl,
)


_FIELD_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_. &-]*$")
_WRAPPER = re.compile(
    r"\b(?:outputcsv|casename)\b|\beval\s+(?:\"?rulename\"?|\"?search\"?)\s*=",
    re.IGNORECASE,
)
_CONTROL = re.compile(r"[|;\[\]\r\n]")
_REQUIRED_MAPPINGS = {"Fix_Source Type", "Event_Hostname"}


def _splunk_string(value: str, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")
    if any(character in value for character in "\r\n"):
        raise ValueError(f"{field} must be a single-line scalar")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _scalar_expression(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty scalar SPL expression")
    expression = value.strip()
    if _CONTROL.search(expression):
        raise ValueError(f"{field} must be a scalar expression, not a pipeline fragment")
    if expression.count('"') % 2:
        raise ValueError(f"{field} contains an unterminated string literal")
    if expression.count("(") != expression.count(")"):
        raise ValueError(f"{field} contains unbalanced parentheses")
    return expression


def _table_field(field: str) -> str:
    if not isinstance(field, str) or not field.strip() or not _FIELD_NAME.fullmatch(field.strip()):
        raise ValueError(f"invalid table field: {field}")
    field = field.strip()
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.-]*", field):
        return field
    return _splunk_string(field, "table field")


def _append_stages(base: str, stages: list[str]) -> str:
    base = base.strip()
    while base.endswith("|"):
        base = base[:-1].rstrip()
    return base + "\n" + "\n".join(stages)


def _validate_base_logic(detection_logic: str) -> str:
    if not isinstance(detection_logic, str) or not detection_logic.strip():
        raise ValueError("detection_logic is required")
    logic = detection_logic.strip()
    if _WRAPPER.search(logic):
        raise ValueError("detection_logic must not contain CITIC wrapper fields or outputcsv")
    return logic


def _table_fields(
    event_field_mappings: Mapping[str, str],
    extra_table_fields: list[str] | None,
    *,
    include_threat_fields: bool,
) -> list[str]:
    fields = list(REQUIRED_CITIC_FIELDS)
    if include_threat_fields:
        fields.extend(["Event_Threat Name", "Event_Threat Type"])
    for field in event_field_mappings:
        if field not in fields:
            fields.append(field)
    for field in extra_table_fields or []:
        if field not in fields:
            fields.append(field)
    return fields


def compile_citic_detection(
    *,
    detection_logic: str,
    rulename: str,
    threat_name: str,
    threat_type: str,
    case_prefix: str,
    event_field_mappings: Mapping[str, str],
    extra_table_fields: list[str] | None = None,
) -> dict[str, Any]:
    """Compile one base SPL into the production and read-only forms."""
    logic = _validate_base_logic(detection_logic)
    if not isinstance(rulename, str) or not re.fullmatch(r"\d{4}", rulename.strip()):
        raise ValueError("rulename must be exactly four digits")
    rulename = rulename.strip()
    prefix = case_prefix.strip() if isinstance(case_prefix, str) else case_prefix
    _splunk_string(prefix, "case_prefix")
    _splunk_string(threat_name, "threat_name")
    _splunk_string(threat_type, "threat_type")
    if not isinstance(event_field_mappings, Mapping):
        raise ValueError("event_field_mappings must be an object")
    mappings: dict[str, str] = {}
    for field, expression in event_field_mappings.items():
        if not isinstance(field, str) or not field.strip() or not _FIELD_NAME.fullmatch(field.strip()):
            raise ValueError(f"invalid event field mapping: {field}")
        mappings[field.strip()] = _scalar_expression(expression, f"event_field_mappings.{field}")
    missing = sorted(_REQUIRED_MAPPINGS - mappings.keys())
    if missing:
        raise ValueError("event_field_mappings is missing: " + ", ".join(missing))
    if extra_table_fields is not None and not isinstance(extra_table_fields, (list, tuple)):
        raise ValueError("extra_table_fields must be an array of field names")
    extras: list[str] = []
    for field in extra_table_fields or []:
        if not isinstance(field, str) or not field.strip() or not _FIELD_NAME.fullmatch(field.strip()):
            raise ValueError(f"invalid extra table field: {field}")
        field = field.strip()
        if field not in extras:
            extras.append(field)
    fields = _table_fields(mappings, extras, include_threat_fields=True)
    rendered_fields = ", ".join(_table_field(field) for field in fields)

    stages = [
        f'| eval GID={_splunk_string(prefix, "case_prefix")}',
        f'| eval rulename="{rulename}"',
        '| eval search=strftime(now(), "%Y%m%d%H%M")',
        '| eval Fix_Ticketnumber=GID."".search."".rulename',
        '| eval Fix_TriggerTime=strftime(now(), "%F %T")',
        f'| eval "Fix_Index"={_splunk_string("G" + prefix, "Fix_Index")}',
        f'| eval "Fix_Source Type"={mappings["Fix_Source Type"]}',
        f'| eval "Event_Hostname"={mappings["Event_Hostname"]}',
        '| eval "Event_Date Time"=strftime(_time, "%F %T")',
        f'| eval "Event_Threat Name"={_splunk_string(threat_name, "threat_name")}',
        f'| eval "Event_Threat Type"={_splunk_string(threat_type, "threat_type")}',
    ]
    for field, expression in mappings.items():
        if field in REQUIRED_CITIC_FIELDS or field in {"Event_Threat Name", "Event_Threat Type"}:
            continue
        stages.append(f"| eval {_table_field(field)}={expression}")
    stages.append(f"| table {rendered_fields}")

    event_template = build_log_event_template(fields)
    outputcsv = "\n".join(
        [
            "| outputcsv [",
            "    | stats count",
            "    | addinfo",
            f'    | eval rulename="{rulename}"',
            '    | eval search=strftime(now(), "%Y%m%d%H%M")',
            f'    | eval casename={_splunk_string(prefix, "case_prefix")}."".search."".rulename',
            "    | return $casename",
            "]",
        ]
    )
    production_spl = _append_stages(logic, stages + [outputcsv])
    backtest_spl = _append_stages(logic, stages)
    production_validation = validate_citic_detection_spl(production_spl)
    detection = {
        "spl": production_spl,
        "enabled": False,
        "alert.track": True,
        "actions": "logevent",
        "action.logevent": True,
        "action.logevent.param.event": event_template,
        "action.logevent.param.source": "$name$",
        "action.logevent.param.sourcetype": "ticket_details",
        "action.logevent.param.host": "",
        "action.logevent.param.index": "ticket_summary",
    }
    return {
        "production_spl": production_spl,
        "backtest_spl": backtest_spl,
        "production_validation": production_validation,
        "backtest_validation": {
            "valid": True,
            "errors": [],
            "warnings": ["backtest_spl is derived from the same stages and excludes outputcsv"],
        },
        "table_fields": fields,
        "event_template": event_template,
        "detection": detection,
    }


__all__ = ["compile_citic_detection"]
