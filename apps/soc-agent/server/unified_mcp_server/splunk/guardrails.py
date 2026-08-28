"""SPL policy compatibility helpers and output sanitization.

Authorization is decided by :class:`SplunkQueryPolicy`; these two validation
helpers remain for callers that still consume the legacy tuple/list shape.
"""

from __future__ import annotations

import re
from typing import Any

from .query_policy import QueryPolicyResult, SplunkQueryPolicy


def analyze_spl_query(
    query: str,
    earliest_time: str = "-24h",
    latest_time: str = "now",
) -> QueryPolicyResult:
    """Return the structured policy result without contacting Splunk."""
    return SplunkQueryPolicy().evaluate(query, earliest_time, latest_time)


def blocked_spl_commands(query: str) -> list[str]:
    """Return dangerous commands found at any query/subsearch depth."""
    return analyze_spl_query(query).dangerous_commands


def has_blocked_write_operation(query: str) -> bool:
    return bool(blocked_spl_commands(query))


def validate_spl_query(query: str, safe_timerange: str) -> tuple[int, str]:
    """Compatibility tuple; the score is informational, never authorization."""
    del safe_timerange
    result = analyze_spl_query(query)
    return result.risk_score or 0, result.risk_message


# Credit-card and SSN masking remains a separate output-boundary concern.
_CC_PATTERN = re.compile(r"\b(\d{4})[-\s]?(\d{4})[-\s]?(\d{4})[-\s]?(\d{3,6})\b")
_SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


def sanitize_output(data: Any) -> Any:
    """Recursively mask common payment-card and SSN values."""
    if isinstance(data, dict):
        return {key: sanitize_output(value) for key, value in data.items()}
    if isinstance(data, list):
        return [sanitize_output(item) for item in data]
    if not isinstance(data, str):
        return data

    def mask_card(match: re.Match[str]) -> str:
        value = match.group(0)
        separator = "-" if "-" in value else " " if " " in value else ""
        return f"****{separator}****{separator}****{separator}{match.group(4)}"

    return _SSN_PATTERN.sub("***-**-****", _CC_PATTERN.sub(mask_card, data))


__all__ = [
    "analyze_spl_query",
    "blocked_spl_commands",
    "has_blocked_write_operation",
    "sanitize_output",
    "validate_spl_query",
]
