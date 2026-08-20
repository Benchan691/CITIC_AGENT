"""Compatibility facade for the split Splunk capabilities.

New code should depend on ``splunk.search`` or ``splunk.detection`` directly.
This facade preserves the original import path and service surface.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.splunk.core.client import SplunkClient
from unified_mcp_server.splunk.core.service import SplunkCore
from unified_mcp_server.splunk.detection.service import SplunkDetectionService
from unified_mcp_server.splunk.search.service import SplunkSearchService


class SplunkService:
    def __init__(
        self,
        settings: SplunkSettings,
        client_factory: Callable[[dict[str, object]], SplunkClient] = SplunkClient,
        *,
        core: SplunkCore | None = None,
    ) -> None:
        self.core = core or SplunkCore(settings, client_factory)
        self.search_service = SplunkSearchService(self.core)
        self.detection_service = SplunkDetectionService(self.core)

    @property
    def settings(self) -> SplunkSettings:
        return self.core.settings

    def validate(self, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        return self.search_service.validate(query, earliest_time, latest_time)

    async def search(self, query: str, earliest_time: str = "-24h", latest_time: str = "now", max_count: int = 100) -> dict[str, Any]:
        return await self.search_service.search(query, earliest_time, latest_time, max_count)

    async def list_indexes(self) -> dict[str, Any]:
        return await self.search_service.list_indexes()

    async def test_connection(self) -> dict[str, Any]:
        return await self.search_service.test_connection()

    async def list_saved_searches(self, name: str = "", app: str = "") -> dict[str, Any]:
        return await self.search_service.list_saved_searches(name, app)

    async def list_data_sources(self, index: str = "") -> dict[str, Any]:
        return await self.search_service.list_data_sources(index)

    async def run_saved_search(self, name: str) -> dict[str, Any]:
        return await self.search_service.run_saved_search(name)

    async def get_detection(self, name: str) -> dict[str, Any]:
        return await self.detection_service.get_detection(name)

    def validate_detection(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.detection_service.validate_detection(payload)

    async def backtest_detection(self, payload: dict[str, Any], earliest_time: str = "-7d", latest_time: str = "now", max_count: int = 100) -> dict[str, Any]:
        return await self.detection_service.backtest_detection(payload, earliest_time, latest_time, max_count)

    async def create_detection_draft(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.detection_service.create_detection_draft(payload)

    async def update_detection_draft(self, name: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.detection_service.update_detection_draft(name, payload)

    async def set_detection_enabled(self, name: str, enabled: bool) -> dict[str, Any]:
        return await self.detection_service.set_detection_enabled(name, enabled)

    async def close(self) -> None:
        await self.core.close()
