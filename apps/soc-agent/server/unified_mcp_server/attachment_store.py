"""Private, durable attachment originals, partitioned by authenticated scope."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
import shutil
import threading
import uuid
from pathlib import Path

from .attachment_validation import _safe_filename
from .env_loader import workspace_root
from .errors import ServiceError
from .request_context import operation_context

MAX_BYTES = 100_000_000
DEFAULT_MAX_BYTES = 10_000_000
MAX_FILES = 20
MAX_STORED_BYTES = 100_000_000


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def chat_directory(root: Path, user_id: str, investigation_id: str) -> Path:
    if not user_id or not investigation_id:
        raise ServiceError("authentication_required", "An authenticated user and chat are required for attachments.")
    return root / _digest(user_id) / _digest(investigation_id)


def scope_directory(root: Path, user_id: str, investigation_id: str, customer_id: str = "") -> Path:
    return chat_directory(root, user_id, investigation_id) / _digest(customer_id)


def delete_chat_files(user_id: str, investigation_id: str) -> None:
    """Called only after an authenticated, owned chat has been deleted."""
    for kind in ("documents", "spreadsheets"):
        root = workspace_root() / ".data" / kind
        directory = chat_directory(root, user_id, investigation_id)
        if directory.is_symlink():
            raise ServiceError("attachment_invalid_request", "The attachment storage directory is invalid.")
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (directory / ".lock").open("a") as lock:
            os.chmod(directory / ".lock", 0o600)
            fcntl.flock(lock, fcntl.LOCK_EX)
            # A tombstone rejects uploads already in flight when deletion won.
            (directory / ".deleted").touch(mode=0o600, exist_ok=True)
            for child in directory.iterdir():
                if child.name in {".lock", ".deleted"}:
                    continue
                if child.is_dir() and not child.is_symlink():
                    shutil.rmtree(child)
                else:
                    child.unlink(missing_ok=True)
        # Pre-upgrade spreadsheet references used one flat, temporary scope.
        if kind == "spreadsheets":
            legacy = root / hashlib.sha256(json.dumps([user_id, investigation_id, ""]).encode()).hexdigest()
            if legacy.exists() and not legacy.is_symlink():
                shutil.rmtree(legacy)


class DocumentStore:
    def __init__(self, root: Path | None = None):
        self.root = root or workspace_root() / ".data" / "documents"
        self._lock = threading.RLock()

    def put(self, data: bytes, filename: str, content_type: str, *,
            user_id: str, investigation_id: str, customer_id: str = "",
            max_bytes: int = DEFAULT_MAX_BYTES) -> dict:
        filename = _safe_filename(filename)
        if not data:
            raise ServiceError("attachment_empty", "The attachment is empty.")
        if len(data) > min(max_bytes, MAX_BYTES):
            raise ServiceError("attachment_too_large", "The attachment exceeds the configured byte limit.")
        directory = scope_directory(self.root, user_id, investigation_id, customer_id)
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        file_id = hashlib.sha256(data + filename.encode()).hexdigest()
        meta = {"filename": filename, "content_type": content_type, "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(), "retention": "chat"}
        # The chat lock and quota cover every customer partition of this chat.
        chat = directory.parent
        with self._lock, (chat / ".lock").open("a") as lock:
            os.chmod(chat / ".lock", 0o600)
            fcntl.flock(lock, fcntl.LOCK_EX)
            if (chat / ".deleted").exists():
                raise ServiceError("attachment_not_found", "This chat was deleted. Choose an available chat.")
            kept = [json.loads(path.read_text()) for path in chat.glob("*/*.json")
                    if path != directory / (file_id + ".json")]
            if len(kept) >= MAX_FILES or sum(item["bytes"] for item in kept) + len(data) > MAX_STORED_BYTES:
                raise ServiceError("attachment_storage_limit", "This chat reached its attachment storage limit (20 files or 100 MB).")
            pending = directory / uuid.uuid4().hex
            try:
                with pending.open("xb") as output:
                    os.chmod(pending, 0o600)
                    output.write(data)
                metadata = pending.with_suffix(".json")
                with metadata.open("x") as output:
                    os.chmod(metadata, 0o600)
                    json.dump(meta, output)
                os.replace(pending, directory / (file_id + ".bin"))
                os.replace(metadata, directory / (file_id + ".json"))
            finally:
                pending.unlink(missing_ok=True)
                pending.with_suffix(".json").unlink(missing_ok=True)
        return {"file_id": file_id, **meta}

    def read(self, file_id: str) -> tuple[bytes, dict]:
        if not isinstance(file_id, str) or not re.fullmatch(r"[0-9a-f]{64}", file_id):
            raise ServiceError("attachment_not_found", "Use a file_id returned for an attachment in this chat.")
        scope = operation_context.get()
        directory = scope_directory(self.root, scope.principal_id, scope.investigation_id, scope.customer_id)
        source = directory / (file_id + ".bin")
        metadata = directory / (file_id + ".json")
        try:
            if (directory.parent / ".deleted").exists() or source.is_symlink() or metadata.is_symlink() or directory.is_symlink():
                raise FileNotFoundError
            meta = json.loads(metadata.read_text())
            if source.stat().st_size > MAX_BYTES:
                raise ServiceError("attachment_too_large", "The stored attachment exceeds its byte limit.")
            data = source.read_bytes()
            if len(data) != meta["bytes"] or hashlib.sha256(data).hexdigest() != meta["sha256"]:
                raise ServiceError("attachment_malformed", "The stored attachment failed its integrity check.")
            return data, meta
        except (FileNotFoundError, KeyError, ValueError):
            raise ServiceError("attachment_not_found", "This attachment is unavailable in the current chat. Attach the original file again.") from None
