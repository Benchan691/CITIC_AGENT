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
from unified_mcp_server.splunk.search.executor import SearchExecutor
from unified_mcp_server.splunk.search.service import SplunkSearchService
from unified_mcp_server.splunk.security_queue.service import SplunkSecurityQueueService


class SplunkService:
    def __init__(
        self,
        settings: SplunkSettings,
        client_factory: Callable[[dict[str, object]], SplunkClient] = SplunkClient,
        *,
        core: SplunkCore | None = None,
    ) -> None:
        self.core = core or SplunkCore(settings, client_factory)
        executor = SearchExecutor(self.core)
        self.search_service = SplunkSearchService(self.core, executor)
        self.detection_service = SplunkDetectionService(self.core, executor)
        self.security_queue_service = SplunkSecurityQueueService(self.core, executor)

    @property
    def settings(self) -> SplunkSettings:
        return self.core.settings

    def validate(self, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        return self.search_service.validate(query, earliest_time, latest_time)

    async def search(self, query: str, earliest_time: str = "-24h", latest_time: str = "now", max_count: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        return await self.search_service.search(query, earliest_time, latest_time, max_count, fields)

    async def test_connection(self) -> dict[str, Any]:
        return await self.search_service.test_connection()

    async def list_saved_searches(self, name: str = "", app: str = "", limit: int = 50, include_spl: bool = False) -> dict[str, Any]:
        return await self.search_service.list_saved_searches(name, app, limit, include_spl)

    async def run_saved_search(self, name: str, max_count: int = 50, app: str = "", owner: str = "") -> dict[str, Any]:
        return await self.search_service.run_saved_search(name, max_count, app, owner)

    async def get_detection(self, name: str) -> dict[str, Any]:
        return await self.detection_service.get_detection(name)

    def validate_detection(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.detection_service.validate_detection(payload)

    async def backtest_detection(self, payload: dict[str, Any], earliest_time: str = "-7d", latest_time: str = "now", max_count: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        return await self.detection_service.backtest_detection(payload, earliest_time, latest_time, max_count, fields)

    async def list_security_findings(
        self,
        status: str = "",
        urgency: str = "",
        owner: str = "",
        detection: str = "",
        earliest_time: str = "-24h",
        latest_time: str = "now",
        limit: int = 50,
        cursor: str = "",
    ) -> dict[str, Any]:
        return await self.security_queue_service.list_security_findings(
            status, urgency, owner, detection, earliest_time, latest_time, limit, cursor
        )

    async def get_security_finding(self, finding_id: str) -> dict[str, Any]:
        return await self.security_queue_service.get_security_finding(finding_id)

    async def get_investigation(self, investigation_id: str) -> dict[str, Any]:
        return await self.security_queue_service.get_investigation(investigation_id)

    async def create_detection_draft(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.detection_service.create_detection_draft(payload)

    async def update_detection_draft(self, name: str, payload: dict[str, Any], expected_fingerprint: str) -> dict[str, Any]:
        return await self.detection_service.update_detection_draft(name, payload, expected_fingerprint)

    async def set_detection_enabled(self, name: str, enabled: bool, expected_fingerprint: str) -> dict[str, Any]:
        return await self.detection_service.set_detection_enabled(name, enabled, expected_fingerprint)

    async def close(self) -> None:
        await self.core.close()
