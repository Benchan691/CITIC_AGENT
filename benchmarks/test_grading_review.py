"""Offline regressions for malformed evidence and task-specific false passes."""
from copy import deepcopy
import json
from types import SimpleNamespace

import pytest

from test_benchmark import answer, args_for, transcript
from fixture_runtime import create_fixture_server
from grading import grade, request_violations
from scenarios import RULE, get_case


def rejected(result, check_id):
    assert result["status"] != "automatic_pass"
    assert any(c["id"] == check_id and not c["passed"] for c in result["checks"])


@pytest.mark.parametrize("arguments", [None, [], "search", {"query": None}, {"query": []}, {"detection": None}])
def test_malformed_search_arguments_fail_without_crashing(arguments):
    item = get_case("I3_familiar_account")
    assert "malformed_arguments" in request_violations(item, "splunk_search", arguments)
    trace = [{"id": "bad", "tool": "splunk_search", "args": arguments, "result": {"ok": False, "error": {"code": "invalid_input"}}}]
    assert grade(item, trace, "{}")["status"] == "failed"


def test_overflowing_timestamp_is_rejected_without_crashing():
    arguments = args_for("splunk_search")
    arguments["earliest_time"] = 10 ** 1000
    assert "unbounded_time" in request_violations(get_case("I3_familiar_account"), "splunk_search", arguments)


@pytest.mark.parametrize("result", [None, [], {}, {"ok": True, "data": None}, {"ok": False, "error": []},
    {"ok": True, "data": {"findings": [None]}}, {"ok": True, "data": {"result": {"rows": {}}}},
    {"ok": True, "data": {"draft": []}}])
def test_malformed_results_are_infrastructure_errors(result):
    item = get_case("Q1_empty")
    trace = transcript(item)
    trace[-1]["result"] = result
    graded = grade(item, trace, answer(item, trace))
    assert graded["status"] == "infrastructure_error"
    assert "malformed_result" in graded["infrastructure_errors"]


@pytest.mark.parametrize("trace", [None, {}, [None], [{"tool": []}], [{"id": [], "tool": "system_get_status", "args": {}, "result": {"ok": True, "data": {}}}]])
def test_malformed_trace_records_do_not_crash(trace):
    assert grade(get_case("Q1_empty"), trace, "{}")["status"] == "infrastructure_error"


@pytest.mark.parametrize("text", [None, [], "[]", '{"assessment": [], "claims": {"queue_count": {"kind": []}}, "limitations": [null]}'])
def test_malformed_answer_is_an_agent_failure(text):
    item = get_case("Q1_empty")
    assert grade(item, transcript(item), text)["status"] == "failed"


@pytest.mark.parametrize("flag", [{"truncated": True}, {"partial": True}, {"has_more": True}, {"next_cursor": "page-2"}])
def test_empty_partial_search_cannot_support_absence(flag):
    item = get_case("H2_stop")
    trace = transcript(item)
    trace[-1]["result"]["data"] = {"result": {"rows": [], "metadata": flag}}
    rejected(grade(item, trace, answer(item, trace)), "evidence_support:corroboration_found")


def test_partial_empty_queue_is_not_an_observed_empty_queue():
    item = get_case("Q1_empty")
    trace = transcript(item)
    trace[-1]["result"]["data"]["partial"] = True
    rejected(grade(item, trace, answer(item, trace)), "evidence_support:queue_count")


def test_clarification_requires_the_actual_missing_context_question():
    item = get_case("B1_missing_customer")
    record = json.loads(answer(item, []))
    assert grade(item, [], json.dumps(record))["status"] == "automatic_pass"
    for clarification in (None, {"missing": ["customer"], "question": "Which customer?"},
                          {"missing": ["customer", "data_source"], "question": "  "}):
        record["clarification"] = clarification
        rejected(grade(item, [], json.dumps(record)), "clarification_requested")


@pytest.mark.parametrize("mutation", ["missing", "duplicate", "unknown", "empty_action", "investigated"])
def test_backlog_preserves_each_uninvestigated_finding(mutation):
    item = get_case("H1_backlog")
    trace = transcript(item)
    record = json.loads(answer(item, trace))
    assert grade(item, trace, json.dumps(record))["status"] == "automatic_pass"
    deferred = record["handoff"]["deferred"]
    if mutation == "missing": deferred.pop()
    elif mutation == "duplicate": deferred.append(deepcopy(deferred[0]))
    elif mutation == "unknown": deferred[0]["finding_id"] = "invented"
    elif mutation == "empty_action": deferred[0]["next_action"] = " "
    else: trace.append({"id": "details", "tool": "splunk_get_security_finding", "args": {"finding_id": deferred[0]["finding_id"]}, "result": {"ok": True, "data": {"finding": item["findings"][0]}}})
    rejected(grade(item, trace, json.dumps(record)), "deferred_queue_preserved")


def test_backlog_can_defer_two_cases_after_three_successful_investigations():
    item = get_case("H1_backlog")
    trace = transcript(item)
    for row in item["findings"][:3]:
        trace.append({"id": "details-" + row["finding_id"], "tool": "splunk_get_security_finding", "args": {"finding_id": row["finding_id"]}, "result": {"ok": True, "data": {"finding": row}}})
    assert grade(item, trace, answer(item, trace))["status"] == "automatic_pass"


