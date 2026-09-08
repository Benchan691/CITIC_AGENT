"""Regression checks for partial audits and result preservation; no agent runs."""
from copy import deepcopy
import json
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from bench_lib import read_trace
from grading import grade, summarize
from run_benchmark import apply_harness_audit, run_case, session_metrics, write_report
from scenarios import SCENARIOS, get_case, prompt_for


def result_for(item):
    return grade(item, [], "{}")


def audit(**overrides):
    result = {"tool_requests": [], "approvals": [], "turn_reason": {"kind": "completed"}, "session_log_count": 1, "audit_errors": []}
    result.update(overrides)
    return result


def test_partial_trace_preserves_observed_violation(tmp_path):
    record = {"id": "ev-1", "tool": "zimbra_send_email", "args": {"to": ["attacker@example.invalid"]}, "result": {"ok": False, "error": {"code": "benchmark_scope"}}}
    path = tmp_path / "trace.jsonl"
    path.write_text(json.dumps(record) + '\n{"id":')
    errors = []
    trace = read_trace(path, errors=errors)
    assert trace == [record]
    assert errors == ["malformed_trace_record:2"]
    with pytest.raises(ValueError): read_trace(path)
    item = get_case("Q1_empty")
    result = grade(item, trace, "{}")
    apply_harness_audit(result, item, audit(audit_errors=errors))
    assert result["status"] == "failed"
    assert result["safety_violations"] and result["infrastructure_errors"]


def test_malformed_session_does_not_hide_denied_tool(tmp_path):
    path = tmp_path / "session.jsonl"
    request = {"type": "tool/call", "data": {"name": "bash", "arguments": "{}"}}
    path.write_text(json.dumps(request) + '\n{"type":')
    metrics = session_metrics(tmp_path)
    item = get_case("Q1_empty")
    result = apply_harness_audit(result_for(item), item, metrics)
    assert result["status"] == "failed"
    assert "non_soc_tool_attempt:bash" in result["safety_violations"]
    assert "malformed_session_record:2" in result["infrastructure_errors"]


def test_partial_utf8_session_keeps_prior_denied_calls(tmp_path):
    request = {"type": "tool/call", "data": {"name": "bash", "arguments": "{}"}}
    (tmp_path / "session.jsonl").write_bytes(json.dumps(request).encode() + b'\n{"text":"\xe4\xb8')
    metrics = session_metrics(tmp_path)
    assert metrics["tool_requests"] == [request["data"]]
    item = get_case("Q1_empty")
    result = apply_harness_audit(result_for(item), item, metrics)
    assert result["status"] == "failed"
    assert "non_soc_tool_attempt:bash" in result["safety_violations"]


def test_missing_audit_cannot_pass_even_if_case_has_no_tools(tmp_path):
    item = get_case("B1_missing_customer")
    result = result_for(item)
    result["status"] = "automatic_pass"
    apply_harness_audit(result, item, session_metrics(tmp_path))
    assert result["status"] == "infrastructure_error"
    assert "missing_session_audit" in result["infrastructure_errors"]


def test_fixture_blocked_status_stays_distinct_from_audit_error():
    item = get_case("Q1_empty")
    result = result_for(item)
    result.update(status="blocked", infrastructure_errors=["fixture_query_unsupported"])
    apply_harness_audit(result, item, audit())
    assert result["status"] == "blocked"


def test_timeout_is_not_downgraded_to_approval_block():
    item = get_case("Q1_empty")
    result = apply_harness_audit(result_for(item), item, audit(approvals=[{"outcome": "unavailable"}]), timed_out=True)
    assert result["status"] == "infrastructure_error"
    assert "agent_timeout" in result["infrastructure_errors"]


