"""Migration checks use an isolated local cluster, never the application DB."""

from concurrent.futures import ThreadPoolExecutor
from importlib.resources import files
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import urlencode, urlsplit, urlunsplit
import uuid

import psycopg
from psycopg.sql import Identifier, SQL
import pytest

from unified_mcp_server.schema import apply_migrations


@pytest.fixture(scope="module")
def local_postgres():
    initdb, pg_ctl = shutil.which("initdb"), shutil.which("pg_ctl")
    if not initdb or not pg_ctl or os.geteuid() == 0:
        pytest.skip("local PostgreSQL binaries and a non-root user are required")
    # A short directory avoids the Unix socket path limit on macOS.
    with tempfile.TemporaryDirectory(prefix="soc-pg-", dir="/tmp") as directory:
        data = str(Path(directory) / "data")
        subprocess.run([initdb, "-D", data, "-A", "trust", "-U", "soc_migration_test", "--no-locale", "--encoding=UTF8"],
                       check=True, capture_output=True, timeout=30)
        subprocess.run([pg_ctl, "-D", data, "-l", str(Path(directory) / "postgres.log"),
                        "-o", f"-F -c listen_addresses='' -c unix_socket_directories='{directory}'",
                        "-w", "-t", "30", "start"], check=True, capture_output=True, timeout=35)
        try:
            yield f"postgresql://soc_migration_test@localhost/postgres?{urlencode({'host': directory})}"
        finally:
            subprocess.run([pg_ctl, "-D", data, "-m", "immediate", "-w", "-t", "15", "stop"],
                           check=True, capture_output=True, timeout=20)


@pytest.fixture
def database(local_postgres):
    name = f"soc_{uuid.uuid4().hex}"
    with psycopg.connect(local_postgres, autocommit=True) as connection:
        connection.execute(SQL("CREATE DATABASE {}").format(Identifier(name)))
    return urlunsplit(urlsplit(local_postgres)._replace(path=f"/{name}"))


def migrate(database):
    with psycopg.connect(database) as connection:
        apply_migrations(connection)


def test_concurrent_startup_adopts_existing_rows_and_bootstrap_marker(database):
    initial = files("unified_mcp_server").joinpath("migrations/001_initial.sql").read_text()
    with psycopg.connect(database) as connection:
        connection.execute(initial)
        connection.execute("""
            INSERT INTO app_config (key, value_encrypted) VALUES ('setting', 'encrypted-setting');
            INSERT INTO zimbra_accounts (id, label, email, username, password_encrypted)
                VALUES ('account', 'Inbox', 'analyst@example.test', '', 'encrypted-password');
            INSERT INTO soc_users (id, zimbra_email, last_login_at) VALUES ('user', 'analyst@example.test', NOW());
            INSERT INTO soc_app_sessions VALUES ('session', 'user', 'encrypted-token', NOW(), NOW() + INTERVAL '1 day');
            INSERT INTO soc_workspace_owners (workspace_id, owner_user_id, workspace_path) VALUES ('workspace', 'user', '/workspace');
            INSERT INTO soc_session_owners (session_id, owner_user_id, workspace_id) VALUES ('session', 'user', 'workspace');
            INSERT INTO soc_folder_owners (folder_id, owner_user_id) VALUES ('folder', 'user');
            INSERT INTO soc_bootstrap (key) VALUES ('catalog-feature-removed-v1');
            CREATE TABLE soc_customer (id TEXT);
        """)
    with ThreadPoolExecutor(max_workers=4) as workers:
        list(workers.map(migrate, [database] * 4))
    with psycopg.connect(database) as connection:
        assert connection.execute("SELECT version FROM soc_schema_migrations ORDER BY version").fetchall() == [
            ("001_initial.sql",), ("002_remove_catalog.sql",),
        ]
        for table in ("app_config", "zimbra_accounts", "soc_users", "soc_app_sessions",
                      "soc_workspace_owners", "soc_session_owners", "soc_folder_owners"):
            assert connection.execute(SQL("SELECT COUNT(*) FROM {}").format(Identifier(table))).fetchone() == (1,)
        assert connection.execute("SELECT zimbra_token_encrypted FROM soc_app_sessions").fetchone() == ("encrypted-token",)
        assert connection.execute("SELECT to_regclass('soc_customer') IS NOT NULL").fetchone() == (True,)
        assert connection.execute("""
            SELECT COUNT(*) FROM pg_indexes WHERE indexname IN (
                'soc_app_sessions_user_idx', 'soc_app_sessions_expiry_idx',
                'soc_session_owners_user_idx', 'soc_session_owners_workspace_idx'
            )
        """).fetchone() == (4,)


def test_migration_failure_rolls_back_and_can_retry(database):
    with psycopg.connect(database) as connection:
        connection.execute("""
            CREATE TABLE soc_customer (id TEXT);
            INSERT INTO soc_customer VALUES ('preserved');
            CREATE VIEW external_dependency AS SELECT * FROM soc_customer;
        """)
    with pytest.raises(psycopg.errors.DependentObjectsStillExist):
        migrate(database)
    with psycopg.connect(database) as connection:
        assert connection.execute("SELECT to_regclass('soc_schema_migrations'), to_regclass('app_config'), to_regclass('soc_bootstrap')").fetchone() == (None, None, None)
        assert connection.execute("SELECT * FROM external_dependency").fetchall() == [("preserved",)]
        connection.execute("DROP VIEW external_dependency")
    migrate(database)
    with psycopg.connect(database) as connection:
        assert connection.execute("SELECT to_regclass('soc_customer')").fetchone() == (None,)
        assert connection.execute("SELECT key FROM soc_bootstrap").fetchall() == [("catalog-feature-removed-v1",)]
        connection.execute("CREATE TABLE soc_customer (id TEXT)")
    migrate(database)
    with psycopg.connect(database) as connection:
        assert connection.execute("SELECT to_regclass('soc_customer') IS NOT NULL").fetchone() == (True,)


def test_node_startup_uses_python_migrations_for_its_resolved_uri(database):
    if not shutil.which("node") or not shutil.which("uv"):
        pytest.skip("Node and uv are required for the host startup check")
    app = Path(__file__).resolve().parents[3]
    script = f"""
        import {{ SocStateStore }} from {json.dumps((app / 'ownership.js').as_uri())};
        let uri = '';
        for await (const chunk of process.stdin) uri += chunk;
        const store = new SocStateStore(uri);
        try {{
            await Promise.all([store.ensureSchema(), store.ensureSchema()]);
            console.log(JSON.stringify((await store.pool.query('SELECT COUNT(*) FROM soc_schema_migrations')).rows));
        }} finally {{ await store.close(); }}
    """
    result = subprocess.run(["node", "--input-type=module", "-e", script], input=database, text=True,
                            capture_output=True, timeout=60, check=True, env={
                                **os.environ, "DSH_SOC_AGENT_SERVER": str(app / "server"),
                                "UV_NO_SYNC": "1", "UV_OFFLINE": "1",
                                "APP_POSTGRES_URI": "postgresql://invalid.example.test/wrong-database",
                                "APP_SETTINGS_ENCRYPTION_KEY": "",
                            })
    assert json.loads(result.stdout) == [{"count": "2"}]
