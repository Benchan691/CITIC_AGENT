import asyncio

import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.query_policy import QueryPolicyConfig
from unified_mcp_server.splunk.search.resource_manager import SearchResourceManager
from unified_mcp_server.splunk.search.resource_policy import (
    SearchResourceConfig,
    SearchResourcePolicy,
)
from unified_mcp_server.splunk_service import SplunkService
from unified_mcp_server.splunk.splunk_client import SplunkAPIError


def relaxed_policy() -> QueryPolicyConfig:
    return QueryPolicyConfig(
        wildcard_index_decision="allow",
        no_index_decision="allow",
        long_raw_decision="allow",
        very_long_decision="allow",
        all_time_decision="allow",
        expensive_command_decision="allow",
        subsearch_decision="allow",
        nested_subsearch_decision="allow",
        unresolved_macro_decision="allow",
        unparseable_time_decision="allow",
        max_subsearch_depth=3,
    )


def settings(**overrides) -> SplunkSettings:
    values = {
        "host": "splunk.example.com",
        "port": 8089,
        "username": "",
        "password": "",
        "token": "token",
        "verify_ssl": True,
        "request_timeout": 30,
        "job_timeout": 120,
        "max_events": 10_000,
        "risk_tolerance": 75,
        "safe_timerange": "24h",
        "sanitize_output": True,
        "query_policy": relaxed_policy(),
        "search_resource": SearchResourceConfig(
            max_jobs_per_minute=100,
            budget_per_minute=100,
        ),
    }
    values.update(overrides)
    return SplunkSettings(**values)


class RecordingClient:
    def __init__(self, _config):
        self.search_calls = []
        self.saved_calls = []
        self.saved_gets = []
        self.started = asyncio.Event()
        self.release = None
        self.fail = None

    async def connect(self):
        return None

    async def disconnect(self):
        return None

    async def run_search_job(
        self,
        query,
        earliest_time="-24h",
        latest_time="now",
        max_count=100,
        *,
        runtime_limit=None,
    ):
        self.search_calls.append(
            {
                "query": query,
                "earliest_time": earliest_time,
                "latest_time": latest_time,
                "max_count": max_count,
                "runtime_limit": runtime_limit,
            }
        )
        self.started.set()
        if self.release is not None:
            await self.release.wait()
        if self.fail is not None:
            raise self.fail
        return {
            "events": [{"host": "host-1", "message": "event"}],
            "columns": ["host", "message"],
            "metadata": {
                "total_result_count": 10_000,
                "scan_count": 50_000,
                "run_duration": 0.25,
                "splunk_result_truncated": True,
            },
        }

    async def get_saved_search(self, name, app="", owner=""):
        self.saved_gets.append((name, app, owner))
        return {
            "name": name,
            "content": {
                "search": "index=main",
                "dispatch.earliest_time": "-1h",
                "dispatch.latest_time": "now",
            },
        }

    async def run_saved_search(
        self,
        name,
        trigger_actions=False,
        max_count=100,
        app="",
        owner="",
        *,
        runtime_limit=None,
    ):
        self.saved_calls.append(
            {
                "name": name,
                "trigger_actions": trigger_actions,
                "max_count": max_count,
                "app": app,
                "owner": owner,
                "runtime_limit": runtime_limit,
            }
        )
        return {"events": [{"host": "host-1"}]}


def make_service(resource=None, *, client_factory=None):
    clients = []

    def factory(config):
        client = client_factory(config) if client_factory is not None else RecordingClient(config)
        clients.append(client)
        return client

    service = SplunkService(
        settings(search_resource=resource or SearchResourceConfig(max_jobs_per_minute=100, budget_per_minute=100)),
        factory,
    )
    return service, clients


def test_resource_profile_uses_existing_query_analysis_and_classifies_costs():
    service, _ = make_service()
    executor = service.search_service.executor

    low = executor.resource_policy.profile(
        service.core.validate_query("index=main", "-2h", "now"), 10
    )
    medium = executor.resource_policy.profile(
        service.core.validate_query("index=main | stats count by host", "-2d", "now"), 10
    )
    high = executor.resource_policy.profile(
        service.core.validate_query("index=main", "-2d", "now"), 10
    )
    restricted = executor.resource_policy.profile(
        service.core.validate_query("index=*", "-8d", "now"), 10
    )

    assert low.cost_class == "low"
    assert medium.cost_class == "medium"
    assert high.cost_class == "high"
    assert restricted.cost_class == "restricted"
    assert "Long raw-event searches" in " ".join(high.reasons)