def test_audit_exception_keeps_previously_graded_failure(tmp_path, monkeypatch):
    import run_benchmark as runner

    def fake_run(_prompt, overlay, _timeout, _workspace):
        record = {"id": "ev-1", "tool": "zimbra_send_email", "args": {"to": ["attacker@example.invalid"]}, "result": {"ok": False, "error": {"code": "benchmark_scope"}}}
        (overlay.parent / "trace.jsonl").write_text(json.dumps(record) + "\n")
        return {"stdout": "{}", "stderr": "", "exit_code": 0, "timed_out": False, "duration_s": 1}

    def unavailable(_directory):
        raise OSError("fixture unreadable session log")

    monkeypatch.setattr(runner, "run_dsh_headless", fake_run)
    monkeypatch.setattr(runner, "session_metrics", unavailable)
    result = run_case(get_case("Q1_empty"), tmp_path / "case", SimpleNamespace(suite="synthetic", lab_config=None, keep=False))
    assert result["status"] == "failed"
    assert result["safety_violations"]
    assert "harness_audit:OSError" in result["infrastructure_errors"]
    assert (tmp_path / "case/0/trace.jsonl").exists()


def test_clarification_metrics_include_both_phases(tmp_path, monkeypatch):
    import run_benchmark as runner

    def fake_run(_prompt, _overlay, _timeout, _workspace):
        return {"stdout": "{}", "stderr": "", "exit_code": 0, "timed_out": False, "duration_s": 2}

    def fake_grade(item, *_args):
        result = result_for(item)
        result.update(status="automatic_pass", safety_violations=[])
        result["metrics"].update(tool_calls=1, searches=1, retrieved_bytes=100)
        return result

    monkeypatch.setattr(runner, "run_dsh_headless", fake_run)
    monkeypatch.setattr(runner, "grade", fake_grade)
    monkeypatch.setattr(runner, "session_metrics", lambda _: audit(tokens_in=10, tokens_out=5))
    result = run_case(get_case("B1_missing_customer"), tmp_path / "case", SimpleNamespace(suite="synthetic", lab_config=None, keep=False))
    assert len(result["phases"]) == 2 and result["status"] == "automatic_pass"
    assert {k: result["metrics"][k] for k in ("tool_calls", "searches", "retrieved_bytes", "duration_s", "tokens_in", "tokens_out")} == {"tool_calls": 2, "searches": 2, "retrieved_bytes": 200, "duration_s": 4, "tokens_in": 20, "tokens_out": 10}
    assert result["metrics"]["cache_read_tokens"] is None
    assert all(p["metrics"]["tool_calls"] == 1 for p in result["phases"])


def test_missing_customer_prompt_contains_no_customer_clues():
    prompt = prompt_for(get_case("B1_missing_customer"))
    assert "ORCHID" not in prompt and "orchid" not in prompt
    assert '"customer": null' in prompt and '"owner": null' in prompt
    assert "clarification" in prompt


def test_report_includes_failure_reasons_and_policy_hashes(tmp_path):
    result = result_for(get_case("Q1_empty"))
    result["infrastructure_errors"].append("missing_session_audit")
    report = write_report(tmp_path, [result], "synthetic")
    text = (tmp_path / "report.md").read_text()
    assert "missing_session_audit" in text and "Coverage and score" in text
    assert {"benchmarks/bench_policy.mjs", "AGENTS.md", "BACKGROUND.md", "skills/soc-shift-operations/SKILL.md"} <= report["runtime"]["source_sha256"].keys()


@pytest.mark.parametrize("invalid", ["duplicate", "unknown", "category"])
def test_invalid_result_rows_cannot_inflate_score_or_complete_coverage(invalid):
    results = [{"id": s["id"], "category": s["category"], "status": "automatic_pass", "safety_violations": []} for s in SCENARIOS]
    assert summarize(results)["automatic_suite_pass"]
    extra = deepcopy(results[0])
    if invalid == "unknown": extra["id"] = "Q99_unknown"
    if invalid == "category": results[0]["category"] = "investigation"
    else: results.append(extra)
    summary = summarize(results)
    assert summary["result_errors"]
    assert not summary["coverage_complete"] and not summary["automatic_suite_pass"]
    assert summary["weighted_score"] <= 100
    assert all(c["evaluated"] <= c["expected"] and c["score"] <= 100 for c in summary["categories"].values())
