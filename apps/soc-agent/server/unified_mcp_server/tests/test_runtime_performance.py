"""Offline lifecycle and deadline checks with the real service composition."""

import asyncio
import threading
from types import SimpleNamespace

import pytest

from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.blocking_io import BlockingIO
from unified_mcp_server.config import ServerSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.request_context import operation_budget, operation_context, remaining_seconds
from unified_mcp_server.server import Runtime


async def test_real_runtime_constructs_catalog_and_reuses_immutable_mail_services(monkeypatch):
    for key in ("APP_POSTGRES_URI", "LANGGRAPH_POSTGRES_URI", "POSTGRES_URI"):
        monkeypatch.delenv(key, raising=False)
    settings = ServerSettings.from_env({})
    runtime = Runtime.create(settings, accounts=SimpleNamespace(count=lambda: 0))
    try:
        assert runtime.catalog.settings is settings.splunk
        a = ZimbraIdentity("user-a", "a@example.test", "token-a", "session-a")
        b = ZimbraIdentity("user-b", "b@example.test", "token-b", "session-b")
        assert runtime.for_identity(a) is runtime.for_identity(a)
        assert runtime.for_identity(a).zimbra is not runtime.for_identity(b).zimbra
        assert runtime.for_identity(a).zimbra._attachment_converter.markitdown is None
    finally:
        await runtime.close()


async def test_actual_mcp_callbacks_handle_sync_catalog_reads_and_local_email_drafts(monkeypatch):
    from unified_mcp_server.server import create_server, PostgresStore
    from unified_mcp_server.catalog.service import CatalogService
    monkeypatch.setattr(PostgresStore, "from_env", lambda: None)
    settings = ServerSettings.from_env({})
    server = create_server(settings)
    owner = SimpleNamespace(user_id="user-a", zimbra_email="a@example.test", zimbra_token="fixture-token", session_id="app-a")
    store = SimpleNamespace(get_app_session=lambda _id: owner, close=lambda: None)
    runtime = Runtime.create(settings, accounts=SimpleNamespace(count=lambda: 0), postgres=store)
    event_thread = threading.get_ident()
    def records(*_args, **_kwargs):
        assert threading.get_ident() != event_thread
        return {"items": [], "total": 0}
    runtime.catalog = CatalogService(SimpleNamespace(list_records=records), settings.splunk)
    context = SimpleNamespace(request_context=SimpleNamespace(
        lifespan_context=runtime, meta={"soc_session_id": "app-a", "soc_investigation_id": "case-a"},
    ))
    before = operation_context.get()
    try:
        listed = await server._tool_manager.get_tool("catalog_list_rules").fn(context)
        assert listed["ok"] is True
        assert listed["data"] == {"items": [], "total": 0}
        draft = await server._tool_manager.get_tool("zimbra_send_email").fn(context, to=["recipient@example.test"], subject="Fixture", body="Draft only")
        assert draft["ok"] is True
        assert operation_context.get() is before
    finally:
        await runtime.close()


async def test_deadline_includes_earlier_stages_and_restores_context():
    before = operation_context.get()
    async with operation_budget(maximum_seconds=1):
        first = remaining_seconds(5)
        await asyncio.sleep(0.01)
        assert remaining_seconds(5) < first
        assert remaining_seconds(0.001) == 0.001
    assert operation_context.get() is before
    with pytest.raises(ServiceError) as error:
        async with operation_budget(maximum_seconds=0.01):
            await asyncio.Event().wait()
    assert error.value.code == "operation_timeout"


async def test_cancelled_blocking_wait_does_not_release_busy_provider_slot():
    pool = BlockingIO(limit=2, per_principal=1)
    started, release = threading.Event(), threading.Event()
    def slow():
        started.set()
        release.wait(2)
    first = asyncio.create_task(pool.run(slow, principal="a"))
    while not started.is_set():
        await asyncio.sleep(0)
    first.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first
    second = asyncio.create_task(pool.run(lambda: "done", principal="a"))
    await asyncio.sleep(0)
    assert not second.done()
    assert await pool.run(lambda: "independent", principal="b") == "independent"
    release.set()
    assert await second == "done"
    assert pool.users == {}


