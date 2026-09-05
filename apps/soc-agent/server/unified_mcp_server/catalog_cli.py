"""Operator CLI for catalog migration and deferred schema maintenance.

Reads the authoritative lookup data from the source Splunk environment
(SPLUNK_SOURCE_*, defaulting to the main SPLUNK_* target) into PostgreSQL
staging, produces a reconciliation report, and promotes staged rows only on
an explicit operator command. Publications stay behind the regular publish
flow; imports never write to Splunk.

Usage (run from apps/soc-agent/server):
    uv run python -m unified_mcp_server.catalog_cli import-ruleset
    uv run python -m unified_mcp_server.catalog_cli report --batch <id>
    uv run python -m unified_mcp_server.catalog_cli promote --batch <id> [--limit N] [--dry-run]
    uv run python -m unified_mcp_server.catalog_cli pending-migrations
    uv run python -m unified_mcp_server.catalog_cli apply-unique-constraint
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import json
import sys
import uuid
from typing import Any

from .catalog.model import CATALOGS, RULE_SEVERITIES
from .catalog.store import CatalogStore
from .catalog.validation import validate_payload
from .config import ServerSettings
from .env_loader import load_server_env
from .errors import ServiceError

RULE_LOOKUP = "Ruleset.csv"

# Lookup columns copied verbatim into the rule catalog, mapped to columns.
COLUMN_MAP = {
    "RuleNum": "rule_number",
    "RuleName_EN": "rule_name_en",
    "RuleName_CN": "rule_name_cn",
    "RuleName_ZH": "rule_name_zh",
    "Description_EN": "description_en",
    "Description_CN": "description_cn",
    "Description_ZH": "description_zh",
    "Remediation_EN": "remediation_en",
    "Remediation_CN": "remediation_cn",
    "Remediation_ZH": "remediation_zh",
    "Severity": "severity",
    "GID": "gid",
}


def _store() -> CatalogStore:
    store = CatalogStore.from_env()
    if store is None:
        raise SystemExit("APP_POSTGRES_URI is required for catalog storage.")
    return store


def _source_config(settings: ServerSettings) -> dict[str, Any]:
    """Splunk client config for the read-only source environment."""
    import os

    source_url = os.environ.get("SPLUNK_SOURCE_URL", "").strip()
    if source_url:
        return {
            "splunk_url": source_url,
            "splunk_host": "",
            "splunk_port": 8089,
            "splunk_username": os.environ.get("SPLUNK_SOURCE_USERNAME", "").strip(),
            "splunk_password": os.environ.get("SPLUNK_SOURCE_PASSWORD", "").strip(),
            "splunk_token": "",
            "verify_ssl": os.environ.get("SPLUNK_SOURCE_VERIFY_SSL", "false").strip().lower()
            in {"1", "true", "yes", "on"},
            "allow_insecure_http": False,
            "request_timeout": settings.splunk.request_timeout,
            "job_timeout": settings.splunk.job_timeout,
        }
    # No dedicated source configured: read from the main target.
    return settings.splunk.client_config()


async def _read_lookup_rows(settings: ServerSettings, lookup_name: str) -> list[dict[str, str]]:
    from .splunk.splunk_client import SplunkAPIError, SplunkClient

    config = _source_config(settings)
    client = SplunkClient(config)
    try:
        await client.connect()
        rows = await client.search_oneshot(
            f'| inputlookup "{lookup_name}"',
            earliest_time="0",
            latest_time="now",
            max_count=100000,
        )
    except SplunkAPIError as exc:
        raise SystemExit(f"Reading {lookup_name} from the source Splunk failed: {exc.message}") from exc
    finally:
        await client.disconnect()
    return rows


def _normalize_severity(raw: str) -> tuple[str, str | None]:
    value = raw.strip().lower()
    if value in RULE_SEVERITIES:
        return value, None
    return "info", f"unknown severity {raw!r} normalized to 'info'"


def _rule_values_from_row(row: dict[str, str]) -> tuple[dict[str, str], list[str]]:
    values: dict[str, str] = {}
    warnings: list[str] = []
    for source_column, column in COLUMN_MAP.items():
        values[column] = str(row.get(source_column, "") or "").strip()
    if values["severity"]:
        normalized, warning = _normalize_severity(values["severity"])
        values["severity"] = normalized
        if warning:
            warnings.append(warning)
    values["status"] = "active"
    values["customer_id"] = ""
    for source_column in row:
        if source_column not in COLUMN_MAP and str(row.get(source_column, "")).strip():
            warnings.append(f"unmapped source column {source_column!r} preserved in staging only")
    return values, warnings


def import_ruleset(args: argparse.Namespace) -> None:
    settings = ServerSettings.from_env()
    store = _store()
    rows = asyncio.run(_read_lookup_rows(settings, args.lookup))

    columns: set[str] = set()
    for row in rows:
        columns.update(row.keys())

    batch_id = uuid.uuid4().hex
    actor = f"catalog_cli:{getpass.getuser()}"
    store.create_import_batch(batch_id=batch_id, source="splunk:Ruleset.csv", actor=actor)

    staged: list[dict[str, Any]] = []
    duplicate_counts: dict[str, int] = {}
    missing_required: list[int] = []
    severity_variants: set[str] = set()
    for index, row in enumerate(rows, start=1):
        values, warnings = _rule_values_from_row(row)
        number = values.get("rule_number", "")
        if number:
            duplicate_counts[number] = duplicate_counts.get(number, 0) + 1
        try:
            validate_payload("rule", values, partial=False)
        except ServiceError as exc:
            fields = exc.details.get("fields", {}) if isinstance(exc.details, dict) else {}
            warnings.extend(f"invalid {field}: {message}" for field, message in fields.items())
            if "rule_number" in fields or "rule_name_en" in fields:
                missing_required.append(index)
        for field in ("Severity",):
            if str(row.get(field, "")).strip() and str(row.get(field, "")).strip().lower() not in RULE_SEVERITIES:
                severity_variants.add(str(row.get(field)).strip())
        staged.append({"row_number": index, "payload": values, "warnings": warnings})

    duplicates = sorted(
        ({"rule_number": number, "row_count": count} for number, count in duplicate_counts.items() if count > 1),
        key=lambda item: item["rule_number"],
    )
    store.add_staging_rows(batch_id, staged)
    report = {
        "batch_id": batch_id,
        "lookup": args.lookup,
        "source_row_count": len(rows),
        "staged_row_count": len(staged),
        "columns_discovered": sorted(columns),
        "duplicate_rule_numbers": duplicates,
        "rows_missing_required_fields": missing_required,
        "severity_variants_normalized": sorted(severity_variants),
        "warning_total": sum(len(item["warnings"]) for item in staged),
        "promoted_row_count": 0,
        "note": "Review this report, resolve duplicates, then run: promote --batch " + batch_id,
    }
    store.update_import_report(batch_id, report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


def show_report(args: argparse.Namespace) -> None:
    store = _store()
    batch = store.get_import_batch(args.batch)
    if batch is None:
        raise SystemExit(f"Unknown import batch: {args.batch}")
    print(json.dumps(batch["report"], indent=2, ensure_ascii=False))


def promote(args: argparse.Namespace) -> None:
    store = _store()
    batch = store.get_import_batch(args.batch)
    if batch is None:
        raise SystemExit(f"Unknown import batch: {args.batch}")
    rows = store.staging_rows(args.batch, promoted=False)
    actor = f"catalog_cli:{getpass.getuser()}"
    promoted = 0
    skipped: list[dict[str, Any]] = []
    for row in rows[: args.limit] if args.limit else rows:
        if args.dry_run:
            promoted += 1
            continue
        values = row["payload"]
        try:
            validate_payload("rule", values, partial=False)
        except ServiceError as exc:
            skipped.append({"row_number": row["row_number"], "reason": exc.message})
            continue
        try:
            record = store.create_record("rule", values, actor=actor)
        except ServiceError as exc:
            skipped.append({"row_number": row["row_number"], "code": exc.code, "reason": exc.message})
            continue
        store.set_staging_promoted(args.batch, row["row_number"], record["record_id"])
        promoted += 1

    report = dict(batch["report"] or {})
    report["promoted_row_count"] = promoted + int(report.get("promoted_row_count", 0))
    report["skipped"] = skipped
    store.update_import_report(args.batch, report)
    print(json.dumps({
        "batch_id": args.batch,
        "dry_run": args.dry_run,
        "promoted_this_run": promoted,
        "skipped": skipped,
        "report_total_promoted": report["promoted_row_count"],
    }, indent=2, ensure_ascii=False))


def pending_migrations(_args: argparse.Namespace) -> None:
    print(json.dumps({"pending": _store().pending_migrations()}, indent=2))


def apply_unique_constraint(_args: argparse.Namespace) -> None:
    try:
        applied = _store().apply_pending_migrations()
    except ServiceError as exc:
        print(json.dumps({"applied": [], "blocked": exc.details}, indent=2))
        raise SystemExit(exc.message) from exc
    print(json.dumps({"applied": applied}, indent=2))


def main() -> None:
    load_server_env()
    parser = argparse.ArgumentParser(description="SOC catalog import and maintenance CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    import_parser = sub.add_parser("import-ruleset", help="read the source Ruleset.csv into staging and report")
    import_parser.add_argument("--lookup", default=RULE_LOOKUP)
    import_parser.set_defaults(func=import_ruleset)

    report_parser = sub.add_parser("report", help="show the reconciliation report for a batch")
    report_parser.add_argument("--batch", required=True)
    report_parser.set_defaults(func=show_report)

    promote_parser = sub.add_parser("promote", help="promote staged rows into the rule catalog")
    promote_parser.add_argument("--batch", required=True)
    promote_parser.add_argument("--limit", type=int, default=0)
    promote_parser.add_argument("--dry-run", action="store_true")
    promote_parser.set_defaults(func=promote)

    pending_parser = sub.add_parser("pending-migrations", help="list deferred catalog migrations")
    pending_parser.set_defaults(func=pending_migrations)

    unique_parser = sub.add_parser("apply-unique-constraint", help="apply the unique rule-number index after reconciliation")
    unique_parser.set_defaults(func=apply_unique_constraint)

    args = parser.parse_args()
    if args.command not in {"pending-migrations", "apply-unique-constraint"}:
        # Fail fast on unknown catalogs before doing work.
        assert all(catalog in CATALOGS for catalog in ("rule",))
    args.func(args)


if __name__ == "__main__":
    main()
