"""Regression tests for SearchResultVerifier, including the aggregate-zero probe."""

from unified_mcp_server.splunk.search.planner import SearchPlan
from unified_mcp_server.splunk.search.verifier import verify_search_result


def plan(confidence: float = 0.95, indexes: list[str] | None = None) -> SearchPlan:
    return SearchPlan(
        objective="Count failed logins for host X",
        indexes=indexes if indexes is not None else ["g41228_windows_wec"],
        sourcetypes=["windows_security"],
        entity_fields={"host": ["Event_Hostname"]},
        earliest_time="-24h",
        latest_time="now",
        strategy="structured",
        spl='index=g41228_windows_wec | stats count',
        output_fields=["count"],
        confidence=confidence,
        reasons=["test"],
        assumptions=[],
    )


def execution(rows: list[dict], **metadata) -> dict:
    base = {"returned_count": len(rows), "fetched_count": len(rows), "total_result_count": len(rows)}
    base.update(metadata)
    return {"events": rows, "search_metadata": base}


def test_aggregate_zero_row_is_not_a_match():
    """The offline probe: one aggregate row with count=0 must not be matches_observed."""
    result = verify_search_result(plan(), execution([{"count": "0"}]))
    assert result["conclusion"] != "matches_observed"
    assert result["aggregate_zero_rows"] is True
    assert result["conclusion"] == "no_match_observed"
    assert "zero-valued aggregate" in result["reason"]


def test_aggregate_zero_multiple_zero_rows_is_not_a_match():
    result = verify_search_result(plan(), execution([{"count": 0}, {"total": 0.0}]))
    assert result["conclusion"] != "matches_observed"
    assert result["aggregate_zero_rows"] is True


def test_positive_count_still_matches():
    result = verify_search_result(plan(), execution([{"count": "7"}]))
    assert result["conclusion"] == "matches_observed"
    assert result["aggregate_zero_rows"] is False
    assert result["confidence"] == "high"


def test_event_rows_with_fields_are_matches():
    rows = [{"_time": "2026-09-05T00:00:00Z", "Event_Hostname": "host-a", "count": "1"}]
    result = verify_search_result(plan(), execution(rows))
    assert result["conclusion"] == "matches_observed"
    assert result["aggregate_zero_rows"] is False


def test_zero_count_next_to_text_fields_is_still_a_match():
    rows = [{"host": "host-a", "count": "0"}]
    result = verify_search_result(plan(), execution(rows))
    assert result["conclusion"] == "matches_observed"


def test_zero_rows_without_results_remain_no_match_observed():
    result = verify_search_result(plan(), execution([]))
    assert result["conclusion"] == "no_match_observed"
    assert result["aggregate_zero_rows"] is False


def test_untrusted_scope_zero_rows_stay_uncertain():
    result = verify_search_result(plan(confidence=0.5, indexes=[]), execution([]))
    assert result["conclusion"] == "uncertain_no_match"


def test_truncated_zero_rows_never_become_absence():
    result = verify_search_result(plan(), execution([], splunk_result_truncated=True))
    assert result["conclusion"] == "uncertain_no_match"
    assert result["confidence"] == "low"
