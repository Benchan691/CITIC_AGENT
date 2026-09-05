"""Shared guarded Splunk search execution for search and detection services."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging
import math
from time import monotonic
from typing import Any, Literal, TypedDict

from unified_mcp_server.errors import ServiceError

from ..core.service import SplunkCore
from .resource_manager import SearchResourceManager
from .resource_policy import (
    SearchResourceConfig,
    SearchResourceExecution,
    SearchResourcePolicy,
    SearchWorkloadType,
)


logger = logging.getLogger(__name__)


class SearchExecution(TypedDict):
    validation: dict[str, Any]
    limit: int
    fields: list[str]
    events: list[dict[str, Any]]
    result_type: Literal["events", "table"]
    columns: list[str]
    event_budget: dict[str, Any]
    search_metadata: dict[str, Any]
    retained_events: list[dict[str, Any]]
    earliest_time: str
    latest_time: str


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

    def __init__(
        self,
        core: SplunkCore,
        resource_policy: SearchResourcePolicy | None = None,
        resource_manager: SearchResourceManager | None = None,
    ) -> None:
        self.core = core
        configured_policy = getattr(core.settings, "search_resource", SearchResourceConfig())
        self.resource_policy = resource_policy or SearchResourcePolicy(
            configured_policy,
            job_timeout_seconds=getattr(core.settings, "job_timeout", None),
        )
        self.resource_manager = resource_manager or SearchResourceManager(self.resource_policy.config)

    @staticmethod
    def normalize_limit(limit: Any) -> int:
        if isinstance(limit, bool) or not isinstance(limit, int):
            raise ServiceError("invalid_input", "max_count must be an integer")
        return max(1, limit)

    @staticmethod
    def _normalize_fields(fields: list[str] | None) -> list[str]:
        selected_fields: list[str] = []
        if fields is not None and not isinstance(fields, list):
            raise ServiceError("invalid_input", "fields must be a list of field names")
        if fields:
            selected_fields = list(dict.fromkeys(str(field).strip() for field in fields if str(field).strip()))
            if len(selected_fields) > 50 or any(len(field) > 128 for field in selected_fields):
                raise ServiceError("invalid_input", "fields must contain at most 50 names of 128 characters or fewer")
        return selected_fields

    @staticmethod
    def _blocked_query_error(validation: dict[str, Any]) -> ServiceError:
        decision = validation.get("decision")
        policy = validation.get("policy", validation)
        if decision == "require_approval":
            return ServiceError(
                "query_approval_required",
                "The SPL query requires approval before execution.",
                details={"policy": policy},
            )
        return ServiceError(
            "query_blocked",
            "The SPL query was denied by the safety policy; risk tolerance cannot override this decision.",
            details={"policy": policy},
        )

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
        if isinstance(value, int):
            parsed = value
        elif isinstance(value, float):
            if not math.isfinite(value) or not value.is_integer():
                return None
            parsed = int(value)
        elif isinstance(value, str):
            raw = value.strip()
            if not raw or (raw[0] in "+-" and not raw[1:].isdigit()) or (
                raw[0] not in "+-" and not raw.isdigit()
            ):
                return None
            try:
                parsed = int(raw)
            except ValueError:
                return None
        else:
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

    def _resource_request_limit(self, limit: Any) -> int:
        requested = self.normalize_limit(limit)
        server_limit = getattr(self.core.settings, "max_events", requested)
        if isinstance(server_limit, bool) or not isinstance(server_limit, int):
            server_limit = requested
        return min(requested, max(1, server_limit))

    @asynccontextmanager
    async def _admit(
        self,
        validation: dict[str, Any],
        requested_limit: int,
        *,
        principal_id: str | None,
        workload_type: SearchWorkloadType,
    ) -> AsyncIterator[SearchResourceExecution]:
        profile = self.resource_policy.profile(validation, requested_limit)
        admission = self.resource_policy.evaluate(profile, workload_type)
        try:
            self.resource_policy.require_allowed(profile, admission)
        except ServiceError as exc:
            self.resource_manager.record_rejection(exc.code, admission.cost_class)
            raise

        effective_limit = min(requested_limit, admission.max_results)
        effective_limit = max(1, effective_limit)
        principal = principal_id.strip() if isinstance(principal_id, str) and principal_id.strip() else "anonymous"
        started = monotonic()
        try:
            async with self.resource_manager.acquire(
                principal=principal,
                cost_class=admission.cost_class,
                weight=admission.concurrency_weight,
                budget_cost=admission.budget_cost,
                workload_type=workload_type,
            ) as lease:
                logger.info(
                    "splunk search resource execution started",
                    extra={
                        "principal": principal,
                        "cost_class": admission.cost_class,
                        "workload_type": workload_type,
                        "lookback_seconds": profile.lookback_seconds,
                        "runtime_limit_seconds": admission.max_runtime_seconds,
                        "effective_max_results": effective_limit,
                        "queue_wait_seconds": lease.queue_wait_seconds,
                    },
                )
                execution = SearchResourceExecution(
                    admission=admission,
                    requested_max_results=requested_limit,
                    effective_max_results=effective_limit,
                    principal_id=principal,
                )
                try:
                    yield execution
                except ServiceError as exc:
                    if exc.code == "runtime_limit_exceeded":
                        self.resource_manager.record_runtime_limit()
                    raise
        finally:
            logger.info(
                "splunk search resource execution finished",
                extra={
                    "principal": principal,
                    "cost_class": admission.cost_class,
                    "workload_type": workload_type,
                    "duration_seconds": max(0.0, monotonic() - started),
                },
            )

    @asynccontextmanager
    async def resource_scope(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        limit: int = 50,
        *,
        principal_id: str | None = None,
        workload_type: SearchWorkloadType = "ad_hoc",
    ) -> AsyncIterator[SearchResourceExecution]:
        """Admit a non-standard search caller through the same policy path."""
        validation = self.core.validate_query(query, earliest_time, latest_time)
        if validation.get("decision") != "allow":
            raise self._blocked_query_error(validation)
        requested_limit = self._resource_request_limit(limit)
        async with self._admit(
            validation,
            requested_limit,
            principal_id=principal_id,
            workload_type=workload_type,
        ) as execution:
            yield execution

    async def execute(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        limit: int = 50,
        fields: list[str] | None = None,
        *,
        principal_id: str | None = None,
        workload_type: SearchWorkloadType = "ad_hoc",
    ) -> SearchExecution:
        validation = self.core.validate_query(query, earliest_time, latest_time)
        if validation.get("decision") != "allow":
            raise self._blocked_query_error(validation)

        bounded_limit = self._resource_request_limit(limit)
        selected_fields = self._normalize_fields(fields)
        async with self._admit(
            validation,
            bounded_limit,
            principal_id=principal_id,
            workload_type=workload_type,
        ) as resource:
            job_result = await self.core.request(
                lambda client: client.run_search_job(
                    validation["query"],
                    earliest_time,
                    latest_time,
                    resource.effective_max_results,
                    runtime_limit=resource.admission.max_runtime_seconds,
                )
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
        retained_events = list(events)
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
            "limit": resource.effective_max_results,
            "fields": selected_fields,
            "events": events,
            "result_type": "table" if self._is_table_query(validation["query"]) else "events",
            "columns": result_columns,
            "event_budget": event_budget,
            "search_metadata": search_metadata,
            "retained_events": retained_events,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
        }
