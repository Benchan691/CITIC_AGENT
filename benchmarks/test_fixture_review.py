"""Offline regression checks for fixture evidence and provider contracts."""
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "benchmarks"), str(ROOT / "apps/soc-agent/server")]
from fixture_runtime import FixtureSplunk, create_fixture_server
from scenarios import RULE, WINDOW, event, get_case
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.detection.compiler import compile_citic_detection


def compilation(**overrides):
    args = {
        "detection_logic": "index=bench_orchid EventCode=4625", "rulename": "7902",
        "threat_name": "Authentication failures", "threat_type": "Authentication", "case_prefix": "ORC",
        "event_field_mappings": {"Fix_Source Type": '"Windows Security"', "Event_Hostname": "host", "Event_Date Time": "_time"},
    }
    args.update(overrides)
    return args, compile_citic_detection(**args)


async def search(provider, query, limit=20):
    return await provider.run_search_job(query, WINDOW["start"], WINDOW["end"], limit)


@pytest.mark.asyncio
async def test_compiled_backtest_returns_real_projected_fields_through_mcp():
    server, runtime, _ = create_fixture_server(get_case("D1_new"), "fixture-test", lambda *_: "fixture-evidence")
    async def call(name, args):
        return await server._tool_manager.get_tool(name).run(args, context=SimpleNamespace())
    try:
        args, _ = compilation()
        compiled = (await call("splunk_compile_citic_detection", args))["data"]
        result = (await call("splunk_backtest_detection", {
            "detection": {"name": "[ORCHID] 7902_Authentication failures", "spl": compiled["backtest_spl"]},
            "earliest_time": WINDOW["start"], "latest_time": WINDOW["end"],
            "max_count": 20, "fields": compiled["table_fields"],
        }))["data"]
        row, = result["sample_events"]
        assert set(row) == set(compiled["table_fields"])
        assert row["Fix_Ticketnumber"] == "ORC2026090809007902"
        assert row["Fix_TriggerTime"] == "2026-09-08 09:00:00"
        assert row["Fix_Index"] == "GORC"
        assert row["Fix_Source Type"] == "Windows Security"
        assert row["Event_Hostname"] == "orchid-ws1"
        assert row["Event_Date Time"] == "2026-09-08 08:15:00"
        assert row["Event_Threat Name"] == "Authentication failures"
        assert row["Event_Threat Type"] == "Authentication"
        assert row["Event_GID"] == "ORC" and row["Event_Rulenum"] == "7902"
        assert result["search_metadata"]["total_result_count"] == 1
    finally:
        await runtime.splunk_search.core.close()


@pytest.mark.asyncio
async def test_compiler_mapping_order_null_fields_and_extra_projection():
    mappings = {"Fix_Source Type": '"Windows Security"', "Event_Hostname": "missing_host", "Event_Date Time": '"ignored by real compiler"', "Event_Account": "user", "Event_Copy": "Event_Account"}
    args, compiled = compilation(event_field_mappings=mappings, extra_table_fields=["src_ip"])
    provider = FixtureSplunk(get_case("D1_new"))
    provider.compiled[compiled["backtest_spl"]] = args["detection_logic"]
    row, = (await search(provider, compiled["backtest_spl"]))["events"]
    assert "Event_Hostname" not in row and "host" not in row and "user" not in row
    assert row["Event_Account"] == row["Event_Copy"] == "svc_backup"
    assert row["src_ip"] == "192.0.2.10"
    assert row["Event_Date Time"] == "2026-09-08 08:15:00"


@pytest.mark.asyncio
@pytest.mark.parametrize("events", [[], [event()]])
async def test_unsupported_compiler_mapping_is_blocked_even_without_matches(events):
    args, compiled = compilation(event_field_mappings={"Fix_Source Type": '"Windows Security"', "Event_Hostname": 'coalesce(host, "unknown")'})
    item = get_case("D1_new")
    item["events"] = events
    provider = FixtureSplunk(item)
    provider.compiled[compiled["backtest_spl"]] = args["detection_logic"]
    with pytest.raises(ServiceError) as raised:
        await search(provider, compiled["backtest_spl"])
    assert raised.value.code == "fixture_query_unsupported"


@pytest.mark.asyncio
async def test_empty_results_count_projection_and_result_truncation():
    provider = FixtureSplunk(get_case("C2_unconfirmed"))
    empty = await search(provider, "index=bench_orchid")
    assert empty["events"] == []
    assert empty["metadata"] == {"total_result_count": 0, "fetched_count": 0, "splunk_result_truncated": False}
    counted = await search(provider, "index=bench_orchid | stats count as matches")
    assert counted["events"] == [{"matches": 0}]
    item = get_case("I1_suspicious")
    limited = await search(FixtureSplunk(item), "index=bench_orchid | table id", 1)
    assert limited["events"] == [{"id": "ev-1"}]
    assert limited["metadata"] == {"total_result_count": 2, "fetched_count": 1, "splunk_result_truncated": True}


@pytest.mark.asyncio
async def test_incomplete_sample_cannot_fabricate_aggregate_count():
    provider = FixtureSplunk(get_case("I4_incomplete"))
    result = await search(provider, "index=bench_orchid")
    assert result["metadata"]["total_result_count"] is None
    assert result["metadata"]["splunk_result_truncated"] is True
    with pytest.raises(ServiceError) as raised:
        await search(provider, "index=bench_orchid | stats count")
    assert raised.value.code == "fixture_query_unsupported"


