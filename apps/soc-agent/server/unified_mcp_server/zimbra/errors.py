"""Stable, credential-free errors shared by Zimbra capabilities."""

import re
from typing import Any

from zimbra_client.errors import ZimbraHTTPError, ZimbraSOAPFault

from unified_mcp_server.errors import ServiceError


_SEARCH_QUERY_EXAMPLES = (
    'in:"/Inbox/SOC" date:09/30/2026',
    'in:"/Inbox/SOC" subject:alert is:unread',
    "after:09/01/2026 before:10/01/2026 has:attachment",
    "from:analyst@example.com",
    'subject:"security alert"',
)
_SAFE_FAULT_CODE = re.compile(r"(?:account|mail|service)\.[A-Z][A-Z0-9_]{0,63}")


def _query_validation_error(
    *,
    invalid_operator: str | None = None,
    suggested_query: str | None = None,
    upstream_details: dict[str, Any] | None = None,
) -> ServiceError:
    details: dict[str, Any] = {
        **(upstream_details or {}),
        "examples": list(_SEARCH_QUERY_EXAMPLES),
        "date_format": "MM/DD/YYYY",
        "dates_optional": True,
        "parsing_locale": "en_US",
    }
    if invalid_operator:
        details["invalid_operator"] = invalid_operator
    if suggested_query:
        details["suggested_query"] = suggested_query
    message = (
        "Unsupported Zimbra search operator d:. Use a valid calendar date with date:MM/DD/YYYY for one day, "
        "or after:MM/DD/YYYY and before:MM/DD/YYYY for a range. Dates are optional."
        if invalid_operator == "d"
        else "Zimbra rejected the search query syntax. Put native filters directly in query: "
        'in:"/Inbox/SOC", from:address, subject:"security alert", is:unread, or has:attachment. '
        "Dates are optional; use date:MM/DD/YYYY, after:MM/DD/YYYY, or before:MM/DD/YYYY "
        "for absolute dates (en_US parsing), or relative dates such as after:-7d. "
        "Use double quotes for phrases and full folder paths with spaces; balance quotes and parentheses. "
        "Correct the query before retrying."
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
    details: dict[str, Any] = {"exception_type": type(exc).__name__}
    if isinstance(exc, ZimbraSOAPFault):
        # A SOAP fault's code is authoritative. Its free-form message can
        # contain credentials, query text or misleading HTTP status numbers.
        if _SAFE_FAULT_CODE.fullmatch(exc.code):
            details["upstream_code"] = exc.code
        code = exc.code.casefold()
        if code in {"mail.no_such_folder", "mail.no_such_mountpoint"}:
            return ServiceError(
                "folder_not_found",
                "Zimbra could not find the requested mailbox folder. Use zimbra_list_folders to confirm "
                "its full path or ID, then correct the query. "
                'For a path /Inbox/SOC use in:"/Inbox/SOC" or in:"Inbox/SOC"; in:"SOC" refers to /SOC. '
                "Use inid:<id> only with a returned folder ID. Do not guess the intended folder or retry unchanged.",
                details={**details, "next_tool": "zimbra_list_folders"},
            )
        if code in {"service.perm_denied", "service.forbidden", "service.non_readonly_operation_denied"}:
            return ServiceError(
                "zimbra_permission_denied",
                "Zimbra denied access to the requested mailbox resource. Confirm the resource is available "
                "to your authenticated account; ask a Zimbra administrator to check permissions if needed.",
                details=details,
            )
        if code in {"service.parse_error", "mail.invalid_search_query", "mail.query_parse_error"}:
            return _query_validation_error(upstream_details=details)
        if any(marker in code for marker in ("auth_failed", "auth_expired", "auth_invalid", "auth_required", "two_factor")):
            return ServiceError(
                "zimbra_auth_error",
                "Zimbra authentication failed or the session expired. Sign in again and complete two-factor "
                "authentication if required.",
                details=details,
            )
        retryable = code in {
            "service.failure", "service.internal_error", "service.temporarily_unavailable",
            "service.resource_unreachable", "mail.maintenance", "mail.try_again",
        }
        return ServiceError(
            "zimbra_api_error",
            "Zimbra is temporarily unable to complete the request. Retry later; if it persists, check the server logs."
            if retryable else "Zimbra rejected the request. Check the error details and the "
            "Zimbra server logs to identify the cause before retrying.",
            retryable=retryable,
            details=details,
        )
    if isinstance(exc, ZimbraHTTPError):
        details["http_status"] = exc.status_code
        if exc.status_code == 403:
            return ServiceError(
                "zimbra_permission_denied",
                "The Zimbra endpoint denied access (HTTP 403). Check account permissions and server access policy.",
                details=details,
            )
        if exc.status_code != 401:
            retryable = exc.status_code == 429 or 500 <= exc.status_code < 600
            return ServiceError(
                "zimbra_api_error",
                "The Zimbra endpoint returned an HTTP error. Check http_status in the error details and the server logs.",
                retryable=retryable,
                details=details,
            )
    text = str(exc).lower()
    if re.search(r"\b(?:401|403)\b", text) or any(marker in text for marker in (
        "login failed", "authentication", "auth failed", "auth token", "auth_expired", "auth expired",
        "auth_invalid", "auth invalid", "auth_required", "auth required", "unauthorized",
    )):
        return ServiceError(
            "zimbra_auth_error",
            "Zimbra authentication failed or the session expired. Sign in again and complete two-factor "
            "authentication if required.",
            details=details,
        )
    if any(marker in text for marker in ("certificate", "ssl", "tls")):
        return ServiceError(
            "zimbra_tls_error",
            "Zimbra TLS validation failed. Check the server certificate or ZIMBRA_VERIFY_SSL.",
            details=details,
        )
    if any(marker in text for marker in ("connection", "timed out", "timeout", "name or service", "refused")):
        return ServiceError(
            "zimbra_connection_error",
            "Could not connect to Zimbra. Check ZIMBRA_HOST and network access.",
            retryable=True,
            details=details,
        )
    if _is_query_error(text):
        return _query_validation_error(upstream_details=details)
    return ServiceError(
        "zimbra_api_error",
        "Zimbra could not complete the request. Check the server logs for its cause before retrying.",
        details=details,
    )
