"""Errors that are safe to return through MCP tool responses."""

from typing import Any


class ServiceError(RuntimeError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or {}


class ConfigurationError(ServiceError):
    def __init__(self, service: str, missing: list[str]) -> None:
        super().__init__(
            "not_configured",
            f"{service} is not configured on the MCP server.",
            details={"missing_environment_variables": missing},
        )

