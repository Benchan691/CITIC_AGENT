"""Evidence retention, coalescing, and the definition-only planner tool."""

import asyncio

import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.search.evidence import (
    SearchEvidenceCoordinator,
    fingerprint_request,
)
from unified_mcp_server.splunk.search.planner import SearchIntent
from unified_mcp_server.splunk_service import SplunkService


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


async def test_reuse_returns_snapshot_within_ttl_and_stores_record():
    coordinator = SearchEvidenceCoordinator(reuse_ttl_seconds=300)
    calls = 0

    async def runner():
        nonlocal calls
        calls += 1
        return make_execution([{"src_ip": "10.1.2.3"}, {"src_ip": "10.1.2.4"}])

    fingerprint = fingerprint_request(
        query="q", earliest_time="-24h", latest_time="now", max_count=50, fields=None, principal_id="a",
    )
    first, reused_first, coalesced_first = await coordinator.execute_coalesced(fingerprint, runner)
    second, reused_second, coalesced_second = await coordinator.execute_coalesced(fingerprint, runner)
    assert calls == 1
    assert reused_first is None and coalesced_first is False
    assert reused_second is not None and coalesced_second is False
    assert reused_second.summary(reused=True)["reused"] is True
    assert reused_second.summary()["result_count"] == 2
    assert first["retained_events"] == second["retained_events"]


async def test_zero_ttl_always_refreshes():
    coordinator = SearchEvidenceCoordinator(reuse_ttl_seconds=0)
    calls = 0

    async def runner():
        nonlocal calls
        calls += 1
        return make_execution([{"n": calls}])

    fingerprint = fingerprint_request(
        query="q", earliest_time="-24h", latest_time="now", max_count=50, fields=None, principal_id="a",
    )
    await coordinator.execute_coalesced(fingerprint, runner)
    await coordinator.execute_coalesced(fingerprint, runner)
    assert calls == 2


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


async def test_service_search_reuses_retained_evidence_and_pages_it():
    service = build_service()
    first = await service.search('index=windows src_ip="10.1.2.3"', "-24h", "now", 50, None, principal_id="analyst")
    second = await service.search('index=windows src_ip="10.1.2.3"', "-24h", "now", 50, None, principal_id="analyst")
    assert second["evidence"]["reused"] is True
    assert first["evidence"]["id"] == second["evidence"]["id"]

    page = service.read_evidence(second["evidence"]["id"], offset=0, limit=10)
    assert page["total_count"] >= 1
    assert page["rows"][0]["src_ip"] == "10.1.2.3"

    changed = await service.search('index=windows src_ip="10.1.2.3"', "-1h", "now", 50, None, principal_id="analyst")
    assert changed["evidence"]["reused"] is False
    assert changed["evidence"]["id"] != first["evidence"]["id"]


async def test_service_search_refreshes_when_ttl_disabled():
    service = build_service(search_reuse_ttl_seconds=0)
    await service.search("index=windows activity", "-24h", "now", 50, None, principal_id="a")
    await service.search("index=windows activity", "-24h", "now", 50, None, principal_id="a")
    assert service.search_service.evidence.stats()["records"] == 2


async def test_plan_search_is_disabled_until_flag_and_never_executes():
    service = build_service()
    with pytest.raises(ServiceError) as caught:
        service.plan_search(SearchIntent(objective="find failed authentication activity for this IP", entity_type="ip", entity="10.1.2.3"))
    assert caught.value.code == "operation_disabled"

    enabled = build_service(search_planner_enabled=True)
    result = enabled.plan_search(
        SearchIntent(objective="find failed authentication activity for this IP", entity_type="ip", entity="10.1.2.3")
    )
    assert result["plan"]["objective"].startswith("find failed authentication")
    assert result["spl"].startswith("index=")
    assert "not executed" in result["note"]
