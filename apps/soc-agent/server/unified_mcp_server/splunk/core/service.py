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
from ..query_policy import QueryPolicyConfig, SplunkQueryPolicy
from .guardrails import sanitize_output


class SplunkCore:
    MAX_RESULT_CHARS = 20_000

    def __init__(
        self,
        settings: SplunkSettings,
        client_factory: Callable[[dict[str, object]], SplunkClient] = SplunkClient,
        query_policy: SplunkQueryPolicy | None = None,
    ) -> None:
        self.settings = settings
        self._client_factory = client_factory
        self.query_policy = query_policy or SplunkQueryPolicy(
            getattr(settings, "query_policy", QueryPolicyConfig())
        )
        self._client: SplunkClient | None = None
        self._connect_lock = asyncio.Lock()

    def validate_query(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        *,
        allow_outputcsv: bool = False,
    ) -> dict[str, Any]:
        if not isinstance(query, str) or not query.strip():
            raise ServiceError("invalid_input", "query cannot be empty")
        if not isinstance(earliest_time, str) or not isinstance(latest_time, str):
            raise ServiceError("invalid_input", "earliest_time and latest_time must be strings")
        query = query.strip()
        policy = self.query_policy.evaluate(
            query,
            earliest_time,
            latest_time,
            allow_outputcsv=allow_outputcsv,
        )
        policy_data = policy.to_dict()
        result = {
            "query": query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "risk_score": policy.risk_score,
            "risk_message": policy.risk_message,
            "risk_tolerance": self.settings.risk_tolerance,
            "blocked_commands": [
                command
                for command in policy.dangerous_commands
                if command not in policy.allowed_commands
            ],
            "allowed_commands": policy.allowed_commands,
            "decision": policy.decision,
            "would_execute": policy.decision == "allow",
            "policy": policy_data,
        }
        # Keep the structured policy easy to consume for existing callers that
        # expect validation fields at the top level, while also providing a
        # single nested policy object for new callers.
        result.update(policy_data)
        return result

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
        details = {}
        if isinstance(exc.details, dict):
            for key in ("status_code", "runtime_limit_seconds"):
                if key in exc.details:
                    details[key] = exc.details[key]
        if status:
            details.setdefault("status_code", status)
        # Only bounded client-generated details cross the MCP boundary.  The
        # low-level client supplies actionable, secret-free messages for
        # connection failures; never forward a Splunk response body.
        code = exc.error_code if exc.error_code in {"runtime_limit_exceeded"} else "splunk_api_error"
        candidate = str(exc.message or "").strip()
        if not candidate or len(candidate) > 240:
            candidate = "The Splunk operation failed."
        message = "Splunk search exceeded its runtime limit." if code == "runtime_limit_exceeded" else candidate
        return ServiceError(
            code,
            message,
            retryable=(status is None or status >= 500) if code == "splunk_api_error" else False,
            details=details,
        )
