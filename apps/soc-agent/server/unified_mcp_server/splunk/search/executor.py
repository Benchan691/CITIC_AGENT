"""Shared guarded Splunk search execution for search and detection services."""

from __future__ import annotations

import math
from typing import Any, Literal, TypedDict

from unified_mcp_server.errors import ServiceError

from ..core.service import SplunkCore


class SearchExecution(TypedDict):
    validation: dict[str, Any]
    limit: int
    fields: list[str]
    events: list[dict[str, Any]]
    result_type: Literal["events", "table"]
    columns: list[str]
    event_budget: dict[str, Any]
    search_metadata: dict[str, Any]


class SearchExecutor:
    """Run one guarded search and normalize its result for a domain service."""

    _TABLE_COMMANDS = frozenset({
        "chart",
        "geostats",
        "mstats",
        "pivot",
        "rare",
        "stats",
        "table",
        "timechart",
        "top",
        "transpose",
        "tstats",
        "untable",
        "xyseries",
    })

    def __init__(self, core: SplunkCore) -> None:
        self.core = core

    @staticmethod
    def _normalize_fields(fields: list[str] | None) -> list[str]:
        selected_fields: list[str] = []
        if fields:
            selected_fields = list(dict.fromkeys(str(field).strip() for field in fields if str(field).strip()))
            if len(selected_fields) > 50 or any(len(field) > 128 for field in selected_fields):
                raise ServiceError("invalid_input", "fields must contain at most 50 names of 128 characters or fewer")
        return selected_fields

    @staticmethod
    def _blocked_query_error(validation: dict[str, Any]) -> ServiceError:
        reason = (
            "The SPL query contains a command blocked by the safety policy."
            if validation["blocked_commands"]
            else "The SPL query exceeds the configured risk tolerance."
        )
        return ServiceError("query_blocked", reason, details=validation)

    @staticmethod
    def _pipeline_commands(query: str) -> list[str]:
        """Extract top-level pipeline command names without parsing all of SPL."""
        segments: list[str] = []
        segment: list[str] = []
        quote: str | None = None
        escaped = False
        square_depth = 0
        paren_depth = 0

        for character in query:
            if quote is not None:
                segment.append(character)
                if escaped:
                    escaped = False
                elif character == "\\":
                    escaped = True
                elif character == quote:
                    quote = None
                continue

            if character in {"'", '"'}:
                quote = character
                segment.append(character)
            elif character == "[":
                square_depth += 1
                segment.append(character)
            elif character == "]":
                square_depth = max(0, square_depth - 1)
                segment.append(character)
            elif character == "(":
                paren_depth += 1
                segment.append(character)
            elif character == ")":
                paren_depth = max(0, paren_depth - 1)
                segment.append(character)
            elif character == "|" and square_depth == 0 and paren_depth == 0:
                segments.append("".join(segment))
                segment = []
            else:
                segment.append(character)
        segments.append("".join(segment))

        commands: list[str] = []
        for segment in segments:
            words = segment.strip().split(None, 1)
            if words:
                commands.append(words[0].casefold())
        return commands

    @classmethod
    def _is_table_query(cls, query: str) -> bool:
        return any(command in cls._TABLE_COMMANDS for command in cls._pipeline_commands(query))

    @staticmethod
    def _normalize_metadata_int(value: Any, name: str) -> int | None:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        if parsed < 0:
            return None
        return parsed

    @staticmethod
    def _normalize_metadata_float(value: Any, name: str) -> float | None:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(parsed) or parsed < 0:
            return None
        return parsed

    @staticmethod
    def _normalize_columns(columns: Any) -> list[str]:
        if columns is None:
            return []
        if not isinstance(columns, list):
            raise ServiceError("splunk_api_error", "Splunk returned malformed search columns.")
        normalized: list[str] = []
        for column in columns:
            if not isinstance(column, str) or not column.strip():
                raise ServiceError("splunk_api_error", "Splunk returned malformed search columns.")
            column = column.strip()
            if column not in normalized:
                normalized.append(column)
        return normalized

    @staticmethod
    def _columns_for_rows(
        columns: list[str],
        rows: list[dict[str, Any]],
        selected_fields: list[str],
    ) -> list[str]:
        row_columns: list[str] = []
        for row in rows:
            for column in row:
                if column not in row_columns:
                    row_columns.append(column)

        ordered: list[str] = []

        def add(column: str) -> None:
            if column not in ordered:
                ordered.append(column)

        if selected_fields:
            selected = set(selected_fields)
            for column in columns:
                if column in selected:
                    add(column)
            for column in selected_fields:
                if column in row_columns:
                    add(column)
        else:
            for column in columns:
                add(column)
            for column in row_columns:
                add(column)
        return ordered

    @staticmethod
    def _unpack_job_result(
        job_result: Any,
    ) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
        if not isinstance(job_result, dict) or not isinstance(job_result.get("events"), list):
            raise ServiceError("splunk_api_error", "Splunk returned malformed search results.")
        metadata = job_result.get("metadata", {})
        if not isinstance(metadata, dict):
            raise ServiceError("splunk_api_error", "Splunk returned malformed search metadata.")
        events = job_result["events"]
        if any(not isinstance(event, dict) for event in events):
            raise ServiceError("splunk_api_error", "Splunk returned malformed search results.")
        return events, SearchExecutor._normalize_columns(job_result.get("columns")), metadata

    async def execute(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        limit: int = 50,
        fields: list[str] | None = None,
    ) -> SearchExecution:
        validation = self.core.validate_query(query, earliest_time, latest_time)
        if not validation["would_execute"]:
            raise self._blocked_query_error(validation)

        bounded_limit = min(max(1, int(limit)), self.core.settings.max_events)
        selected_fields = self._normalize_fields(fields)
        job_result = await self.core.request(
            lambda client: client.run_search_job(query, earliest_time, latest_time, bounded_limit)
        )
        raw_events, raw_columns, job_metadata = self._unpack_job_result(job_result)
        events = self.core.sanitize(raw_events)
        if not isinstance(events, list) or any(not isinstance(event, dict) for event in events):
            raise ServiceError("splunk_api_error", "Splunk returned malformed search results.")
        if selected_fields:
            events = [
                {field: event[field] for field in selected_fields if field in event}
                for event in events
            ]
        result_columns = self._columns_for_rows(raw_columns, events, selected_fields)
        events, event_budget = self.core.bound_events(events)
        total_result_count = self._normalize_metadata_int(
            job_metadata.get("total_result_count"), "total result count"
        )
        scan_count = self._normalize_metadata_int(job_metadata.get("scan_count"), "scan count")
        run_duration = self._normalize_metadata_float(
            job_metadata.get("run_duration"), "run duration"
        )
        reported_truncated = job_metadata.get("splunk_result_truncated")
        if reported_truncated is not None and not isinstance(reported_truncated, bool):
            reported_truncated = None
        splunk_result_truncated = (
            total_result_count > len(raw_events)
            if total_result_count is not None
            else reported_truncated
        )
        search_metadata = {
            "total_result_count": total_result_count,
            "fetched_count": len(raw_events),
            "returned_count": len(events),
            "scan_count": scan_count,
            "run_duration": run_duration,
            "splunk_result_truncated": splunk_result_truncated,
            "mcp_context_truncated": event_budget["truncated"],
        }
        return {
            "validation": validation,
            "limit": bounded_limit,
            "fields": selected_fields,
            "events": events,
            "result_type": "table" if self._is_table_query(validation["query"]) else "events",
            "columns": result_columns,
            "event_budget": event_budget,
            "search_metadata": search_metadata,
        }
