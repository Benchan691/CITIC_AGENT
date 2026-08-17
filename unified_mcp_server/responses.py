"""Consistent JSON-serializable MCP tool response envelopes."""

from typing import Any


def success(
    service: str,
    operation: str,
    data: Any,
    *,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "ok": True,
        "service": service,
        "operation": operation,
        "data": data,
        "error": None,
        "meta": meta or {},
    }


def failure(
    service: str,
    operation: str,
    code: str,
    message: str,
    *,
    retryable: bool = False,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "ok": False,
        "service": service,
        "operation": operation,
        "data": None,
        "error": {
            "code": code,
            "message": message,
            "retryable": retryable,
            "details": details or {},
        },
        "meta": {},
    }

