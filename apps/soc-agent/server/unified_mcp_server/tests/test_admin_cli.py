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
        }
    }


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
        "Could not reach Splunk at the configured URL. Check SPLUNK_URL and network access.",
        details={
            "status_code": 502,
            "missing_environment_variables": ["SPLUNK_URL"],
            "secret": "must not cross the boundary",
        },
    ))

    stderr = capsys.readouterr().err
    assert stderr.endswith("\n")
    assert json.loads(stderr) == {
        "code": "splunk_api_error",
        "message": "Could not reach Splunk at the configured URL. Check SPLUNK_URL and network access.",
        "details": {
            "status_code": 502,
            "missing_environment_variables": ["SPLUNK_URL"],
        },
    }