@pytest.mark.asyncio
async def test_resource_denial_happens_before_splunk_client_or_job_creation():
    created = []

    def factory(config):
        created.append(config)
        raise AssertionError("resource denial must happen before client creation")

    service = SplunkService(
        settings(
            query_policy=relaxed_policy(),
            search_resource=SearchResourceConfig(max_jobs_per_minute=100, budget_per_minute=100),
        ),
        factory,
    )

    with pytest.raises(ServiceError) as error:
        await service.search("index=main", earliest_time="0", principal_id="analyst-a")

    assert error.value.code == "lookback_limit_exceeded"
    assert created == []




@pytest.mark.asyncio
async def test_capacity_is_weighted_and_per_principal_slots_are_enforced():
    manager = SearchResourceManager(
        SearchResourceConfig(
            global_concurrency=2,
            per_principal_concurrency=2,
            queue_timeout_seconds=0.02,
            max_jobs_per_minute=100,
            budget_per_minute=100,
        )
    )

    async with manager.acquire("analyst-a", "medium", weight=2, budget_cost=3):
        with pytest.raises(ServiceError) as busy:
            async with manager.acquire("analyst-b", "low", weight=1, budget_cost=1):
                pass
        assert busy.value.code == "resource_busy"
    assert manager.snapshot()["active_splunk_searches"] == 0

    per_principal = SearchResourceManager(
        SearchResourceConfig(
            global_concurrency=4,
            per_principal_concurrency=1,
            queue_timeout_seconds=0.02,
            max_jobs_per_minute=100,
            budget_per_minute=100,
        )
    )
    async with per_principal.acquire("analyst-a", "low"):
        with pytest.raises(ServiceError) as principal_busy:
            async with per_principal.acquire("analyst-a", "low"):
                pass
        assert principal_busy.value.code == "resource_busy"
        async with per_principal.acquire("analyst-b", "low"):
            assert per_principal.snapshot()["active_splunk_searches"] == 2






@pytest.mark.asyncio
async def test_rate_and_weighted_query_budget_block_before_dispatch():
    rate_limited = SearchResourceManager(
        SearchResourceConfig(
            max_jobs_per_minute=1,
            budget_per_minute=100,
            queue_timeout_seconds=0,
        )
    )
    async with rate_limited.acquire("analyst-a", "low", budget_cost=1):
        pass
    with pytest.raises(ServiceError) as rate_error:
        async with rate_limited.acquire("analyst-a", "low", budget_cost=1):
            pass
    assert rate_error.value.code == "rate_limit_exceeded"

    budget_limited = SearchResourceManager(
        SearchResourceConfig(
            max_jobs_per_minute=100,
            budget_per_minute=2,
            queue_timeout_seconds=0,
        )
    )
    async with budget_limited.acquire("analyst-a", "low", budget_cost=1):
        pass
    with pytest.raises(ServiceError) as budget_error:
        async with budget_limited.acquire("analyst-a", "medium", weight=2, budget_cost=3):
            pass
    assert budget_error.value.code == "query_budget_exceeded"




@pytest.mark.asyncio
async def test_backtests_use_dedicated_concurrency_profile():
    release = asyncio.Event()

    def factory(config):
        client = RecordingClient(config)
        client.release = release
        return client

    service, clients = make_service(
        SearchResourceConfig(
            global_concurrency=8,
            per_principal_concurrency=4,
            backtest_concurrency=1,
            queue_timeout_seconds=0.02,
            max_jobs_per_minute=100,
            budget_per_minute=100,
        ),
        client_factory=factory,
    )
    payload = {"name": "test", "spl": "index=main"}
    first = asyncio.create_task(
        service.backtest_detection(payload, earliest_time="-1h", principal_id="analyst-a")
    )
    while not clients:
        await asyncio.sleep(0)
    await clients[0].started.wait()
    with pytest.raises(ServiceError) as second_error:
        await service.backtest_detection(payload, earliest_time="-1h", principal_id="analyst-a")
    assert second_error.value.code == "resource_busy"
    release.set()
    await first
    assert len(clients[0].search_calls) == 1
