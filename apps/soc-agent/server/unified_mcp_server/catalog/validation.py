"""Per-field validation for catalog record payloads.

Validation errors always identify the exact field to correct: the ServiceError
carries ``details={"fields": {column: message}}`` so forms and MCP clients can
point at the offending input instead of one blended message.
"""

from __future__ import annotations

import re
from typing import Any

from ..errors import ServiceError
from .model import (
    CATALOG_EDITABLE_COLUMNS,
    LIFECYCLE_STATUSES,
    RULE_SEVERITIES,
    RULE_STATUSES,
)

_RULE_NUMBER_RE = re.compile(r"^[0-9]{1,4}$")
# Four digits is the CITIC contract for detection rulenames; the catalog also
# preserves legacy values such as "0" that reconciliation must review.
_CITIC_RULE_NUMBER_RE = re.compile(r"^[0-9]{4}$")
_CUSTOMER_CODE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
_TENANT_NUMBER_RE = re.compile(r"^[0-9]{1,10}$")
_GID_RE = re.compile(r"^(?:Default|default|[0-9]{1,10}|g[0-9]{1,10})$")

MAX_TEXT_LENGTHS = {
    "customer_code": 64,
    "display_name": 200,
    "tenant_number": 10,
    "gid": 16,
    "notes": 4000,
    "rule_number": 4,
    "rule_name_en": 300,
    "rule_name_cn": 300,
    "rule_name_zh": 300,
    "description_en": 4000,
    "description_cn": 4000,
    "description_zh": 4000,
    "remediation_en": 4000,
    "remediation_cn": 4000,
    "remediation_zh": 4000,
    "system_name": 200,
    "fix_source_type_value": 200,
    "default_fix_index": 16,
    "description": 4000,
}


def validation_error(catalog: str, fields: dict[str, str]) -> ServiceError:
    label = {
        "customer": "Customer Information",
        "rule": "Ruleset",
        "fix_source_type": "Fix Source type",
    }[catalog]
    return ServiceError(
        "validation_failed",
        f"{label} validation failed; correct the highlighted fields.",
        details={"catalog": catalog, "fields": fields},
    )


def _text_value(payload: dict[str, Any], column: str, fields: dict[str, str]) -> str:
    value = payload.get(column)
    if value is None:
        return ""
    if not isinstance(value, str):
        fields[column] = "must be text."
        return ""
    return value.strip()


def _apply_common_rules(column: str, value: str, fields: dict[str, str]) -> str:
    limit = MAX_TEXT_LENGTHS.get(column)
    if limit is not None and len(value) > limit:
        fields[column] = f"must be at most {limit} characters."
    return value


def validate_customer(payload: dict[str, Any], *, partial: bool) -> dict[str, str]:
    fields: dict[str, str] = {}
    values: dict[str, str] = {}
    for column in CATALOG_EDITABLE_COLUMNS["customer"]:
        values[column] = _apply_common_rules(column, _text_value(payload, column, fields), fields)

    if not partial or "customer_code" in payload:
        if not values["customer_code"]:
            fields["customer_code"] = "customer code is required."
        elif not _CUSTOMER_CODE_RE.fullmatch(values["customer_code"]):
            fields["customer_code"] = "use letters, digits, underscores, or hyphens (max 64)."
    if not partial or "display_name" in payload:
        if not values["display_name"]:
            fields["display_name"] = "display name is required."
    if not partial or "tenant_number" in payload:
        if values["tenant_number"] and not _TENANT_NUMBER_RE.fullmatch(values["tenant_number"]):
            fields["tenant_number"] = "use digits only (the g<tenant> index prefix number)."
    if not partial or "gid" in payload:
        if values["gid"] and not _GID_RE.fullmatch(values["gid"]):
            fields["gid"] = "use Default or a numeric tenant GID (optionally g-prefixed)."
    if not partial or "lifecycle_status" in payload:
        if values["lifecycle_status"] not in LIFECYCLE_STATUSES:
            fields["lifecycle_status"] = "choose one of: " + ", ".join(LIFECYCLE_STATUSES) + "."
    if fields:
        raise validation_error("customer", fields)
    return values


