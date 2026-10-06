"""Encrypted user report profiles and authorized report artifact registry."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any
from uuid import UUID

from ..errors import ServiceError
from .config import validate_profiles

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_MIME = "application/pdf"


class ReportStore:
    def __init__(self, postgres, root: str | Path | None = None):
        if postgres is None:
            raise ServiceError("report_configuration_unavailable", "Authenticated report storage is unavailable.")
        self.postgres = postgres
        application_root = Path(os.environ.get("MCP_SERVER_ROOT") or os.environ.get("MCP_SEVER_ROOT") or Path(__file__).resolve().parents[5])
        self.root = Path(root).resolve() if root is not None else (application_root / ".data" / "reports").resolve()

    def get_profiles(self, user_id: str, account: str) -> list[dict[str, Any]]:
        with self.postgres._connect() as connection:
            row = connection.execute("SELECT profiles_encrypted FROM soc_report_profiles WHERE owner_user_id = %s", (user_id,)).fetchone()
        if row is None:
            return []
        try:
            values = json.loads(self.postgres._decrypt_text(row[0]))
        except (ValueError, TypeError, RuntimeError) as exc:
            raise ServiceError("report_configuration_invalid", "Stored report settings could not be read. Save your customer settings again.") from exc
        return validate_profiles(values, account)

    def save_profiles(self, user_id: str, account: str, values: Any) -> list[dict[str, Any]]:
        profiles = validate_profiles(values, account)
        encrypted = self.postgres._encrypt_text(json.dumps(profiles, ensure_ascii=False, allow_nan=False))
        with self.postgres._connect() as connection:
            connection.execute("""INSERT INTO soc_report_profiles (owner_user_id, profiles_encrypted)
                VALUES (%s, %s) ON CONFLICT (owner_user_id) DO UPDATE
                SET profiles_encrypted = EXCLUDED.profiles_encrypted, updated_at = NOW()""", (user_id, encrypted))
        return profiles

    def require_session_owner(self, user_id: str, session_id: str) -> None:
        if not isinstance(session_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", session_id):
            raise ServiceError("report_session_required", "Generate the report from an owned conversation session.")
        with self.postgres._connect() as connection:
            row = connection.execute("""SELECT sessions.session_id FROM soc_session_owners AS sessions
                JOIN soc_workspace_owners AS workspaces ON workspaces.workspace_id = sessions.workspace_id
                WHERE sessions.session_id = %s AND sessions.owner_user_id = %s AND workspaces.owner_user_id = %s""", (session_id, user_id, user_id)).fetchone()
        if row is None:
            raise ServiceError("report_session_forbidden", "The report conversation is unavailable or does not belong to your account.")

    def run_directory(self, user_id: str, session_id: str, run_id: str) -> Path:
        owner = hashlib.sha256(user_id.encode()).hexdigest()
        session = hashlib.sha256(session_id.encode()).hexdigest()
        return self.root / owner / session / run_id

    def register_artifacts(self, user_id: str, session_id: str, run_id: str, artifacts: list[dict[str, Any]]) -> None:
        self.require_session_owner(user_id, session_id)
        if len(artifacts) != 2 or {item["mime_type"] for item in artifacts} != {XLSX_MIME, PDF_MIME}:
            raise ServiceError("report_artifact_invalid", "A report must publish one Excel file and one PDF file together.")
        with self.postgres._connect() as connection:
            for item in artifacts:
                connection.execute("""INSERT INTO soc_report_artifacts
                    (id, owner_user_id, session_id, report_run_id, filename, mime_type, size_bytes, relative_path)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""", (item["id"], user_id, session_id, run_id, item["filename"], item["mime_type"], item["size_bytes"], item["relative_path"]))

    def get_artifact(self, user_id: str, session_id: str, artifact_id: str) -> dict[str, Any]:
        try:
            if str(UUID(artifact_id)) != artifact_id:
                raise ValueError
        except (ValueError, TypeError, AttributeError) as exc:
            raise ServiceError("report_artifact_not_found", "The report file is unavailable.") from exc
        self.require_session_owner(user_id, session_id)
        with self.postgres._connect() as connection:
            row = connection.execute("""SELECT id, filename, mime_type, size_bytes, relative_path, session_id
                FROM soc_report_artifacts WHERE id = %s AND owner_user_id = %s AND session_id = %s""", (artifact_id, user_id, session_id)).fetchone()
        if row is None:
            raise ServiceError("report_artifact_not_found", "The report file is unavailable in this conversation.")
        path = (self.root / row[4]).resolve()
        if not path.is_relative_to(self.root) or not path.is_file() or path.stat().st_size != row[3]:
            raise ServiceError("report_artifact_not_found", "The report file is unavailable.")
        return {"id": row[0], "filename": row[1], "mime_type": row[2], "size_bytes": row[3], "path": str(path), "session_id": row[5]}
