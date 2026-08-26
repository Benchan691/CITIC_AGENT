from __future__ import annotations

import io
import json
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import unified_mcp_server.auth_cli as auth_cli
import unified_mcp_server.postgres_store as postgres_module
from unified_mcp_server.auth import public_session
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.postgres_store import PostgresStore


class SocConnection:
    """Small in-memory SQL double for the auth/session store tests."""

    def __init__(self):
        self.users: dict[str, dict[str, object]] = {}
        self.sessions: dict[str, dict[str, object]] = {}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=()):
        upper = " ".join(query.strip().upper().split())
        if upper.startswith("CREATE TABLE"):
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if upper.startswith("INSERT INTO SOC_USERS"):
            proposed_id, email, created_at, last_login_at = params
            current = next((user for user in self.users.values() if user["email"] == email), None)
            if current is None:
                self.users[proposed_id] = {
                    "id": proposed_id,
                    "email": email,
                    "created_at": created_at,
                    "last_login_at": last_login_at,
                }
            else:
                current["last_login_at"] = last_login_at
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if upper.startswith("SELECT ID, ZIMBRA_EMAIL FROM SOC_USERS WHERE ID"):
            user = self.users.get(params[0])
            row = None if user is None else (user["id"], user["email"])
            return SimpleNamespace(fetchone=lambda: row, fetchall=lambda: [])
        if upper.startswith("SELECT ID, ZIMBRA_EMAIL FROM SOC_USERS"):
            email = params[0]
            user = next((value for value in self.users.values() if value["email"] == email), None)
            row = None if user is None else (user["id"], user["email"])
            return SimpleNamespace(fetchone=lambda: row, fetchall=lambda: [])
        if upper.startswith("INSERT INTO SOC_APP_SESSIONS"):
            session_id, user_id, token, created_at, expires_at = params
            self.sessions[session_id] = {
                "id": session_id,
                "user_id": user_id,
                "token": token,
                "created_at": created_at,
                "expires_at": expires_at,
            }
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        if upper.startswith("SELECT S.ID, S.USER_ID, U.ZIMBRA_EMAIL"):
            session = self.sessions.get(params[0])
            user = self.users.get(session["user_id"]) if session else None
            row = None if session is None or user is None else (
                session["id"],
                session["user_id"],
                user["email"],
                session["token"],
                session["created_at"],
                session["expires_at"],
            )
            return SimpleNamespace(fetchone=lambda: row, fetchall=lambda: [])
        if upper.startswith("DELETE FROM SOC_APP_SESSIONS WHERE ID = %S RETURNING ID"):
            removed = self.sessions.pop(params[0], None)
            return SimpleNamespace(fetchone=lambda: (params[0],) if removed else None, fetchall=lambda: [])
        if upper.startswith("DELETE FROM SOC_APP_SESSIONS WHERE ID = %S"):
            self.sessions.pop(params[0], None)
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])
        raise AssertionError(f"Unhandled query: {query}")


@pytest.fixture
def store(monkeypatch):
    connection = SocConnection()
    monkeypatch.setattr(postgres_module, "psycopg", SimpleNamespace(connect=lambda _uri: connection))
    return PostgresStore("postgresql://example.test/soc", "test-encryption-key"), connection


def settings():
    return SimpleNamespace(zimbra=ZimbraSettings(host="mail.example.test", verify_ssl=True, timeout=60))


def test_first_login_creates_one_normalized_user_and_never_returns_password_or_token(store, monkeypatch):
    database, connection = store
    captured = {}

    monkeypatch.setattr(auth_cli, "_store", lambda: database)
    monkeypatch.setattr(auth_cli.ServerSettings, "from_store", lambda _store: settings())

    def fake_login(config):
        captured.update(config)
        return "zimbra-token"

    monkeypatch.setattr(auth_cli, "zimbra_login", fake_login)

    first = auth_cli.login({"email": " Analyst@Example.COM ", "password": "never-store-this"})
    second = auth_cli.login({"email": "analyst@example.com", "password": "another-password"})

    assert captured["zimbra_email"] == "analyst@example.com"
    assert captured["zimbra_password"] == "another-password"
    assert len(connection.users) == 1
    assert first["session"]["user"]["id"] == second["session"]["user"]["id"]
    assert first["session"]["session_id"] != second["session"]["session_id"]
    serialized = json.dumps(first)
    assert "never-store-this" not in serialized
    assert "zimbra-token" not in serialized
    assert all("never-store-this" not in str(row) for row in connection.sessions.values())
    assert public_session(database.get_app_session(first["session"]["session_id"]))["user"]["zimbra_email"] == "analyst@example.com"


def test_invalid_zimbra_login_is_rejected_without_creating_local_state(store, monkeypatch):
    database, connection = store
    monkeypatch.setattr(auth_cli, "_store", lambda: database)
    monkeypatch.setattr(auth_cli.ServerSettings, "from_store", lambda _store: settings())
    monkeypatch.setattr(auth_cli, "zimbra_login", lambda _config: (_ for _ in ()).throw(RuntimeError("wrong password")))

    with pytest.raises(ValueError, match="authentication failed"):
        auth_cli.login({"email": "analyst@example.com", "password": "wrong"})

    assert connection.users == {}
    assert connection.sessions == {}


def test_session_expires_after_24_hours_and_logout_deletes_token(store):
    database, connection = store
    created = datetime(2026, 1, 1, tzinfo=timezone.utc)
    session = database.create_user_session("analyst@example.com", "encrypted-token", now=created)

    assert database.get_app_session(session.session_id, now=created + timedelta(hours=24, seconds=1)) is None
    assert session.session_id not in connection.sessions

    active = database.create_user_session("analyst@example.com", "second-token", now=created)
    assert database.delete_app_session(active.session_id) is True
    assert database.get_app_session(active.session_id, now=created) is None


def test_invalid_zimbra_token_invalidates_application_session(store, monkeypatch):
    database, _connection = store
    session = database.create_user_session("analyst@example.com", "expired-zimbra-token")
    monkeypatch.setattr(auth_cli, "_store", lambda: database)
    monkeypatch.setattr(auth_cli.ServerSettings, "from_store", lambda _store: settings())

    def reject_token(self, *_args):
        raise RuntimeError("auth required")

    monkeypatch.setattr(auth_cli.ZimbraMailService, "_send_email", reject_token)
    old_argv, old_stdin, old_stderr = sys.argv, sys.stdin, sys.stderr
    sys.argv = ["auth_cli", "send-email"]
    sys.stdin = io.StringIO(json.dumps({
        "session_id": session.session_id,
        "to": ["recipient@example.com"],
        "subject": "Subject",
        "body": "Body",
    }))
    sys.stderr = io.StringIO()
    try:
        with pytest.raises(SystemExit):
            auth_cli.main()
        assert database.get_app_session(session.session_id) is None
        assert "expired-zimbra-token" not in sys.stderr.getvalue()
    finally:
        sys.argv, sys.stdin, sys.stderr = old_argv, old_stdin, old_stderr
