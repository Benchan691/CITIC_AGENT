"""Bounded durable evidence, using the standard library and one local file.

All reads require an exact host-resolved scope. SQLite stores complete JSON
records and atomically prunes the oldest snapshots; it never stores credentials.
"""

import json
import sqlite3
from contextlib import contextmanager, closing
from pathlib import Path


class EvidenceStore:
    def __init__(self, path: str, *, max_records: int, max_bytes: int):
        self.path = path
        self.max_records, self.max_bytes = max_records, max_bytes
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, scope TEXT NOT NULL, fingerprint TEXT NOT NULL, created REAL NOT NULL, payload TEXT NOT NULL, bytes INTEGER NOT NULL)")
            db.execute("CREATE INDEX IF NOT EXISTS evidence_lookup ON evidence(scope, fingerprint, created DESC)")

    @contextmanager
    def _connect(self):
        with closing(sqlite3.connect(self.path, timeout=5)) as db, db:
            yield db

    def put(self, record: dict) -> bool:
        payload = json.dumps(record, ensure_ascii=True, separators=(",", ":"))
        size = len(payload.encode())
        if size > self.max_bytes:
            return False
        with self._connect() as db:
            db.execute("INSERT OR REPLACE INTO evidence VALUES (?, ?, ?, ?, ?, ?)", (
                record["evidence_id"], record["scope"], record["fingerprint"], record["created_at"], payload, size,
            ))
            retained, total = 0, 0
            for evidence_id, stored_bytes in db.execute("SELECT id, bytes FROM evidence ORDER BY created DESC").fetchall():
                retained += 1
                total += stored_bytes
                if retained > self.max_records or total > self.max_bytes:
                    db.execute("DELETE FROM evidence WHERE id = ?", (evidence_id,))
        return True

    def get(self, scope: str, evidence_id: str) -> dict | None:
        with self._connect() as db:
            row = db.execute("SELECT payload FROM evidence WHERE scope = ? AND id = ?", (scope, evidence_id)).fetchone()
        return json.loads(row[0]) if row else None

    def latest(self, scope: str, fingerprint: str) -> dict | None:
        with self._connect() as db:
            row = db.execute("SELECT payload FROM evidence WHERE scope = ? AND fingerprint = ? ORDER BY created DESC LIMIT 1", (scope, fingerprint)).fetchone()
        return json.loads(row[0]) if row else None
