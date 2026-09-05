"""Splunk lookup metadata and CSV editing helpers."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from collections.abc import Iterable
from typing import Any


_LOOKUP_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*\.csv$", re.IGNORECASE)
_FORMULA_LIKE = re.compile(r"^-\s*(?:[A-Za-z(=])")


def rest_search_filter(name: str) -> str:
    escaped = name.replace("\\", "\\\\").replace('"', '\\"')
    # The lookup-table-files handler accepts exact name predicates.  Broader
    # filtering is done after normalization so case-insensitive substring
    # matching remains consistent across Splunk versions.
    return f'name="{escaped}"'


def normalize_lookup(entry: dict[str, Any]) -> dict[str, Any]:
    acl = entry.get("acl") if isinstance(entry.get("acl"), dict) else {}
    content = entry.get("content") if isinstance(entry.get("content"), dict) else {}
    return {
        "name": str(entry.get("name", "")),
        "app": str(acl.get("app") or content.get("app") or ""),
        "owner": str(acl.get("owner") or content.get("owner") or ""),
        "sharing": str(acl.get("sharing") or content.get("sharing") or ""),
        "acl": acl,
    }


def normalize_lookups(entries: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [normalize_lookup(entry) for entry in entries]


def normalize_lookup_name(name: str) -> str:
    if not isinstance(name, str) or not name.strip():
        raise ValueError("name cannot be empty")
    normalized = name.strip()
    if len(normalized) > 255 or "\x00" in normalized or not _LOOKUP_NAME.fullmatch(normalized):
        raise ValueError("lookup name must be a single .csv filename")
    return normalized


def _validate_limits(max_bytes: int, max_rows: int, max_columns: int) -> None:
    if not all(
        isinstance(value, int) and not isinstance(value, bool) and value > 0
        for value in (max_bytes, max_rows, max_columns)
    ):
        raise ValueError("CSV limits must be positive integers")


def _reject_formula_cell(value: str, row_number: int, column_number: int) -> None:
    stripped = value.lstrip()
    if stripped.startswith(("=", "+", "@")) or _FORMULA_LIKE.match(stripped):
        raise ValueError(
            f"CSV cell at row {row_number}, column {column_number} looks like a spreadsheet formula"
        )


def parse_csv_text(
    content: str,
    *,
    max_bytes: int = 5_000_000,
    max_rows: int = 50_000,
    max_columns: int = 100,
) -> list[list[str]]:
    """Parse and validate editor CSV text before it reaches Splunk."""
    if not isinstance(content, str):
        raise ValueError("CSV content must be text")
    _validate_limits(max_bytes, max_rows, max_columns)
    byte_count = len(content.encode("utf-8"))
    if byte_count > max_bytes:
        raise ValueError(f"CSV content exceeds the {max_bytes}-byte limit")
    if "\x00" in content:
        raise ValueError("CSV content contains a NUL character")
    if any(ord(char) < 32 and char not in {"\t", "\n", "\r"} for char in content):
        raise ValueError("CSV content contains unsupported control characters")
    normalized = content.replace("\r\n", "\n")
    if "\r" in normalized:
        raise ValueError("CSV content must use LF line endings")

    try:
        rows = list(csv.reader(io.StringIO(normalized, newline=""), strict=True))
    except csv.Error as exc:
        raise ValueError("CSV content is malformed") from exc
    if not rows or not rows[0]:
        raise ValueError("CSV content must include a header row")
    if len(rows) - 1 > max_rows:
        raise ValueError(f"CSV content exceeds the {max_rows}-row limit")
    if len(rows[0]) > max_columns:
        raise ValueError(f"CSV content exceeds the {max_columns}-column limit")

    headers = rows[0]
    seen_headers: set[str] = set()
    for column_number, header in enumerate(headers, 1):
        if not header.strip():
            raise ValueError(f"CSV header at column {column_number} cannot be empty")
        folded = header.casefold()
        if folded in seen_headers:
            raise ValueError(f"CSV header {header!r} is duplicated")
        seen_headers.add(folded)

    width = len(headers)
    for row_number, row in enumerate(rows[1:], 2):
        if len(row) != width:
            raise ValueError(
                f"CSV row {row_number} has {len(row)} columns; expected {width}"
            )
    for row_number, row in enumerate(rows, 1):
        for column_number, value in enumerate(row, 1):
            _reject_formula_cell(value, row_number, column_number)
    return rows


def serialize_csv_rows(rows: list[list[str]]) -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerows(rows)
    return output.getvalue()


def canonical_csv_text(
    content: str,
    *,
    max_bytes: int = 5_000_000,
    max_rows: int = 50_000,
    max_columns: int = 100,
) -> tuple[str, list[list[str]]]:
    rows = parse_csv_text(
        content,
        max_bytes=max_bytes,
        max_rows=max_rows,
        max_columns=max_columns,
    )
    return serialize_csv_rows(rows), rows


def lookup_summary(rows: list[list[str]], content: str) -> dict[str, Any]:
    return {
        "row_count": max(0, len(rows) - 1),
        "column_count": len(rows[0]) if rows else 0,
        "headers": list(rows[0]) if rows else [],
        "byte_count": len(content.encode("utf-8")),
    }


def lookup_fingerprint(name: str, app: str, owner: str, content: str) -> str:
    value = {"name": name, "app": app, "owner": owner, "content": content}
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def _response_rows(value: Any) -> list[list[str]] | None:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None
    if isinstance(value, list):
        if not all(isinstance(row, list) for row in value):
            return None
        rows: list[list[str]] = []
        for row in value:
            cells: list[str] = []
            for cell in row:
                if cell is None:
                    cells.append("")
                elif isinstance(cell, (str, int, float, bool)):
                    cells.append(str(cell))
                else:
                    return None
            rows.append(cells)
        return rows
    if isinstance(value, dict):
        for key in ("contents", "content", "rows", "data", "entry"):
            if key in value:
                rows = _response_rows(value[key])
                if rows is not None:
                    return rows
    return None


def lookup_rows_from_response(payload: Any) -> list[list[str]]:
    rows = _response_rows(payload)
    if rows is None:
        raise ValueError("Splunk returned malformed lookup CSV contents")
    return rows


__all__ = [
    "canonical_csv_text",
    "lookup_fingerprint",
    "lookup_rows_from_response",
    "lookup_summary",
    "normalize_lookup",
    "normalize_lookup_name",
    "normalize_lookups",
    "parse_csv_text",
    "rest_search_filter",
    "serialize_csv_rows",
]
