import asyncio
import json
from types import SimpleNamespace

import pytest

import unified_mcp_server.admin_cli as module
from unified_mcp_server.errors import ServiceError


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

    assert result == {"ok": True}
    assert captured == {"settings": "subscription-settings", "closed": True}


def test_admin_service_settings_are_status_only(monkeypatch):
    monkeypatch.setattr(
        module,
        "_settings",
        lambda _store: SimpleNamespace(
            splunk=SimpleNamespace(configured=True),
            zimbra=SimpleNamespace(configured=False),
            markitdown=SimpleNamespace(),
            email_server=SimpleNamespace(configured=True),
        ),
    )

    class Store:
        def list_config(self):
            raise AssertionError("admin status must not read persisted service configuration")

    result = module._public_settings(Store())

    assert result == {
        "services": {
            "splunk": {"status": "ready"},
            "zimbra": {"status": "not_configured"},
            "markitdown": {"status": "ready"},
            "subscription_server": {"status": "ready"},
            "alert_email": {"status": "disabled", "enabled": False, "configured": False},
        }
    }


def test_splunk_connection_test_requires_the_mcp_endpoint(monkeypatch):
    monkeypatch.setattr(
        module,
        "_settings",
        lambda _store: SimpleNamespace(splunk=SimpleNamespace(mcp_endpoint="")),
    )

    with pytest.raises(ServiceError, match="SPLUNK_MCP_ENDPOINT"):
        asyncio.run(module.test_splunk("store"))


def test_splunk_connection_test_uses_the_mcp_backed_service(monkeypatch):
    captured = {}

    class FakeSearchService:
        async def test_connection(self):
            captured["tested"] = True
            return {"connected": True, "index_count": 2}

    class FakeService:
        def __init__(self, settings):
            captured["settings"] = settings
            self.search_service = FakeSearchService()

        async def close(self):
            captured["closed"] = True

    splunk_settings = SimpleNamespace(mcp_endpoint="https://splunk.example.test/services/mcp")
    monkeypatch.setattr(module, "_settings", lambda _store: SimpleNamespace(splunk=splunk_settings))
    monkeypatch.setattr(module, "SplunkService", FakeService)

    assert asyncio.run(module.test_splunk("store")) == {"ok": True}
    assert captured == {"settings": splunk_settings, "tested": True, "closed": True}


def test_service_setting_writes_are_disabled():
    class Store:
        def __init__(self):
            self.writes = []

        def set_config(self, key, value):
            self.writes.append((key, value))

        def delete_config(self, key):
            self.writes.append(("delete", key))

    store = Store()

    with pytest.raises(RuntimeError, match=r"server \.env file"):
        module.update_settings(store, {"splunk": {"url": "https://splunk.example.test"}})
    with pytest.raises(RuntimeError, match=r"server \.env file"):
        module.delete_setting(store, "splunk.url")

    assert store.writes == []


def test_service_errors_are_emitted_as_safe_structured_diagnostics(capsys):
    module._write_service_error(ServiceError(
        "splunk_api_error",
        "Could not initialize the official Splunk MCP connection.",
        details={
            "status_code": 502,
            "missing_environment_variables": ["SPLUNK_MCP_ENDPOINT"],
            "secret": "must not cross the boundary",
        },
    ))

    stderr = capsys.readouterr().err
    assert stderr.endswith("\n")
    assert json.loads(stderr) == {
        "code": "splunk_api_error",
        "message": "Could not initialize the official Splunk MCP connection.",
        "details": {
            "status_code": 502,
            "missing_environment_variables": ["SPLUNK_MCP_ENDPOINT"],
        },
    }


def test_receive_alert_run_forwards_verified_webhook_context(monkeypatch):
    captured = {}

    class FakeStore:
        def receive_alert_run(self, payload, *, authenticated_deployment=None, replay_id=None):
            captured.update(
                payload=payload,
                authenticated_deployment=authenticated_deployment,
                replay_id=replay_id,
            )
            return {"status": "accepted"}

        def close(self):
            captured["closed"] = True

    fake = FakeStore()
    monkeypatch.setattr(module.AlertIngestionStore, "from_env", staticmethod(lambda: fake))

    payload = {
        "deployment": "splunk-prod",
        "_authenticated_deployment": "splunk-prod",
        "_authenticated_replay_id": "replay-1",
    }
    assert module.receive_alert_run("store", payload) == {"status": "accepted"}
    assert captured == {
        "payload": payload,
        "authenticated_deployment": "splunk-prod",
        "replay_id": "replay-1",
        "closed": True,
    }
