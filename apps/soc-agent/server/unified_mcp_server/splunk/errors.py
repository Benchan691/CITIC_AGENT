"""Errors raised by the official Splunk MCP client."""

from __future__ import annotations

from typing import Any


class SplunkAPIError(Exception):
    """A safe, structured failure from the Splunk MCP integration."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
        *,
        error_code: str | None = None,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.error_code = error_code
        super().__init__(self.message)
