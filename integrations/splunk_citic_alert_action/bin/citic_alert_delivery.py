#!/usr/bin/env python3
"""Authenticated Splunk custom action for original alert results.

Splunk invokes this process once for a triggered saved search.  The action
reads the result file supplied by Splunk, preserves source row positions, and
durably spools the immutable run before attempting the SOC endpoint.  The
backend, not this process, chooses customer fields and constructs CID/AID/EID.
"""

from __future__ import annotations

import csv
import gzip
import hashlib
import hmac
import json
import os
import secrets
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen


MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 1_000
DEFAULT_SPOOL_DIR = Path(__file__).resolve().parents[1] / "var" / "citic_alert_spool"


class DeliveryTransientError(RuntimeError):
    pass


class DeliveryPermanentError(RuntimeError):
    pass


class SpoolSaturatedError(RuntimeError):
    pass


def _env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return default


def _input() -> dict[str, Any]:
    input_limit = MAX_BYTES + 16 * 1024
    # Read one byte beyond the accepted bound so an oversized stdin stream is
    # distinguishable from an exactly-boundary payload without unbounded reads.
    raw_bytes = sys.stdin.buffer.read(input_limit + 1)
    if len(raw_bytes) > input_limit:
        raise ValueError("custom alert action input exceeds the bounded limit")
    raw = raw_bytes.decode("utf-8").strip()
    if not raw:
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("custom alert action input must be an object")
    return value


def _configuration(source: Mapping[str, Any]) -> dict[str, Any]:
    """Flatten Splunk's nested ``configuration``/``param.*`` contract."""
    value: Any = source.get("configuration", source.get("config", {}))
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            value = {}
    if not isinstance(value, Mapping):
        value = {}
    result: dict[str, Any] = {}
    for key, item in value.items():
        name = str(key)
        for prefix in (
            "action.citic_alert_delivery.param.",
            "citic_alert_delivery.param.",
            "param.",
        ):
            if name.startswith(prefix):
                name = name[len(prefix):]
                break
        result[name] = item
    return result


def _pick(source: Mapping[str, Any], config: Mapping[str, Any], *names: str, env: tuple[str, ...] = ()) -> Any:
    for name in names:
        if source.get(name) not in (None, ""):
            return source[name]
        if config.get(name) not in (None, ""):
            return config[name]
    return _env(*env)


def _safe_row(row: Mapping[str, Any], selected_columns: list[str]) -> dict[str, str]:
    return {
        str(key): "" if value is None else str(value)
        for key, value in row.items()
        if str(key) in selected_columns and str(key) != "_raw"
    }


def _filter_matches(row: Mapping[str, Any], filters: list[Mapping[str, Any]]) -> bool:
    for item in filters:
        source = str(item.get("source") or item.get("field") or "").strip()
        operator = str(item.get("operator") or item.get("op") or "equals").strip().casefold()
        if operator in {"eq", "=="}:
            operator = "equals"
        elif operator in {"ne", "!="}:
            operator = "not_equals"
        left = row.get(source)
        exists = source in row and left not in (None, "")
        if operator == "exists":
            if not exists:
                return False
            continue
        if operator == "not_exists":
            if exists:
                return False
            continue
        right = item.get("value")
        if isinstance(left, str) or isinstance(right, str):
            left_value = "" if left is None else str(left).casefold()
            right_value = "" if right is None else str(right).casefold()
        else:
            left_value, right_value = left, right
        if operator == "equals":
            matched = left_value == right_value
        elif operator == "not_equals":
            matched = left_value != right_value
        elif operator == "contains":
            matched = right_value in left_value
        elif operator == "not_contains":
            matched = right_value not in left_value
        else:
            raise ValueError("row filters are invalid")
        if not matched:
            return False
    return True


