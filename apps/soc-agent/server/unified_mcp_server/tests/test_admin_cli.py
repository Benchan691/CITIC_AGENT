import asyncio
from types import SimpleNamespace

import unified_mcp_server.admin_cli as module


def test_subscription_server_connection_test_closes_service(monkeypatch):
    captured = {}

    class FakeService:
        def __init__(self, settings):
            captured["settings"] = settings

        async def test_connection(self):
            return {"ok": True, "url": "http://subscription.example.test", "subscription_count": 2}

        async def close(self):
            captured["closed"] = True

    monkeypatch.setattr(
        module,
        "_settings",
        lambda _store: SimpleNamespace(email_server="subscription-settings"),
    )
    monkeypatch.setattr(module, "EmailSubscriptionService", FakeService)

    result = asyncio.run(module.test_subscription_server("store"))

    assert result == {"ok": True, "url": "http://subscription.example.test", "subscription_count": 2}
    assert captured == {"settings": "subscription-settings", "closed": True}
