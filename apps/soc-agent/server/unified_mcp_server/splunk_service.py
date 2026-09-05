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
from unified_mcp_server.splunk.search.planner import SearchIntent, SearchPlanner
from unified_mcp_server.splunk.search.service import SplunkSearchService
from unified_mcp_server.splunk.search.schema_registry import SearchSchemaRegistry
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

    def validate(self, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        return self.search_service.validate(query, earliest_time, latest_time)

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
        return await self.search_service.search(
            query,
            earliest_time,
            latest_time,
            max_count,
            fields,
            principal_id=principal_id,
        )

    async def search_intent(
        self,
        intent: SearchIntent,
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        return await self.search_service.search_intent(intent, principal_id=principal_id)

    async def test_connection(self) -> dict[str, Any]:
        return await self.search_service.test_connection()

    def read_evidence(self, evidence_id: str, *, offset: int = 0, limit: int = 50) -> dict[str, Any]:
        return self.search_service.read_evidence(evidence_id, offset=offset, limit=limit)

    def evidence_stats(self) -> dict[str, Any]:
        return self.search_service.evidence_stats()

    def plan_search(self, intent: SearchIntent) -> dict[str, Any]:
        return self.search_service.plan_search(intent)

    async def list_saved_searches(self, name: str = "", app: str = "", limit: int = 50, include_spl: bool = False) -> dict[str, Any]:
        return await self.search_service.list_saved_searches(name, app, limit, include_spl)

    async def run_saved_search(
        self,
        name: str,
        max_count: int = 50,
        app: str = "",
        owner: str = "",
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        return await self.search_service.run_saved_search(
            name,
            max_count,
            app,
            owner,
            principal_id=principal_id,
        )

    async def get_lookup(self, name: str) -> dict[str, Any]:
        return await self.search_service.get_lookup(name)

    async def write_lookup(self, name: str, content: str, *, actor_id: str | None = None) -> dict[str, Any]:
        return await self.search_service.write_lookup(name, content, actor_id=actor_id)

    async def update_lookup(
        self,
        name: str,
        content: str,
        expected_fingerprint: str,
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        return await self.search_service.update_lookup(
            name,
            content,
            expected_fingerprint,
            actor_id=actor_id,
        )

    async def delete_lookup(
        self,
        name: str,
        expected_fingerprint: str,
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        return await self.search_service.delete_lookup(
            name,
            expected_fingerprint,
            actor_id=actor_id,
        )

    async def save_lookup(
        self,
        operation: str,
        name: str,
        *,
        content: str | None = None,
        expected_fingerprint: str | None = None,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        return await self.search_service.save_lookup(
            operation,
            name,
            content=content,
            expected_fingerprint=expected_fingerprint,
            actor_id=actor_id,
        )

    async def get_detection(self, name: str) -> dict[str, Any]:
        return await self.detection_service.get_detection(name)

    def validate_detection(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.detection_service.validate_detection(payload)

    def compile_citic_detection(
        self,
        *,
        detection_logic: str,
        rulename: str,
        threat_name: str,
        threat_type: str,
        case_prefix: str,
        event_field_mappings: dict[str, str],
        extra_table_fields: list[str] | None = None,
    ) -> dict[str, Any]:
        return self.detection_service.compile_citic_detection(
            detection_logic=detection_logic,
            rulename=rulename,
            threat_name=threat_name,
            threat_type=threat_type,
            case_prefix=case_prefix,
            event_field_mappings=event_field_mappings,
            extra_table_fields=extra_table_fields,
        )

    async def backtest_detection(
        self,
        payload: dict[str, Any],
        earliest_time: str = "-7d",
        latest_time: str = "now",
        max_count: int = 50,
        fields: list[str] | None = None,
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        return await self.detection_service.backtest_detection(
            payload,
            earliest_time,
            latest_time,
            max_count,
            fields,
            principal_id=principal_id,
        )

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

    async def write_detection(self, payload: dict[str, Any], *, actor_id: str | None = None) -> dict[str, Any]:
        return await self.detection_service.write_detection(payload, actor_id=actor_id)

    async def update_detection(self, name: str, payload: dict[str, Any], expected_fingerprint: str, *, actor_id: str | None = None) -> dict[str, Any]:
        return await self.detection_service.update_detection(name, payload, expected_fingerprint, actor_id=actor_id)

    async def save_detection(
        self,
        operation: str,
        payload: dict[str, Any],
        *,
        name: str | None = None,
        expected_fingerprint: str | None = None,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        return await self.detection_service.save_detection(
            operation,
            payload,
            name=name,
            expected_fingerprint=expected_fingerprint,
            actor_id=actor_id,
        )

    async def close(self) -> None:
        await self.core.close()
