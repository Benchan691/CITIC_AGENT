from __future__ import annotations

from types import SimpleNamespace

import unified_mcp_server.postgres_store as module
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.config import ServerSettings
from unified_mcp_server.postgres_store import PostgresStore


class FakeConnection:
    def __init__(self):
        self.config: dict[str, str] = {}
        self.accounts: dict[str, dict[str, str]] = {}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=()):
        upper = " ".join(query.strip().upper().split())
        if upper.startswith("CREATE TABLE"):
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if upper.startswith("SELECT VALUE_ENCRYPTED FROM APP_CONFIG"):
            value = self.config.get(params[0])
            return SimpleNamespace(fetchone=lambda: (value,) if value else None, fetchall=lambda: [])
        if upper.startswith("SELECT KEY, VALUE_ENCRYPTED FROM APP_CONFIG"):
            rows = sorted(self.config.items())
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: rows)
        if upper.startswith("INSERT INTO APP_CONFIG"):
            self.config[params[0]] = params[1]
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if upper.startswith("DELETE FROM APP_CONFIG"):
            removed = self.config.pop(params[0], None)
            return SimpleNamespace(fetchone=lambda: (params[0],) if removed else None, fetchall=lambda: [])
        if upper.startswith("SELECT ID, LABEL, EMAIL, USERNAME, PASSWORD_ENCRYPTED FROM ZIMBRA_ACCOUNTS WHERE ID ="):
            row = self.accounts.get(params[0])
            value = None if row is None else (
                row["id"],
                row["label"],
                row["email"],
                row["username"],
                row["password_encrypted"],
            )
            return SimpleNamespace(fetchone=lambda: value, fetchall=lambda: [])
        if upper.startswith("SELECT ID, LABEL, EMAIL, USERNAME, PASSWORD_ENCRYPTED FROM ZIMBRA_ACCOUNTS"):
            rows = [
                (row["id"], row["label"], row["email"], row["username"], row["password_encrypted"])
                for row in self.accounts.values()
            ]
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: rows)
        if upper.startswith("SELECT COUNT(*) FROM ZIMBRA_ACCOUNTS"):
            return SimpleNamespace(fetchone=lambda: (len(self.accounts),), fetchall=lambda: [])
        if upper.startswith("INSERT INTO ZIMBRA_ACCOUNTS"):
            self.accounts[params[0]] = {
                "id": params[0],
                "label": params[1],
                "email": params[2],
                "username": params[3],
                "password_encrypted": params[4],
            }
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if upper.startswith("UPDATE ZIMBRA_ACCOUNTS"):
            row = self.accounts[params[5]]
            row["label"] = params[0]
            row["email"] = params[1]
            row["username"] = params[2]
            row["password_encrypted"] = params[3]
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if upper.startswith("DELETE FROM ZIMBRA_ACCOUNTS"):
            removed = self.accounts.pop(params[0], None)
            return SimpleNamespace(fetchone=lambda: (params[0],) if removed else None, fetchall=lambda: [])
        raise AssertionError(f"Unhandled query: {query}")


def test_postgres_store_round_trips_config_and_accounts(monkeypatch):
    connection = FakeConnection()
    monkeypatch.setattr(module, "psycopg", SimpleNamespace(connect=lambda _uri: connection))

    store = PostgresStore("postgresql://example.test/settings", "test-encryption-key")
    store.set_config("SPLUNK_URL", "http://127.0.0.1:8089")
    store.set_config("SPLUNK_PASSWORD", "splunk-secret")
    account = store.add_account(
        label="Inbox",
        email="analyst@example.com",
        username="analyst",
        password="mail-secret",
    )

    assert "splunk-secret" not in connection.config["SPLUNK_PASSWORD"]
    assert "mail-secret" not in connection.accounts[account.id]["password_encrypted"]
    assert store.get_config("SPLUNK_URL") == "http://127.0.0.1:8089"
    assert store.get_account(account.id).password == "mail-secret"
    assert store.count_accounts() == 1


def test_server_settings_reads_postgres_overrides(monkeypatch):
    connection = FakeConnection()
    monkeypatch.setattr(module, "psycopg", SimpleNamespace(connect=lambda _uri: connection))
    store = PostgresStore("postgresql://example.test/settings", "test-encryption-key")
    store.set_configs(
        {
            "SPLUNK_HOST": "splunk.internal",
            "SPLUNK_PORT": "8089",
            "SPLUNK_USERNAME": "admin",
            "SPLUNK_PASSWORD": "secret",
            "SPLUNK_VERIFY_SSL": "false",
            "ZIMBRA_HOST": "mail.internal",
            "ZIMBRA_VERIFY_SSL": "false",
        }
    )

    settings = ServerSettings.from_store(store, {"MCP_TRANSPORT": "stdio"})

    assert settings.splunk.host == "splunk.internal"
    assert settings.splunk.password == "secret"
    assert settings.splunk.verify_ssl is False
    assert settings.zimbra.host == "mail.internal"
    assert settings.zimbra.verify_ssl is False


def test_postgres_store_migrates_file_accounts(monkeypatch, tmp_path):
    connection = FakeConnection()
    monkeypatch.setattr(module, "psycopg", SimpleNamespace(connect=lambda _uri: connection))
    store = PostgresStore("postgresql://example.test/settings", "test-encryption-key")
    file_store = AccountStore(str(tmp_path / "accounts.enc"), str(tmp_path / "accounts.key"))
    file_store.add(label="Ops", email="ops@example.com", username="ops", password="pw1")

    imported = store.migrate_account_store(file_store)

    assert imported == 1
    assert store.count_accounts() == 1