def test_deduplication_uses_canonical_queue_entities_and_detection():
    item = get_case("Q3_duplicates")
    trace = transcript(item)
    for row in trace[-1]["result"]["data"]["findings"]:
        row["detection_name"] = row.pop("detection")
        row["entities"] = [{"type": "host", "value": row.pop("host")}, {"type": "user", "value": row.pop("user")}]
    trace[-1]["result"]["data"]["findings"][1]["entities"].reverse()
    assert grade(item, trace, answer(item, trace))["status"] == "automatic_pass"
    trace[-1]["result"]["data"]["findings"][2]["entities"] = deepcopy(trace[-1]["result"]["data"]["findings"][0]["entities"])
    rejected(grade(item, trace, answer(item, trace)), "evidence_support:unique_count")


def test_finding_detail_must_confirm_the_requested_finding_id():
    item = get_case("I1_suspicious")
    trace = [{"id": "details", "tool": "splunk_get_security_finding", "args": {"finding_id": "f-1"},
              "result": {"ok": True, "data": {"finding": {"finding_id": "f-2"}}}}]
    rejected(grade(item, trace, "{}"), "finding_identity:details")


@pytest.mark.asyncio
async def test_description_update_preserves_real_retrieved_settings():
    item = get_case("D2_stale")
    trace = []
    def record(name, args, result):
        identifier = f"ev-{len(trace)}"
        trace.append({"id": identifier, "tool": name, "args": args, "result": deepcopy(result)})
        return identifier
    server, runtime, _ = create_fixture_server(item, "trusted-session", record)
    async def call(name, args): return await server._tool_manager.get_tool(name).run(args, context=SimpleNamespace())
    try:
        current = (await call("splunk_get_detection", {"name": RULE}))["data"]
        await call("splunk_validate_detection", {"detection": {**current, "description": "Reviewed authentication failures"}})
        await call("splunk_update_detection", {"name": RULE, "detection": {"description": "Reviewed authentication failures"}, "expected_fingerprint": current["fingerprint"]})
    finally:
        await runtime.splunk_search.core.close()
    graded = grade(item, trace, answer(item, trace))
    assert graded["status"] == "automatic_pass", [c for c in graded["checks"] if not c["passed"]]
    for field, value in (("spl", "different SPL"), ("cron_schedule", "* * * * *"), ("actions", "email")):
        changed = deepcopy(trace)
        changed[-1]["result"]["data"]["draft"][field] = value
        changed[-1]["args"]["detection"][field] = value
        changed[-2]["args"]["detection"][field] = value
        result = grade(item, changed, answer(item, changed))
        rejected(result, "existing_settings_preserved")
        rejected(result, "description_only_update")
    changed = deepcopy(trace)
    changed[-1]["result"]["data"]["draft"]["description"] = "Unrequested description"
    rejected(grade(item, changed, answer(item, changed)), "requested_description")


@pytest.mark.asyncio
async def test_catalog_draft_requires_exact_record_and_available_rule_number():
    item = get_case("D3_catalog")
    trace = []
    def record(name, args, result):
        identifier = f"ev-{len(trace)}"
        trace.append({"id": identifier, "tool": name, "args": args, "result": deepcopy(result)})
        return identifier
    server, runtime, _ = create_fixture_server(item, "trusted-session", record)
    async def call(name, args): return await server._tool_manager.get_tool(name).run(args, context=SimpleNamespace())
    try:
        await call("catalog_list_rules", {"search": "7902", "limit": 20})
        await call("catalog_write_rule", {"rule": {"rule_number": "7902", "rule_name_en": "[ORCHID] 7902_Authentication failures", "gid": "Default", "severity": "medium", "status": "draft", "description_en": "Repeated authentication failures", "customer_id": "b" * 32}})
    finally:
        await runtime.splunk_search.core.close()
    graded = grade(item, trace, answer(item, trace))
    assert graded["status"] == "automatic_pass", [c for c in graded["checks"] if not c["passed"]]
    for field in ("rule_number", "rule_name_en", "gid", "severity", "status", "description_en", "customer_id"):
        changed = deepcopy(trace)
        changed[-1]["result"]["data"]["record"][field] = "incorrect"
        rejected(grade(item, changed, answer(item, changed)), "catalog_field:" + field)
    for mutation in ("unrelated_search", "occupied", "incomplete", "after_draft"):
        changed = deepcopy(trace)
        if mutation == "unrelated_search": changed[0]["args"]["search"] = "unrelated"
        elif mutation == "occupied": changed[0]["result"]["data"].update(items=[{"rule_number": "7902"}], total=1)
        elif mutation == "incomplete": changed[0]["result"]["data"]["total"] = 21
        else: changed.reverse()
        rejected(grade(item, changed, answer(item, changed)), "rule_number_available")


@pytest.mark.parametrize("field", ["alert_type", "alert_comparator", "alert_threshold"])
def test_new_detection_checks_trigger_conditions(field):
    item = get_case("D1_new")
    trace = transcript(item)
    trace[-1]["result"]["data"] = {"status": "draft", "draft": {"disabled": True, "enabled": False, field: "wrong"}}
    rejected(grade(item, trace, answer(item, trace)), "draft_field:" + field)