def _row_filters(source: Mapping[str, Any], config: Mapping[str, Any]) -> list[dict[str, Any]]:
    value = _pick(source, config, "row_filters")
    if value in (None, ""):
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("row filters are invalid") from exc
    if not isinstance(value, list) or len(value) > 100:
        raise ValueError("row filters are invalid")
    result: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, Mapping):
            raise ValueError("row filters are invalid")
        source_name = item.get("source", item.get("field", item.get("name")))
        operator = str(item.get("operator", item.get("op", "equals"))).strip().casefold()
        if operator in {"eq", "=="}:
            operator = "equals"
        elif operator in {"ne", "!="}:
            operator = "not_equals"
        if not isinstance(source_name, str) or not source_name.strip() or source_name.strip() == "_raw":
            raise ValueError("row filters are invalid")
        if operator not in {"equals", "not_equals", "contains", "not_contains", "exists", "not_exists"}:
            raise ValueError("row filters are invalid")
        filter_value = item.get("value")
        if filter_value is not None and not isinstance(filter_value, (str, int, float, bool)):
            raise ValueError("row filters are invalid")
        result.append({"source": source_name.strip(), "operator": operator, "value": filter_value})
    return result


def _max_stored_rows(source: Mapping[str, Any], config: Mapping[str, Any]) -> int:
    value = _pick(source, config, "max_stored_rows")
    if value in (None, ""):
        return MAX_ROWS
    try:
        value = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("max stored rows are invalid") from exc
    if value < 1 or value > MAX_ROWS:
        raise ValueError("max stored rows are invalid")
    return value


