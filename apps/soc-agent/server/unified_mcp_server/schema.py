"""The Python runtime owns versioned SOC database migrations."""

import json
import sys
from importlib.resources import files

def apply_migrations(connection) -> None:
    """Apply pending SQL within the caller's transaction, serializing startup."""
    connection.execute("SELECT pg_advisory_xact_lock(hashtext('soc-agent-schema'))")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS soc_schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    migrations = files("unified_mcp_server").joinpath("migrations")
    for migration in sorted(migrations.iterdir(), key=lambda entry: entry.name):
        if not migration.name.endswith(".sql"):
            continue
        pending = connection.execute("""
            INSERT INTO soc_schema_migrations (version) VALUES (%s)
            ON CONFLICT (version) DO NOTHING RETURNING version
        """, (migration.name,)).fetchone()
        if pending is not None:
            connection.execute(migration.read_text(encoding="utf-8"))


def main() -> None:
    # The host passes its resolved URI over stdin. Loading .env here could
    # override that target and initialize a different database.
    try:
        import psycopg

        uri = str(json.load(sys.stdin).get("uri", "")).strip()
        if not uri:
            raise ValueError("a PostgreSQL URI is required")
        with psycopg.connect(uri, connect_timeout=5, options="-c statement_timeout=15000") as connection:
            apply_migrations(connection)
        print(json.dumps({"migrated": True}))
    except Exception:
        print(json.dumps({"code": "schema_migration_failed", "message": "SOC database schema initialization failed."}), file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
