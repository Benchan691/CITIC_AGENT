"""Read-only Splunk search operations."""

from __future__ import annotations

from typing import Any

from ..core.service import SplunkCore
from .executor import SearchExecutor
from .lookup import normalize_lookups, rest_search_filter
from unified_mcp_server.errors import ServiceError


class SplunkSearchService:
    def __init__(self, core: SplunkCore, executor: SearchExecutor | None = None) -> None:
        self.core = core
        self.executor = executor if executor is not None else SearchExecutor(core)

    def validate(self, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        return self.core.validate_query(query, earliest_time, latest_time)

    async def search(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_count: int = 50,
        fields: list[str] | None = None,
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        execution = await self.executor.execute(
            query,
            earliest_time,
            latest_time,
            max_count,
            fields,
            principal_id=principal_id,
        )
        validation = execution["validation"]
        events = execution["events"]
        metadata = execution["search_metadata"]
        run_duration = metadata["run_duration"]
        run_duration_ms = (
            int(round(run_duration * 1000))
            if isinstance(run_duration, (int, float)) and not isinstance(run_duration, bool)
            else None
        )
        result: dict[str, Any] = {
            "type": execution["result_type"],
            "rows": events,
        }
        if execution["result_type"] == "table":
            result["columns"] = execution["columns"]
        return {
            "query": query,
            "search": {
                "earliest_time": earliest_time,
                "latest_time": latest_time,
                "run_duration_seconds": run_duration,
                "run_duration_ms": run_duration_ms,
                "scanned_events": metadata["scan_count"],
                "result_count": metadata["total_result_count"],
                "fetched_count": metadata["fetched_count"],
                "returned_count": metadata["returned_count"],
                "splunk_result_truncated": metadata["splunk_result_truncated"],
                "mcp_context_truncated": metadata["mcp_context_truncated"],
            },
            "result": result,
            "truncated": (
                metadata["splunk_result_truncated"] is True
                or metadata["mcp_context_truncated"] is True
            ),
            "risk": {
                "score": validation["risk_score"],
                "tolerance": validation["risk_tolerance"],
            },
        }

    async def test_connection(self) -> dict[str, Any]:
        indexes = await self.core.request(lambda client: client.get_indexes())
        return {"connected": True, "index_count": len(indexes)}

    async def list_saved_searches(
        self,
        name: str = "",
        app: str = "",
        limit: int = 50,
        include_spl: bool = False,
    ) -> dict[str, Any]:
        name = name.strip()
        app = app.strip()
        limit = min(max(1, int(limit)), 200)
        searches = await self.core.request(lambda client: client.get_saved_searches(name=name, app=app, count=limit))
        if name:
            needle = name.casefold()
            searches = [item for item in searches if needle in item.get("name", "").casefold()]
        if app:
            searches = [item for item in searches if item.get("app", "") == app]
        searches = searches[:limit]
        if not include_spl:
            searches = [{key: value for key, value in item.items() if key != "search"} for item in searches]
        return {"count": len(searches), "saved_searches": self.core.sanitize(searches)}

    async def list_lookups(self, app: str = "", name: str = "", limit: int = 50) -> dict[str, Any]:
        app = app.strip()
        name = name.strip()
        limit = min(max(1, int(limit)), 200)
        entries = await self.core.request(
            lambda client: client.get_lookup_table_files(app=app, count=limit)
        )
        lookups = normalize_lookups(entries)
        if app:
            lookups = [lookup for lookup in lookups if lookup["app"] == app]
        if name:
            needle = name.casefold()
            lookups = [lookup for lookup in lookups if needle in lookup["name"].casefold()]
        lookups = lookups[:limit]
        return {"count": len(lookups), "lookups": lookups}

    async def find_lookup(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        entries = await self.core.request(
            lambda client: client.get_lookup_table_files(search=rest_search_filter(name), count=20)
        )
        lookup = next(
            (item for item in normalize_lookups(entries) if item["name"] == name),
            None,
        )
        if lookup is None:
            raise ServiceError("not_found", "The requested lookup-table file was not found.", details={"name": name})
        return {"lookup": lookup}

    async def run_saved_search(
        self,
        name: str,
        max_count: int = 50,
        app: str = "",
        owner: str = "",
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        limit = self.executor.normalize_limit(max_count)
        limit = min(limit, self.core.settings.max_events)
        app = app.strip()
        owner = owner.strip()
        definition = await self.core.request(
            lambda client: client.get_saved_search(name, app, owner)
        )
        content = definition.get("content") if isinstance(definition, dict) else None
        if not isinstance(content, dict) or not isinstance(content.get("search"), str) or not content["search"].strip():
            raise ServiceError("splunk_api_error", "Splunk returned a saved search without executable SPL.")
        earliest = content.get("dispatch.earliest_time")
        latest = content.get("dispatch.latest_time")
        # A saved search without a known earliest bound may use Splunk's own
        # potentially unbounded dispatch defaults.  Fail closed instead of
        # turning missing metadata into an assumed 24-hour workload.
        earliest = earliest.strip() if isinstance(earliest, str) and earliest.strip() else ""
        latest = latest.strip() if isinstance(latest, str) and latest.strip() else "now"
        validation = self.core.validate_query(content["search"], earliest, latest)
        if validation.get("decision") != "allow":
            raise self.executor._blocked_query_error(validation)
        async with self.executor.resource_scope(
            content["search"],
            earliest,
            latest,
            limit,
            principal_id=principal_id,
            workload_type="saved_search",
        ) as resource:
            result = await self.core.request(
                lambda client: client.run_saved_search(
                    name,
                    False,
                    resource.effective_max_results,
                    app,
                    owner,
                    runtime_limit=resource.admission.max_runtime_seconds,
                )
            )
        result = self.core.sanitize(result)
        events = result.get("events") if isinstance(result, dict) else None
        if isinstance(events, list):
            result["events"], result["event_budget"] = self.core.bound_events(events)
            result["event_count"] = len(result["events"])
        return result