def _row_budget_with_counts(
    rows: list[Mapping[str, Any]],
    positions: list[int],
    selected_columns: list[str],
    filters: list[Mapping[str, Any]] | None = None,
    max_rows: int = MAX_ROWS,
) -> tuple[list[dict[str, str]], list[int], bool, int, int]:
    retained: list[dict[str, str]] = []
    retained_positions: list[int] = []
    used = 0
    truncated = False
    matching_count = 0
    budget_exhausted = False
    filters = filters or []
    for position, row in zip(positions, rows, strict=True):
        if not _filter_matches(row, filters):
            continue
        matching_count += 1
        if len(retained) >= max_rows or budget_exhausted:
            truncated = True
            continue
        projected = _safe_row(row, selected_columns)
        encoded = json.dumps(projected, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if used + len(encoded) > MAX_BYTES:
            truncated = True
            budget_exhausted = True
            continue
        retained.append(projected)
        retained_positions.append(position)
        used += len(encoded)
    if matching_count > len(retained):
        truncated = True
    return retained, retained_positions, truncated, len(rows), matching_count


def _row_budget(
    rows: list[Mapping[str, Any]],
    positions: list[int],
    selected_columns: list[str],
) -> tuple[list[dict[str, str]], list[int], bool]:
    retained, retained_positions, truncated, _source_total, _matching_total = _row_budget_with_counts(
        rows, positions, selected_columns
    )
    return retained, retained_positions, truncated


def _read_results_with_counts(
    path: str,
    selected_columns: list[str],
    filters: list[Mapping[str, Any]] | None = None,
    max_rows: int = MAX_ROWS,
) -> tuple[list[dict[str, str]], list[int], bool, int, int]:
    if not path:
        return [], [], False, 0, 0
    result_path = Path(path)
    if not result_path.is_file():
        raise ValueError("Splunk result file is not available")
    opener = gzip.open if result_path.suffix.casefold() == ".gz" else open
    rows: list[Mapping[str, Any]] = []
    positions: list[int] = []
    source_total = 0
    matching_total = 0
    truncated = False
    with opener(result_path, "rt", encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        for position, row in enumerate(reader):
            if not isinstance(row, dict):
                continue
            source_total += 1
            if not _filter_matches(row, filters or []):
                continue
            matching_total += 1
            if len(rows) < max_rows:
                rows.append(row)
                positions.append(position)
            else:
                truncated = True
    projected, projected_positions, budget_truncated, _retained_source, _retained_matching = _row_budget_with_counts(
        rows, positions, selected_columns, max_rows=max_rows
    )
    return projected, projected_positions, truncated or budget_truncated, source_total, matching_total


def _read_results(path: str, selected_columns: list[str]) -> tuple[list[dict[str, str]], list[int], bool]:
    projected, positions, truncated, _source_total, _matching_total = _read_results_with_counts(
        path, selected_columns
    )
    return projected, positions, truncated


def _positions(source: Mapping[str, Any], config: Mapping[str, Any], count: int) -> list[int]:
    value = _pick(source, config, "original_row_positions", "row_positions")
    if value in (None, ""):
        return list(range(count))
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("original row positions are invalid") from exc
    if not isinstance(value, list) or len(value) != count:
        raise ValueError("original row positions must match result rows")
    parsed: list[int] = []
    for item in value:
        if isinstance(item, bool):
            raise ValueError("original row positions are invalid")
        try:
            position = int(item)
        except (TypeError, ValueError) as exc:
            raise ValueError("original row positions are invalid") from exc
        if position < 0:
            raise ValueError("original row positions are invalid")
        parsed.append(position)
    if parsed != sorted(set(parsed)):
        raise ValueError("original row positions must be strictly increasing")
    return parsed


def _selected_columns(source: Mapping[str, Any], config: Mapping[str, Any]) -> list[str]:
    """Read the publisher's approved projection, defaulting to no details."""
    value = _pick(source, config, "selected_columns", "detail_columns")
    if value in (None, ""):
        return []
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            value = decoded if isinstance(decoded, list) else [item.strip() for item in value.split(",")]
        except (TypeError, ValueError):
            value = [item.strip() for item in value.split(",")]
    if not isinstance(value, list) or len(value) > 100:
        raise ValueError("selected columns are invalid")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError("selected columns are invalid")
        name = item.strip()
        if not name or name == "_raw" or len(name) > 255 or name in result:
            if name == "_raw" or len(name) > 255:
                raise ValueError("selected columns are invalid")
            continue
        result.append(name)
    return result


def build_payload(source: dict[str, Any]) -> dict[str, Any]:
    config = _configuration(source)
    selected_columns = _selected_columns(source, config)
    filters = _row_filters(source, config)
    max_stored_rows = _max_stored_rows(source, config)
    rows_value = _pick(source, config, "rows", "results")
    if isinstance(rows_value, list):
        raw_rows = [item for item in rows_value if isinstance(item, Mapping)]
        if len(raw_rows) != len(rows_value):
            raise ValueError("alert result rows must contain objects")
        source_positions = _positions(source, config, len(raw_rows))
        rows, positions, truncated, source_total, matching_total = _row_budget_with_counts(
            raw_rows, source_positions, selected_columns, filters, max_stored_rows
        )
    else:
        results_file = _pick(
            source,
            config,
            "results_file", "results_file_path", "result_file",
            env=("SPLUNK_ALERT_RESULTS_FILE", "SPLUNK_ARG_8"),
        )
        rows, positions, truncated, source_total, matching_total = _read_results_with_counts(
            str(results_file or ""), selected_columns, filters, max_stored_rows
        )

    trigger_time = _pick(
        source, config, "trigger_time", "triggerTime", "run_time", env=("CITIC_ALERT_TRIGGER_TIME", "SPLUNK_ALERT_TRIGGER_TIME", "SPLUNK_ARG_4")
    )
    result_count = _pick(source, config, "result_count", "source_result_count", env=("CITIC_ALERT_RESULT_COUNT", "SPLUNK_ALERT_RESULT_COUNT"))
    if result_count in (None, ""):
        result_count = source_total
    try:
        result_count = int(result_count)
    except (TypeError, ValueError) as exc:
        raise ValueError("result_count is invalid") from exc
    if result_count < source_total or result_count < 0:
        raise ValueError("result_count is invalid")

    name = str(_pick(source, config, "alert_name", "saved_search_name", "search_name", env=("SPLUNK_ALERT_NAME", "SPLUNK_ARG_5")) or "").strip()
    app = str(_pick(source, config, "app", env=("CITIC_ALERT_APP", "SPLUNK_ALERT_APP")) or "").strip()
    owner = str(_pick(source, config, "owner", env=("CITIC_ALERT_OWNER", "SPLUNK_ALERT_OWNER")) or "").strip()
    definition = _pick(source, config, "definition")
    if not isinstance(definition, dict):
        definition = {}
    definition = dict(definition)
    definition.setdefault("name", name)
    definition.setdefault("app", app)
    definition.setdefault("owner", owner)
    spl = _pick(source, config, "spl", "search", env=("CITIC_ALERT_SPL",))
    if spl:
        definition.setdefault("spl", spl)
    indexes = _pick(source, config, "source_indexes", env=("CITIC_ALERT_SOURCE_INDEXES",))
    if isinstance(indexes, str):
        try:
            decoded_indexes = json.loads(indexes)
        except (TypeError, ValueError):
            decoded_indexes = None
        if isinstance(decoded_indexes, list):
            indexes = decoded_indexes
        else:
            indexes = [item.strip() for item in indexes.split(",") if item.strip()]
    if isinstance(indexes, list) and indexes:
        definition.setdefault(
            "source_indexes",
            [str(item).strip() for item in indexes if isinstance(item, str) and item.strip()],
        )

    deployment = str(_pick(source, config, "deployment", "deployment_id", env=("CITIC_ALERT_DEPLOYMENT", "SPLUNK_DEPLOYMENT_ID")) or "").strip()
    registration_id = str(_pick(source, config, "registration_id", env=("CITIC_ALERT_REGISTRATION_ID",)) or "").strip()
    policy_id = str(_pick(source, config, "policy_id", "email_policy_id", env=("CITIC_ALERT_POLICY_ID",)) or "").strip()
    policy_revision = _pick(source, config, "policy_revision", "email_policy_revision", env=("CITIC_ALERT_POLICY_REVISION",))
    definition_revision = _pick(source, config, "definition_revision", env=("CITIC_ALERT_DEFINITION_REVISION",))
    if not policy_id or policy_revision in (None, "") or definition_revision in (None, ""):
        raise ValueError("registration and approved policy revisions are required")
    try:
        policy_revision = int(policy_revision)
        definition_revision = int(definition_revision)
    except (TypeError, ValueError) as exc:
        raise ValueError("registration and approved policy revisions are invalid") from exc
    if policy_revision < 1 or definition_revision < 1:
        raise ValueError("registration and approved policy revisions are invalid")

    sid = str(_pick(source, config, "sid", "search_id", env=("SPLUNK_SID", "SPLUNK_ARG_3")) or "").strip()
    if not deployment or not name or not sid or not trigger_time:
        raise ValueError("deployment, saved-search identity, SID, and trigger time are required")
    stable_id = str(_pick(source, config, "stable_id", "guid", "uid", env=("CITIC_ALERT_STABLE_ID",)) or "").strip()
    severity = _pick(source, config, "severity", "urgency", env=("CITIC_ALERT_SEVERITY",))
    payload: dict[str, Any] = {
        "version": 1,
        "deployment": deployment,
        "registration_id": registration_id,
        "stable_id": stable_id,
        "cid": _pick(source, config, "cid", env=("CITIC_ALERT_CID",)),
        "aid": _pick(source, config, "aid", env=("CITIC_ALERT_AID",)),
        "sid": sid,
        "alert_name": name,
        "app": app,
        "owner": owner,
        "trigger_time": str(trigger_time),
        "result_count": result_count,
        "source_result_count": result_count,
        "matching_count": matching_total,
        "retained_count": len(rows),
        "truncated": bool(truncated),
        "severity": severity,
        "policy_id": policy_id,
        "policy_revision": policy_revision,
        "definition_revision": definition_revision,
        "definition": definition,
        "selected_columns": selected_columns,
        "original_row_positions": positions,
        "rows": rows,
    }
    if len(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) > MAX_BYTES:
        raise ValueError("CITIC alert action payload exceeds the bounded limit")
    return payload


def _endpoint() -> tuple[str, str]:
    url = _env("CITIC_ALERT_INGEST_URL")
    secret = _env("CITIC_ALERT_INGEST_SECRET")
    if not url or not secret:
        raise ValueError("CITIC alert action endpoint and deployment secret are required")
    parsed = urlsplit(url)
    if parsed.scheme.casefold() != "https" or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("CITIC alert action endpoint must be an HTTPS URL without credentials")
    return url, secret


def _policy_endpoint() -> tuple[str, str]:
    configured = _env("CITIC_ALERT_POLICY_URL")
    if configured:
        url = configured
        secret = _env("CITIC_ALERT_INGEST_SECRET")
    else:
        ingest_url, secret = _endpoint()
        parsed = urlsplit(ingest_url)
        path = parsed.path.rstrip("/")
        if path.endswith("/runs"):
            path = path[:-len("/runs")] + "/action-context"
        else:
            path += "/action-context"
        url = urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))
    parsed = urlsplit(url)
    if parsed.scheme.casefold() != "https" or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("CITIC alert action context endpoint must be an HTTPS URL without credentials")
    if not secret:
        raise ValueError("CITIC alert action deployment secret is required")
    return url, secret


