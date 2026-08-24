"""Normalization helpers for Splunk lookup-table metadata."""

from __future__ import annotations

from typing import Any, Iterable


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
