"""Per-field validation for catalog record payloads.

Validation errors always identify the exact field to correct: the ServiceError
carries ``details={"fields": {column: message}}`` so forms and MCP clients can
point at the offending input instead of one blended message.
"""

from __future__ import annotations

import re
import uuid
from email.utils import parseaddr
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
_GID_RE = re.compile(r"^(?:Default|default|[0-9]{1,10}|g[0-9]{1,10})$")
_FIELD_KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{0,63}$")
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+$")

FIELD_MAPPING_KEYS = (
    "username",
    "hostname",
    "src_ip",
    "dest_ip",
    "event_id",
    "title",
    "description",
    "severity",
    "status",
)
EMAIL_LANGUAGES = ("EN", "CN", "ZH")
EMAIL_BRANDS = ("CPC", "CEC")

MAX_TEXT_LENGTHS = {
    "customer_code": 64,
    "display_name": 200,
    "short_name": 100,
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


def _uuid_value(payload: dict[str, Any], column: str, fields: dict[str, str]) -> str:
    value = payload.get(column, "")
    if value in (None, ""):
        return ""
    if not isinstance(value, str):
        fields[column] = "must be a UUID or empty."
        return ""
    value = value.strip()
    try:
        return str(uuid.UUID(value))
    except (ValueError, AttributeError):
        fields[column] = "must be a valid UUID or empty."
        return value


def _email_list(value: Any, column: str, fields: dict[str, str]) -> list[str]:
    if value in (None, ""):
        return []
    values = [value] if isinstance(value, str) else value if isinstance(value, list) else None
    if values is None:
        fields[column] = "must be a list of email addresses."
        return []
    if len(values) > 50:
        fields[column] = "contains too many recipients."
        return []
    result: list[str] = []
    for item in values:
        if not isinstance(item, str):
            fields[column] = "must contain only email addresses."
            continue
        address = item.strip()
        name, parsed = parseaddr(address)
        if name or parsed != address or not _EMAIL_RE.fullmatch(address) or len(address) > 320:
            fields[column] = "contains an invalid email address."
            continue
        if address.casefold() not in {existing.casefold() for existing in result}:
            result.append(address)
    return result


def _email_config(value: Any, fields: dict[str, str]) -> dict[str, Any]:
    if value in (None, ""):
        value = {}
    if not isinstance(value, dict):
        fields["email_config"] = "must be an object."
        value = {}
    result = {
        "recipients": _email_list(value.get("recipients", value.get("to", [])), "email_config.recipients", fields),
        "cc": _email_list(value.get("cc", []), "email_config.cc", fields),
        "bcc": _email_list(value.get("bcc", []), "email_config.bcc", fields),
        "language": str(value.get("language", "EN") or "EN").upper(),
        "brand": str(value.get("brand", "CPC") or "CPC").upper(),
    }
    if result["language"] not in EMAIL_LANGUAGES:
        fields["email_config.language"] = "choose EN, CN, or ZH."
    if result["brand"] not in EMAIL_BRANDS:
        fields["email_config.brand"] = "choose CPC or CEC."
    return result


def _field_mapping(value: Any, fields: dict[str, str]) -> dict[str, str]:
    if value in (None, ""):
        value = {}
    if not isinstance(value, dict):
        fields["field_mapping"] = "must be an object."
        value = {}
    result: dict[str, str] = {}
    for key in FIELD_MAPPING_KEYS:
        item = value.get(key, "")
        if not isinstance(item, str):
            fields[f"field_mapping.{key}"] = "must be text."
            item = ""
        item = item.strip()
        if len(item) > 255:
            fields[f"field_mapping.{key}"] = "must be at most 255 characters."
            item = item[:255]
        result[key] = item
    for key, item in value.items():
        if key in FIELD_MAPPING_KEYS:
            continue
        if not isinstance(key, str) or not _FIELD_KEY_RE.fullmatch(key):
            fields[f"field_mapping.{key}"] = "must use a simple field name."
            continue
        if not isinstance(item, str):
            fields[f"field_mapping.{key}"] = "must be text."
            continue
        item = item.strip()
        if len(item) > 255:
            fields[f"field_mapping.{key}"] = "must be at most 255 characters."
            item = item[:255]
        result[key] = item
    return result


def _splunk_indexes(value: Any, fields: dict[str, str]) -> list[str]:
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        fields["splunk_indexes"] = "must be a list of index names."
        return []
    if len(value) > 100:
        fields["splunk_indexes"] = "contains too many indexes."
        return []
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            fields["splunk_indexes"] = "must contain only text index names."
            continue
        name = item.strip()
        if not name or len(name) > 255:
            fields["splunk_indexes"] = "contains an invalid index name."
            continue
        if name.casefold() not in {existing.casefold() for existing in result}:
            result.append(name)
    return result


def validate_customer(payload: dict[str, Any], *, partial: bool) -> dict[str, Any]:
    fields: dict[str, str] = {}
    values: dict[str, Any] = {}
    for column in ("customer_code", "display_name", "short_name", "gid", "lifecycle_status", "notes"):
        values[column] = _apply_common_rules(column, _text_value(payload, column, fields), fields)
    values["source_type_id"] = _uuid_value(payload, "source_type_id", fields)
    values["related_staff_id"] = _uuid_value(payload, "related_staff_id", fields)
    values["splunk_indexes"] = _splunk_indexes(payload.get("splunk_indexes", []), fields)
    values["field_mapping"] = _field_mapping(payload.get("field_mapping", {}), fields)
    values["email_config"] = _email_config(payload.get("email_config", {}), fields)
    delivery_enabled = payload.get("alert_delivery_enabled", False)
    if not isinstance(delivery_enabled, bool):
        fields["alert_delivery_enabled"] = "must be a boolean."
        delivery_enabled = False
    values["alert_delivery_enabled"] = delivery_enabled

    if not partial or "customer_code" in payload:
        if not values["customer_code"]:
            fields["customer_code"] = "customer code is required."
        elif not _CUSTOMER_CODE_RE.fullmatch(values["customer_code"]):
            fields["customer_code"] = "use letters, digits, underscores, or hyphens (max 64)."
    if not partial or "display_name" in payload:
        if not values["display_name"]:
            fields["display_name"] = "display name is required."
    if not partial or "gid" in payload:
        if values["gid"] and not _GID_RE.fullmatch(values["gid"]):
            fields["gid"] = "use Default or a numeric tenant GID (optionally g-prefixed)."
    if not partial or "lifecycle_status" in payload:
        if values["lifecycle_status"] not in LIFECYCLE_STATUSES:
            fields["lifecycle_status"] = "choose one of: " + ", ".join(LIFECYCLE_STATUSES) + "."
    if fields:
        raise validation_error("customer", fields)
    return values


def validate_rule(payload: dict[str, Any], *, partial: bool) -> dict[str, Any]:
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


def validate_fix_source_type(payload: dict[str, Any], *, partial: bool) -> dict[str, Any]:
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


def validate_payload(catalog: str, payload: dict[str, Any], *, partial: bool = False) -> dict[str, Any]:
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
