"""Encrypted local storage for Zimbra account credentials."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import RLock
from typing import Any

from cryptography.fernet import Fernet, InvalidToken


def _mask_email(value: str) -> str:
    if "@" not in value:
        return "configured" if value else ""
    local, domain = value.split("@", 1)
    return f"{local[:1]}***@{domain}"


def _derive_key(value: str) -> bytes:
    return base64.urlsafe_b64encode(hashlib.sha256(value.encode("utf-8")).digest())


@dataclass(frozen=True)
class StoredAccount:
    id: str
    label: str
    email: str
    username: str
    password: str

    def public_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "email": self.email,
            "username": self.username,
        }

    def agent_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "email": _mask_email(self.email),
        }


class AccountStore:
    """Small encrypted JSON store; credentials never leave this process."""

    def __init__(self, path: str, key_path: str, explicit_key: str = "") -> None:
        self.path = Path(path).expanduser()
        self.key_path = Path(key_path).expanduser()
        self.explicit_key = explicit_key.strip()
        self._lock = RLock()
        self._accounts: dict[str, StoredAccount] = {}
        self._load()

    def list(self) -> list[StoredAccount]:
        with self._lock:
            return list(self._accounts.values())

    def list_public(self) -> list[dict[str, Any]]:
        return [account.public_dict() for account in self.list()]

    def list_agent(self) -> list[dict[str, Any]]:
        return [account.agent_dict() for account in self.list()]

    def count(self) -> int:
        with self._lock:
            return len(self._accounts)

    def get(self, account_id: str) -> StoredAccount | None:
        with self._lock:
            return self._accounts.get(account_id.strip())

    def add(self, *, label: str, email: str, username: str, password: str) -> StoredAccount:
        account = StoredAccount(
            id=secrets.token_urlsafe(12),
            label=label.strip() or email.strip(),
            email=email.strip(),
            username=username.strip(),
            password=password,
        )
        with self._lock:
            self._accounts[account.id] = account
            self._save()
        return account

    def update(
        self,
        account_id: str,
        *,
        label: str | None = None,
        email: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ) -> StoredAccount:
        with self._lock:
            current = self._accounts.get(account_id.strip())
            if current is None:
                raise KeyError(account_id)
            account = StoredAccount(
                id=current.id,
                label=current.label if label is None else label.strip() or current.label,
                email=current.email if email is None else email.strip(),
                username=current.username if username is None else username.strip(),
                password=current.password if password is None else password,
            )
            self._accounts[account.id] = account
            self._save()
            return account

    def delete(self, account_id: str) -> bool:
        with self._lock:
            removed = self._accounts.pop(account_id.strip(), None)
            if removed is None:
                return False
            self._save()
            return True

    def _fernet(self) -> Fernet:
        if self.explicit_key:
            return Fernet(_derive_key(self.explicit_key))

        self.key_path.parent.mkdir(parents=True, exist_ok=True)
        if self.key_path.exists():
            key = self.key_path.read_bytes().strip()
        else:
            key = Fernet.generate_key()
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
            fd = os.open(self.key_path, flags, 0o600)
            try:
                os.write(fd, key)
            finally:
                os.close(fd)
        os.chmod(self.key_path, 0o600)
        return Fernet(key)

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            payload = self._fernet().decrypt(self.path.read_bytes())
            data = json.loads(payload.decode("utf-8"))
            accounts = data.get("accounts", [])
            self._accounts = {
                item["id"]: StoredAccount(**item)
                for item in accounts
                if isinstance(item, dict)
            }
        except InvalidToken as exc:
            raise RuntimeError("The Zimbra account store could not be decrypted.") from exc
        except (OSError, ValueError, TypeError, KeyError) as exc:
            raise RuntimeError("The Zimbra account store is invalid or unreadable.") from exc

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(
            {"version": 1, "accounts": [asdict(account) for account in self._accounts.values()]},
            separators=(",", ":"),
        ).encode("utf-8")
        encrypted = self._fernet().encrypt(payload)
        fd, temp_name = tempfile.mkstemp(prefix=f".{self.path.name}.", dir=self.path.parent)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(encrypted)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, self.path)
            os.chmod(self.path, 0o600)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
