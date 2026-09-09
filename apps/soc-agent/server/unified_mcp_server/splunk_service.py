"""Compose Splunk capabilities around one shared connection and executor."""

from __future__ import annotations

from collections.abc import Callable

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.splunk.official_mcp_client import OfficialSplunkMCPClient
from unified_mcp_server.splunk.core.service import SplunkCore
from unified_mcp_server.splunk.detection.service import SplunkDetectionService
from unified_mcp_server.splunk.search.executor import SearchExecutor
from unified_mcp_server.splunk.search.planner import SearchPlanner
from unified_mcp_server.splunk.search.service import SplunkSearchService
from unified_mcp_server.splunk.search.schema_registry import SearchSchemaRegistry
from unified_mcp_server.splunk.security_queue.service import SplunkSecurityQueueService


class SplunkService:
    def __init__(
        self,
        settings: SplunkSettings,
        client_factory: Callable[[dict[str, object]], OfficialSplunkMCPClient] | None = None,
        *,
        core: SplunkCore | None = None,
    ) -> None:
        self.core = core or SplunkCore(settings, client_factory)
        executor = SearchExecutor(self.core)
        planner = SearchPlanner(getattr(self.core.settings, "search_planner_max_refinements", 2))
        self.search_service = SplunkSearchService(
            self.core,
            executor,
            planner,
            SearchSchemaRegistry.default(),
        )
        self.detection_service = SplunkDetectionService(self.core, executor)
        self.security_queue_service = SplunkSecurityQueueService(self.core, executor)

    @property
    def settings(self) -> SplunkSettings:
        return self.core.settings

    async def close(self) -> None:
        await self.core.close()
