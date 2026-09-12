"""Stable, credential-free errors shared by Zimbra capabilities."""

import re
from typing import Any

from unified_mcp_server.errors import ServiceError


_SEARCH_QUERY_EXAMPLES = (
    "date:MM/DD/YYYY",
    "after:MM/DD/YYYY",
    "before:MM/DD/YYYY",
    "from:analyst@example.com",
    "subject:alert",
    "in:Inbox",
    "is:unread",
)


def _query_validation_error(*, invalid_operator: str | None = None, suggested_query: str | None = None) -> ServiceError:
    details: dict[str, Any] = {
        "examples": list(_SEARCH_QUERY_EXAMPLES),
        "date_format": "MM/DD/YYYY (locale-sensitive)",
    }
    if invalid_operator:
        details["invalid_operator"] = invalid_operator
    if suggested_query:
        details["suggested_query"] = suggested_query
    message = (
        "Invalid Zimbra search query. The d:YYYYMMDD date form is not supported; use date:MM/DD/YYYY, "
        "after:MM/DD/YYYY, or before:MM/DD/YYYY instead."
        if invalid_operator == "d"
        else "Zimbra rejected the search query syntax. Use native operators such as date:MM/DD/YYYY, "
        "after:MM/DD/YYYY, before:MM/DD/YYYY, from:address, subject:text, in:Inbox, or is:unread."
    )
    return ServiceError(
        "query_validation_error",
        message,
        details=details,
    )


def _is_query_error(text: str) -> bool:
    return any(marker in text for marker in (
        "parse_error", "parse error", "invalid_search_query", "invalid search query",
        "invalid_query", "invalid query", "malformed query", "query syntax",
        "search syntax", "syntax error",
    ))


def _upstream_error(exc: Exception) -> ServiceError:
    """Convert upstream failures to useful messages without returning raw responses."""
    text = str(exc).lower()
    if re.search(r"\b(?:401|403)\b", text) or any(marker in text for marker in (
        "login failed", "authentication", "auth failed", "auth token", "auth_expired", "auth expired",
        "auth_invalid", "auth invalid", "auth_required", "auth required", "unauthorized",
    )):
        return ServiceError(
            "zimbra_auth_error",
            "Zimbra authentication failed. Check the email, optional login username, and password.",
            details={"exception_type": type(exc).__name__},
        )
    if any(marker in text for marker in ("certificate", "ssl", "tls")):
        return ServiceError(
            "zimbra_tls_error",
            "Zimbra TLS validation failed. Check the server certificate or ZIMBRA_VERIFY_SSL.",
            details={"exception_type": type(exc).__name__},
        )
    if any(marker in text for marker in ("connection", "timed out", "timeout", "name or service", "refused")):
        return ServiceError(
            "zimbra_connection_error",
            "Could not connect to Zimbra. Check ZIMBRA_HOST and network access.",
            retryable=True,
            details={"exception_type": type(exc).__name__},
        )
    if _is_query_error(text):
        return _query_validation_error()
    return ServiceError(
        "zimbra_api_error",
        "Zimbra request failed. Check ZIMBRA_HOST, TLS settings, and account credentials.",
        retryable=True,
        details={"exception_type": type(exc).__name__},
    )


