"""PostgreSQL storage for the SOC catalogs.

The store owns the versioned schema (``soc_catalog_migrations``), the three
catalog tables, the append-only history table, publication records, and the
import staging tables. Every mutation writes its record row and history entry
in one transaction and bumps ``revision``; edits based on an outdated revision
are rejected with ``catalog_conflict``. Connections follow the existing
``PostgresStore`` pattern: one fresh connection per call, no pool.
"""

from __future__ import annotations

import json
import types
import uuid
from dataclasses import dataclass
from typing import Any, Callable

from ..errors import ServiceError
from ..postgres_store import PostgresBootstrap, create_connection_pool
from .model import (
    CATALOG_EDITABLE_COLUMNS,
    CATALOG_ID_COLUMNS,
    CATALOG_TABLES,
    RETURNING_COLUMNS,
    ROW_MAPPERS,
)

try:
    import psycopg
except ImportError:  # pragma: no cover - exercised when the optional runtime is absent
    psycopg = None  # type: ignore[assignment]


INITIAL_SCHEMA = """
CREATE TABLE IF NOT EXISTS soc_customer (
    customer_id TEXT PRIMARY KEY,
    customer_code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    tenant_number TEXT NOT NULL DEFAULT '',
    gid TEXT NOT NULL DEFAULT '',
    lifecycle_status TEXT NOT NULL DEFAULT 'active'
        CHECK (lifecycle_status IN ('active', 'provisioning', 'suspended', 'retired')),
    notes TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 1,
    archived_at TIMESTAMPTZ,
    created_by TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS soc_customer_gid_uidx
    ON soc_customer (gid) WHERE gid <> '';

CREATE TABLE IF NOT EXISTS soc_rule_catalog (
    rule_id TEXT PRIMARY KEY,
    rule_number TEXT NOT NULL CHECK (rule_number ~ '^[0-9]{1,4}$'),
    rule_name_en TEXT NOT NULL,
    rule_name_cn TEXT NOT NULL DEFAULT '',
    rule_name_zh TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    description_cn TEXT NOT NULL DEFAULT '',
    description_zh TEXT NOT NULL DEFAULT '',
    remediation_en TEXT NOT NULL DEFAULT '',
    remediation_cn TEXT NOT NULL DEFAULT '',
    remediation_zh TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'info'
        CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'disabled', 'retired')),
    customer_id TEXT REFERENCES soc_customer (customer_id),
    gid TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 1,
    archived_at TIMESTAMPTZ,
    created_by TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soc_rule_catalog_rule_number_idx
    ON soc_rule_catalog (rule_number);

CREATE TABLE IF NOT EXISTS soc_fix_source_type (
    source_type_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES soc_customer (customer_id),
    system_name TEXT NOT NULL,
    fix_source_type_value TEXT NOT NULL,
    default_fix_index TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 1,
    archived_at TIMESTAMPTZ,
    created_by TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT soc_fix_source_type_customer_value_uidx
        UNIQUE (customer_id, fix_source_type_value)
);

CREATE TABLE IF NOT EXISTS soc_catalog_history (
    history_id BIGSERIAL PRIMARY KEY,
    catalog TEXT NOT NULL CHECK (catalog IN ('customer', 'rule', 'fix_source_type')),
    record_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'archive', 'restore', 'publish')),
    actor TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    before_json JSONB,
    after_json JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soc_catalog_history_record_idx
    ON soc_catalog_history (catalog, record_id, changed_at);

CREATE TABLE IF NOT EXISTS soc_catalog_publications (
    publication_id TEXT PRIMARY KEY,
    catalog TEXT NOT NULL CHECK (catalog IN ('customer', 'rule', 'fix_source_type')),
    lookup_name TEXT NOT NULL,
    content_checksum TEXT NOT NULL DEFAULT '',
    destination TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT '',
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'published', 'failed', 'rolled_back')),
    error TEXT NOT NULL DEFAULT '',
    content_snapshot TEXT NOT NULL DEFAULT '',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    replaced_publication_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS soc_catalog_import_batches (
    batch_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT '',
    report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soc_catalog_staging (
    batch_id TEXT NOT NULL REFERENCES soc_catalog_import_batches (batch_id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    payload_json JSONB NOT NULL,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    promoted BOOLEAN NOT NULL DEFAULT FALSE,
    promoted_record_id TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (batch_id, row_number)
);
"""

