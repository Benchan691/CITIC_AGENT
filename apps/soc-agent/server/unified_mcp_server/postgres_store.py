"""PostgreSQL-backed encrypted configuration and authenticated SOC state."""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import re
import types
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from os import environ
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from .schema import apply_migrations

try:
    import psycopg
    from psycopg_pool import ConnectionPool
except ImportError:  # pragma: no cover - exercised when the optional runtime is absent
    psycopg = None  # type: ignore[assignment]
    ConnectionPool = None  # type: ignore[assignment,misc]


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


def _pool_enabled(env: Mapping[str, str] | None = None) -> bool:
    values = environ if env is None else env
    return str(values.get("APP_POSTGRES_POOL", "true")).strip().lower() in {"1", "true", "yes", "on"}


def create_connection_pool(uri: str, env: Mapping[str, str] | None = None):
    """Return a bounded connection pool, or None when disabled or unavailable.

    Pooling defaults on; APP_POSTGRES_POOL=false restores per-call connections.
    Missing optional pool support also retains the per-call connection path.
    The pool preserves the commit-on-clean-exit semantics of a plain
    ``psycopg.connect`` context manager. Pooling applies only to the real
    psycopg runtime — tests replace the module with doubles, and a pool built
    against such a double would dial a real database that does not exist.
    """
    if not _pool_enabled(env) or ConnectionPool is None or psycopg is None:
        return None
    if not isinstance(psycopg, types.ModuleType):
        return None
    try:
        return ConnectionPool(uri, min_size=1, max_size=4, timeout=5, open=True, name="soc-postgres", kwargs={"connect_timeout": 5, "options": "-c statement_timeout=15000"})
    except Exception:
        return None


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
    replaced_session_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class TwoFactorChallenge:
    """Server-side Zimbra challenge; the public id is never stored in cleartext."""

    challenge_id: str
    zimbra_email: str
    temporary_token: str
    created_at: datetime
    expires_at: datetime
    attempts: int = 0


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
    TWO_FACTOR_MAX_LIFETIME_SECONDS = 5 * 60
    TWO_FACTOR_MAX_ATTEMPTS = 5
    _OPAQUE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

    def __init__(self, uri: str, encryption_key: str) -> None:
        if psycopg is None:
            raise _connection_error()
        self.uri = uri.strip()
        if not self.uri:
            raise ValueError("A PostgreSQL URI is required for settings storage")
        self._fernet = Fernet(_fernet_key(encryption_key))
        self._pool = (
            create_connection_pool(self.uri)
            if isinstance(psycopg, types.ModuleType)
            else None
        )
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
        if self._pool is not None:
            return self._pool.connection()
        return psycopg.connect(self.uri, connect_timeout=5, options="-c statement_timeout=15000")

    def close(self) -> None:
        if self._pool is not None:
            self._pool.close()
            self._pool = None

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
            apply_migrations(connection)

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
                "SELECT id, zimbra_email FROM soc_users WHERE zimbra_email = %s FOR UPDATE",
                (normalized,),
            ).fetchone()
            if row is None:
                raise RuntimeError("local user creation failed")
            user_id = str(row[0])
            connection.execute(
                "DELETE FROM soc_session_revocations WHERE expires_at <= %s",
                (created,),
            )
            replaced_rows = connection.execute(
                """
                DELETE FROM soc_app_sessions
                WHERE user_id = %s AND expires_at > %s
                RETURNING id
                """,
                (user_id, created),
            ).fetchall()
            replaced_session_ids = tuple(str(replaced[0]) for replaced in replaced_rows)
            for replaced_session_id in replaced_session_ids:
                connection.execute(
                    """
                    INSERT INTO soc_session_revocations (session_id, reason, created_at, expires_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (session_id) DO UPDATE SET
                        reason = EXCLUDED.reason,
                        created_at = EXCLUDED.created_at,
                        expires_at = EXCLUDED.expires_at
                    """,
                    (replaced_session_id, "new_device_login", created, expires),
                )
            connection.execute(
                """
                INSERT INTO soc_app_sessions (id, user_id, zimbra_token_encrypted, created_at, expires_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (session_id, user_id, self._encrypt_text(token), created, expires),
            )
        return AuthenticatedSession(
            session_id,
            user_id,
            normalized,
            token,
            created,
            expires,
            replaced_session_ids,
        )

    @classmethod
    def _challenge_hash(cls, challenge_id: str) -> str | None:
        value = str(challenge_id or "").strip()
        if not cls._OPAQUE_ID_RE.fullmatch(value):
            return None
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def create_two_factor_challenge(
        self,
        email: str,
        temporary_token: str,
        lifetime_ms: int | str | None = None,
        *,
        now: datetime | None = None,
    ) -> TwoFactorChallenge:
        """Persist only an encrypted temporary Zimbra token and a bounded expiry."""
        normalized = normalize_zimbra_email(email)
        token = str(temporary_token or "")
        if not token:
            raise ValueError("Zimbra authentication did not return a temporary token")
        try:
            requested_ms = int(lifetime_ms) if lifetime_ms is not None else 0
        except (TypeError, ValueError):
            requested_ms = 0
        if requested_ms <= 0:
            lifetime_seconds = self.TWO_FACTOR_MAX_LIFETIME_SECONDS
        else:
            lifetime_seconds = min(
                self.TWO_FACTOR_MAX_LIFETIME_SECONDS,
                max(1, (requested_ms + 999) // 1000),
            )
        created = now or datetime.now(timezone.utc)
        expires = created + timedelta(seconds=lifetime_seconds)
        challenge_id = secrets.token_urlsafe(32)
        challenge_hash = self._challenge_hash(challenge_id)
        if challenge_hash is None:  # pragma: no cover - token_urlsafe always matches the contract
            raise RuntimeError("could not create a valid two-factor challenge id")
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM soc_two_factor_challenges WHERE expires_at <= %s",
                (created,),
            )
            connection.execute(
                """
                INSERT INTO soc_two_factor_challenges
                    (challenge_id_hash, zimbra_email, temporary_token_encrypted,
                     attempts, created_at, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    challenge_hash,
                    normalized,
                    self._encrypt_text(token),
                    0,
                    created,
                    expires,
                ),
            )
        return TwoFactorChallenge(
            challenge_id=challenge_id,
            zimbra_email=normalized,
            temporary_token=token,
            created_at=created,
            expires_at=expires,
        )

    def get_two_factor_challenge(
        self,
        challenge_id: str,
        *,
        now: datetime | None = None,
    ) -> TwoFactorChallenge | None:
        challenge_hash = self._challenge_hash(challenge_id)
        if challenge_hash is None:
            return None
        current = now or datetime.now(timezone.utc)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT zimbra_email, temporary_token_encrypted, attempts,
                       created_at, expires_at
                FROM soc_two_factor_challenges
                WHERE challenge_id_hash = %s
                """,
                (challenge_hash,),
            ).fetchone()
            if row is None:
                return None
            if row[4] <= current:
                connection.execute(
                    "DELETE FROM soc_two_factor_challenges WHERE challenge_id_hash = %s",
                    (challenge_hash,),
                )
                return None
            temporary_token = self._decrypt_text(str(row[1]))
        return TwoFactorChallenge(
            challenge_id=str(challenge_id).strip(),
            zimbra_email=str(row[0]),
            temporary_token=temporary_token,
            attempts=int(row[2]),
            created_at=row[3],
            expires_at=row[4],
        )

    def record_two_factor_attempt(
        self,
        challenge_id: str,
        *,
        now: datetime | None = None,
    ) -> tuple[bool, bool]:
        """Increment one attempt atomically; return (found, locked)."""
        challenge_hash = self._challenge_hash(challenge_id)
        if challenge_hash is None:
            return False, False
        current = now or datetime.now(timezone.utc)
        with self._connect() as connection:
            row = connection.execute(
                """
                UPDATE soc_two_factor_challenges
                SET attempts = attempts + 1
                WHERE challenge_id_hash = %s
                  AND expires_at > %s
                  AND attempts < %s
                RETURNING attempts
                """,
                (challenge_hash, current, self.TWO_FACTOR_MAX_ATTEMPTS),
            ).fetchone()
            if row is None:
                return False, False
            attempts = int(row[0])
            if attempts >= self.TWO_FACTOR_MAX_ATTEMPTS:
                connection.execute(
                    "DELETE FROM soc_two_factor_challenges WHERE challenge_id_hash = %s",
                    (challenge_hash,),
                )
                return True, True
        return True, False

    def delete_two_factor_challenge(self, challenge_id: str) -> bool:
        challenge_hash = self._challenge_hash(challenge_id)
        if challenge_hash is None:
            return False
        with self._connect() as connection:
            row = connection.execute(
                "DELETE FROM soc_two_factor_challenges WHERE challenge_id_hash = %s RETURNING challenge_id_hash",
                (challenge_hash,),
            ).fetchone()
        return row is not None

    def cleanup_two_factor_challenges(self, *, now: datetime | None = None) -> int:
        current = now or datetime.now(timezone.utc)
        with self._connect() as connection:
            rows = connection.execute(
                "DELETE FROM soc_two_factor_challenges WHERE expires_at <= %s RETURNING challenge_id_hash",
                (current,),
            ).fetchall()
        return len(rows)

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

def dump_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))
