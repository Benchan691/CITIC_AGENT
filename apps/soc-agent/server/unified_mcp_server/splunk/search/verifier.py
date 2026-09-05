"""Conservative verification of planned search results."""

from __future__ import annotations

from typing import Any

from .planner import SearchPlan


def _aggregate_zero_rows(rows: Any) -> bool:
    """Detect aggregate rows that carry no evidence, such as a lone count=0.

    ``| stats count`` over zero events returns one row whose only value is 0.
    Row count alone would classify that as a match; every field of every row
    must be a numeric zero for the sample to count as evidence-free. Any
    non-numeric or non-zero field (an entity, a timestamp, text) keeps the
    rows classified as observable matches.
    """
    if not isinstance(rows, list) or not rows:
        return False
    for row in rows:
        if not isinstance(row, dict) or not row:
            return False
        for value in row.values():
            if isinstance(value, bool):
                return False
            if isinstance(value, (int, float)):
                if value != 0:
                    return False
                continue
            text = str(value).strip()
            try:
                if float(text) != 0:
                    return False
            except ValueError:
                return False
    return True


class SearchResultVerifier:
    """Prevent a bounded zero-result sample from becoming an absence claim."""

    def verify(
        self,
        plan: SearchPlan,
        execution: dict[str, Any],
        *,
        refinement_count: int = 0,
    ) -> dict[str, Any]:
        metadata = execution.get("search_metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        returned = metadata.get("returned_count")
        fetched = metadata.get("fetched_count")
        total = metadata.get("total_result_count")
        splunk_truncated = metadata.get("splunk_result_truncated")
        context_truncated = metadata.get("mcp_context_truncated")
        has_rows = isinstance(returned, int) and returned > 0
        events = execution.get("events")
        aggregate_zero = _aggregate_zero_rows(events)
        has_matching_rows = has_rows and not aggregate_zero
        backend_limited = splunk_truncated is True or context_truncated is True
        truncation_unknown = splunk_truncated is None and total is None

        if has_matching_rows:
            conclusion = "matches_observed"
            confidence = "high" if plan.confidence >= 0.85 and not backend_limited else "medium"
            reason = "The planned scope returned observable matching rows."
        else:
            trusted_scope = bool(plan.indexes) and (
                bool(plan.sourcetypes) or plan.confidence >= 0.85
            )
            if not backend_limited and not truncation_unknown and trusted_scope and plan.confidence >= 0.85:
                conclusion = "no_match_observed"
                confidence = "high"
                reason = (
                    "No matching rows were observed in the trusted planned scope and configured aliases; "
                    "this is not proof of absence outside that scope."
                )
            else:
                conclusion = "uncertain_no_match"
                confidence = "low" if backend_limited or plan.confidence < 0.65 else "medium"
                reason = (
                    "No rows were returned, but the planned scope, confidence, or result bounds are "
                    "insufficient to conclude that no activity exists."
                )

        if aggregate_zero:
            reason = (
                "The search returned only zero-valued aggregate rows (for example a lone count=0); "
                "this is not evidence of matching activity."
            )

        return {
            "conclusion": conclusion,
            "confidence": confidence,
            "reason": reason,
            "aggregate_zero_rows": aggregate_zero,
            "planner_confidence": plan.confidence,
            "planner_confidence_label": plan.confidence_label,
            "total_result_count": total,
            "fetched_count": fetched,
            "returned_count": returned,
            "splunk_result_truncated": splunk_truncated,
            "mcp_context_truncated": context_truncated,
            "refinement_count": refinement_count,
        }


def verify_search_result(
    plan: SearchPlan,
    execution: dict[str, Any],
    *,
    refinement_count: int = 0,
) -> dict[str, Any]:
    return SearchResultVerifier().verify(plan, execution, refinement_count=refinement_count)


__all__ = ["SearchResultVerifier", "verify_search_result"]