# The unique rule-number index is intentional deferred: the live Ruleset.csv
# contains duplicate rule numbers, so the constraint may only be applied after
# the reconciliation report has been reviewed and duplicates resolved.
PENDING_MIGRATION_SQL = {
    2: (
        "rule_number_unique",
        "CREATE UNIQUE INDEX IF NOT EXISTS soc_rule_catalog_rule_number_uidx"
        " ON soc_rule_catalog (rule_number);",
    ),
}

# Map database unique-constraint names back to the editable field to highlight.
_UNIQUE_FIELDS = {
    "soc_customer_customer_code_key": "customer_code",
    "soc_customer_gid_uidx": "gid",
    "soc_fix_source_type_customer_value_uidx": "fix_source_type_value",
}

_SEARCH_COLUMNS = {
    "customer": ("customer_code", "display_name", "tenant_number", "gid"),
    "rule": ("rule_number", "rule_name_en", "rule_name_zh", "description_en"),
    "fix_source_type": ("system_name", "fix_source_type_value", "default_fix_index", "description"),
}

_ORDER_COLUMNS = {
    "customer": "customer_code",
    "rule": "rule_number",
    "fix_source_type": "system_name",
}


@dataclass(frozen=True)
class _Spec:
    catalog: str
    table: str
    id_column: str
    editable: tuple[str, ...]
    mapper: Callable[[Any], dict[str, Any]]


def _spec(catalog: str) -> _Spec:
    if catalog not in CATALOG_TABLES:
        raise ServiceError("invalid_input", f"Unknown catalog: {catalog}")
    return _Spec(
        catalog=catalog,
        table=CATALOG_TABLES[catalog],
        id_column=CATALOG_ID_COLUMNS[catalog],
        editable=CATALOG_EDITABLE_COLUMNS[catalog],
        mapper=ROW_MAPPERS[catalog],
    )


