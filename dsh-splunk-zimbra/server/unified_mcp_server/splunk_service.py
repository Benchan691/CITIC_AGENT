"""Application service around the reused async Splunk client and guardrails."""

import asyncio
from collections.abc import Callable, Coroutine
from typing import Any

from unified_mcp_server.splunk.guardrails import sanitize_output, validate_spl_query
from unified_mcp_server.splunk.splunk_client import SplunkAPIError, SplunkClient

from .config import SplunkSettings
from .detection import DetectionDraft, validate_detection
from .errors import ConfigurationError, ServiceError


class SplunkService:
    def __init__(
        self,
        settings: SplunkSettings,
        client_factory: Callable[[dict[str, object]], SplunkClient] = SplunkClient,
    ) -> None:
        self.settings = settings
        self._client_factory = client_factory
        self._client: SplunkClient | None = None
        self._connect_lock = asyncio.Lock()

    @staticmethod
    def _flag(value: Any) -> bool:
        return value is True or str(value).strip().lower() in {"1", "true", "yes", "on"}

    def validate(self, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        query = query.strip()
        if not query:
            raise ServiceError("invalid_input", "query cannot be empty")
        scored_query = f"{query} earliest={earliest_time} latest={latest_time}"
        risk_score, risk_message = validate_spl_query(scored_query, self.settings.safe_timerange)
        return {
            "query": query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "risk_score": risk_score,
            "risk_message": risk_message,
            "risk_tolerance": self.settings.risk_tolerance,
            "would_execute": risk_score <= self.settings.risk_tolerance,
        }

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
        limit = min(max(1, int(max_count)), self.settings.max_events)
        events = await self._request(
            lambda client: client.search_oneshot(query, earliest_time, latest_time, limit)
        )
        if self.settings.sanitize_output:
            events = sanitize_output(events)
        return {
            "query": query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "event_count": len(events),
            "events": events,
            "validation": validation,
        }

    async def list_indexes(self) -> dict[str, Any]:
        indexes = await self._request(lambda client: client.get_indexes())
        return {"count": len(indexes), "indexes": indexes}

    async def test_connection(self) -> dict[str, Any]:
        """Verify Splunk authentication and read access without changing data."""
        result = await self.list_indexes()
        return {"connected": True, "index_count": result["count"]}

    async def list_saved_searches(self) -> dict[str, Any]:
        searches = await self._request(lambda client: client.get_saved_searches())
        if self.settings.sanitize_output:
            searches = sanitize_output(searches)
        return {"count": len(searches), "saved_searches": searches}

    async def list_data_sources(self, index: str = "") -> dict[str, Any]:
        """Return index metadata used to scope a detection before authoring SPL."""
        result = await self.list_indexes()
        indexes = result["indexes"]
        if index.strip():
            indexes = [item for item in indexes if item.get("name") == index.strip()]
        return {
            "count": len(indexes),
            "indexes": indexes,
            "guidance": "Confirm index permissions and sourcetypes with a narrow search before deployment.",
        }

    async def get_detection(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        result = await self._request(lambda client: client.get_saved_search(name))
        if self.settings.sanitize_output:
            result = sanitize_output(result)
        content = result.get("content", {})
        return {
            "name": result.get("name", name),
            "description": content.get("description", ""),
            "spl": content.get("search", ""),
            "earliest_time": content.get("dispatch.earliest_time", ""),
            "latest_time": content.get("dispatch.latest_time", ""),
            "cron_schedule": content.get("cron_schedule", ""),
            "is_scheduled": self._flag(content.get("is_scheduled", False)),
            "disabled": self._flag(content.get("disabled", False)),
            "actions": content.get("actions", ""),
            "acl": result.get("acl", {}),
        }

    def validate_detection(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            draft = DetectionDraft.from_payload(payload)
        except ValueError as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        query_validation = self.validate(draft.spl, draft.earliest_time, draft.latest_time)
        return validate_detection(draft, query_validation=query_validation)

    async def backtest_detection(
        self,
        payload: dict[str, Any],
        earliest_time: str = "-7d",
        latest_time: str = "now",
        max_count: int = 100,
    ) -> dict[str, Any]:
        validation = self.validate_detection({**payload, "earliest_time": earliest_time, "latest_time": latest_time})
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        result = await self.search(payload.get("spl", payload.get("search", "")), earliest_time, latest_time, max_count)
        return {
            "detection": validation["detection"],
            "window": {"earliest_time": earliest_time, "latest_time": latest_time},
            "match_count": result["event_count"],
            "sample_events": result["events"],
            "validation": validation,
            "note": "Backtests are read-only samples; review volume, deduplication, and suppression before enabling.",
        }

    def _write_fields(self, draft: DetectionDraft) -> dict[str, Any]:
        return {
            "name": draft.name,
            "search": draft.spl,
            "description": draft.description,
            "is_scheduled": "1" if draft.cron_schedule else "0",
            "cron_schedule": draft.cron_schedule,
            "dispatch.earliest_time": draft.earliest_time,
            "dispatch.latest_time": draft.latest_time,
            "disabled": "1",
            "actions": "",
            "app": self.settings.detection_app,
            "owner": self.settings.detection_owner,
        }

    def _require_write(self, *, enabling: bool = False) -> None:
        if not self.settings.detection_write_enabled:
            raise ServiceError(
                "operation_disabled",
                "Detection writes are disabled. Set SPLUNK_ALLOW_DETECTION_WRITE=true after review.",
            )
        if enabling and not self.settings.detection_enable_enabled:
            raise ServiceError(
                "operation_disabled",
                "Detection enablement is disabled. Set SPLUNK_ALLOW_DETECTION_ENABLE=true only in a controlled environment.",
            )

    async def create_detection_draft(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._require_write()
        validation = self.validate_detection({**payload, "enabled": False})
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload({**payload, "enabled": False})
        result = await self._request(lambda client: client.create_saved_search(self._write_fields(draft)))
        return {"created": True, "enabled": False, "detection": validation["detection"], "splunk": result}

    async def update_detection_draft(self, name: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._require_write()
        current = await self.get_detection(name)
        merged = {**current, **payload, "name": name, "enabled": False}
        validation = self.validate_detection(merged)
        if not validation["valid"]:
            raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        draft = DetectionDraft.from_payload(merged)
        result = await self._request(lambda client: client.update_saved_search(name, self._write_fields(draft)))
        return {"updated": True, "enabled": False, "detection": validation["detection"], "splunk": result}

    async def set_detection_enabled(self, name: str, enabled: bool) -> dict[str, Any]:
        self._require_write(enabling=enabled)
        current = await self.get_detection(name)
        if enabled:
            validation = self.validate_detection({
                "name": current["name"],
                "spl": current["spl"],
                "description": current.get("description", ""),
                "earliest_time": current.get("earliest_time") or "-10m",
                "latest_time": current.get("latest_time") or "now",
                "cron_schedule": current.get("cron_schedule", ""),
                "enabled": False,
            })
            if not validation["valid"]:
                raise ServiceError("detection_invalid", "Detection validation failed.", details=validation)
        result = await self._request(lambda client: client.update_saved_search(name, {"disabled": "0" if enabled else "1"}))
        return {"updated": True, "name": name, "enabled": enabled, "splunk": result}

    async def run_saved_search(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        result = await self._request(lambda client: client.run_saved_search(name, False))
        return sanitize_output(result) if self.settings.sanitize_output else result

    async def close(self) -> None:
        if self._client is not None:
            await self._client.disconnect()
            self._client = None

    async def _connected_client(self) -> SplunkClient:
        if not self.settings.configured:
            raise ConfigurationError("Splunk", self.settings.missing)
        if self._client is not None:
            return self._client
        async with self._connect_lock:
            if self._client is None:
                client = self._client_factory(self.settings.client_config())
                try:
                    await client.connect()
                except SplunkAPIError as exc:
                    raise self._service_error(exc) from exc
                self._client = client
        return self._client

    async def _request(
        self,
        operation: Callable[[SplunkClient], Coroutine[Any, Any, Any]],
    ) -> Any:
        client = await self._connected_client()
        try:
            return await operation(client)
        except SplunkAPIError as exc:
            raise self._service_error(exc) from exc

    @staticmethod
    def _service_error(exc: SplunkAPIError) -> ServiceError:
        status = exc.status_code
        return ServiceError(
            "splunk_api_error",
            exc.message,
            retryable=status is None or status >= 500,
            details={"status_code": status} if status else {},
        )
