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
        fields: list[str] | None = None,
    ) -> dict[str, Any]:
        validation = self.validate(query, earliest_time, latest_time)
        if not validation["would_execute"]:
            raise ServiceError(
                "query_blocked",
                "The SPL query exceeds the configured risk tolerance.",
                details=validation,
            )
        limit = min(max(1, int(max_count)), self.core.settings.max_events)
        selected_fields = []
        if fields:
            selected_fields = list(dict.fromkeys(str(field).strip() for field in fields if str(field).strip()))
            if len(selected_fields) > 50 or any(len(field) > 128 for field in selected_fields):
                raise ServiceError("invalid_input", "fields must contain at most 50 names of 128 characters or fewer")
        events = await self.core.request(
            lambda client: client.search_oneshot(query, earliest_time, latest_time, limit)
        )
        events = self.core.sanitize(events)
        if selected_fields:
            events = [
                {field: event[field] for field in selected_fields if field in event}
                for event in events
            ]
        return {
            "query": query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "event_count": len(events),
            "events": events,
            "fields": selected_fields,
            "validation": validation,
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
        max_count: int = 100,
        app: str = "",
        owner: str = "",
    ) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        limit = min(max(1, int(max_count)), self.core.settings.max_events)
        result = await self.core.request(lambda client: client.run_saved_search(name, False, limit, app.strip(), owner.strip()))
        return self.core.sanitize(result)
