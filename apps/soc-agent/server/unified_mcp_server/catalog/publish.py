"""Lookup snapshot generation and verification for catalog publication.

PostgreSQL is authoritative; Splunk consumers keep reading lookup files. These
helpers are pure so the generated CSV format and checksums can be tested
without a Splunk connection.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
from typing import Any

from ..errors import ServiceError
from .model import CATALOGS
from .validation import citic_rule_number_warning

RULESET_COLUMNS = [
    "RuleNum",
    "RuleName_EN",
    "RuleName_CN",
    "RuleName_ZH",
    "Description_EN",
    "Description_CN",
    "Description_ZH",
    "Remediation_EN",
    "Remediation_CN",
    "Remediation_ZH",
    "Severity",
    "GID",
]

CUSTOMER_COLUMNS = [
    "CustomerID",
    "CustomerCode",
    "DisplayName",
    "TenantNumber",
    "GID",
    "LifecycleStatus",
]

FIX_SOURCE_TYPE_COLUMNS = [
    "CustomerID",
    "CustomerCode",
    "SystemName",
    "FixSourceType",
    "DefaultFixIndex",
    "Description",
]

LOOKUP_COLUMNS = {
    "rule": RULESET_COLUMNS,
    "customer": CUSTOMER_COLUMNS,
    "fix_source_type": FIX_SOURCE_TYPE_COLUMNS,
}


def ruleset_row(record: dict[str, Any]) -> dict[str, str]:
    return {
        "RuleNum": record.get("rule_number", ""),
        "RuleName_EN": record.get("rule_name_en", ""),
        "RuleName_CN": record.get("rule_name_cn", ""),
        "RuleName_ZH": record.get("rule_name_zh", ""),
        "Description_EN": record.get("description_en", ""),
        "Description_CN": record.get("description_cn", ""),
        "Description_ZH": record.get("description_zh", ""),
        "Remediation_EN": record.get("remediation_en", ""),
        "Remediation_CN": record.get("remediation_cn", ""),
        "Remediation_ZH": record.get("remediation_zh", ""),
        "Severity": str(record.get("severity", "")).upper(),
        "GID": record.get("gid", ""),
    }


def customer_row(record: dict[str, Any]) -> dict[str, str]:
    return {
        "CustomerID": record.get("record_id", ""),
        "CustomerCode": record.get("customer_code", ""),
        "DisplayName": record.get("display_name", ""),
        "TenantNumber": record.get("tenant_number", ""),
        "GID": record.get("gid", ""),
        "LifecycleStatus": record.get("lifecycle_status", ""),
    }


def fix_source_type_row(record: dict[str, Any], customer: dict[str, Any] | None) -> dict[str, str]:
    return {
        "CustomerID": record.get("customer_id", ""),
        "CustomerCode": (customer or {}).get("customer_code", ""),
        "SystemName": record.get("system_name", ""),
        "FixSourceType": record.get("fix_source_type_value", ""),
        "DefaultFixIndex": record.get("default_fix_index", ""),
        "Description": record.get("description", ""),
    }


def lookup_rows(catalog: str, records: list[dict[str, Any]], customers: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    if catalog == "rule":
        return [ruleset_row(record) for record in records]
    if catalog == "customer":
        return [customer_row(record) for record in records]
    if catalog == "fix_source_type":
        return [
            fix_source_type_row(record, customers.get(record.get("customer_id", "")))
            for record in records
        ]
    raise ServiceError("invalid_input", f"Unknown catalog: {catalog}")


def render_lookup_csv(columns: list[str], rows: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(columns)
    for row in rows:
        writer.writerow([row.get(column, "") for column in columns])
    return buffer.getvalue()


def parse_lookup_csv(text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    return [
        {(key or ""): ("" if value is None else str(value)) for key, value in row.items()}
        for row in reader
    ]


def canonical_checksum(rows: list[dict[str, str]]) -> str:
    encoded = json.dumps(rows, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def validate_publication(
    catalog: str,
    records: list[dict[str, Any]],
    customers: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Blocking errors and non-blocking warnings for one catalog snapshot."""
    errors: list[str] = []
    warnings: list[str] = []

    if catalog == "rule":
        counts: dict[str, int] = {}
        for record in records:
            counts[record.get("rule_number", "")] = counts.get(record.get("rule_number", ""), 0) + 1
        duplicates = sorted(number for number, count in counts.items() if count > 1)
        if duplicates:
            errors.append(
                "duplicate rule numbers must be resolved before publication: "
                + ", ".join(duplicates[:20])
            )
        for record in records:
            number = record.get("rule_number", "")
            if not number:
                errors.append(f"rule {record.get('record_id', '')} has no rule number.")
            if not record.get("rule_name_en"):
                errors.append(f"rule {number or record.get('record_id', '')} has no English rule name.")
            note = citic_rule_number_warning(number)
            if note:
                warnings.append(note)
            if not record.get("gid"):
                warnings.append(f"rule {number} has an empty GID.")
            customer_id = record.get("customer_id", "")
            if customer_id and customer_id not in customers:
                errors.append(f"rule {number} references unknown customer {customer_id}.")
    elif catalog == "customer":
        for record in records:
            if not record.get("customer_code"):
                errors.append(f"customer {record.get('record_id', '')} has no customer code.")
            if not record.get("display_name"):
                errors.append(f"customer {record.get('record_id', '')} has no display name.")
    elif catalog == "fix_source_type":
        for record in records:
            customer_id = record.get("customer_id", "")
            if not customer_id or customer_id not in customers:
                errors.append(
                    f"fix source type {record.get('system_name', '') or record.get('record_id', '')}"
                    " references a missing customer."
                )
                continue
            customer = customers[customer_id]
            expected_index = f"G{customer.get('gid', '')}" if customer.get("gid") else ""
            value = record.get("default_fix_index", "")
            if expected_index and value and value != expected_index:
                errors.append(
                    f"fix source type {record.get('system_name', '')} sets Fix_Index {value!r}"
                    f" but customer {customer.get('customer_code', '')} implies {expected_index!r}."
                )
    else:
        raise ServiceError("invalid_input", f"Unknown catalog: {catalog}")

    return {"catalog": catalog, "valid": not errors, "errors": errors, "warnings": warnings}


__all__ = [
    "FIX_SOURCE_TYPE_COLUMNS",
    "CUSTOMER_COLUMNS",
    "LOOKUP_COLUMNS",
    "RULESET_COLUMNS",
    "canonical_checksum",
    "lookup_rows",
    "parse_lookup_csv",
    "render_lookup_csv",
    "validate_publication",
]
