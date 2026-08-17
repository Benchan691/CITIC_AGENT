from __future__ import annotations

from types import SimpleNamespace

import unified_mcp_server.settings_store as module
from unified_mcp_server.settings_store import SettingsStore


class FakeConnection:
    payload = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=()):
        if query.lstrip().upper().startswith("SELECT"):
            return SimpleNamespace(fetchone=lambda: (self.payload,) if self.payload else None)
        if query.lstrip().upper().startswith("INSERT"):
            self.payload = params[1]
        return SimpleNamespace(fetchone=lambda: None)


def test_settings_store_encrypts_and_round_trips(monkeypatch):
    connection = FakeConnection()
    monkeypatch.setattr(module, "psycopg", SimpleNamespace(connect=lambda _uri: connection))

    store = SettingsStore("postgresql://example.test/settings", "test-encryption-key")
    store.save(
        {
            "splunk": {"url": "http://127.0.0.1:8089", "password": "splunk-secret"},
            "models": {"deepseek": {"api_key": "model-secret"}},
        }
    )

    assert "splunk-secret" not in connection.payload
    assert "model-secret" not in connection.payload
    assert store.load() == {
        "splunk": {"password": "splunk-secret", "url": "http://127.0.0.1:8089"},
        "models": {"deepseek": {"api_key": "model-secret"}},
    }
