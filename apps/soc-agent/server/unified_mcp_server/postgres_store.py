"""PostgreSQL-backed encrypted configuration and authenticated SOC state."""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from os import environ
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from .account_store import AccountStore, StoredAccount

try:
    import psycopg
except ImportError:  # pragma: no cover - exercised when the optional runtime is absent
    psycopg = None  # type: ignore[assignment]


def _derive_key(value: str) -> bytes:
    return base64.urlsafe_b64encode(hashlib.sha256(value.encode("utf-8")).digest())


def _fernet_key(value: str) -> bytes:
    value = value.strip()
    if not value:
        raise ValueError("APP_SETTINGS_ENCRYPTION_KEY is required when PostgreSQL settings are enabled")
    try:
        Fernet(value.encode("ascii"))
    except Exception:
        return _derive_key(value)
    return value.encode("ascii")


def _connection_error() -> RuntimeError:
    return RuntimeError(
        "PostgreSQL settings require the psycopg package. Install the project dependencies first."
    )


# Let the configured Zimbra server decide whether an address is valid. Some
# installations accept local domains such as user@localhost.
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+$")


def normalize_zimbra_email(value: str) -> str:
    """Return the canonical local identity used for Zimbra-backed login."""
    email = str(value or "").strip().casefold()
    if not _EMAIL_RE.fullmatch(email):
        raise ValueError("a valid email address is required")
    return email


@dataclass(frozen=True)
class AuthenticatedSession:
    """Server-side application session; the token never has a public serializer."""

    session_id: str
    user_id: str
    zimbra_email: str
    zimbra_token: str
    created_at: datetime
    expires_at: datetime


@dataclass(frozen=True)
class PostgresBootstrap:
    uri: str
    encryption_key: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "PostgresBootstrap | None":
        values = environ if env is None else env
        uri = (
            str(values.get("APP_POSTGRES_URI", "")).strip()
            or str(values.get("LANGGRAPH_POSTGRES_URI", "")).strip()
            or str(values.get("POSTGRES_URI", "")).strip()
        )
        if not uri:
            return None
        return cls(uri=uri, encryption_key=str(values.get("APP_SETTINGS_ENCRYPTION_KEY", "")).strip())


