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




async def test_actual_mcp_callback_handles_local_email_drafts(monkeypatch):
    from unified_mcp_server.server import create_server, PostgresStore
    monkeypatch.setattr(PostgresStore, "from_env", lambda: None)
    settings = ServerSettings.from_env({})
    server = create_server(settings)
    owner = SimpleNamespace(user_id="user-a", zimbra_email="a@example.test", zimbra_token="fixture-token", session_id="app-a")
    store = SimpleNamespace(get_app_session=lambda _id: owner, close=lambda: None)
    runtime = Runtime.create(settings, accounts=SimpleNamespace(count=lambda: 0), postgres=store)
    context = SimpleNamespace(request_context=SimpleNamespace(
        lifespan_context=runtime, meta={"soc_session_id": "app-a", "soc_investigation_id": "case-a"},
    ))
    before = operation_context.get()
    try:
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
