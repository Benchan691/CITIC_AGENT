from __future__ import annotations

from types import SimpleNamespace

import pytest

import unified_mcp_server.postgres_store as module
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.config import ServerSettings
from unified_mcp_server.postgres_store import PostgresStore


class FakeConnection:
    def __init__(self):
        self.config: dict[str, str] = {}
        self.accounts: dict[str, dict[str, str]] = {}
        self.bootstrap: set[str] = set()
        self.dropped_tables: list[str] = []
        self.schema_queries: list[str] = []
        self.fail_drop: str | None = None
        self._transaction_snapshot = None

    def __enter__(self):
        self._transaction_snapshot = (set(self.bootstrap), list(self.dropped_tables))
        return self

    def __exit__(self, exc_type, *_args):
        if exc_type is not None and self._transaction_snapshot is not None:
            self.bootstrap, self.dropped_tables = self._transaction_snapshot
        self._transaction_snapshot = None
        return False

    def execute(self, query, params=()):
        upper = " ".join(query.strip().upper().split())
        if upper.startswith("CREATE TABLE"):
            self.schema_queries.append(upper)
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if upper.startswith("INSERT INTO SOC_BOOTSTRAP"):
            marker = params[0]
            inserted = marker not in self.bootstrap
            self.bootstrap.add(marker)
            self.schema_queries.append(upper)
            return SimpleNamespace(fetchone=lambda: (marker,) if inserted else None, fetchall=lambda: [])
        if upper.startswith("DROP TABLE IF EXISTS"):
            assert "CASCADE" not in upper
            table = upper.split()[-1].lower()
            self.dropped_tables.append(table)
            self.schema_queries.append(upper)
            if table == self.fail_drop:
                raise RuntimeError("unexpected external dependency")
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


def test_catalog_removal_migration_is_atomic_ordered_and_one_time(monkeypatch):
    connection = FakeConnection()
    monkeypatch.setattr(module, "psycopg", SimpleNamespace(connect=lambda _uri, **_kwargs: connection))

    PostgresStore("postgresql://example.test/settings", "test-encryption-key")

    assert connection.bootstrap == {module._CATALOG_REMOVAL_MARKER}
    assert connection.dropped_tables == list(module._CATALOG_TABLES)
    first_run_queries = list(connection.schema_queries)

    PostgresStore("postgresql://example.test/settings", "test-encryption-key")

    assert connection.dropped_tables == list(module._CATALOG_TABLES)
    assert len(connection.schema_queries) == len(first_run_queries) + 10


def test_catalog_removal_migration_rolls_back_marker_and_drops(monkeypatch):
    connection = FakeConnection()
    connection.fail_drop = "soc_catalog_history"
    monkeypatch.setattr(module, "psycopg", SimpleNamespace(connect=lambda _uri, **_kwargs: connection))

    with pytest.raises(RuntimeError, match="external dependency"):
        PostgresStore("postgresql://example.test/settings", "test-encryption-key")

    assert module._CATALOG_REMOVAL_MARKER not in connection.bootstrap
    assert connection.dropped_tables == []

    connection.fail_drop = None
    PostgresStore("postgresql://example.test/settings", "test-encryption-key")
    assert connection.bootstrap == {module._CATALOG_REMOVAL_MARKER}
    assert connection.dropped_tables == list(module._CATALOG_TABLES)


def test_postgres_store_round_trips_config_and_accounts(monkeypatch):
    connection = FakeConnection()
    monkeypatch.setattr(module, "psycopg", SimpleNamespace(connect=lambda _uri, **_kwargs: connection))

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