def validate_rule(payload: dict[str, Any], *, partial: bool) -> dict[str, str]:
    fields: dict[str, str] = {}
    values: dict[str, str] = {}
    for column in CATALOG_EDITABLE_COLUMNS["rule"]:
        values[column] = _apply_common_rules(column, _text_value(payload, column, fields), fields)

    if not partial or "rule_number" in payload:
        if not values["rule_number"]:
            fields["rule_number"] = "rule number is required."
        elif not _RULE_NUMBER_RE.fullmatch(values["rule_number"]):
            fields["rule_number"] = "use 1-4 digits; leading zeros are preserved as text."
    if not partial or "rule_name_en" in payload:
        if not values["rule_name_en"]:
            fields["rule_name_en"] = "English rule name is required."
    if not partial or "severity" in payload:
        if values["severity"] not in RULE_SEVERITIES:
            fields["severity"] = "choose one of: " + ", ".join(RULE_SEVERITIES) + "."
    if not partial or "status" in payload:
        if values["status"] not in RULE_STATUSES:
            fields["status"] = "choose one of: " + ", ".join(RULE_STATUSES) + "."
    if not partial or "customer_id" in payload:
        if values["customer_id"] and not re.fullmatch(r"[0-9a-f]{32}", values["customer_id"]):
            fields["customer_id"] = "must be a catalog customer ID, or empty for a shared rule."
    if fields:
        raise validation_error("rule", fields)
    return values


def validate_fix_source_type(payload: dict[str, Any], *, partial: bool) -> dict[str, str]:
    fields: dict[str, str] = {}
    values: dict[str, str] = {}
    for column in CATALOG_EDITABLE_COLUMNS["fix_source_type"]:
        values[column] = _apply_common_rules(column, _text_value(payload, column, fields), fields)

    if not partial or "customer_id" in payload:
        if not re.fullmatch(r"[0-9a-f]{32}", values["customer_id"]):
            fields["customer_id"] = "a catalog customer ID is required."
    if not partial or "system_name" in payload:
        if not values["system_name"]:
            fields["system_name"] = "source system name is required."
    if not partial or "fix_source_type_value" in payload:
        if not values["fix_source_type_value"]:
            fields["fix_source_type_value"] = "Fix_Source Type value is required."
    if not partial or "default_fix_index" in payload:
        if values["default_fix_index"] and not _TENANT_INDEX_RE.fullmatch(values["default_fix_index"]):
            fields["default_fix_index"] = 'use the ticket Fix_Index format "G" plus the customer GID.'
    if fields:
        raise validation_error("fix_source_type", fields)
    return values


_TENANT_INDEX_RE = re.compile(r"^G[0-9]{0,10}$")


VALIDATORS = {
    "customer": validate_customer,
    "rule": validate_rule,
    "fix_source_type": validate_fix_source_type,
}


def validate_payload(catalog: str, payload: dict[str, Any], *, partial: bool = False) -> dict[str, str]:
    validator = VALIDATORS.get(catalog)
    if validator is None:
        raise ServiceError("invalid_input", f"Unknown catalog: {catalog}")
    if not isinstance(payload, dict):
        raise validation_error(catalog, {"_": "record must be a JSON object."})
    return validator(payload, partial=partial)


def citic_rule_number_warning(rule_number: str) -> str | None:
    """Non-blocking note for legacy rule numbers outside the 4-digit contract."""
    if _CITIC_RULE_NUMBER_RE.fullmatch(rule_number):
        return None
    return f"rule number {rule_number!r} is not four digits; CITIC detections require a 4-digit rulename."


__all__ = [
    "citic_rule_number_warning",
    "validate_payload",
    "validation_error",
]
