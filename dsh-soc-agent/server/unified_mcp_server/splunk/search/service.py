"""Read-only Splunk search operations."""

from __future__ import annotations

from typing import Any

from ..core.service import SplunkCore
from .lookup import normalize_lookups, rest_search_filter
from unified_mcp_server.errors import ServiceError


class SplunkSearchService:
    def __init__(self, core: SplunkCore) -> None:
        self.core = core

    def validate(self, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        return self.core.validate_query(query, earliest_time, latest_time)

    async def search(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_count: int = 100,
    ) -> dict[str, Any]:
        validation = self.validate(query, earliest_time, latest_time)
        if not validation["would_execute"]:
            raise ServiceError(
                "query_blocked",
                "The SPL query exceeds the configured risk tolerance.",
                details=validation,
            )
        limit = min(max(1, int(max_count)), self.core.settings.max_events)
        events = await self.core.request(
            lambda client: client.search_oneshot(query, earliest_time, latest_time, limit)
        )
        events = self.core.sanitize(events)
        return {
            "query": query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "event_count": len(events),
            "events": events,
            "validation": validation,
        }

    async def list_indexes(self) -> dict[str, Any]:
        indexes = await self.core.request(lambda client: client.get_indexes())
        return {"count": len(indexes), "indexes": indexes}

    async def test_connection(self) -> dict[str, Any]:
        result = await self.list_indexes()
        return {"connected": True, "index_count": result["count"]}

    async def list_saved_searches(self, name: str = "", app: str = "") -> dict[str, Any]:
        name = name.strip()
        app = app.strip()
        searches = await self.core.request(
            lambda client: client.get_saved_searches(name=name, app=app)
        )
        if name:
            needle = name.casefold()
            searches = [item for item in searches if needle in item.get("name", "").casefold()]
        if app:
            searches = [item for item in searches if item.get("app", "") == app]
        return {"count": len(searches), "saved_searches": self.core.sanitize(searches)}

    async def list_data_sources(self, index: str = "") -> dict[str, Any]:
        result = await self.list_indexes()
        indexes = result["indexes"]
        requested_index = index.strip()
        if requested_index:
            indexes = [item for item in indexes if item.get("name") == requested_index]

        data_sources = []
        metadata_limit = min(100, self.core.settings.max_events)
        for index_metadata in indexes:
            index_name = str(index_metadata.get("name", "")).strip()
            if not index_name:
                continue
            metadata = await self.search(
                f"| metadata type=sourcetypes index={index_name} | head 100",
                max_count=metadata_limit,
            )
            sourcetypes = sorted({
                str(event.get("sourcetype", "")).strip()
                for event in metadata["events"]
                if str(event.get("sourcetype", "")).strip()
            })
            source = {
                "index": index_name,
                "sourcetypes": sourcetypes,
            }
            if index_metadata.get("totalEventCount") is not None:
                source["event_count"] = index_metadata["totalEventCount"]
            if index_metadata.get("maxTime"):
                source["latest_event_time"] = index_metadata["maxTime"]
            data_sources.append(source)

        return {
            "count": len(data_sources),
            "data_sources": data_sources,
            "indexes": indexes,
            "guidance": "Choose an index and sourcetype from this metadata before writing a narrow SPL query.",
        }

    async def list_lookups(self, app: str = "", name: str = "") -> dict[str, Any]:
        app = app.strip()
        name = name.strip()
        entries = await self.core.request(
            lambda client: client.get_lookup_table_files(app=app)
        )
        lookups = normalize_lookups(entries)
        if app:
            lookups = [lookup for lookup in lookups if lookup["app"] == app]
        if name:
            needle = name.casefold()
            lookups = [lookup for lookup in lookups if needle in lookup["name"].casefold()]
        return {"count": len(lookups), "lookups": lookups}

    async def find_lookup(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        entries = await self.core.request(
            lambda client: client.get_lookup_table_files(search=rest_search_filter(name))
        )
        lookup = next(
            (item for item in normalize_lookups(entries) if item["name"] == name),
            None,
        )
        if lookup is None:
            raise ServiceError("not_found", "The requested lookup-table file was not found.", details={"name": name})
        return {"lookup": lookup}

    async def run_saved_search(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        result = await self.core.request(lambda client: client.run_saved_search(name, False))
        return self.core.sanitize(result)
