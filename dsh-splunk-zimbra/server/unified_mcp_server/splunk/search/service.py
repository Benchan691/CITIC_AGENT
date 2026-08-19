"""Read-only Splunk search operations."""

from __future__ import annotations

from typing import Any

from ..core.service import SplunkCore
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

    async def list_saved_searches(self) -> dict[str, Any]:
        searches = await self.core.request(lambda client: client.get_saved_searches())
        return {"count": len(searches), "saved_searches": self.core.sanitize(searches)}

    async def list_data_sources(self, index: str = "") -> dict[str, Any]:
        result = await self.list_indexes()
        indexes = result["indexes"]
        if index.strip():
            indexes = [item for item in indexes if item.get("name") == index.strip()]
        return {
            "count": len(indexes),
            "indexes": indexes,
            "guidance": "Confirm index permissions and sourcetypes with a narrow search before deployment.",
        }

    async def run_saved_search(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        result = await self.core.request(lambda client: client.run_saved_search(name, False))
        return self.core.sanitize(result)