class PostgresStore:
    """Shared encrypted PostgreSQL storage for config and SOC authentication state."""

    SESSION_TTL_SECONDS = 24 * 60 * 60

    def __init__(self, uri: str, encryption_key: str) -> None:
        if psycopg is None:
            raise _connection_error()
        self.uri = uri.strip()
        if not self.uri:
            raise ValueError("A PostgreSQL URI is required for settings storage")
        self._fernet = Fernet(_fernet_key(encryption_key))
        self._ensure_schema()

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "PostgresStore | None":
        bootstrap = PostgresBootstrap.from_env(env)
        if bootstrap is None:
            return None
        return cls(bootstrap.uri, bootstrap.encryption_key)

    def _connect(self):
        if psycopg is None:  # pragma: no cover
            raise _connection_error()
        return psycopg.connect(self.uri)

    def _encrypt_text(self, value: str) -> str:
        return self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")

    def _decrypt_error(self, *, row_count: int, failed_key: str) -> RuntimeError:
        from urllib.parse import urlparse
        db_name = (urlparse(self.uri).path or "/").lstrip("/") or "unknown"
        return RuntimeError(
            "The PostgreSQL settings payload could not be decrypted. "
            f"APP_SETTINGS_ENCRYPTION_KEY does not match {row_count} encrypted app_config "
            f"row(s) in database {db_name!r} (failed at {failed_key}). "
            "Restore the original key, or TRUNCATE app_config and zimbra_accounts and re-enter settings."
        )

    def _decrypt_text(self, value: str) -> str:
        try:
            return self._fernet.decrypt(value.encode("utf-8")).decode("utf-8")
        except (InvalidToken, ValueError, TypeError) as exc:
            raise self._decrypt_error(row_count=1, failed_key="unknown") from exc

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS app_config (
                    key TEXT PRIMARY KEY,
                    value_encrypted TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS zimbra_accounts (
                    id TEXT PRIMARY KEY,
                    label TEXT NOT NULL,
                    email TEXT NOT NULL,
                    username TEXT NOT NULL,
                    password_encrypted TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS soc_users (
                    id TEXT PRIMARY KEY,
                    zimbra_email TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_login_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS soc_app_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
                    zimbra_token_encrypted TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS soc_workspace_owners (
                    workspace_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
                    workspace_path TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS soc_session_owners (
                    session_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
                    workspace_id TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS soc_folder_owners (
                    folder_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS soc_bootstrap (
                    key TEXT PRIMARY KEY,
                    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

    def get_config(self, key: str, default: str = "") -> str:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT value_encrypted FROM app_config WHERE key = %s",
                (key.strip(),),
            ).fetchone()
        return default if row is None else self._decrypt_text(str(row[0]))

    def list_config(self) -> dict[str, str]:
        with self._connect() as connection:
            rows = connection.execute("SELECT key, value_encrypted FROM app_config ORDER BY key").fetchall()
        decrypted: dict[str, str] = {}
        for key, value in rows:
            try:
                decrypted[str(key)] = self._decrypt_text(str(value))
            except RuntimeError as exc:
                raise self._decrypt_error(row_count=len(rows), failed_key=str(key)) from exc
        return decrypted

    def set_config(self, key: str, value: str) -> None:
        now = datetime.now(timezone.utc)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO app_config (key, value_encrypted, created_at, updated_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (key) DO UPDATE SET
                    value_encrypted = EXCLUDED.value_encrypted,
                    updated_at = EXCLUDED.updated_at
                """,
                (key.strip(), self._encrypt_text(value), now, now),
            )

    def set_configs(self, values: Mapping[str, str]) -> None:
        for key, value in values.items():
            self.set_config(str(key), str(value))

    def delete_config(self, key: str) -> bool:
        with self._connect() as connection:
            row = connection.execute("DELETE FROM app_config WHERE key = %s RETURNING key", (key.strip(),)).fetchone()
        return row is not None

    def list_accounts(self) -> list[StoredAccount]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, label, email, username, password_encrypted
                FROM zimbra_accounts
                ORDER BY created_at, id
                """
            ).fetchall()
        return [
            StoredAccount(
                id=str(account_id),
                label=str(label),
                email=str(email),
                username=str(username),
                password=self._decrypt_text(str(password_encrypted)),
            )
            for account_id, label, email, username, password_encrypted in rows
        ]

    def count_accounts(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) FROM zimbra_accounts").fetchone()
        return int(row[0]) if row is not None else 0

    def get_account(self, account_id: str) -> StoredAccount | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, label, email, username, password_encrypted
                FROM zimbra_accounts
                WHERE id = %s
                """,
                (account_id.strip(),),
            ).fetchone()
        if row is None:
            return None
        return StoredAccount(
            id=str(row[0]),
            label=str(row[1]),
            email=str(row[2]),
            username=str(row[3]),
            password=self._decrypt_text(str(row[4])),
        )

    def add_account(self, *, label: str, email: str, username: str, password: str) -> StoredAccount:
        account = StoredAccount(
            id=secrets.token_urlsafe(12),
            label=label.strip() or email.strip(),
            email=email.strip(),
            username=username.strip(),
            password=password,
        )
        now = datetime.now(timezone.utc)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO zimbra_accounts (id, label, email, username, password_encrypted, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    account.id,
                    account.label,
                    account.email,
                    account.username,
                    self._encrypt_text(account.password),
                    now,
                    now,
                ),
            )
        return account

    def update_account(
        self,
        account_id: str,
        *,
        label: str | None = None,
        email: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ) -> StoredAccount:
        current = self.get_account(account_id)
        if current is None:
            raise KeyError(account_id)
        updated = StoredAccount(
            id=current.id,
            label=current.label if label is None else label.strip() or current.label,
            email=current.email if email is None else email.strip(),
            username=current.username if username is None else username.strip(),
            password=current.password if password is None else password,
        )
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE zimbra_accounts
                SET label = %s, email = %s, username = %s, password_encrypted = %s, updated_at = %s
                WHERE id = %s
                """,
                (
                    updated.label,
                    updated.email,
                    updated.username,
                    self._encrypt_text(updated.password),
                    datetime.now(timezone.utc),
                    updated.id,
                ),
            )
        return updated

    def delete_account(self, account_id: str) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                "DELETE FROM zimbra_accounts WHERE id = %s RETURNING id",
                (account_id.strip(),),
            ).fetchone()
        return row is not None

    def create_user_session(
        self,
        email: str,
        zimbra_token: str,
        *,
        now: datetime | None = None,
    ) -> AuthenticatedSession:
        """Upsert the local identity and persist only an encrypted Zimbra token."""
        normalized = normalize_zimbra_email(email)
        token = str(zimbra_token or "")
        if not token:
            raise ValueError("Zimbra authentication did not return a token")
        created = now or datetime.now(timezone.utc)
        expires = created + timedelta(seconds=self.SESSION_TTL_SECONDS)
        user_id = secrets.token_urlsafe(24)
        session_id = secrets.token_urlsafe(32)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO soc_users (id, zimbra_email, created_at, last_login_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (zimbra_email) DO UPDATE SET last_login_at = EXCLUDED.last_login_at
                """,
                (user_id, normalized, created, created),
            )
            row = connection.execute(
                "SELECT id, zimbra_email FROM soc_users WHERE zimbra_email = %s",
                (normalized,),
            ).fetchone()
            if row is None:
                raise RuntimeError("local user creation failed")
            user_id = str(row[0])
            connection.execute(
                """
                INSERT INTO soc_app_sessions (id, user_id, zimbra_token_encrypted, created_at, expires_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (session_id, user_id, self._encrypt_text(token), created, expires),
            )
        return AuthenticatedSession(session_id, user_id, normalized, token, created, expires)

    def get_user_by_id(self, user_id: str) -> dict[str, str] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id, zimbra_email FROM soc_users WHERE id = %s",
                (str(user_id).strip(),),
            ).fetchone()
        if row is None:
            return None
        return {"id": str(row[0]), "zimbra_email": str(row[1])}

    def get_app_session(
        self,
        session_id: str,
        *,
        now: datetime | None = None,
    ) -> AuthenticatedSession | None:
        """Resolve one opaque application-session cookie, expiring it atomically."""
        value = str(session_id or "").strip()
        if not value or len(value) > 128 or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
            return None
        current = now or datetime.now(timezone.utc)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT s.id, s.user_id, u.zimbra_email, s.zimbra_token_encrypted,
                       s.created_at, s.expires_at
                FROM soc_app_sessions AS s
                JOIN soc_users AS u ON u.id = s.user_id
                WHERE s.id = %s
                """,
                (value,),
            ).fetchone()
            if row is None:
                return None
            if row[5] <= current:
                connection.execute("DELETE FROM soc_app_sessions WHERE id = %s", (value,))
                return None
            token = self._decrypt_text(str(row[3]))
        return AuthenticatedSession(
            session_id=str(row[0]),
            user_id=str(row[1]),
            zimbra_email=str(row[2]),
            zimbra_token=token,
            created_at=row[4],
            expires_at=row[5],
        )

    def delete_app_session(self, session_id: str) -> bool:
        value = str(session_id or "").strip()
        if not value:
            return False
        with self._connect() as connection:
            row = connection.execute(
                "DELETE FROM soc_app_sessions WHERE id = %s RETURNING id",
                (value,),
            ).fetchone()
        return row is not None

    def invalidate_app_session(self, session_id: str) -> bool:
        return self.delete_app_session(session_id)

    def migrate_env_config(self, env: Mapping[str, str]) -> None:
        keys = [
            "SPLUNK_HOST",
            "SPLUNK_PORT",
            "SPLUNK_SCHEME",
            "SPLUNK_URL",
            "SPLUNK_TOKEN",
            "SPLUNK_USERNAME",
            "SPLUNK_PASSWORD",
            "SPLUNK_VERIFY_SSL",
            "SPLUNK_REQUEST_TIMEOUT",
            "SPLUNK_JOB_TIMEOUT",
            "SPLUNK_MAX_EVENTS",
            "SPLUNK_RISK_TOLERANCE",
            "SPLUNK_SAFE_TIMERANGE",
            "SPLUNK_SANITIZE_OUTPUT",
            "SPLUNK_ALLOW_DETECTION_WRITE",
            "SPLUNK_ALLOW_DETECTION_ENABLE",
            "SPLUNK_DETECTION_APP",
            "SPLUNK_DETECTION_OWNER",
            "SPLUNK_DETECTION_APPROVAL_TTL_SECONDS",
            "SPLUNK_SECURITY_QUEUE_MODE",
            "SPLUNK_POLICY_SHORT_SEARCH_SECONDS",
            "SPLUNK_POLICY_NORMAL_SEARCH_SECONDS",
            "SPLUNK_POLICY_VERY_LONG_SEARCH_SECONDS",
            "SPLUNK_POLICY_WILDCARD_INDEX",
            "SPLUNK_POLICY_NO_INDEX",
            "SPLUNK_POLICY_LONG_RAW",
            "SPLUNK_POLICY_VERY_LONG",
            "SPLUNK_POLICY_ALL_TIME",
            "SPLUNK_POLICY_EXPENSIVE_COMMAND",
            "SPLUNK_POLICY_SUBSEARCH",
            "SPLUNK_POLICY_NESTED_SUBSEARCH",
            "SPLUNK_POLICY_UNRESOLVED_MACRO",
            "SPLUNK_POLICY_UNPARSEABLE_TIME",
            "SPLUNK_POLICY_MAX_SUBSEARCH_DEPTH",
            "SPLUNK_POLICY_TRUSTED_MACROS",
            "SPLUNK_SEARCH_GLOBAL_CONCURRENCY",
            "SPLUNK_SEARCH_PER_PRINCIPAL_CONCURRENCY",
            "SPLUNK_SEARCH_QUEUE_TIMEOUT_SECONDS",
            "SPLUNK_SEARCH_MAX_JOBS_PER_MINUTE",
            "SPLUNK_SEARCH_BUDGET_PER_MINUTE",
            "SPLUNK_SEARCH_MAX_RUNTIME_LOW",
            "SPLUNK_SEARCH_MAX_RUNTIME_MEDIUM",
            "SPLUNK_SEARCH_MAX_RUNTIME_HIGH",
            "SPLUNK_SEARCH_MAX_LOOKBACK_LOW",
            "SPLUNK_SEARCH_MAX_LOOKBACK_MEDIUM",
            "SPLUNK_SEARCH_MAX_LOOKBACK_HIGH",
            "SPLUNK_SEARCH_MAX_RESULTS_LOW",
            "SPLUNK_SEARCH_MAX_RESULTS_MEDIUM",
            "SPLUNK_SEARCH_MAX_RESULTS_HIGH",
            "SPLUNK_SEARCH_BACKTEST_CONCURRENCY",
            "SPLUNK_SEARCH_RESTRICTED_DECISION",
            "ZIMBRA_HOST",
            "ZIMBRA_VERIFY_SSL",
            "ZIMBRA_TIMEOUT",
            "ZIMBRA_MAX_ATTACHMENT_BYTES",
            "ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS",
            "MARKITDOWN_LLM_ENABLED",
            "MARKITDOWN_LLM_BASE_URL",
            "MARKITDOWN_LLM_MODEL",
            "MARKITDOWN_LLM_TIMEOUT",
        ]
        current = self.list_config()
        for key in keys:
            value = str(env.get(key, "")).strip()
            if value and key not in current:
                self.set_config(key, value)

    def migrate_account_store(self, store: AccountStore | None) -> int:
        if store is None:
            return 0
        existing_by_email = {account.email.lower(): account for account in self.list_accounts()}
        imported = 0
        for account in store.list():
            if account.email.lower() in existing_by_email:
                continue
            self.add_account(
                label=account.label,
                email=account.email,
                username=account.username,
                password=account.password,
            )
            imported += 1
        return imported


class PostgresAccountStore:
    """AccountStore-compatible adapter backed by PostgreSQL rows."""

    def __init__(self, store: PostgresStore) -> None:
        self.store = store

    def list(self) -> list[StoredAccount]:
        return self.store.list_accounts()

    def list_public(self) -> list[dict[str, Any]]:
        return [account.public_dict() for account in self.list()]

    def list_agent(self) -> list[dict[str, Any]]:
        return [account.agent_dict() for account in self.list()]

    def count(self) -> int:
        return self.store.count_accounts()

    def get(self, account_id: str) -> StoredAccount | None:
        return self.store.get_account(account_id)

    def add(self, *, label: str, email: str, username: str, password: str) -> StoredAccount:
        return self.store.add_account(label=label, email=email, username=username, password=password)

    def update(
        self,
        account_id: str,
        *,
        label: str | None = None,
        email: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ) -> StoredAccount:
        return self.store.update_account(
            account_id,
            label=label,
            email=email,
            username=username,
            password=password,
        )

    def delete(self, account_id: str) -> bool:
        return self.store.delete_account(account_id)


def dump_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))
