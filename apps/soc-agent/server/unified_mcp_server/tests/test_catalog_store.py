from types import SimpleNamespace

import psycopg
import pytest

import unified_mcp_server.catalog.store as store_module
from unified_mcp_server.catalog.store import CatalogStore
from unified_mcp_server.errors import ServiceError


class FakeConnection:
    """Pattern-matching stand-in for psycopg connections (see test_postgres_store)."""

    def __init__(self):
        self.tables: dict[str, list[dict]] = {}
        self.migrations: list[tuple] = []
        self.history: list[tuple] = []
        self.sequences = {"transaction": 0}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def transaction(self):
        from contextlib import nullcontext

        return nullcontext()

    # -- helpers ------------------------------------------------------------

    @staticmethod
    def _upper(query: str) -> str:
        return " ".join(query.strip().upper().split())

    @staticmethod
    def _column_list(section: str) -> list[str]:
        return [item.strip().strip('"') for item in section.split(",") if item.strip()]

    def _row_tuple(self, row: dict, columns: list[str]):
        return tuple(row.get(column) for column in columns)

    # -- execution ----------------------------------------------------------

    def execute(self, query, params=()):
        sql = self._upper(query)
        self.executed = sql  # last statement, for debugging failures

        if sql.startswith("CREATE TABLE IF NOT EXISTS SOC_CATALOG_MIGRATIONS"):
            self.tables.setdefault("migrations", [])
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if sql.startswith("SELECT VERSION FROM SOC_CATALOG_MIGRATIONS"):
            rows = [(version,) for version, _name in self.migrations]
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: rows)
        if sql.startswith("INSERT INTO SOC_CATALOG_MIGRATIONS"):
            self.migrations.append((params[0], params[1]))
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if sql.startswith("CREATE"):
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])

        if sql.startswith("INSERT INTO SOC_CUSTOMER"):
            columns = self._column_list(query.split("(", 1)[1].split(")")[0])
            row = dict(zip(columns, params))
            for existing in self.tables.setdefault("soc_customer", []):
                if existing["customer_code"] == row["customer_code"]:
                    raise psycopg.errors.UniqueViolation(
                        'duplicate key value violates unique constraint "soc_customer_customer_code_key"'
                    )
            row.setdefault("archived_at", None)
            row.setdefault("created_at", "2026-01-01T00:00:00+00:00")
            row.setdefault("updated_at", row["created_at"])
            row["revision"] = int(row.get("revision", 1))
            self.tables["soc_customer"].append(row)
            returning = self._column_list(query.split("RETURNING ")[1])
            return SimpleNamespace(fetchone=lambda: self._row_tuple(row, returning), fetchall=lambda: [])

        if sql.startswith("INSERT INTO SOC_CATALOG_HISTORY"):
            self.history.append(params)
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])

        if sql.startswith("SELECT") and " FROM SOC_CUSTOMER WHERE CUSTOMER_ID =" in sql:
            returning = self._column_list(query.split("SELECT ")[1].split(" FROM")[0])
            matches = [row for row in self.tables.get("soc_customer", []) if row["customer_id"] == params[0]]
            found = matches[0] if matches else None
            return SimpleNamespace(fetchone=lambda: self._row_tuple(found, returning) if found else None)

        if sql.startswith("UPDATE SOC_CUSTOMER SET"):
            set_section = query.split("SET ", 1)[1].split(" WHERE", 1)[0]
            assignments = [item.strip() for item in set_section.split(",")]
            explicit = [item.split(" = ")[0].strip() for item in assignments if "%s" in item]
            where_clause = query.split(" WHERE ", 1)[1]
            record_id = params[len(explicit)]
            revision = int(params[len(explicit) + 1])
            matches = [row for row in self.tables.get("soc_customer", []) if row["customer_id"] == record_id]
            if not matches:
                return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
            row = matches[0]
            if row["revision"] != revision:
                return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
            for column, value in zip(explicit, params):
                row[column] = value
            row["revision"] = row["revision"] + 1
            returning = self._column_list(query.split("RETURNING ")[1])
            return SimpleNamespace(fetchone=lambda: self._row_tuple(row, returning), fetchall=lambda: [])

        raise AssertionError(f"Unhandled query: {query}")


