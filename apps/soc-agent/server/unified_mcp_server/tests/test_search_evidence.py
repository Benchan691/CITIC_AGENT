"""Evidence retention, coalescing, and the definition-only planner tool."""

import asyncio
from dataclasses import replace

import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.search.evidence import (
    SearchEvidenceCoordinator,
    fingerprint_request,
)
from unified_mcp_server.splunk.search.planner import SearchIntent
from unified_mcp_server.splunk_service import SplunkService
from unified_mcp_server.request_context import OperationContext, operation_context


def settings(**overrides):
    values = {
        "host": "splunk.example.com",
        "port": 8089,
        "username": "",
        "password": "",
        "token": "token",
        "verify_ssl": True,
        "request_timeout": 30,
        "job_timeout": 120,
        "max_events": 100,
        "risk_tolerance": 75,
        "safe_timerange": "24h",
        "sanitize_output": True,
    }
    values.update(overrides)
    return SplunkSettings(**values)


class RecordingClient:
    def __init__(self, _config):
        self.queries = []

    async def connect(self):
        return None

    async def disconnect(self):
        return None

    async def run_search_job(self, query, *args, **kwargs):
        self.queries.append(query)
        return {
            "events": [{"_time": "2026-09-05T00:00:00Z", "src_ip": "10.1.2.3"}],
            "columns": ["_time", "src_ip"],
            "metadata": {"total_result_count": 1, "scan_count": 3},
        }


def make_execution(events):
    return {
        "validation": {"query": "index=windows src_ip=\"10.1.2.3\"", "risk_score": 1, "risk_tolerance": 75},
        "limit": 50,
        "fields": [],
        "events": events[:1],
        "result_type": "events",
        "columns": ["_time", "src_ip"],
        "event_budget": {"truncated": False},
        "search_metadata": {"returned_count": len(events[:1])},
        "retained_events": events,
        "earliest_time": "-24h",
        "latest_time": "now",
    }


def test_fingerprint_is_stable_and_discriminates_requests():
    base = fingerprint_request(
        query="index=x error", earliest_time="-24h", latest_time="now",
        max_count=50, fields=["src"], principal_id="analyst",
    )
    same = fingerprint_request(
        query="index=x error", earliest_time="-24h", latest_time="now",
        max_count=50, fields=["src"], principal_id="analyst",
    )
    changed = fingerprint_request(
        query="index=x error", earliest_time="-24h", latest_time="now",
        max_count=50, fields=["src"], principal_id="other",
    )
    assert base == same
    assert base != changed






async def test_durable_snapshot_restarts_without_redispatch_and_enforces_scope(tmp_path):
    path = str(tmp_path / "evidence.sqlite3")
    context = OperationContext(principal_id="a", investigation_id="case-1", customer_id="customer-a")
    token = operation_context.set(context)
    try:
        coordinator = SearchEvidenceCoordinator(store_path=path)
        async def runner():
            return make_execution([{"n": 1}, {"n": 2}])
        await coordinator.execute_coalesced("fixture", runner)
        original = coordinator.get_latest("fixture")
        assert original.durable is True
        restarted = SearchEvidenceCoordinator(store_path=path)
        async def must_not_run():
            pytest.fail("retained evidence dispatched another search")
        _, reused, _ = await restarted.execute_coalesced("fixture", must_not_run)
        assert reused.evidence_id == original.evidence_id
        assert restarted.read_page(original.evidence_id)["rows"] == [{"n": 1}, {"n": 2}]
        for altered in [replace(context, principal_id="b"), replace(context, investigation_id="case-2"), replace(context, customer_id="customer-b")]:
            operation_context.set(altered)
            with pytest.raises(ServiceError, match="no longer retained"):
                restarted.read_page(original.evidence_id)
    finally:
        operation_context.reset(token)








async def test_identical_in_flight_requests_share_one_dispatch():
    coordinator = SearchEvidenceCoordinator(reuse_ttl_seconds=300)
    calls = 0
    gate = asyncio.Event()

    async def runner():
        nonlocal calls
        calls += 1
        await gate.wait()
        return make_execution([{"n": calls}])

    fingerprint = fingerprint_request(
        query="q", earliest_time="-24h", latest_time="now", max_count=50, fields=None, principal_id="a",
    )
    first_task = asyncio.create_task(coordinator.execute_coalesced(fingerprint, runner))
    await asyncio.sleep(0)
    second_task = asyncio.create_task(coordinator.execute_coalesced(fingerprint, runner))
    await asyncio.sleep(0)
    gate.set()
    first, second = await asyncio.gather(first_task, second_task)
    assert calls == 1
    assert second[2] is True and first[2] is False
    assert first[0] is second[0]




async def test_last_reader_cancellation_drains_backend_and_allows_retry():
    coordinator = SearchEvidenceCoordinator()
    started, cleaned = asyncio.Event(), asyncio.Event()

    async def runner():
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cleaned.set()

    task = asyncio.create_task(coordinator.execute_coalesced("shared", runner))
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert cleaned.is_set()
    assert coordinator.stats()["in_flight"] == 0
    assert coordinator.get_latest("shared") is None




async def test_read_page_and_eviction():
    coordinator = SearchEvidenceCoordinator(max_records=2, reuse_ttl_seconds=300)
    events = [{"i": str(index)} for index in range(5)]

    async def runner(index):
        return make_execution(list(events))

    last_fingerprint = None
    for index in range(3):
        fingerprint = fingerprint_request(
            query=f"q{index}", earliest_time="-24h", latest_time="now", max_count=50, fields=None, principal_id="a",
        )
        await coordinator.execute_coalesced(
            fingerprint, lambda index=index: runner(index)
        )
        last_fingerprint = fingerprint

    assert len(coordinator._records) == 2
    last_record = coordinator.get_latest(last_fingerprint)
    assert last_record is not None
    page = coordinator.read_page(last_record.evidence_id, offset=2, limit=2)
    assert page["returned_count"] == 2
    assert page["rows"] == [{"i": "2"}, {"i": "3"}]
    assert page["complete"] is False

    with pytest.raises(ServiceError) as caught:
        coordinator.read_page("missing-evidence-id")
    assert caught.value.code == "evidence_not_found"


def build_service(**overrides):
    return SplunkService(settings(**overrides), RecordingClient)
