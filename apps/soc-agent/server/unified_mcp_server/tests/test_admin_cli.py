import asyncio
import json
from types import SimpleNamespace

import pytest

import unified_mcp_server.admin_cli as module
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.alert_identity import AlertIdentityError


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


def test_action_context_failure_is_visible_in_run_quarantine(monkeypatch):
    captured = {}
    splunk_settings = SimpleNamespace(
        configured=True,
        deployment_id="splunk-prod",
        detection_app="citic",
        detection_owner="nobody",
    )

    class DetectionService:
        async def get_detection(self, name):
            assert name == "review alert"
            return {
                "name": name,
                "spl": "index=CPC_security | table device",
                "actions": "citic_alert_delivery",
                "stable_id": "splunk-guid-1",
                "fingerprint": "transport-only",
                "splunk_revision": "9",
            }

    class Service:
        def __init__(self, settings):
            assert settings is splunk_settings
            self.detection_service = DetectionService()

        async def close(self):
            captured["service_closed"] = True

    class FakeStore:
        def resolve_alert_action_context(self, payload, **kwargs):
            raise AlertIdentityError("alert_registration_review", "scope requires review")

        def quarantine_alert_run(self, payload, reason):
            captured.update(payload=payload, reason=reason)

        def close(self):
            captured["closed"] = True

    monkeypatch.setattr(module.AlertIngestionStore, "from_env", staticmethod(FakeStore))
    monkeypatch.setattr(module, "_settings", lambda _store: SimpleNamespace(splunk=splunk_settings))
    monkeypatch.setattr(module, "SplunkService", Service)
    payload = {
        "deployment": "splunk-prod",
        "_authenticated_deployment": "splunk-prod",
        "_authenticated_replay_id": "replay-1",
        "sid": "sid-1",
        "alert_name": "review alert",
        "spl": "index=stale_or_wrong",
        "source_indexes": ["stale_or_wrong"],
    }

    with pytest.raises(ServiceError, match="scope requires review"):
        asyncio.run(module.resolve_alert_action_context("store", payload))

    assert captured["payload"]["spl"] == "index=CPC_security | table device"
    assert captured["payload"]["source_indexes"] == []
    assert captured["payload"]["stable_id"] == "splunk-guid-1"
    assert "fingerprint" not in captured["payload"]["definition"]
    assert "alert_registration_review" in captured["reason"]
    assert captured["service_closed"] is True
    assert captured["closed"] is True


def test_action_context_rejects_missing_live_delivery_action(monkeypatch):
    captured = {}
    splunk_settings = SimpleNamespace(
        configured=True,
        deployment_id="splunk-prod",
        detection_app="citic",
        detection_owner="nobody",
    )

    class DetectionService:
        async def get_detection(self, _name):
            return {"name": "alert", "spl": "index=CPC_security", "actions": "email"}

    class Service:
        def __init__(self, _settings):
            self.detection_service = DetectionService()

        async def close(self):
            captured["service_closed"] = True

    class FakeStore:
        def quarantine_alert_run(self, payload, reason):
            captured.update(payload=payload, reason=reason)

        def close(self):
            captured["store_closed"] = True

    monkeypatch.setattr(module, "_settings", lambda _store: SimpleNamespace(splunk=splunk_settings))
    monkeypatch.setattr(module, "SplunkService", Service)
    monkeypatch.setattr(module.AlertIngestionStore, "from_env", staticmethod(FakeStore))

    with pytest.raises(ServiceError, match="does not have"):
        asyncio.run(module.resolve_alert_action_context("store", {
            "deployment": "splunk-prod",
            "_authenticated_deployment": "splunk-prod",
            "_authenticated_replay_id": "replay-2",
            "sid": "sid-2",
            "alert_name": "alert",
        }))

    assert "alert_action_missing" in captured["reason"]
    assert captured["service_closed"] is True
    assert captured["store_closed"] is True


def test_active_index_ownership_is_verified_against_the_bound_deployment(monkeypatch):
    captured = {}
    splunk_settings = SimpleNamespace(configured=True, deployment_id="splunk-prod")
    monkeypatch.setattr(module, "_settings", lambda _store: SimpleNamespace(splunk=splunk_settings))

    class Core:
        async def request(self, operation):
            class Client:
                async def get_indexes(self):
                    return [{"name": "CPC_security"}, {"name": "_internal"}]
            return await operation(Client())

    class Service:
        def __init__(self, settings):
            assert settings is splunk_settings
            self.core = Core()

        async def close(self):
            captured["service_closed"] = True

    class AlertStore:
        def set_index_ownership(self, **kwargs):
            captured.update(kwargs)
            return {"index_name": kwargs["index_name"], "status": kwargs["status"]}

        def close(self):
            captured["store_closed"] = True

    monkeypatch.setattr(module, "SplunkService", Service)
    monkeypatch.setattr(module.AlertIngestionStore, "from_env", staticmethod(lambda: AlertStore()))

    result = asyncio.run(module.set_alert_index_ownership("store", {
        "deployment": "splunk-prod",
        "index_name": "CPC_security",
        "customer_id": "customer-1",
        "status": "active",
        "actor_id": "admin@example.test",
    }))

    assert result["ownership"] == {"index_name": "CPC_security", "status": "active"}
    assert captured["verification"] == {
        "verified": True,
        "source": "official_splunk_mcp",
        "deployment": "splunk-prod",
        "index_name": "CPC_security",
    }
    assert captured["service_closed"] is True
    assert captured["store_closed"] is True


def test_active_index_ownership_rejects_unknown_or_wrong_deployment(monkeypatch):
    splunk_settings = SimpleNamespace(configured=True, deployment_id="splunk-prod")
    monkeypatch.setattr(module, "_settings", lambda _store: SimpleNamespace(splunk=splunk_settings))

    with pytest.raises(ServiceError, match="does not match"):
        asyncio.run(module.set_alert_index_ownership("store", {
            "deployment": "splunk-other", "index_name": "CPC_security",
            "customer_id": "customer-1", "status": "active",
        }))