@pytest.fixture()
def store(monkeypatch):
    connection = FakeConnection()
    monkeypatch.setattr(store_module, "psycopg", SimpleNamespace(connect=lambda _uri, **_kwargs: connection, errors=psycopg.errors))
    return CatalogStore("postgresql://example.test/catalog"), connection


def test_bootstrap_records_the_initial_migration(store):
    catalog_store, connection = store
    assert catalog_store.pending_migrations()[0]["version"] == 2
    assert [version for version, _name in connection.migrations] == [1]


def test_create_customer_writes_history_in_one_transaction(store):
    catalog_store, connection = store
    record = catalog_store.create_record(
        "customer",
        {
            "customer_code": "fubon",
            "display_name": "Fubon Securities",
            "tenant_number": "41228",
            "gid": "50176",
            "lifecycle_status": "active",
            "notes": "",
        },
        actor="analyst-1",
    )
    assert record["customer_code"] == "fubon"
    assert record["revision"] == 1
    assert record["archived"] is False
    assert len(connection.history) == 1
    catalog_name, record_id, revision, action, actor = connection.history[0][:5]
    assert (catalog_name, record_id, revision, action, actor) == (
        "customer",
        record["record_id"],
        1,
        "create",
        "analyst-1",
    )


def test_update_rejects_stale_revision_and_writes_history_when_current(store):
    catalog_store, connection = store
    record = catalog_store.create_record(
        "customer",
        {"customer_code": "fubon", "display_name": "Fubon", "lifecycle_status": "active"},
        actor="analyst-1",
    )

    with pytest.raises(ServiceError) as caught:
        catalog_store.update_record(
            "customer",
            record["record_id"],
            {"display_name": "Renamed"},
            expected_revision=99,
            actor="analyst-1",
        )
    assert caught.value.code == "catalog_conflict"

    updated = catalog_store.update_record(
        "customer",
        record["record_id"],
        {"display_name": "Renamed"},
        expected_revision=1,
        actor="analyst-1",
        reason="rename",
    )
    assert updated["revision"] == 2
    assert updated["display_name"] == "Renamed"
    assert len(connection.history) == 2
    assert connection.history[-1][3] == "update"


def test_duplicate_customer_code_maps_to_a_field_error(store):
    catalog_store, _connection = store
    values = {"customer_code": "fubon", "display_name": "Fubon", "lifecycle_status": "active"}
    catalog_store.create_record("customer", values, actor="analyst-1")
    with pytest.raises(ServiceError) as caught:
        catalog_store.create_record("customer", values, actor="analyst-2")
    assert caught.value.code == "duplicate_record"
    assert caught.value.details["field"] == "customer_code"


def test_real_database_round_trip_when_configured(monkeypatch):
    """Optional integration check: set CATALOG_STORE_TEST_URI to a disposable database."""
    import os

    uri = os.environ.get("CATALOG_STORE_TEST_URI", "").strip()
    if not uri:
        pytest.skip("CATALOG_STORE_TEST_URI is not configured")
    import uuid

    catalog_store = CatalogStore(uri)
    record = catalog_store.create_record(
        "customer",
        {
            "customer_code": uuid.uuid4().hex[:16],
            "display_name": "Store integration",
            "lifecycle_status": "active",
        },
        actor="integration-test",
    )
    fetched = catalog_store.get_record("customer", record["record_id"])
    assert fetched is not None and fetched["customer_code"] == record["customer_code"]
    updated = catalog_store.update_record(
        "customer",
        record["record_id"],
        {"display_name": "Store integration v2"},
        expected_revision=1,
        actor="integration-test",
    )
    assert updated["revision"] == 2
    history = catalog_store.record_history("customer", record["record_id"])
    assert [entry["action"] for entry in history] == ["update", "create"]