async def test_interactive_search_gets_next_free_slot_before_waiting_scheduled_work():
    from dataclasses import replace
    from unified_mcp_server.splunk.search.resource_manager import SearchResourceManager
    from unified_mcp_server.splunk.search.resource_policy import SearchResourceConfig
    manager = SearchResourceManager(SearchResourceConfig(global_concurrency=1, per_principal_concurrency=1, queue_timeout_seconds=1))
    admitted = []
    async def work(name, workload):
        token = operation_context.set(replace(operation_context.get(), workload=workload))
        try:
            async with manager.acquire(principal=name, cost_class="cheap", weight=1, budget_cost=1):
                admitted.append(name)
                await asyncio.sleep(0)
        finally:
            operation_context.reset(token)
    async with manager.acquire(principal="occupied", cost_class="cheap", weight=1, budget_cost=1):
        scheduled = asyncio.create_task(work("scheduled", "scheduled"))
        interactive = asyncio.create_task(work("interactive", "interactive"))
        while manager.snapshot()["queued_splunk_searches"] < 2:
            await asyncio.sleep(0)
    await asyncio.gather(scheduled, interactive)
    assert admitted == ["interactive", "scheduled"]
    assert manager._waiters == []


async def test_only_transient_reads_are_retried_once():
    import httpx
    from unified_mcp_server.splunk.splunk_client import SplunkClient
    client = SplunkClient({"splunk_host": "fixture.invalid", "splunk_port": 8089})
    calls = []
    async def get(*_args, **_kwargs):
        calls.append("get")
        if len(calls) == 1:
            raise httpx.ConnectError("offline fixture")
        return SimpleNamespace(status_code=200)
    client._client = SimpleNamespace(get=get)
    assert (await client._get("/fixture")).status_code == 200
    assert calls == ["get", "get"]


async def test_splunk_dispatch_itself_is_bounded_by_the_job_budget():
    from unified_mcp_server.splunk.splunk_client import SplunkClient, SplunkAPIError
    client = SplunkClient({"splunk_host": "fixture.invalid", "splunk_port": 8089})
    stopped = asyncio.Event()
    async def dispatch(*_args, **_kwargs):
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()
    client._client = SimpleNamespace(post=dispatch)
    with pytest.raises(SplunkAPIError) as error:
        await asyncio.wait_for(client._run_job(dispatch_url="/fixture", dispatch_params={}, max_count=1,
                                               results_path_prefix="/fixture", label="fixture", runtime_limit=0.01), 1)
    assert error.value.code == "runtime_limit_exceeded"
    assert stopped.is_set()


def test_scheduled_relative_window_uses_original_run_time():
    from dataclasses import replace
    from unified_mcp_server.splunk.search.evidence import resolve_time_window
    token = operation_context.set(replace(operation_context.get(), scheduled_at=1700000000))
    try:
        start, end, resolved = resolve_time_window("-24h", "now")
        assert (float(start), float(end), resolved) == (1700000000 - 86400, 1700000000, True)
        assert resolve_time_window("-1d@d", "now")[2] is False
    finally:
        operation_context.reset(token)


async def test_zimbra_checks_the_remaining_budget_at_each_soap_boundary(monkeypatch):
    from dataclasses import replace
    import importlib
    zimbra = importlib.import_module("unified_mcp_server.zimbra.zimbra")
    timeouts = []
    class Client:
        def __init__(self, *_args, **kwargs):
            timeouts.append(kwargs["timeout"])
        def _request_once(self, *_args, **_kwargs):
            return "fixture"
    monkeypatch.setattr(zimbra, "_TokenClient", Client)
    async with operation_budget(maximum_seconds=0.5):
        assert zimbra.soap_request("fixture.invalid", "<test/>") == "fixture"
        assert 0 < timeouts[0] <= 0.5
        token = operation_context.set(replace(operation_context.get(), deadline=0))
        try:
            with pytest.raises(ServiceError, match="deadline"):
                zimbra.soap_request("fixture.invalid", "<test/>")
            assert len(timeouts) == 1
        finally:
            operation_context.reset(token)