class CatalogStore:
    """PostgreSQL persistence for catalog records, history, and publications."""

    def __init__(self, uri: str) -> None:
        if psycopg is None:
            raise ServiceError(
                "not_configured",
                "Catalog storage requires the psycopg package. Install the project dependencies first.",
            )
        self.uri = uri.strip()
        if not self.uri:
            raise ValueError("A PostgreSQL URI is required for catalog storage")
        # Pool only the real psycopg runtime; test doubles replace this
        # module's psycopg reference and must never dial a real database.
        self._pool = (
            create_connection_pool(self.uri)
            if isinstance(psycopg, types.ModuleType)
            else None
        )
        self._ensure_schema()

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "CatalogStore | None":
        bootstrap = PostgresBootstrap.from_env(env)
        if bootstrap is None:
            return None
        return cls(bootstrap.uri)

    def _connect(self):
        if self._pool is not None:
            return self._pool.connection()
        return psycopg.connect(self.uri)

    def _ensure_schema(self) -> None:
        self._apply_script(1, "initial_catalog_schema", INITIAL_SCHEMA)

    def _apply_script(self, version: int, name: str, script: str) -> None:
        if version in self._applied_versions():
            return
        with self._connect() as connection:
            with connection.transaction():
                for statement in filter(None, (part.strip() for part in script.split(";"))):
                    connection.execute(statement)
                connection.execute(
                    "INSERT INTO soc_catalog_migrations (version, name) VALUES (%s, %s)",
                    (version, name),
                )

    def _applied_versions(self) -> set[int]:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS soc_catalog_migrations (
                    version INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            rows = connection.execute("SELECT version FROM soc_catalog_migrations").fetchall()
        return {int(row[0]) for row in rows}

    # -- migrations ---------------------------------------------------------

    def pending_migrations(self) -> list[dict[str, Any]]:
        applied = self._applied_versions()
        return [
            {"version": version, "name": name}
            for version, (name, _sql) in sorted(PENDING_MIGRATION_SQL.items())
            if version not in applied
        ]

    def rule_number_duplicates(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT rule_number, COUNT(*) AS row_count
                FROM soc_rule_catalog
                WHERE archived_at IS NULL
                GROUP BY rule_number
                HAVING COUNT(*) > 1
                ORDER BY rule_number
                """
            ).fetchall()
        return [{"rule_number": str(row[0]), "row_count": int(row[1])} for row in rows]

    def apply_pending_migrations(self) -> list[dict[str, Any]]:
        """Apply deferred migrations after their preconditions are verified."""
        applied: list[dict[str, Any]] = []
        for version, (name, sql) in sorted(PENDING_MIGRATION_SQL.items()):
            if version in self._applied_versions():
                continue
            if version == 2:
                duplicates = self.rule_number_duplicates()
                if duplicates:
                    raise ServiceError(
                        "migration_blocked",
                        "Duplicate rule numbers must be resolved before uniqueness can be enforced.",
                        details={"duplicates": duplicates},
                    )
            with self._connect() as connection:
                with connection.transaction():
                    connection.execute(sql)
                    connection.execute(
                        "INSERT INTO soc_catalog_migrations (version, name) VALUES (%s, %s)",
                        (version, name),
                    )
            applied.append({"version": version, "name": name})
        return applied

    # -- record reads -------------------------------------------------------

    def list_records(
        self,
        catalog: str,
        *,
        search: str = "",
        limit: int = 50,
        offset: int = 0,
        include_archived: bool = False,
    ) -> dict[str, Any]:
        spec = _spec(catalog)
        clause = "WHERE TRUE"
        params: list[Any] = []
        if search.strip():
            like = f"%{search.strip()}%"
            predicates = " OR ".join(
                f"{column}::text ILIKE %s" for column in _SEARCH_COLUMNS[catalog]
            )
            clause += f" AND ({predicates})"
            params.extend([like] * len(_SEARCH_COLUMNS[catalog]))
        if not include_archived:
            clause += " AND archived_at IS NULL"
        limit = max(1, min(int(limit), 500))
        offset = max(0, int(offset))
        with self._connect() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM {spec.table} {clause}", params
            ).fetchone()[0]
            rows = connection.execute(
                f"SELECT {', '.join(RETURNING_COLUMNS[catalog])} FROM {spec.table} {clause}"
                f" ORDER BY {_ORDER_COLUMNS[catalog]} LIMIT %s OFFSET %s",
                [*params, limit, offset],
            ).fetchall()
        return {
            "catalog": catalog,
            "total": int(total),
            "limit": limit,
            "offset": offset,
            "items": [spec.mapper(row) for row in rows],
        }

    def all_records(self, catalog: str, *, include_archived: bool = False) -> list[dict[str, Any]]:
        """Every non-archived record in canonical order; used by publication."""
        spec = _spec(catalog)
        clause = "" if include_archived else "WHERE archived_at IS NULL"
        with self._connect() as connection:
            rows = connection.execute(
                f"SELECT {', '.join(RETURNING_COLUMNS[catalog])} FROM {spec.table} {clause}"
                f" ORDER BY {_ORDER_COLUMNS[catalog]}"
            ).fetchall()
        return [spec.mapper(row) for row in rows]

    def get_record(self, catalog: str, record_id: str) -> dict[str, Any] | None:
        spec = _spec(catalog)
        record_id = _require_id(record_id)
        with self._connect() as connection:
            row = connection.execute(
                f"SELECT {', '.join(RETURNING_COLUMNS[catalog])} FROM {spec.table}"
                f" WHERE {spec.id_column} = %s",
                (record_id,),
            ).fetchone()
        return spec.mapper(row) if row is not None else None

    def require_record(self, catalog: str, record_id: str) -> dict[str, Any]:
        record = self.get_record(catalog, record_id)
        if record is None:
            raise ServiceError(
                "record_not_found",
                "The catalog record no longer exists.",
                details={"catalog": catalog, "record_id": record_id},
            )
        return record

    # -- record mutations ---------------------------------------------------

    def create_record(self, catalog: str, values: dict[str, str], *, actor: str) -> dict[str, Any]:
        spec = _spec(catalog)
        record_id = uuid.uuid4().hex
        columns = (spec.id_column, *spec.editable, "created_by", "updated_by")
        params = [record_id, *(values.get(column, "") for column in spec.editable), actor, actor]
        placeholders = ", ".join(["%s"] * len(columns))
        try:
            with self._connect() as connection:
                with connection.transaction():
                    row = connection.execute(
                        f"INSERT INTO {spec.table} ({', '.join(columns)}) VALUES ({placeholders})"
                        f" RETURNING {', '.join(RETURNING_COLUMNS[catalog])}",
                        params,
                    ).fetchone()
                    self._insert_history(
                        connection,
                        catalog,
                        record_id,
                        revision=1,
                        action="create",
                        actor=actor,
                        before=None,
                        after=spec.mapper(row),
                    )
        except Exception as exc:
            raise self._mutation_error(exc, catalog) from exc
        return spec.mapper(row)

    def update_record(
        self,
        catalog: str,
        record_id: str,
        values: dict[str, str],
        *,
        expected_revision: int,
        actor: str,
        reason: str = "",
    ) -> dict[str, Any]:
        spec = _spec(catalog)
        record_id = _require_id(record_id)
        assignments = ", ".join(f"{column} = %s" for column in spec.editable)
        values_params = [values.get(column, "") for column in spec.editable]
        try:
            with self._connect() as connection:
                with connection.transaction():
                    before_row = connection.execute(
                        f"SELECT {', '.join(RETURNING_COLUMNS[catalog])} FROM {spec.table}"
                        f" WHERE {spec.id_column} = %s FOR UPDATE",
                        (record_id,),
                    ).fetchone()
                    if before_row is None:
                        raise ServiceError(
                            "record_not_found",
                            "The catalog record no longer exists.",
                            details={"catalog": catalog, "record_id": record_id},
                        )
                    before = spec.mapper(before_row)
                    _require_current_revision(before, expected_revision)
                    _require_not_archived(before)
                    row = connection.execute(
                        f"UPDATE {spec.table} SET {assignments},"
                        " revision = revision + 1, updated_by = %s, updated_at = NOW()"
                        f" WHERE {spec.id_column} = %s AND revision = %s"
                        f" RETURNING {', '.join(RETURNING_COLUMNS[catalog])}",
                        [*values_params, actor, record_id, int(expected_revision)],
                    ).fetchone()
                    after = spec.mapper(row)
                    self._insert_history(
                        connection,
                        catalog,
                        record_id,
                        revision=after["revision"],
                        action="update",
                        actor=actor,
                        before=before,
                        after=after,
                        reason=reason,
                    )
        except ServiceError:
            raise
        except Exception as exc:
            raise self._mutation_error(exc, catalog) from exc
        return after

    def set_archived(
        self,
        catalog: str,
        record_id: str,
        *,
        archived: bool,
        expected_revision: int,
        actor: str,
        reason: str = "",
    ) -> dict[str, Any]:
        spec = _spec(catalog)
        record_id = _require_id(record_id)
        action = "archive" if archived else "restore"
        try:
            with self._connect() as connection:
                with connection.transaction():
                    before_row = connection.execute(
                        f"SELECT {', '.join(RETURNING_COLUMNS[catalog])} FROM {spec.table}"
                        f" WHERE {spec.id_column} = %s FOR UPDATE",
                        (record_id,),
                    ).fetchone()
                    if before_row is None:
                        raise ServiceError(
                            "record_not_found",
                            "The catalog record no longer exists.",
                            details={"catalog": catalog, "record_id": record_id},
                        )
                    before = spec.mapper(before_row)
                    _require_current_revision(before, expected_revision)
                    if before["archived"] == archived:
                        raise ServiceError(
                            "invalid_input",
                            "The record is already in the requested state.",
                            details={"catalog": catalog, "record_id": record_id},
                        )
                    if archived:
                        self._require_unreferenced(connection, catalog, record_id)
                    row = connection.execute(
                        f"UPDATE {spec.table}"
                        f" SET archived_at = {'NOW()' if archived else 'NULL'},"
                        " revision = revision + 1, updated_by = %s, updated_at = NOW()"
                        f" WHERE {spec.id_column} = %s AND revision = %s"
                        f" RETURNING {', '.join(RETURNING_COLUMNS[catalog])}",
                        [actor, record_id, int(expected_revision)],
                    ).fetchone()
                    after = spec.mapper(row)
                    self._insert_history(
                        connection,
                        catalog,
                        record_id,
                        revision=after["revision"],
                        action=action,
                        actor=actor,
                        before=before,
                        after=after,
                        reason=reason,
                    )
        except ServiceError:
            raise
        except Exception as exc:
            raise self._mutation_error(exc, catalog) from exc
        return after

    def _require_unreferenced(self, connection: Any, catalog: str, record_id: str) -> None:
        """Archive-by-default: refuse records that are still referenced."""
        if catalog != "customer":
            return
        rules = connection.execute(
            "SELECT COUNT(*) FROM soc_rule_catalog"
            " WHERE customer_id = %s AND archived_at IS NULL",
            (record_id,),
        ).fetchone()[0]
        source_types = connection.execute(
            "SELECT COUNT(*) FROM soc_fix_source_type"
            " WHERE customer_id = %s AND archived_at IS NULL",
            (record_id,),
        ).fetchone()[0]
        if rules or source_types:
            raise ServiceError(
                "record_referenced",
                "The customer is still referenced by other catalog records; resolve them first.",
                details={"rules": int(rules), "fix_source_types": int(source_types)},
            )

    def referenced_customers(self, customer_ids: list[str]) -> set[str]:
        """Return the subset of customer IDs referenced by non-archived records."""
        if not customer_ids:
            return set()
        placeholders = ", ".join(["%s"] * len(customer_ids))
        with self._connect() as connection:
            rules = {
                str(row[0])
                for row in connection.execute(
                    "SELECT DISTINCT customer_id FROM soc_rule_catalog"
                    f" WHERE archived_at IS NULL AND customer_id IN ({placeholders})",
                    customer_ids,
                ).fetchall()
            }
            source_types = {
                str(row[0])
                for row in connection.execute(
                    "SELECT DISTINCT customer_id FROM soc_fix_source_type"
                    f" WHERE archived_at IS NULL AND customer_id IN ({placeholders})",
                    customer_ids,
                ).fetchall()
            }
        return rules | source_types

    def _insert_history(
        self,
        connection: Any,
        catalog: str,
        record_id: str,
        *,
        revision: int,
        action: str,
        actor: str,
        before: dict[str, Any] | None,
        after: dict[str, Any] | None,
        reason: str = "",
    ) -> None:
        connection.execute(
            """
            INSERT INTO soc_catalog_history
                (catalog, record_id, revision, action, actor, reason, before_json, after_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
            """,
            (
                catalog,
                record_id,
                int(revision),
                action,
                actor,
                reason,
                json.dumps(before, ensure_ascii=False) if before is not None else None,
                json.dumps(after, ensure_ascii=False) if after is not None else None,
            ),
        )

    def record_history(self, catalog: str, record_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        _spec(catalog)
        record_id = _require_id(record_id)
        limit = max(1, min(int(limit), 500))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT history_id, revision, action, actor, reason, before_json, after_json, changed_at
                FROM soc_catalog_history
                WHERE catalog = %s AND record_id = %s
                ORDER BY history_id DESC
                LIMIT %s
                """,
                (catalog, record_id, limit),
            ).fetchall()
        return [
            {
                "history_id": int(row[0]),
                "catalog": catalog,
                "record_id": record_id,
                "revision": int(row[1]),
                "action": row[2],
                "actor": row[3],
                "reason": row[4],
                "before": row[5],
                "after": row[6],
                "changed_at": _iso(row[7]),
            }
            for row in rows
        ]

    # -- publications -------------------------------------------------------

    def create_publication(
        self,
        *,
        catalog: str,
        lookup_name: str,
        checksum: str,
        destination: str,
        actor: str,
        content_snapshot: str,
    ) -> dict[str, Any]:
        publication_id = uuid.uuid4().hex
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO soc_catalog_publications
                    (publication_id, catalog, lookup_name, content_checksum, destination,
                     actor, outcome, content_snapshot)
                VALUES (%s, %s, %s, %s, %s, %s, 'pending', %s)
                """,
                (publication_id, catalog, lookup_name, checksum, destination, actor, content_snapshot),
            )
        return self.get_publication(publication_id)  # type: ignore[return-value]

    def set_publication_outcome(
        self,
        publication_id: str,
        *,
        outcome: str,
        error: str = "",
        verified: bool = False,
        checksum: str | None = None,
    ) -> dict[str, Any]:
        if outcome not in {"pending", "published", "failed", "rolled_back"}:
            raise ValueError("invalid publication outcome")
        with self._connect() as connection:
            if checksum is None:
                connection.execute(
                    """
                    UPDATE soc_catalog_publications
                    SET outcome = %s, error = %s, verified = %s
                    WHERE publication_id = %s
                    """,
                    (outcome, error, verified, publication_id),
                )
            else:
                connection.execute(
                    """
                    UPDATE soc_catalog_publications
                    SET outcome = %s, error = %s, verified = %s, content_checksum = %s
                    WHERE publication_id = %s
                    """,
                    (outcome, error, verified, checksum, publication_id),
                )
        return self.get_publication(publication_id)  # type: ignore[return-value]

    def get_publication(self, publication_id: str) -> dict[str, Any] | None:
        publication_id = _require_id(publication_id)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT publication_id, catalog, lookup_name, content_checksum, destination,
                       actor, published_at, outcome, error, content_snapshot, verified,
                       replaced_publication_id
                FROM soc_catalog_publications
                WHERE publication_id = %s
                """,
                (publication_id,),
            ).fetchone()
        return _publication_from_row(row) if row is not None else None

    def latest_publication(self, catalog: str, *, outcome: str | None = None) -> dict[str, Any] | None:
        _spec(catalog)
        clause = "WHERE catalog = %s"
        params: list[Any] = [catalog]
        if outcome is not None:
            clause += " AND outcome = %s"
            params.append(outcome)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT publication_id, catalog, lookup_name, content_checksum, destination,
                       actor, published_at, outcome, error, content_snapshot, verified,
                       replaced_publication_id
                FROM soc_catalog_publications
                {clause}
                ORDER BY published_at DESC
                LIMIT 1
                """.format(clause=clause),
                params,
            ).fetchone()
        return _publication_from_row(row) if row is not None else None

    def list_publications(self, catalog: str, *, limit: int = 50) -> list[dict[str, Any]]:
        _spec(catalog)
        limit = max(1, min(int(limit), 200))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT publication_id, catalog, lookup_name, content_checksum, destination,
                       actor, published_at, outcome, error, content_snapshot, verified,
                       replaced_publication_id
                FROM soc_catalog_publications
                WHERE catalog = %s
                ORDER BY published_at DESC
                LIMIT %s
                """,
                (catalog, limit),
            ).fetchall()
        return [_publication_from_row(row) for row in rows]

    # -- import staging -----------------------------------------------------

    def create_import_batch(self, *, batch_id: str, source: str, actor: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO soc_catalog_import_batches (batch_id, source, actor) VALUES (%s, %s, %s)",
                (batch_id, source, actor),
            )

    def add_staging_rows(self, batch_id: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        with self._connect() as connection:
            with connection.transaction():
                for row in rows:
                    connection.execute(
                        """
                        INSERT INTO soc_catalog_staging (batch_id, row_number, payload_json, warnings)
                        VALUES (%s, %s, %s::jsonb, %s::jsonb)
                        """,
                        (
                            batch_id,
                            int(row["row_number"]),
                            json.dumps(row["payload"], ensure_ascii=False),
                            json.dumps(row.get("warnings", []), ensure_ascii=False),
                        ),
                    )

    def staging_rows(self, batch_id: str, *, promoted: bool | None = None) -> list[dict[str, Any]]:
        clause = "WHERE batch_id = %s"
        params: list[Any] = [batch_id]
        if promoted is not None:
            clause += " AND promoted = %s"
            params.append(promoted)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT row_number, payload_json, warnings, promoted, promoted_record_id
                FROM soc_catalog_staging
                {clause}
                ORDER BY row_number
                """.format(clause=clause),
                params,
            ).fetchall()
        return [
            {
                "row_number": int(row[0]),
                "payload": row[1],
                "warnings": row[2],
                "promoted": bool(row[3]),
                "promoted_record_id": row[4],
            }
            for row in rows
        ]

    def set_staging_promoted(self, batch_id: str, row_number: int, record_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE soc_catalog_staging SET promoted = TRUE, promoted_record_id = %s"
                " WHERE batch_id = %s AND row_number = %s",
                (record_id, batch_id, int(row_number)),
            )

    def update_import_report(self, batch_id: str, report: dict[str, Any]) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE soc_catalog_import_batches SET report = %s::jsonb WHERE batch_id = %s",
                (json.dumps(report, ensure_ascii=False), batch_id),
            )

    def get_import_batch(self, batch_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT batch_id, source, actor, report, created_at
                FROM soc_catalog_import_batches
                WHERE batch_id = %s
                """,
                (batch_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "batch_id": row[0],
            "source": row[1],
            "actor": row[2],
            "report": row[3],
            "created_at": _iso(row[4]),
        }

    # -- errors -------------------------------------------------------------

    def _mutation_error(self, exc: Exception, catalog: str) -> ServiceError:
        unique = getattr(psycopg, "errors", None) if psycopg is not None else None
        violation = getattr(unique, "UniqueViolation", None) if unique is not None else None
        if violation is not None and isinstance(exc, violation):
            constraint = ""
            diag = getattr(exc, "diag", None)
            constraint = str(getattr(diag, "constraint_name", "") or "")
            if not constraint:
                # Client-constructed errors carry the constraint in the message.
                text = str(exc)
                for name in _UNIQUE_FIELDS:
                    if name in text:
                        constraint = name
                        break
            field = _UNIQUE_FIELDS.get(constraint, "")
            return ServiceError(
                "duplicate_record",
                "A catalog record with this unique value already exists.",
                details={"catalog": catalog, "constraint": constraint, "field": field},
            )
        return ServiceError(
            "storage_error",
            "The catalog storage operation failed.",
            details={"catalog": catalog},
        )


def _iso(value: Any) -> str:
    if value is None:
        return ""
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _require_id(record_id: str) -> str:
    value = str(record_id or "").strip()
    if not value or len(value) > 128:
        raise ServiceError("invalid_input", "A valid record ID is required.")
    return value


def _require_current_revision(record: dict[str, Any], expected_revision: int) -> None:
    try:
        expected = int(expected_revision)
    except (TypeError, ValueError):
        expected = -1
    if record["revision"] != expected:
        raise ServiceError(
            "catalog_conflict",
            "The record changed since it was read; refresh and retry.",
            details={"current_revision": record["revision"]},
        )


def _require_not_archived(record: dict[str, Any]) -> None:
    if record["archived"]:
        raise ServiceError(
            "record_archived",
            "Restore the archived record before editing it.",
            details={"record_id": record["record_id"]},
        )


def _publication_from_row(row: Any) -> dict[str, Any]:
    return {
        "publication_id": row[0],
        "catalog": row[1],
        "lookup_name": row[2],
        "content_checksum": row[3],
        "destination": row[4],
        "actor": row[5],
        "published_at": _iso(row[6]),
        "outcome": row[7],
        "error": row[8],
        "content_snapshot": row[9],
        "verified": bool(row[10]),
        "replaced_publication_id": row[11],
    }


__all__ = ["CatalogStore"]
