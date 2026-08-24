"""Shared Splunk connection and guardrail operations.

This module deliberately contains no Search or Detection imports. Both
capabilities compose it independently.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable, Coroutine
from typing import Any

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ConfigurationError, ServiceError

from .client import SplunkAPIError, SplunkClient
from .guardrails import blocked_spl_commands, sanitize_output, validate_spl_query


class SplunkCore:
    MAX_RESULT_CHARS = 20_000

    def __init__(
        self,
        settings: SplunkSettings,
        client_factory: Callable[[dict[str, object]], SplunkClient] = SplunkClient,
    ) -> None:
        self.settings = settings
        self._client_factory = client_factory
        self._client: SplunkClient | None = None
        self._connect_lock = asyncio.Lock()

    def validate_query(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
    ) -> dict[str, Any]:
        query = query.strip()
        if not query:
            raise ServiceError("invalid_input", "query cannot be empty")
        scored_query = f"{query} earliest={earliest_time} latest={latest_time}"
        risk_score, risk_message = validate_spl_query(scored_query, self.settings.safe_timerange)
        blocked_commands = blocked_spl_commands(query)
        return {
            "query": query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "risk_score": risk_score,
            "risk_message": risk_message,
            "risk_tolerance": self.settings.risk_tolerance,
            "blocked_commands": blocked_commands,
            "would_execute": (
                risk_score <= self.settings.risk_tolerance
                and not blocked_commands
            ),
        }

    def sanitize(self, value: Any) -> Any:
        return sanitize_output(value) if self.settings.sanitize_output else value

    def bound_events(
        self,
        events: list[dict[str, Any]],
        character_limit: int | None = None,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Keep a complete leading event prefix within one JSON character budget."""
        limit = character_limit or self.MAX_RESULT_CHARS
        bounded: list[dict[str, Any]] = []
        characters = 2  # JSON list brackets.
        first_omitted_characters = 0
        for event in events:
            encoded = json.dumps(event, ensure_ascii=True, separators=(",", ":"))
            additional = len(encoded) + (1 if bounded else 0)
            if characters + additional > limit:
                first_omitted_characters = len(encoded)
                break
            bounded.append(event)
            characters += additional
        truncated = len(bounded) < len(events)
        metadata: dict[str, Any] = {
            "received_count": len(events),
            "returned_count": len(bounded),
            "characters": characters,
            "character_limit": limit,
            "truncated": truncated,
        }
        if truncated:
            metadata["first_omitted_event_characters"] = first_omitted_characters
            metadata["hint"] = "Retry with fields limited to the evidence needed."
        return bounded, metadata

    async def request(
        self,
        operation: Callable[[SplunkClient], Coroutine[Any, Any, Any]],
    ) -> Any:
        client = await self._connected_client()
        try:
            return await operation(client)
        except SplunkAPIError as exc:
            raise self._service_error(exc) from exc

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

    @staticmethod
    def _service_error(exc: SplunkAPIError) -> ServiceError:
        status = exc.status_code
        return ServiceError(
            "splunk_api_error",
            exc.message,
            retryable=status is None or status >= 500,
            details={"status_code": status} if status else {},
        )
