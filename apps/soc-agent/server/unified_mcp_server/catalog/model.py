"""Column specs and row mapping for the three SOC catalogs.

Records cross the MCP and RPC boundaries as JSON-serializable dicts, so the
catalog models are explicit column tuples plus row mappers instead of
dataclasses. Every mapper returns timestamps as ISO strings and keeps
``revision`` as the optimistic-locking token surfaced to editors.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

CATALOGS = ("customer", "rule", "fix_source_type")

CATALOG_TABLES = {
    "customer": "soc_customer",
    "rule": "soc_rule_catalog",
    "fix_source_type": "soc_fix_source_type",
}

CATALOG_ID_COLUMNS = {
    "customer": "customer_id",
    "rule": "rule_id",
    "fix_source_type": "source_type_id",
}

LIFECYCLE_STATUSES = ("active", "provisioning", "suspended", "retired")
RULE_SEVERITIES = ("info", "low", "medium", "high", "critical")
RULE_STATUSES = ("draft", "active", "disabled", "retired")

CUSTOMER_EDITABLE_COLUMNS = (
    "customer_code",
    "display_name",
    "tenant_number",
    "gid",
    "lifecycle_status",
    "notes",
)
CUSTOMER_COLUMNS = ("customer_id", *CUSTOMER_EDITABLE_COLUMNS)

RULE_EDITABLE_COLUMNS = (
    "rule_number",
    "rule_name_en",
    "rule_name_cn",
    "rule_name_zh",
    "description_en",
    "description_cn",
    "description_zh",
    "remediation_en",
    "remediation_cn",
    "remediation_zh",
    "severity",
    "status",
    "customer_id",
    "gid",
)
RULE_COLUMNS = ("rule_id", *RULE_EDITABLE_COLUMNS)

FIX_SOURCE_TYPE_EDITABLE_COLUMNS = (
    "customer_id",
    "system_name",
    "fix_source_type_value",
    "default_fix_index",
    "description",
)
FIX_SOURCE_TYPE_COLUMNS = ("source_type_id", *FIX_SOURCE_TYPE_EDITABLE_COLUMNS)

CATALOG_EDITABLE_COLUMNS = {
    "customer": CUSTOMER_EDITABLE_COLUMNS,
    "rule": RULE_EDITABLE_COLUMNS,
    "fix_source_type": FIX_SOURCE_TYPE_EDITABLE_COLUMNS,
}

CATALOG_LABELS = {
    "customer": "Customer Information",
    "rule": "Ruleset",
    "fix_source_type": "Fix Source type",
}

# Customer and fix-source-type records have no legacy duplicates; only the
# rule catalog inherits duplicate rule numbers from the live Ruleset.csv, so
# its uniqueness index is a pending migration applied after reconciliation.
PENDING_MIGRATIONS = {
    2: (
        "rule_number_unique",
        "require unique rule numbers after Ruleset.csv reconciliation",
    ),
}


def _iso(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value) if value is not None else ""


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ("" if value is None else str(value))


def customer_from_row(row: Any) -> dict[str, Any]:
    (
        customer_id,
        customer_code,
        display_name,
        tenant_number,
        gid,
        lifecycle_status,
        notes,
        revision,
        archived_at,
        created_by,
        updated_by,
        created_at,
        updated_at,
    ) = row
    return {
        "catalog": "customer",
        "record_id": _text(customer_id),
        "customer_code": _text(customer_code),
        "display_name": _text(display_name),
        "tenant_number": _text(tenant_number),
        "gid": _text(gid),
        "lifecycle_status": _text(lifecycle_status),
        "notes": _text(notes),
        "revision": int(revision),
        "archived": archived_at is not None,
        "archived_at": _iso(archived_at),
        "created_by": _text(created_by),
        "updated_by": _text(updated_by),
        "created_at": _iso(created_at),
        "updated_at": _iso(updated_at),
    }


def rule_from_row(row: Any) -> dict[str, Any]:
    (
        rule_id,
        rule_number,
        rule_name_en,
        rule_name_cn,
        rule_name_zh,
        description_en,
        description_cn,
        description_zh,
        remediation_en,
        remediation_cn,
        remediation_zh,
        severity,
        status,
        customer_id,
        gid,
        revision,
        archived_at,
        created_by,
        updated_by,
        created_at,
        updated_at,
    ) = row
    return {
        "catalog": "rule",
        "record_id": _text(rule_id),
        "rule_number": _text(rule_number),
        "rule_name_en": _text(rule_name_en),
        "rule_name_cn": _text(rule_name_cn),
        "rule_name_zh": _text(rule_name_zh),
        "description_en": _text(description_en),
        "description_cn": _text(description_cn),
        "description_zh": _text(description_zh),
        "remediation_en": _text(remediation_en),
        "remediation_cn": _text(remediation_cn),
        "remediation_zh": _text(remediation_zh),
        "severity": _text(severity),
        "status": _text(status),
        "customer_id": _text(customer_id),
        "gid": _text(gid),
        "revision": int(revision),
        "archived": archived_at is not None,
        "archived_at": _iso(archived_at),
        "created_by": _text(created_by),
        "updated_by": _text(updated_by),
        "created_at": _iso(created_at),
        "updated_at": _iso(updated_at),
    }


def fix_source_type_from_row(row: Any) -> dict[str, Any]:
    (
        source_type_id,
        customer_id,
        system_name,
        fix_source_type_value,
        default_fix_index,
        description,
        revision,
        archived_at,
        created_by,
        updated_by,
        created_at,
        updated_at,
    ) = row
    return {
        "catalog": "fix_source_type",
        "record_id": _text(source_type_id),
        "customer_id": _text(customer_id),
        "system_name": _text(system_name),
        "fix_source_type_value": _text(fix_source_type_value),
        "default_fix_index": _text(default_fix_index),
        "description": _text(description),
        "revision": int(revision),
        "archived": archived_at is not None,
        "archived_at": _iso(archived_at),
        "created_by": _text(created_by),
        "updated_by": _text(updated_by),
        "created_at": _iso(created_at),
        "updated_at": _iso(updated_at),
    }


ROW_MAPPERS = {
    "customer": customer_from_row,
    "rule": rule_from_row,
    "fix_source_type": fix_source_type_from_row,
}

RETURNING_COLUMNS = {
    "customer": CUSTOMER_COLUMNS
    + ("revision", "archived_at", "created_by", "updated_by", "created_at", "updated_at"),
    "rule": RULE_COLUMNS
    + ("revision", "archived_at", "created_by", "updated_by", "created_at", "updated_at"),
    "fix_source_type": FIX_SOURCE_TYPE_COLUMNS
    + ("revision", "archived_at", "created_by", "updated_by", "created_at", "updated_at"),
}


def empty_record(catalog: str) -> dict[str, Any]:
    """Return the all-fields editor draft for a new record of this catalog."""
    base: dict[str, Any] = {
        "catalog": catalog,
        "record_id": "",
        "revision": 1,
        "archived": False,
    }
    for column in CATALOG_EDITABLE_COLUMNS[catalog]:
        base[column] = ""
    if catalog == "customer":
        base["lifecycle_status"] = "active"
        base["customer_code"] = ""
    if catalog == "rule":
        base["severity"] = "info"
        base["status"] = "active"
    return base


def record_public_summary(record: dict[str, Any]) -> dict[str, Any]:
    """Small projection used in list views."""
    keys = ("catalog", "record_id", "revision", "archived", "updated_at", "updated_by")
    summary = {key: record.get(key) for key in keys}
    if record["catalog"] == "customer":
        summary["label"] = record.get("display_name", "")
        summary["code"] = record.get("customer_code", "")
        summary["status"] = record.get("lifecycle_status", "")
    elif record["catalog"] == "rule":
        summary["label"] = record.get("rule_name_en", "")
        summary["code"] = record.get("rule_number", "")
        summary["status"] = record.get("status", "")
        summary["severity"] = record.get("severity", "")
    else:
        summary["label"] = record.get("system_name", "")
        summary["code"] = record.get("fix_source_type_value", "")
        summary["status"] = "archived" if record.get("archived") else "active"
    return summary


__all__ = [
    "CATALOGS",
    "CATALOG_EDITABLE_COLUMNS",
    "CATALOG_ID_COLUMNS",
    "CATALOG_LABELS",
    "CATALOG_TABLES",
    "CUSTOMER_EDITABLE_COLUMNS",
    "FIX_SOURCE_TYPE_EDITABLE_COLUMNS",
    "LIFECYCLE_STATUSES",
    "PENDING_MIGRATIONS",
    "RETURNING_COLUMNS",
    "RULE_EDITABLE_COLUMNS",
    "RULE_SEVERITIES",
    "RULE_STATUSES",
    "ROW_MAPPERS",
    "empty_record",
    "record_public_summary",
]
