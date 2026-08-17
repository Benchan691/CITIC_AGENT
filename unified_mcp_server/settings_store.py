"""Encrypted PostgreSQL-backed settings shared by the MCP and agent runtimes."""

from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Mapping

from cryptography.fernet import Fernet, InvalidToken

try:
    import psycopg
except ImportError:  # pragma: no cover - exercised when the optional runtime is absent
    psycopg = None  # type: ignore[assignment]


PROFILE_ID = "default"


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


class SettingsStore:
    """Persist one encrypted application-settings profile in PostgreSQL."""

    def __init__(self, uri: str, encryption_key: str) -> None:
        if psycopg is None:
            raise _connection_error()
        self.uri = uri.strip()
        if not self.uri:
            raise ValueError("A PostgreSQL URI is required for settings storage")
        self._fernet = Fernet(_fernet_key(encryption_key))
        self._ensure_schema()

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "SettingsStore | None":
        uri = (
            str(env.get("APP_POSTGRES_URI", "")).strip()
            or str(env.get("LANGGRAPH_POSTGRES_URI", "")).strip()
            or str(env.get("POSTGRES_URI", "")).strip()
        )
        if not uri:
            return None
        return cls(uri, str(env.get("APP_SETTINGS_ENCRYPTION_KEY", "")))

    def _connect(self):
        if psycopg is None:  # pragma: no cover
            raise _connection_error()
        return psycopg.connect(self.uri)

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    profile_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

    def load(self) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT payload FROM app_settings WHERE profile_id = %s",
                (PROFILE_ID,),
            ).fetchone()
        if row is None:
            return {}
        try:
            data = json.loads(self._fernet.decrypt(row[0].encode("utf-8")))
        except (InvalidToken, ValueError, TypeError, json.JSONDecodeError) as exc:
            raise RuntimeError("The PostgreSQL application settings could not be decrypted.") from exc
        if not isinstance(data, dict):
            raise RuntimeError("The PostgreSQL application settings payload is invalid.")
        return data

    def save(self, settings: Mapping[str, Any]) -> None:
        payload = self._fernet.encrypt(
            json.dumps(dict(settings), separators=(",", ":"), sort_keys=True).encode("utf-8")
        ).decode("utf-8")
        now = datetime.now(timezone.utc)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO app_settings (profile_id, payload, created_at, updated_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (profile_id) DO UPDATE SET
                    payload = EXCLUDED.payload,
                    updated_at = EXCLUDED.updated_at
                """,
                (PROFILE_ID, payload, now, now),
            )

