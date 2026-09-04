"""Validation and small rendering helpers for the CITIC production SPL format."""

from __future__ import annotations

import re
from collections.abc import Iterable


# This is the team's mandatory table contract. Other Event_* fields are
# optional and may follow these fields in caller-supplied order.
REQUIRED_CITIC_FIELDS = (
    "Fix_Ticketnumber",
    "Fix_TriggerTime",
    "Fix_Index",
    "Fix_Source Type",
    "Event_Hostname",
    "Event_Date Time",
)

_COMMAND = re.compile(r"^\s*([A-Za-z][A-Za-z0-9_]*)\b")
_RULENAME = re.compile(
    r"\beval\s+(?:\"rulename\"|rulename)\s*=\s*\"(?P<value>[^\"]+)\"",
    re.IGNORECASE,
)
_GID = re.compile(
    r"\beval\s+(?:\"GID\"|GID)\s*=\s*(?P<value>[^\s|]+)",
    re.IGNORECASE,
)
_SEARCH = re.compile(
    r"\beval\s+(?:\"search\"|search)\s*=\s*strftime\s*\(\s*now\s*\(\s*\)\s*,\s*\"%Y%m%d%H%M\"\s*\)",
    re.IGNORECASE,
)
_TICKET = re.compile(
    r"\beval\s+(?:\"Fix_Ticketnumber\"|Fix_Ticketnumber)\s*=\s*"
    r"GID\s*\.\s*\"\"\s*\.\s*search\s*\.\s*\"\"\s*\.\s*rulename\b",
    re.IGNORECASE,
)
_TRIGGER_TIME = re.compile(
    r"\beval\s+(?:\"Fix_TriggerTime\"|Fix_TriggerTime)\s*=\s*"
    r"strftime\s*\(\s*now\s*\(\s*\)\s*,\s*\"%F %T\"\s*\)",
    re.IGNORECASE,
)
_DATE_TIME = re.compile(
    r"\beval\s+\"Event_Date Time\"\s*=\s*"
    r"strftime\s*\(\s*_time\s*,\s*\"%F %T\"\s*\)",
    re.IGNORECASE,
)
_CASE_NAME = re.compile(
    r"\beval\s+(?:\"casename\"|casename)\s*=\s*"
    r"\"(?P<prefix>(?:\\.|[^\"\\])+)\"\s*\.\s*\"\"\s*\.\s*search\s*\.\s*\"\"\s*\.\s*rulename\b",
    re.IGNORECASE,
)
_RETURN_CASE = re.compile(r"(?:^|\|)\s*return\s+\$casename\s*$", re.IGNORECASE)


def _split_top_level_pipeline(spl: str) -> list[str]:
    """Split pipeline stages without treating outputcsv subsearch pipes as top-level."""
    stages: list[str] = []
    start = 0
    depth = 0
    quote = False
    escaped = False
    for index, character in enumerate(spl):
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quote = False
            continue
        if character == '"':
            quote = True
        elif character == "[":
            depth += 1
        elif character == "]" and depth:
            depth -= 1
        elif character == "|" and depth == 0:
            stages.append(spl[start:index].strip())
            start = index + 1
    stages.append(spl[start:].strip())
    return [stage for stage in stages if stage]


def _command(stage: str) -> str:
    match = _COMMAND.match(stage)
    return match.group(1).casefold() if match else ""


def _extract_bracket_body(stage: str) -> str | None:
    start = stage.find("[")
    if start < 0:
        return None
    depth = 0
    quote = False
    escaped = False
    for index in range(start, len(stage)):
        character = stage[index]
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quote = False
            continue
        if character == '"':
            quote = True
        elif character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                if stage[index + 1 :].strip():
                    return None
                return stage[start + 1 : index]
    return None


def _parse_table_fields(stage: str) -> list[str]:
    remainder = _COMMAND.sub("", stage, count=1)
    fields: list[str] = []
    current: list[str] = []
    quote = False
    escaped = False

    def flush() -> None:
        value = "".join(current).strip()
        current.clear()
        if value:
            fields.append(value)

    for character in remainder:
        if quote:
            if escaped:
                current.append(character)
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quote = False
            else:
                current.append(character)
        elif character == '"':
            quote = True
        elif character.isspace() or character == ",":
            flush()
        else:
            current.append(character)
    flush()
    return fields


def extract_final_table_fields(spl: str) -> list[str]:
    """Return the top-level table immediately before the final outputcsv."""
    stages = _split_top_level_pipeline(spl) if isinstance(spl, str) else []
    if not stages or _command(stages[-1]) != "outputcsv" or len(stages) < 2:
        return []
    if _command(stages[-2]) != "table":
        return []
    return _parse_table_fields(stages[-2])


