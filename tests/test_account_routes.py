from pathlib import Path

from starlette.testclient import TestClient

import unified_mcp_server.zimbra_service as zimbra_module
import unified_mcp_server.server as server_module
from unified_mcp_server.config import ServerSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.server import create_server


class FakeSplunkService:
    def __init__(self, _settings):
        pass

    async def test_connection(self):
        return {"connected": True, "index_count": 3}

    async def close(self):
        pass

    async def update_settings(self, _settings):
        pass


class FailingSplunkService(FakeSplunkService):
    async def test_connection(self):
        raise ServiceError("splunk_api_error", "Splunk is unavailable.")


class UnexpectedSplunkService(FakeSplunkService):
    async def test_connection(self):
        raise RuntimeError("unexpected connection failure")


def test_account_routes_return_safe_metadata_and_store_encrypted_credentials(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(zimbra_module, "zimbra_login", lambda cfg: "token")
    settings = ServerSettings.from_env(
        {
            "ZIMBRA_HOST": "mail.example.com",
            "ZIMBRA_ACCOUNTS_FILE": str(tmp_path / "accounts.enc"),
            "ZIMBRA_ACCOUNTS_KEY_FILE": str(tmp_path / "accounts.key"),
            "ZIMBRA_ACCOUNT_API_KEY": "test-key",
        }
    )
    app = create_server(settings).streamable_http_app()

    with TestClient(app) as client:
        headers = {"X-Account-Api-Key": "test-key"}
        response = client.post(
            "/api/accounts",
            headers=headers,
            json={"label": "Work", "email": "work@example.com", "username": "work-user", "password": "secret"},
        )
        assert response.status_code == 201
        account = response.json()["account"]
        assert "password" not in response.text

        listed = client.get("/api/accounts", headers=headers).json()["accounts"]
        assert listed == [account]

    assert b"secret" not in (tmp_path / "accounts.enc").read_bytes()


def test_splunk_test_route_returns_safe_success(monkeypatch):
    monkeypatch.setattr(server_module, "SplunkService", FakeSplunkService)
    settings = ServerSettings.from_env(
        {
            "SPLUNK_HOST": "splunk.example.com",
            "SPLUNK_TOKEN": "splunk-secret",
            "ZIMBRA_ACCOUNT_API_KEY": "test-key",
        }
    )
    app = create_server(settings).streamable_http_app()

    with TestClient(app) as client:
        response = client.post("/api/splunk/test", headers={"X-Account-Api-Key": "test-key"})

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "service": "splunk",
        "host": "splunk.example.com",
        "index_count": 3,
    }
    assert "splunk-secret" not in response.text


def test_splunk_test_route_reports_configuration_failure_without_secrets():
    settings = ServerSettings.from_env({"ZIMBRA_ACCOUNT_API_KEY": "test-key"})
    app = create_server(settings).streamable_http_app()

    with TestClient(app) as client:
        response = client.post("/api/splunk/test", headers={"X-Account-Api-Key": "test-key"})

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "not_configured"
    assert "password" not in response.text.lower()


def test_splunk_test_route_reports_upstream_failure(monkeypatch):
    monkeypatch.setattr(server_module, "SplunkService", FailingSplunkService)
    settings = ServerSettings.from_env({"ZIMBRA_ACCOUNT_API_KEY": "test-key"})
    app = create_server(settings).streamable_http_app()

    with TestClient(app) as client:
        response = client.post("/api/splunk/test", headers={"X-Account-Api-Key": "test-key"})

    assert response.status_code == 502
    assert response.json()["error"] == {
        "code": "splunk_api_error",
        "message": "Splunk is unavailable.",
    }


def test_splunk_test_route_reports_unexpected_failure_with_cors(monkeypatch):
    monkeypatch.setattr(server_module, "SplunkService", UnexpectedSplunkService)
    settings = ServerSettings.from_env({"ZIMBRA_ACCOUNT_API_KEY": "test-key"})
    app = create_server(settings).streamable_http_app()

    with TestClient(app) as client:
        response = client.post(
            "/api/splunk/test",
            headers={"X-Account-Api-Key": "test-key", "Origin": "http://localhost:3000"},
        )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "splunk_connection_failed"
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_splunk_test_route_requires_authorization():
    settings = ServerSettings.from_env({"ZIMBRA_ACCOUNT_API_KEY": "test-key"})
    app = create_server(settings).streamable_http_app()

    with TestClient(app) as client:
        response = client.post("/api/splunk/test")

    assert response.status_code == 403


def test_loopback_ui_origin_on_another_port_is_allowed(monkeypatch):
    monkeypatch.setattr(server_module, "SplunkService", FakeSplunkService)
    settings = ServerSettings.from_env({"ZIMBRA_ACCOUNT_API_KEY": "test-key"})
    app = create_server(settings).streamable_http_app()

    with TestClient(app) as client:
        response = client.post(
            "/api/splunk/test",
            headers={
                "X-Account-Api-Key": "test-key",
                "Origin": "http://[::1]:3001",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://[::1]:3001"


class FakeSettingsStore:
    data = {}

    def __init__(self, _uri, _key):
        pass

    def load(self):
        return dict(self.data)

    def save(self, settings):
        self.data = settings


def test_settings_route_persists_and_redacts_credentials(monkeypatch):
    FakeSettingsStore.data = {}
    monkeypatch.setattr(server_module, "SettingsStore", FakeSettingsStore)
    monkeypatch.setattr(server_module, "SplunkService", FakeSplunkService)
    settings = ServerSettings.from_env(
        {
            "APP_POSTGRES_URI": "postgresql://example.test/settings",
            "APP_SETTINGS_ENCRYPTION_KEY": "test-key",
            "ZIMBRA_ACCOUNT_API_KEY": "test-key",
        }
    )
    app = create_server(settings).streamable_http_app()

    with TestClient(app) as client:
        headers = {"X-Account-Api-Key": "test-key"}
        response = client.put(
            "/api/settings",
            headers=headers,
            json={
                "splunk": {
                    "url": "http://127.0.0.1:8089",
                    "username": "admin",
                    "password": "splunk-secret",
                },
                "model": {"provider": "deepseek", "api_key": "model-secret"},
            },
        )
        assert response.status_code == 200
        assert "splunk-secret" not in response.text
        assert "model-secret" not in response.text
        assert response.json()["splunk"]["has_password"] is True
        assert response.json()["model"]["providers"][0]["configured"] is True

        stored = client.get("/api/settings", headers=headers).json()
        assert stored["splunk"]["url"] == "http://127.0.0.1:8089"
        assert stored["splunk"]["username"] == "admin"
        assert "password" not in stored["splunk"]