@pytest.mark.asyncio
@pytest.mark.parametrize("start,end,count", [
    ("2026-09-08T00:30:00Z", "2026-09-08T00:45:00Z", 0),
    ("2026-09-08T00:15:00Z", "2026-09-08T00:16:00Z", 2),
    ("2026-09-08T00:00:00Z", "2026-09-08T00:15:00Z", 2),
])
async def test_queue_uses_real_provider_window_filtering(start, end, count):
    _, runtime, _ = create_fixture_server(get_case("Q2_priority"), "fixture-test", lambda *_: "fixture-evidence")
    try:
        result = await runtime.splunk_security_queue.list_security_findings("", "", "", RULE, start, end, 20, "")
        assert result["count"] == count
        assert result["total_count"] is None and result["partial"] is False
        assert len(result["findings"]) == count
    finally:
        await runtime.splunk_search.core.close()


@pytest.mark.asyncio
async def test_queue_canonical_contract_cursor_detail_and_filter_validation():
    server, runtime, _ = create_fixture_server(get_case("Q2_priority"), "fixture-test", lambda *_: "fixture-evidence")
    async def call(name, args):
        return (await server._tool_manager.get_tool(name).run(args, context=SimpleNamespace()))["data"]
    args = {"detection": RULE, "earliest_time": WINDOW["start"], "latest_time": WINDOW["end"], "limit": 1}
    try:
        first = await call("splunk_list_security_findings", args)
        assert first["source"] == "standard" and first["history_complete"] is False
        assert first["retention_limited"] is True and first["capabilities"]["native_findings"] is False
        assert first["truncated"] is True and first["truncation"]["row_limit"] is True
        assert first["mcp_context_truncated"] is False
        assert first["next_cursor"] and first["findings"][0]["finding_id"] == "f-1"
        summary = first["findings"][0]
        assert summary["detection_name"] == RULE and summary["title"] == "Customer login service unavailable"
        assert summary["entities"] == [{"type": "host", "value": "orchid-ws1"}, {"type": "user", "value": "svc_backup"}]
        assert "host" not in summary and "detection" not in summary
        second = await call("splunk_list_security_findings", {**args, "cursor": first["next_cursor"]})
        assert [row["finding_id"] for row in second["findings"]] == ["f-2"]
        detail = await call("splunk_get_security_finding", {"finding_id": "f-1"})
        assert detail["finding"] == summary and detail["source"] == "standard"
        assert detail["detection"] == {"name": RULE}
        assert detail["evidence"]["contributing_events"] == []
        assert detail["source_metadata"]["retention_limited"] is True
        with pytest.raises(Exception):
            await call("splunk_list_security_findings", {**args, "cursor": first["next_cursor"] + "tamper"})
        with pytest.raises(Exception):
            await call("splunk_list_security_findings", {**args, "urgency": "invalid"})
    finally:
        await runtime.splunk_search.core.close()


@pytest.mark.asyncio
async def test_mail_uses_real_response_shapes_and_rejects_unsupported_queries():
    _, runtime, _ = create_fixture_server(get_case("C4_attachment"), "fixture-test", lambda *_: "fixture-evidence")
    mail = runtime.zimbra_mail
    query = "in:Inbox from:security@orchid.example date:09/08/2026"
    try:
        response = await mail.search_emails(query, 20)
        assert response["count"] == 1 and response["query"] == query and response["offset"] == 0
        assert response["account"]["email"] == "a***@soc.example"
        assert "body" not in response["messages"][0]
        assert (await mail.search_emails(query, 20, offset=1))["messages"] == []
        with pytest.raises(ServiceError) as raised:
            await mail.search_emails(query + " subject:no-match", 20)
        assert raised.value.code == "fixture_query_unsupported"
        message = await mail.get_email("mail-1", max_body_chars=5)
        assert len(message["body"]) == 5 and message["body_truncated"] is True
        assert message["body_characters"] > 5
        assert len((await mail.get_email("mail-1"))["body"]) > 5
        headers = await mail.get_email_headers("mail-1", names=["Authentication-Results", "Received"])
        assert headers["untrusted_evidence"] is True
        assert headers["headers"]["Received"] == []
        assert isinstance(headers["headers"]["Authentication-Results"], list)
        attachment = await mail.get_attachment_text("mail-1", "2", max_chars=5)
        assert attachment["text_truncated"] is True and len(attachment["text"]) == 5
        assert attachment["format"] == {"content_type": "text/plain", "extension": ".txt"}
        with pytest.raises(ServiceError):
            await mail.search_emails(query, account_id="other-user")
        with pytest.raises(ServiceError) as raised:
            await mail.list_folders()
        assert raised.value.code == "fixture_operation_unsupported"
    finally:
        await runtime.splunk_search.core.close()


@pytest.mark.asyncio
async def test_missing_attachment_is_not_an_empty_success():
    _, runtime, _ = create_fixture_server(get_case("C1_confirmed"), "fixture-test", lambda *_: "fixture-evidence")
    try:
        with pytest.raises(ServiceError) as raised:
            await runtime.zimbra_mail.get_attachment_text("mail-1", "2")
        assert raised.value.code == "attachment_not_found"
    finally:
        await runtime.splunk_search.core.close()