def _signed_post(
    url: str,
    secret: str,
    value: Mapping[str, Any],
    *,
    replay_id: str,
) -> dict[str, Any]:
    body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(body) > MAX_BYTES:
        raise ValueError("CITIC alert action request exceeds the bounded limit")
    timestamp = str(int(time.time()))
    signature = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.".encode("utf-8") + body,
        hashlib.sha256,
    ).hexdigest()
    request = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-CITIC-Alert-Timestamp": timestamp,
            "X-CITIC-Alert-Signature": f"sha256={signature}",
            "X-CITIC-Alert-Replay": replay_id,
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            response_body = response.read(64 * 1024 + 1)
            if len(response_body) > 64 * 1024:
                raise DeliveryPermanentError("SOC endpoint returned an oversized response")
            if response.status < 200 or response.status >= 300:
                raise DeliveryTransientError(f"SOC endpoint returned HTTP {response.status}")
    except HTTPError as exc:
        if 400 <= exc.code < 500 and exc.code not in {408, 425, 429}:
            raise DeliveryPermanentError(f"SOC endpoint rejected alert action (HTTP {exc.code})") from exc
        raise DeliveryTransientError("SOC endpoint was temporarily unavailable") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise DeliveryTransientError("CITIC alert delivery endpoint was unavailable") from exc
    try:
        result = json.loads(response_body.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DeliveryPermanentError("SOC endpoint returned malformed JSON") from exc
    if not isinstance(result, dict):
        raise DeliveryPermanentError("SOC endpoint returned an invalid context response")
    return result


def fetch_action_context(source: Mapping[str, Any], *, replay_id: str | None = None) -> dict[str, Any]:
    """Fetch backend-owned registration/policy fields for direct Splunk Web actions."""
    config = _configuration(source)
    definition = _pick(source, config, "definition")
    if not isinstance(definition, Mapping):
        definition = {}
    definition = dict(definition)
    name = str(_pick(source, config, "alert_name", "saved_search_name", "search_name", env=("SPLUNK_ALERT_NAME", "SPLUNK_ARG_5")) or "").strip()
    app = str(_pick(source, config, "app", env=("CITIC_ALERT_APP", "SPLUNK_ALERT_APP")) or "").strip()
    owner = str(_pick(source, config, "owner", env=("CITIC_ALERT_OWNER", "SPLUNK_ALERT_OWNER")) or "").strip()
    spl = _pick(source, config, "spl", "search", env=("CITIC_ALERT_SPL",))
    indexes = _pick(source, config, "source_indexes", env=("CITIC_ALERT_SOURCE_INDEXES",))
    if isinstance(indexes, str):
        try:
            decoded = json.loads(indexes)
        except (TypeError, ValueError):
            decoded = None
        indexes = decoded if isinstance(decoded, list) else [item.strip() for item in indexes.split(",") if item.strip()]
    definition.setdefault("name", name)
    definition.setdefault("app", app)
    definition.setdefault("owner", owner)
    if spl:
        definition.setdefault("spl", spl)
    if isinstance(indexes, list) and indexes:
        definition.setdefault("source_indexes", indexes)
    request_payload: dict[str, Any] = {
        "deployment": str(_pick(source, config, "deployment", "deployment_id", env=("CITIC_ALERT_DEPLOYMENT", "SPLUNK_DEPLOYMENT_ID")) or "").strip(),
        "registration_id": str(_pick(source, config, "registration_id", env=("CITIC_ALERT_REGISTRATION_ID",)) or "").strip(),
        "stable_id": str(_pick(source, config, "stable_id", "guid", "uid", env=("CITIC_ALERT_STABLE_ID",)) or "").strip(),
        "alert_name": name,
        "app": app,
        "owner": owner,
        "spl": spl or "",
        "source_indexes": indexes if isinstance(indexes, list) else [],
        "definition": definition,
    }
    url, secret = _policy_endpoint()
    return _signed_post(
        url,
        secret,
        request_payload,
        replay_id=replay_id or "policy-" + secrets.token_urlsafe(24),
    )


def _with_action_context(source: dict[str, Any], *, replay_id: str | None = None) -> dict[str, Any]:
    # Always refresh backend-owned routing and policy data.  Saved-search copies
    # can inherit the parent's action parameters, so trusting an embedded
    # registration ID would route a copy to the original AID.
    enriched = dict(source)
    enriched.update(fetch_action_context(source, replay_id=replay_id))
    return enriched


def send(payload: dict[str, Any], *, replay_id: str | None = None) -> None:
    url, secret = _endpoint()
    _signed_post(url, secret, payload, replay_id=replay_id or secrets.token_urlsafe(24))


class DurableSpool:
    """Small atomic, bounded JSON spool using only the Python standard library."""

    def __init__(self) -> None:
        self.path = Path(_env("CITIC_ALERT_SPOOL_DIR", default=str(DEFAULT_SPOOL_DIR)))
        self.max_runs = max(1, int(_env("CITIC_ALERT_SPOOL_MAX_RUNS", default="5000")))
        self.max_bytes = max(MAX_BYTES, int(_env("CITIC_ALERT_SPOOL_MAX_BYTES", default=str(512 * 1024 * 1024))))
        self.path.mkdir(parents=True, exist_ok=True)
        self.lock_path = self.path / ".lock"

    def _files(self) -> list[Path]:
        return sorted(self.path.glob("*.json"), key=lambda item: item.name)

    def _all_files(self) -> list[Path]:
        """Return pending and terminal entries for the bounded spool budget."""
        return sorted(
            (*self.path.glob("*.json"), *self.path.glob("*.failed")),
            key=lambda item: item.name,
        )

    def _lock(self):
        stream = self.lock_path.open("a+")
        try:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        except ImportError:  # pragma: no cover - Splunk supported platforms are POSIX
            pass
        return stream

    @staticmethod
    def _unlock(stream: Any) -> None:
        try:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
        except ImportError:  # pragma: no cover
            pass
        stream.close()

    def _enqueue_envelope(self, value: Mapping[str, Any]) -> Path:
        envelope = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(envelope) > self.max_bytes:
            raise SpoolSaturatedError("one alert run exceeds the configured spool size")
        digest = hashlib.sha256(envelope).hexdigest()
        target = self.path / f"{time.time_ns():020d}-{digest}.json"
        lock = self._lock()
        try:
            files = self._all_files()
            if any(digest in item.name for item in files):
                return next(item for item in files if digest in item.name)
            used = sum(item.stat().st_size for item in files if item.is_file())
            if len(files) >= self.max_runs or used + len(envelope) > self.max_bytes:
                raise SpoolSaturatedError("CITIC alert delivery spool is full")
            with tempfile.NamedTemporaryFile("wb", dir=self.path, prefix=".pending-", delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(envelope)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
            return target
        finally:
            self._unlock(lock)

    def enqueue(self, payload: dict[str, Any], replay_id: str) -> Path:
        return self._enqueue_envelope(
            {"replay_id": replay_id, "payload": payload, "attempts": 0, "next_attempt_at": 0}
        )

    def enqueue_source(self, source: dict[str, Any], replay_id: str) -> Path:
        """Persist an unprojected run until the backend policy can be fetched.

        The source is only a recovery record.  ``flush`` resolves the policy,
        projects the run, atomically replaces this envelope with the immutable
        payload, and only then sends it to the backend.
        """
        return self._enqueue_envelope(
            {"replay_id": replay_id, "source": source, "attempts": 0, "next_attempt_at": 0}
        )

    def _rewrite(self, path: Path, envelope: Mapping[str, Any]) -> None:
        encoded = json.dumps(envelope, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(encoded) > self.max_bytes:
            raise SpoolSaturatedError("one alert run exceeds the configured spool size")
        used = sum(
            item.stat().st_size
            for item in self._all_files()
            if item.is_file() and item != path
        )
        if used + len(encoded) > self.max_bytes:
            raise SpoolSaturatedError("CITIC alert delivery spool is full")
        with tempfile.NamedTemporaryFile("wb", dir=path.parent, prefix=".retry-", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)

    def _defer(self, path: Path, envelope: Mapping[str, Any]) -> None:
        retry_envelope = dict(envelope)
        attempts = int(retry_envelope.get("attempts", 0) or 0) + 1
        retry_envelope["attempts"] = attempts
        retry_envelope["next_attempt_at"] = time.time() + min(300, 2 ** min(attempts, 8))
        try:
            self._rewrite(path, retry_envelope)
        except SpoolSaturatedError:
            # Keep the already durable envelope if the aggregate bound is
            # temporarily full.  The caller still reports saturation and the
            # next action invocation can retry it after space is freed.
            pass

    def flush(self) -> tuple[int, str | None]:
        delivered = 0
        lock = self._lock()
        try:
            for item in self._files():
                try:
                    envelope = json.loads(item.read_text(encoding="utf-8"))
                    if not isinstance(envelope, Mapping):
                        raise DeliveryPermanentError("spool entry is malformed")
                    replay_id = str(envelope.get("replay_id") or "").strip()
                    if not replay_id:
                        raise DeliveryPermanentError("spool replay identifier is missing")
                    try:
                        next_attempt_at = float(envelope.get("next_attempt_at", 0) or 0)
                    except (TypeError, ValueError):
                        raise DeliveryPermanentError("spool retry metadata is malformed")
                    if next_attempt_at > time.time():
                        continue
                    payload = envelope.get("payload")
                    if not isinstance(payload, Mapping):
                        source = envelope.get("source")
                        if not isinstance(source, Mapping):
                            raise DeliveryPermanentError("spool entry has no payload or source")
                        payload = build_payload(
                            _with_action_context(
                                dict(source),
                                replay_id="policy-" + replay_id,
                            )
                        )
                        projected_envelope = dict(envelope)
                        projected_envelope.pop("source", None)
                        projected_envelope["payload"] = payload
                        self._rewrite(item, projected_envelope)
                        # Keep the immutable, backend-approved projection for
                        # retries.  Refetching policy context after a
                        # transient transport failure could otherwise turn a
                        # single Splunk run into a different payload when an
                        # administrator edits the policy in the meantime.
                        envelope = projected_envelope
                        payload = projected_envelope["payload"]
                    send(dict(payload), replay_id=replay_id)
                except DeliveryTransientError as exc:
                    self._defer(item, envelope)
                    return delivered, str(exc)
                except SpoolSaturatedError as exc:
                    self._defer(item, envelope)
                    return delivered, str(exc)
                except DeliveryPermanentError as exc:
                    item.rename(item.with_suffix(".failed"))
                    return delivered, str(exc)
                except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
                    item.rename(item.with_suffix(".failed"))
                    return delivered, f"spool entry failed: {type(exc).__name__}"
                else:
                    item.unlink(missing_ok=True)
                    delivered += 1
        finally:
            self._unlock(lock)
        return delivered, None

    def pending(self) -> int:
        return len(self._files())

    def failed(self) -> int:
        return len(tuple(self.path.glob("*.failed")))


def main() -> int:
    try:
        spool = DurableSpool()
        _, prior_error = spool.flush()
        replay_id = _env("CITIC_ALERT_REPLAY_ID", default=secrets.token_urlsafe(24))
        source = _input()
        try:
            payload = build_payload(_with_action_context(source, replay_id="policy-" + replay_id))
        except DeliveryTransientError:
            # Persist before returning.  A process exit is not a durable retry
            # mechanism, but the local spool is.
            spool.enqueue_source(source, replay_id)
            payload = None
        if payload is not None:
            spool.enqueue(payload, replay_id)
        _, current_error = spool.flush()
        error = current_error or prior_error
        if error or spool.pending() or spool.failed():
            print(f"CITIC alert delivery queued for retry: {str(error or 'backend acknowledgement pending')[:240]}", file=sys.stderr)
            return 1
    except Exception as exc:
        print(f"CITIC alert delivery failed: {str(exc)[:240]}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