def build_log_event_template(fields: Iterable[str]) -> str:
    """Render the event text using the team's ticket-summary generator rules."""
    output: dict[str, str] = {}
    for item in fields:
        key = item.replace("Fix_", "").replace("Event_", "").replace(" ", "")
        value = f'{key}="$result.{item}$"'
        output[key] = f"{output[key]} {value}" if key in output else value
    return "{ " + " ".join(output.values()) + " }"


def _required_assignment(
    text: str,
    field: str,
    errors: list[str],
    *,
    expression: re.Pattern[str] | None = None,
) -> None:
    pattern = expression or re.compile(
        rf"\beval\s+"
        + (
            rf'"{re.escape(field)}"'
            if " " in field
            else rf'(?:"{re.escape(field)}"|{re.escape(field)})'
        )
        + rf"\s*=\s*(?P<value>[^\n|]+)",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    value = match.groupdict().get("value") if match else None
    if value is None and match:
        value = match.group(0)
    if not match or _empty_spl_value(value):
        errors.append(f"required CITIC field is missing or empty: {field}")


def _empty_spl_value(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip() in {'""', "''"}


def validate_citic_detection_spl(spl: str) -> dict[str, object]:
    """Validate one complete production detection SPL definition."""
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(spl, str) or not spl.strip():
        return {"valid": False, "errors": ["spl is required"], "warnings": []}

    stages = _split_top_level_pipeline(spl)
    commands = [_command(stage) for stage in stages]
    if not stages or commands[-1:] != ["outputcsv"]:
        errors.append("outputcsv must be the final top-level command")
        output_stage = ""
    else:
        output_stage = stages[-1]
        if len(stages) < 2 or commands[-2] != "table":
            errors.append("the final top-level command before outputcsv must be table")

    table_fields = _parse_table_fields(stages[-2]) if len(stages) >= 2 and commands[-2] == "table" else []
    if table_fields[: len(REQUIRED_CITIC_FIELDS)] != list(REQUIRED_CITIC_FIELDS):
        errors.append(
            "final table must begin with the required CITIC fields in order: "
            + ", ".join(REQUIRED_CITIC_FIELDS)
        )
    if len(table_fields) != len(set(table_fields)):
        errors.append("final table must not contain duplicate fields")

    output_body = _extract_bracket_body(output_stage)
    if output_body is None:
        errors.append("outputcsv must contain one valid bracketed subsearch")
        output_body = ""

    main_text = "\n".join(stages[:-1])
    main_rule_names = [match.group("value") for match in _RULENAME.finditer(main_text)]
    output_rule_names = [match.group("value") for match in _RULENAME.finditer(output_body)]
    all_rule_names = main_rule_names + output_rule_names
    if len(main_rule_names) != 1:
        errors.append("main SPL must contain exactly one rulename assignment")
    if len(output_rule_names) != 1:
        errors.append("outputcsv subsearch must contain exactly one rulename assignment")
    if any(not re.fullmatch(r"\d{4}", value) for value in all_rule_names):
        errors.append("rulename must be exactly four digits")
    if len(set(all_rule_names)) > 1:
        errors.append("main and outputcsv rulename values must match")

    gid = _GID.search(main_text)
    if not gid or _empty_spl_value(gid.group("value")):
        errors.append("required CITIC field is missing or empty: GID")
    if not _SEARCH.search(main_text) or not _SEARCH.search(output_body):
        errors.append("search=strftime(now(), \"%Y%m%d%H%M\") is required in the main SPL and outputcsv")
    _required_assignment(main_text, "Fix_Ticketnumber", errors, expression=_TICKET)
    _required_assignment(main_text, "Fix_TriggerTime", errors, expression=_TRIGGER_TIME)
    _required_assignment(main_text, "Fix_Index", errors)
    _required_assignment(main_text, "Fix_Source Type", errors)
    _required_assignment(main_text, "Event_Hostname", errors)
    _required_assignment(main_text, "Event_Date Time", errors, expression=_DATE_TIME)

    case_names = list(_CASE_NAME.finditer(output_body))
    if len(case_names) != 1:
        errors.append("outputcsv must contain exactly one dynamic casename expression")
    if not _RETURN_CASE.search(output_body.strip()):
        errors.append("outputcsv subsearch must return $casename")

    if len(table_fields) > len(REQUIRED_CITIC_FIELDS):
        warnings.append("optional fields follow the mandatory CITIC table fields")

    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "table_fields": table_fields,
        "rulename": all_rule_names[0] if all_rule_names else None,
    }


__all__ = [
    "REQUIRED_CITIC_FIELDS",
    "build_log_event_template",
    "extract_final_table_fields",
    "validate_citic_detection_spl",
]
