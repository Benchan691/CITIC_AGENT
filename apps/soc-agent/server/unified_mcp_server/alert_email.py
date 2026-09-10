"""Automatic email delivery for newly ingested security events.

The event trigger writes one durable outbox row.  This module evaluates the
operator-maintained rules and delivers a bounded notification through the
configured SMTP relay.  It deliberately does not read or copy raw
Splunk evidence into email.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parseaddr
from typing import Any

from .config import ServerSettings
from .env_loader import load_server_env
from .alert_identity import DEFAULT_DISPLAY_ROWS
from .postgres_store import PostgresBootstrap, create_connection_pool
from .smtp_alert import AlertEmailSender, normalize_routing, routing_matches, render_html, merge_recipients

try:
    import psycopg
except ImportError:  # pragma: no cover - optional runtime guard
    psycopg = None  # type: ignore[assignment]


LOGGER = logging.getLogger(__name__)
ALLOWED_SEVERITIES = {"info", "low", "medium", "high", "critical"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+$")
MAX_RECIPIENTS = 50
MAX_ADDRESS_LENGTH = 320


def _bounded(value: Any, limit: int = 500) -> str:
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    return text[:limit]


def _email(value: Any) -> str:
    raw = str(value or "").strip()
    if len(raw) > MAX_ADDRESS_LENGTH or "\r" in raw or "\n" in raw:
        raise ValueError("email address is invalid")
    name, address = parseaddr(raw)
    if name or address != raw or not EMAIL_RE.fullmatch(raw):
        raise ValueError("email address must be a plain address")
    return raw


def _address_list(value: Any, field: str, *, required: bool = False) -> list[str]:
    if value in (None, ""):
        values: list[Any] = []
    elif isinstance(value, str):
        values = [value]
    elif isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        values = list(value)
    else:
        raise ValueError(f"{field} must be a list of email addresses")
    if len(values) > MAX_RECIPIENTS:
        raise ValueError(f"{field} contains too many recipients")
    result = []
    for item in values:
        address = _email(item)
        if address.casefold() not in {existing.casefold() for existing in result}:
            result.append(address)
    if required and not result:
        raise ValueError("recipients must contain at least one email address")
    return result


def normalize_email_config(value: Any, *, require_recipient: bool = True) -> dict[str, Any]:
    """Validate the customer ``email_config`` JSON contract.

    The accepted shape is ``{"recipients": [], "cc": [], "bcc": []}``.
    A bare list is accepted for migration compatibility and normalized to the
    object shape.  No caller-controlled subject or body is persisted.
    """
    if isinstance(value, Mapping):
        recipients = value.get("recipients", value.get("to", []))
        cc = value.get("cc", [])
        bcc = value.get("bcc", [])
    elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        recipients, cc, bcc = value, [], []
    elif value in (None, ""):
        recipients, cc, bcc = [], [], []
    else:
        raise ValueError("email_config must be an object")
    result = {
        "recipients": _address_list(recipients, "recipients", required=require_recipient),
        "cc": _address_list(cc, "cc"),
        "bcc": _address_list(bcc, "bcc"),
    }
    if isinstance(value, Mapping):
        for key, allowed, default in (("language", {"EN", "CN", "ZH"}, "EN"), ("brand", {"CPC", "CEC"}, "CPC")):
            if key in value:
                item = str(value[key]).upper()
                if item not in allowed:
                    raise ValueError(f"invalid {key}")
                result[key] = item
    return result



@dataclass(frozen=True)
class AlertEmailRule:
    id: str
    name: str
    customer_id: str | None
    ruleset_id: str | None
    severities: tuple[str, ...]
    enabled: bool
    routing: dict = field(default_factory=dict)

    def matches(self, context: "AlertEmailContext") -> bool:
        return bool(
            self.enabled
            and (not self.routing.get("recipients") or self.customer_id == context.customer_id)
            and context.severity
            and context.severity.casefold() in self.severities
            and (self.customer_id is None or self.customer_id == context.customer_id)
            and (self.ruleset_id is None or self.ruleset_id == context.ruleset_id)
            and routing_matches(self.routing, context)
        )


@dataclass(frozen=True)
class AlertEmailContext:
    outbox_id: str
    event_id: str
    customer_id: str
    attempt_count: int
    severity: str | None
    alert_name: str | None
    trigger_time: datetime | None
    result_count: int | None
    splunk_sid: str | None
    customer_gid: str | None
    customer_name: str | None
    ruleset_id: str | None
    rule_number: str | None
    email_config: Any
    metadata: dict = field(default_factory=dict)
    accepted_recipients: list = field(default_factory=list)
    delivery_snapshot: dict | None = None
    cid: str | None = None
    aid: str | None = None
    eid: str | None = None
    detail_columns: list[str] = field(default_factory=list)
    detail_labels: dict[str, str] = field(default_factory=dict)
    detail_rows: list[dict[str, Any]] = field(default_factory=list)
    detail_positions: list[int] = field(default_factory=list)


@dataclass
class EmailCycleReport:
    claimed: int = 0
    sent: int = 0
    skipped: int = 0
    failed: int = 0
    uncertain: int = 0
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "claimed": self.claimed,
            "sent": self.sent,
            "skipped": self.skipped,
            "failed": self.failed,
            "uncertain": self.uncertain,
            "errors": list(self.errors),
        }


def render_alert_email(context: AlertEmailContext) -> tuple[str, str]:
    severity = (context.severity or "unknown").upper()
    customer = _bounded(context.customer_name or context.customer_gid or context.customer_id, 160)
    alert = _bounded(context.alert_name or "Security alert", 160)
    subject = _bounded(f"[SOC][{severity}] {customer} {alert}", 250)
    trigger = context.trigger_time.isoformat() if context.trigger_time else "unknown"
    result_count = str(context.result_count) if context.result_count is not None else "unknown"
    event_identifier = _bounded(context.eid or context.event_id, 256)
    body = "\n".join(
        (
            "A security alert was received.",
            "",
            f"Customer: {customer}",
            f"Customer CID: {_bounded(context.cid, 128) or 'unknown'}",
            f"Customer GID: {_bounded(context.customer_gid, 128) or 'unknown'}",
            f"Alert: {alert}",
            f"Alert AID: {_bounded(context.aid, 128) or 'unknown'}",
            f"Alert EID: {event_identifier}",
            f"Severity: {severity}",
            f"Event time: {trigger}",
            f"Rule number: {_bounded(context.rule_number, 32) or 'unknown'}",
            f"Result count: {result_count}",
            f"Event ID: {event_identifier}",
            f"Splunk SID: {_bounded(context.splunk_sid, 1_024) or 'unknown'}",
            "",
            "Retrieve the event evidence from the SOC system using the event ID or Splunk SID.",
        )
    )
    config = normalize_email_config(context.email_config, require_recipient=False)
    language = config.get('language','EN')
    localized = (context.metadata.get('content') or {}).get(language, {})
    body += "\nDescription: " + _bounded(localized.get('description', context.metadata.get('description')), 1500)
    body += "\nRemediation: " + _bounded(localized.get('remediation'), 1500)
    body += "\nSource types: " + _bounded(', '.join(context.metadata.get('source_types') or []), 500)
    if context.detail_rows or any(
        key in context.metadata for key in ("detail_total", "detail_stored", "detail_displayed")
    ):
        policy = context.metadata.get("email_policy")
        display_limit = DEFAULT_DISPLAY_ROWS
        if isinstance(policy, Mapping):
            try:
                display_limit = max(1, min(int(policy.get("max_display_rows", DEFAULT_DISPLAY_ROWS)), 1_000))
            except (TypeError, ValueError):
                display_limit = DEFAULT_DISPLAY_ROWS
        detail_total = context.metadata.get("detail_total", context.result_count)
        detail_stored = context.metadata.get("detail_stored", len(context.detail_rows))
        detail_displayed = context.metadata.get("detail_displayed", min(len(context.detail_rows), display_limit))
        body += f"\nDetail rows: total={detail_total}; retained={detail_stored}; displayed={detail_displayed}"
        if context.detail_rows:
            body += "\n\nSelected result rows:"
            positions = context.detail_positions or list(range(len(context.detail_rows)))
            for position, row in zip(positions[:display_limit], context.detail_rows[:display_limit], strict=False):
                body += f"\nRow {position + 1}: " + "; ".join(
                    f"{_bounded(context.detail_labels.get(column, column), 128)}={_bounded(row.get(column), 1_000)}"
                    for column in context.detail_columns
                )
    if context.metadata.get("detail_truncated"):
        body += "\n[Additional matching result rows were omitted by the approved limits.]"
    translations = {
        'CN': ['已收到安全告警。','客户','客户 GID','告警','严重程度','事件时间','规则编号','结果数量','事件编号','描述','修复建议','日志源类型','请使用事件编号或 Splunk SID 在 SOC 系统中检索证据。'],
        'ZH': ['已收到安全告警。','客戶','客戶 GID','告警','嚴重程度','事件時間','規則編號','結果數量','事件編號','描述','修復建議','日誌來源類型','請使用事件編號或 Splunk SID 在 SOC 系統中檢索證據。'],
    }
    if language in translations:
        labels = ['A security alert was received.','Customer:','Customer GID:','Alert:','Severity:','Event time:','Rule number:','Result count:','Event ID:','Description:','Remediation:','Source types:','Retrieve the event evidence from the SOC system using the event ID or Splunk SID.']
        translated = dict(zip(labels,translations[language]))
        lines=[]
        for line in body.splitlines():
            label = next((key for key in labels if line.startswith(key)),None)
            lines.append(translated[label] + ('：' if label.endswith(':') else '') + line[len(label):] if label else line)
        body='\n'.join(lines)
    return subject, body[:8_000]


class AlertEmailDeliveryError(RuntimeError):
    """A bounded delivery error with an explicit retry safety decision."""

    def __init__(self, kind: str, message: str) -> None:
        if kind not in {"retryable", "uncertain", "permanent"}:
            raise ValueError("invalid email delivery error kind")
        self.kind = kind
        self.message = _bounded(message, 500)
        super().__init__(self.message)


class AlertEmailStore:
    """PostgreSQL outbox, rule, and worker-state operations."""

    def __init__(self, uri: str) -> None:
        if psycopg is None:
            raise RuntimeError("Alert email delivery requires the psycopg package.")
        self.uri = uri.strip()
        if not self.uri:
            raise ValueError("APP_POSTGRES_URI is required for alert email delivery.")
        self._pool = create_connection_pool(self.uri)
        self._lock_connection = None

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "AlertEmailStore | None":
        bootstrap = PostgresBootstrap.from_env(env)
        return cls(bootstrap.uri) if bootstrap else None

    def _connect(self):
        if self._pool is not None:
            return self._pool.connection()
        return psycopg.connect(self.uri, connect_timeout=5, options="-c statement_timeout=15000")

    def close(self) -> None:
        self.release_worker_lock()
        if self._pool is not None:
            self._pool.close()
            self._pool = None

    def acquire_worker_lock(self, lock_name: str = "citic_soc_alert_email") -> bool:
        if self._lock_connection is not None:
            return True
        connection = psycopg.connect(self.uri, connect_timeout=5, options="-c statement_timeout=15000")
        try:
            row = connection.execute("SELECT pg_try_advisory_lock(hashtext(%s))", (lock_name,)).fetchone()
            if not row or not bool(row[0]):
                connection.close()
                return False
        except Exception:
            connection.close()
            raise
        self._lock_connection = connection
        return True

    def release_worker_lock(self, lock_name: str = "citic_soc_alert_email") -> None:
        connection = self._lock_connection
        self._lock_connection = None
        if connection is None:
            return
        try:
            connection.execute("SELECT pg_advisory_unlock(hashtext(%s))", (lock_name,))
        except Exception:
            pass
        finally:
            connection.close()

    def reset_stale_processing(self) -> None:
        """Called only after acquiring the exclusive worker lock; all claims are orphaned."""
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_event_email_outbox
                SET status = 'uncertain', uncertain_at = NOW(),
                    last_error = 'previous worker stopped before delivery was confirmed',
                    claimed_at = NULL, claimed_by = NULL, next_attempt_at = NULL
                WHERE status = 'processing'
                  AND claimed_at <= NOW() - (%s * INTERVAL '1 second')
                """,
                (0,),
            )

    def claim(self, limit: int, worker_id: str) -> list[AlertEmailContext]:
        with self._connect() as connection:
            # A valid outbox row can become unsafe after it was queued (for
            # example, an administrator can suspend a customer or move an
            # index).  Re-check the complete registered-alert eligibility in
            # the same transaction immediately before claiming it.
            connection.execute(
                """
                UPDATE sec_event_email_outbox AS outbox
                SET status = 'held', next_attempt_at = NULL,
                    last_error = CASE
                        WHEN COALESCE((event.event_data ->> 'email_held')::boolean, FALSE)
                            THEN COALESCE(event.event_data ->> 'email_hold_reason', 'alert is held for review')
                        ELSE 'customer, registration, recipient, or source ownership is no longer eligible'
                    END,
                    claimed_at = NULL, claimed_by = NULL
                FROM sec_events AS event
                LEFT JOIN customers AS customer ON customer.id = event.customer_id
                LEFT JOIN sec_alert_registrations AS registration
                    ON registration.id = event.alert_registration_id
                WHERE outbox.event_id = event.id
                      AND outbox.status IN ('pending', 'failed')
                      AND COALESCE(event.eid, '') <> ''
                      AND NOT COALESCE(event.historical_email_suppressed, FALSE)
                      AND NOT (
                      customer.id IS NOT NULL
                      AND customer.status = 'active'
                      AND customer.alert_delivery_enabled
                      AND registration.id IS NOT NULL
                      AND registration.registration_state = 'active'
                      AND registration.delivery_state = 'ready'
                      AND registration.delivery_enabled
                      AND registration.presence_state IN ('unknown', 'present')
                      AND cardinality(registration.source_indexes) > 0
                      AND jsonb_typeof(customer.email_config -> 'recipients') = 'array'
                      AND jsonb_array_length(customer.email_config -> 'recipients') > 0
                      AND NOT EXISTS (
                          SELECT 1
                          FROM unnest(registration.source_indexes) AS source(index_name)
                          WHERE NOT EXISTS (
                              SELECT 1
                              FROM sec_alert_index_ownership AS ownership
                              WHERE ownership.splunk_deployment = registration.splunk_deployment
                                AND ownership.index_name = source.index_name
                                AND ownership.customer_id = registration.customer_id
                                AND ownership.status = 'active'
                                AND ownership.verified_at IS NOT NULL
                                AND ownership.verification ->> 'verified' = 'true'
                                AND ownership.verification ->> 'deployment' = ownership.splunk_deployment
                                AND ownership.verification ->> 'index_name' = ownership.index_name
                          )
                      )
                      AND NOT COALESCE((event.event_data ->> 'email_held')::boolean, FALSE)
                  )
                """
            )
            rows = connection.execute(
                """
                WITH candidates AS (
                    SELECT outbox.id
                    FROM sec_event_email_outbox AS outbox
                    JOIN sec_events AS event ON event.id = outbox.event_id
                    JOIN customers AS customer ON customer.id = event.customer_id
                    LEFT JOIN sec_alert_registrations AS registration
                        ON registration.id = event.alert_registration_id
                    WHERE outbox.status IN ('pending', 'failed')
                      AND outbox.next_attempt_at IS NOT NULL
                      AND outbox.next_attempt_at <= NOW()
                      AND NOT COALESCE(event.historical_email_suppressed, FALSE)
                      AND (
                          COALESCE(event.eid, '') = ''
                          OR (
                              customer.status = 'active'
                              AND customer.alert_delivery_enabled
                              AND registration.registration_state = 'active'
                              AND registration.delivery_state = 'ready'
                              AND registration.delivery_enabled
                              AND registration.presence_state IN ('unknown', 'present')
                              AND cardinality(registration.source_indexes) > 0
                              AND jsonb_typeof(customer.email_config -> 'recipients') = 'array'
                              AND jsonb_array_length(customer.email_config -> 'recipients') > 0
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM unnest(registration.source_indexes) AS source(index_name)
                                  WHERE NOT EXISTS (
                                      SELECT 1
                                      FROM sec_alert_index_ownership AS ownership
                                      WHERE ownership.splunk_deployment = registration.splunk_deployment
                                        AND ownership.index_name = source.index_name
                                        AND ownership.customer_id = registration.customer_id
                                        AND ownership.status = 'active'
                                        AND ownership.verified_at IS NOT NULL
                                        AND ownership.verification ->> 'verified' = 'true'
                                        AND ownership.verification ->> 'deployment' = ownership.splunk_deployment
                                        AND ownership.verification ->> 'index_name' = ownership.index_name
                                  )
                              )
                              AND NOT COALESCE((event.event_data ->> 'email_held')::boolean, FALSE)
                          )
                      )
                    ORDER BY outbox.created_at, outbox.id
                    FOR UPDATE OF outbox SKIP LOCKED
                    LIMIT %s
                ), claimed AS (
                    UPDATE sec_event_email_outbox AS outbox
                    SET status = 'processing', claimed_at = NOW(), claimed_by = %s,
                        last_attempt_at = NOW(), attempt_count = outbox.attempt_count + 1
                    FROM candidates
                    WHERE outbox.id = candidates.id
                    RETURNING outbox.id, outbox.event_id, outbox.customer_id, outbox.attempt_count,
                              outbox.accepted_recipients, outbox.delivery_snapshot,
                              outbox.recipient_snapshot, outbox.rendering_policy_snapshot
                )
                SELECT claimed.id::text, claimed.event_id::text, claimed.customer_id::text,
                       claimed.attempt_count, event.severity, event.alert_name,
                       event.trigger_time, event.result_count, event.splunk_sid,
                       COALESCE(catalog.gid, customer.gid),
                       COALESCE(catalog.display_name, customer.name),
                       COALESCE(catalog.email_config, customer.email_config),
                       ruleset.id::text, ruleset.rule_number,
                       jsonb_build_object('src_ip', event.src_ip, 'dest_ip', event.dest_ip,
                           'hostname', event.hostname, 'source_type_ids', event.source_type_ids,
                           'customer_active', COALESCE(
                               catalog.archived_at IS NULL AND catalog.lifecycle_status IN ('active', 'provisioning'),
                               customer.status = 'active'
                           ),
                           'content', ruleset.email_content,
                           'description', template.common_logic_summary,
                           'source_types', (SELECT jsonb_agg(st.name) FROM source_types st WHERE st.id = ANY(event.source_type_ids)),
                           'detail_total', event.detail_total,
                           'detail_stored', event.detail_stored,
                           'detail_displayed', event.detail_displayed,
                           'detail_truncated', event.detail_truncated,
                           'email_held', COALESCE((event.event_data ->> 'email_held')::boolean, FALSE),
                           'registration_active', COALESCE(
                               registration.registration_state = 'active'
                               AND registration.delivery_state = 'ready',
                               TRUE
                           )),
                       claimed.accepted_recipients, claimed.delivery_snapshot,
                       event.cid, event.aid, event.eid,
                       COALESCE(event.event_data -> 'detail_columns', '[]'::jsonb),
                       COALESCE((SELECT jsonb_agg(details.row_position ORDER BY details.row_position)
                                 FROM sec_event_details AS details WHERE details.event_id = event.id), '[]'::jsonb),
                       COALESCE((SELECT jsonb_agg(details.details ORDER BY details.row_position)
                                 FROM sec_event_details AS details WHERE details.event_id = event.id), '[]'::jsonb),
                       COALESCE((event.event_data ->> 'email_held')::boolean, FALSE),
                       claimed.recipient_snapshot, claimed.rendering_policy_snapshot
                FROM claimed
                JOIN sec_events AS event ON event.id = claimed.event_id
                JOIN customers AS customer ON customer.id = claimed.customer_id AND customer.id = event.customer_id
                LEFT JOIN sec_alert_registrations AS registration ON registration.id = event.alert_registration_id
                LEFT JOIN soc_customer AS catalog ON catalog.legacy_customer_id = customer.id
                LEFT JOIN rulesets AS ruleset ON ruleset.id = event.ruleset_id AND ruleset.customer_id = customer.id
                LEFT JOIN rule_templates AS template ON template.id = ruleset.rule_template_id
                ORDER BY event.created_at, event.id
                """,
                (max(1, min(int(limit), 201)), worker_id),
            ).fetchall()
        return [self._context(row) for row in rows]

    @staticmethod
    def _context(row: Sequence[Any]) -> AlertEmailContext:
        metadata = row[14] or {}
        if not isinstance(metadata, dict):
            metadata = {}
        position_values = row[21] if len(row) > 21 else []
        if len(row) > 23 and row[23]:
            metadata = {**metadata, "email_held": True}
        registered_run = bool(len(row) > 19 and row[19])
        recipient_snapshot = row[24] if len(row) > 24 and row[24] is not None and registered_run else row[11]
        policy_snapshot = row[25] if len(row) > 25 and row[25] is not None and registered_run else None
        if isinstance(policy_snapshot, dict):
            metadata = {**metadata, "email_policy": policy_snapshot}
        policy = metadata.get("email_policy")
        detail_labels = {}
        if isinstance(policy, Mapping) and isinstance(policy.get("field_mappings"), list):
            for mapping in policy["field_mappings"]:
                if isinstance(mapping, Mapping):
                    source = str(mapping.get("source") or mapping.get("field") or mapping.get("name") or "").strip()
                    label = str(mapping.get("label") or source).strip()
                    if source and label:
                        detail_labels[source] = label
        return AlertEmailContext(
            outbox_id=str(row[0]),
            event_id=str(row[1]),
            customer_id=str(row[2]),
            attempt_count=int(row[3] or 0),
            severity=str(row[4]).casefold() if row[4] else None,
            alert_name=_bounded(row[5], 2_000) or None,
            trigger_time=row[6],
            result_count=int(row[7]) if row[7] is not None else None,
            splunk_sid=_bounded(row[8], 1_024) or None,
            customer_gid=_bounded(row[9], 128) or None,
            customer_name=_bounded(row[10], 2_000) or None,
            email_config=recipient_snapshot,
            ruleset_id=str(row[12]) if row[12] else None,
            rule_number=_bounded(row[13], 32) or None,
            metadata=metadata, accepted_recipients=row[15] or [], delivery_snapshot=row[16],
            cid=_bounded(row[17], 128) or None if len(row) > 17 else None,
            aid=_bounded(row[18], 128) or None if len(row) > 18 else None,
            eid=_bounded(row[19], 256) or None if len(row) > 19 else None,
            detail_columns=list(row[20] or []) if len(row) > 20 and isinstance(row[20], (list, tuple)) else [],
            detail_labels=detail_labels,
            detail_rows=list(row[22] or []) if len(row) > 22 and isinstance(row[22], list) else [],
            detail_positions=[int(position) for position in position_values or [] if not isinstance(position, bool)]
                if isinstance(position_values, (list, tuple)) else [],
        )

    def admin_details(self):
        with self._connect() as connection:
            sources = connection.execute("SELECT id::text,name FROM source_types ORDER BY name").fetchall()
            history = connection.execute("""SELECT o.event_id::text,COALESCE(o.eid,e.eid),o.customer_id::text,
                COALESCE(e.cid,c.cid),COALESCE(e.aid,''),COALESCE(e.eid,''),COALESCE(sc.gid,c.gid),
                o.status,o.created_at::text,o.smtp_accepted_at::text,o.accepted_recipients,
                o.rejected_recipients,o.last_error
                FROM sec_event_email_outbox o JOIN customers c ON c.id=o.customer_id
                JOIN sec_events e ON e.id=o.event_id
                LEFT JOIN soc_customer sc ON sc.legacy_customer_id = c.id
                ORDER BY o.created_at DESC LIMIT 100""").fetchall()
            queue_age = connection.execute(
                """
                SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))), 0)
                FROM sec_event_email_outbox
                WHERE status IN ('pending', 'failed', 'processing', 'held')
                """
            ).fetchone()
            missing_deliveries = connection.execute(
                "SELECT COUNT(*) FROM sec_alert_delivery_reconciliation WHERE status = 'missing'"
            ).fetchone()
            review_count = connection.execute(
                "SELECT COUNT(*) FROM sec_alert_registration_review WHERE resolved_at IS NULL"
            ).fetchone()
            held_count = connection.execute(
                "SELECT COUNT(*) FROM sec_event_email_outbox WHERE status = 'held'"
            ).fetchone()
            discovery_incomplete = connection.execute(
                """
                SELECT COUNT(*) FROM sec_alert_discovery_runs
                WHERE status IN ('incomplete', 'failed')
                  AND started_at >= NOW() - INTERVAL '24 hours'
                """
            ).fetchone()
            publication_failures = connection.execute(
                "SELECT COUNT(*) FROM sec_alert_registrations WHERE publication_state = 'failed'"
            ).fetchone()
            quarantined_runs = connection.execute(
                "SELECT COUNT(*) FROM sec_alert_run_quarantine WHERE resolved_at IS NULL"
            ).fetchone()
        return dict(source_types=[dict(id=r[0], name=r[1]) for r in sources],
                    history=[dict(zip(('event_id','eid','customer_id','cid','aid','event_eid','customer','status','created','smtp_accepted','accepted','rejected','error'), r)) for r in history],
                    metrics={
                        "queue_age_seconds": int(float(queue_age[0] or 0)) if queue_age else 0,
                        "missing_deliveries": int(missing_deliveries[0] or 0) if missing_deliveries else 0,
                        "registration_reviews": int(review_count[0] or 0) if review_count else 0,
                        "held_events": int(held_count[0] or 0) if held_count else 0,
                        "discovery_incomplete_24h": int(discovery_incomplete[0] or 0) if discovery_incomplete else 0,
                        "publication_failures": int(publication_failures[0] or 0) if publication_failures else 0,
                        "quarantined_runs": int(quarantined_runs[0] or 0) if quarantined_runs else 0,
                    })

    def preview(self, customer_id, event_id):
        with self._connect() as connection:
            row = connection.execute("""SELECT '',e.id::text,c.id::text,0,e.severity,e.alert_name,
                e.trigger_time,e.result_count,e.splunk_sid,COALESCE(sc.gid,c.gid),COALESCE(sc.display_name,c.name),
                CASE WHEN COALESCE(e.eid, '') <> '' THEN COALESCE(e.event_data -> 'recipient_snapshot','{}'::jsonb)
                     ELSE COALESCE(sc.email_config,c.email_config) END,
                r.id::text,r.rule_number,
                jsonb_build_object('src_ip',e.src_ip,'dest_ip',e.dest_ip,'hostname',e.hostname,
                'source_type_ids',e.source_type_ids,'customer_active',COALESCE(sc.archived_at IS NULL AND sc.lifecycle_status IN ('active','provisioning'),c.status='active'),'content',r.email_content,
                'description',t.common_logic_summary,'source_types',(SELECT jsonb_agg(s.name) FROM source_types s WHERE s.id=ANY(e.source_type_ids)),
                'email_policy',e.event_data -> 'email_policy','detail_total',e.detail_total,'detail_stored',e.detail_stored,
                'detail_displayed',e.detail_displayed,'detail_truncated',e.detail_truncated,
                'email_held',COALESCE((e.event_data ->> 'email_held')::boolean,FALSE)),
                '[]'::jsonb,NULL,e.cid,e.aid,e.eid,
                COALESCE(e.event_data -> 'detail_columns','[]'::jsonb),
                COALESCE((SELECT jsonb_agg(d.row_position ORDER BY d.row_position)
                          FROM sec_event_details d WHERE d.event_id=e.id),'[]'::jsonb),
                COALESCE((SELECT jsonb_agg(d.details ORDER BY d.row_position)
                          FROM sec_event_details d WHERE d.event_id=e.id),'[]'::jsonb),
                COALESCE((e.event_data ->> 'email_held')::boolean,FALSE),
                COALESCE(e.event_data -> 'recipient_snapshot','{}'::jsonb),
                COALESCE(e.event_data -> 'email_policy','{}'::jsonb)
                FROM sec_events e JOIN customers c ON c.id=e.customer_id
                LEFT JOIN soc_customer sc ON sc.legacy_customer_id = c.id
                LEFT JOIN rulesets r ON r.id=e.ruleset_id AND r.customer_id=c.id
                LEFT JOIN rule_templates t ON t.id=r.rule_template_id
                WHERE e.id=%s::uuid AND e.customer_id=%s::uuid""", (event_id,customer_id)).fetchone()
        if not row:
            raise ValueError('event not found for this customer')
        context = self._context(row)
        eligible = True
        eligibility_reason = ""
        if context.eid:
            eligible, eligibility_reason = self.registered_delivery_eligibility(
                event_id,
                customer_id,
            )
        rules = [] if context.eid else [r for r in self.active_rules() if r.matches(context)]
        subject, text = render_alert_email(context)
        import base64
        from pathlib import Path
        html = render_html(context)
        for cid in set(re.findall(r'cid:([^\s"<>]+)', html)):
            path = Path(__file__).with_name('email_templates') / 'img' / Path(cid).name
            if path.is_file():
                html = html.replace('cid:' + cid, 'data:image/jpeg;base64,' + base64.b64encode(path.read_bytes()).decode())
        recipients = (
            normalize_email_config(context.email_config, require_recipient=False)
            if context.eid
            else merge_recipients(rules, context) if rules else {}
        )
        return dict(
            subject=subject,
            text=text,
            html=html,
            recipients=recipients,
            matched_rules=[r.name for r in rules],
            delivery_mode="registered_snapshot" if context.eid else "legacy_rules",
            held=bool(context.metadata.get("email_held")),
            eligible=eligible,
            eligibility_reason=eligibility_reason,
        )

    def preview_csv(self, customer_id, csv_text):
        import csv
        import io
        if not isinstance(csv_text,str) or len(csv_text)>50000:
            raise ValueError('CSV is too large')
        customers = {c['id']:c for c in self.list_customer_email_configs()}
        if customer_id not in customers:
            raise ValueError('unknown customer')
        sources = {r['name']:r['id'] for r in self.admin_details()['source_types']}
        results=[]
        for index,row in enumerate(csv.DictReader(io.StringIO(csv_text))):
            if index>=100:
                raise ValueError('CSV exceeds 100 records')
            try:
                if any(value for key,value in row.items() if key not in {'gid','source_type','severity','ip1','ip2','hostname','recipients','cc','bcc'}):
                    raise ValueError('unsupported CSV columns require manual mapping')
                if row.get('gid') and row['gid'] != customers[customer_id]['gid']:
                    raise ValueError('customer GID mismatch')
                split=lambda v: [x.strip() for x in re.split('[,;]',v or '') if x.strip()]
                names=split(row.get('source_type'))
                if not names or any(n not in sources for n in names):
                    raise ValueError('source type requires exact mapping')
                severities=[x.lower() for x in split(row.get('severity'))]
                if not severities or not set(severities)<=ALLOWED_SEVERITIES:
                    raise ValueError('severity requires exact mapping')
                routing=normalize_routing(dict(source_type_ids=[sources[n] for n in names],
                    ips=split(row.get('ip1'))+split(row.get('ip2')), hostnames=split(row.get('hostname')),
                    recipients=dict(recipients=split(row.get('recipients')),cc=split(row.get('cc')),bcc=split(row.get('bcc')))))
                # Legacy IP/hostname conditions are OR; split them into equivalent routes.
                alternatives=[routing]
                if routing['ips'] and routing['hostnames']:
                    alternatives=[{**routing,'hostnames':[]},{**routing,'ips':[]}]
                rules=[dict(name=f"CSV {customers[customer_id]['gid']} {index+1}-{n+1}", customer_id=customer_id,
                    severities=severities,enabled=False,routing=route) for n,route in enumerate(alternatives)]
                results.append(dict(row=index+1,rules=rules,status='ready'))
            except (ValueError,TypeError) as exc:
                results.append(dict(row=index+1,status='unapplied',error=str(exc)))
        return dict(rows=results)

    def list_rules(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id::text, name, customer_id::text, ruleset_id::text,
                       severities, enabled, created_at::text, updated_at::text, routing
                FROM sec_alert_email_rules
                ORDER BY name, id
                """
            ).fetchall()
        keys = ("id", "name", "customer_id", "ruleset_id", "severities", "enabled", "created_at", "updated_at", "routing")
        return [dict(zip(keys, row, strict=True)) for row in rows]

    def active_rules(self) -> list[AlertEmailRule]:
        return [
            AlertEmailRule(
                id=str(row["id"]),
                name=str(row["name"]),
                customer_id=str(row["customer_id"]) if row["customer_id"] else None,
                ruleset_id=str(row["ruleset_id"]) if row["ruleset_id"] else None,
                severities=tuple(str(item).casefold() for item in (row["severities"] or [])),
                enabled=bool(row["enabled"]),
                routing=row.get("routing") or {},
            )
            for row in self.list_rules()
            if row["enabled"]
        ]

    def save_rule(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        name = _bounded(payload.get("name"), 160)
        if not name:
            raise ValueError("rule name is required")
        customer_id = payload.get("customer_id") or None
        ruleset_id = payload.get("ruleset_id") or None
        for label, value in (("customer_id", customer_id), ("ruleset_id", ruleset_id)):
            if value is not None and (not isinstance(value, str) or len(value) > 80):
                raise ValueError(f"{label} is invalid")
        severities = payload.get("severities", ["high", "critical"])
        if not isinstance(severities, Sequence) or isinstance(severities, (str, bytes, bytearray)):
            raise ValueError("severities must be a list")
        normalized = sorted({str(item).casefold().strip() for item in severities if str(item).strip()})
        if not normalized or not set(normalized).issubset(ALLOWED_SEVERITIES):
            raise ValueError("severities must contain only valid severity values")
        enabled = payload.get("enabled", False)
        if not isinstance(enabled, bool):
            raise ValueError("enabled must be a boolean")
        routing = normalize_routing(payload.get("routing", {}))
        if routing.get("recipients") and not customer_id:
            raise ValueError("recipient overrides require a customer")
        rule_id = payload.get("id") or None
        if rule_id is not None and (not isinstance(rule_id, str) or len(rule_id) > 80):
            raise ValueError("rule id is invalid")
        with self._connect() as connection:
            if ruleset_id and not connection.execute("SELECT 1 FROM rulesets WHERE id=%s::uuid AND customer_id=%s::uuid", (ruleset_id, customer_id)).fetchone():
                raise ValueError("ruleset must belong to the selected customer")
            for source_id in routing.get("source_type_ids", []):
                if not connection.execute("SELECT 1 FROM source_types WHERE id=%s::uuid", (source_id,)).fetchone():
                    raise ValueError("unknown source type")
            if rule_id:
                row = connection.execute(
                    """
                    INSERT INTO sec_alert_email_rules
                        (id, name, customer_id, ruleset_id, severities, enabled, routing)
                    VALUES (%s::uuid, %s, %s::uuid, %s::uuid, %s, %s, %s::jsonb)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name, customer_id = EXCLUDED.customer_id,
                        ruleset_id = EXCLUDED.ruleset_id, severities = EXCLUDED.severities,
                        enabled = EXCLUDED.enabled, routing = EXCLUDED.routing
                    RETURNING id::text, name, customer_id::text, ruleset_id::text,
                              severities, enabled, created_at::text, updated_at::text, routing
                    """,
                    (rule_id, name, customer_id, ruleset_id, normalized, enabled, json.dumps(routing)),
                ).fetchone()
            else:
                row = connection.execute(
                    """
                    INSERT INTO sec_alert_email_rules
                        (name, customer_id, ruleset_id, severities, enabled, routing)
                    VALUES (%s, %s::uuid, %s::uuid, %s, %s, %s::jsonb)
                    ON CONFLICT (name) DO UPDATE SET
                        customer_id = EXCLUDED.customer_id, ruleset_id = EXCLUDED.ruleset_id,
                        severities = EXCLUDED.severities, enabled = EXCLUDED.enabled, routing = EXCLUDED.routing
                    RETURNING id::text, name, customer_id::text, ruleset_id::text,
                              severities, enabled, created_at::text, updated_at::text, routing
                    """,
                    (name, customer_id, ruleset_id, normalized, enabled, json.dumps(routing)),
                ).fetchone()
        if row is None:
            raise RuntimeError("alert email rule was not saved")
        keys = ("id", "name", "customer_id", "ruleset_id", "severities", "enabled", "created_at", "updated_at", "routing")
        return dict(zip(keys, row, strict=True))

    def list_customer_email_configs(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT c.id::text, COALESCE(sc.customer_id, ''), COALESCE(sc.revision, 0),
                       COALESCE(sc.customer_code, c.cid, ''), COALESCE(sc.gid, c.gid),
                       COALESCE(sc.display_name, c.name),
                       COALESCE(sc.lifecycle_status, CASE WHEN c.status = 'active' THEN 'active' ELSE 'retired' END),
                       COALESCE(sc.email_config, c.email_config),
                       COALESCE(sc.alert_delivery_enabled, c.alert_delivery_enabled, FALSE)
                FROM customers c
                LEFT JOIN soc_customer sc ON sc.legacy_customer_id = c.id
                ORDER BY COALESCE(sc.customer_code, c.cid, sc.gid, c.gid), c.id
                """
            ).fetchall()
        return [
            {
                "id": str(row[0]), "record_id": str(row[1]) if row[1] else "",
                "revision": int(row[2] or 0), "cid": row[3], "gid": row[4], "name": row[5],
                "display_name": row[5], "lifecycle_status": row[6], "email_config": row[7] or {},
                "alert_delivery_enabled": bool(row[8]),
            }
            for row in rows
        ]

    def save_customer_email_config(
        self,
        customer_id: str,
        value: Any,
        *,
        alert_delivery_enabled: bool | None = None,
        actor: str = "admin",
    ) -> dict[str, Any]:
        """Compatibility wrapper; the catalog update owns the transaction."""
        normalized = normalize_email_config(value, require_recipient=False)
        normalized.setdefault("language", "EN")
        normalized.setdefault("brand", "CPC")
        enabled = bool(alert_delivery_enabled) if alert_delivery_enabled is not None else None
        # A few isolated PostgreSQL fixtures install only the legacy
        # migrations. Bootstrap the compatibility table in that same schema
        # so the wrapper remains usable while the normal server path uses the
        # versioned CatalogStore migration below.
        with self._connect() as connection:
            table = connection.execute("SELECT to_regclass(current_schema() || '.soc_customer')").fetchone()
            if not table or not table[0]:
                connection.execute(
                    """CREATE TABLE IF NOT EXISTS soc_customer (
                        customer_id TEXT PRIMARY KEY, customer_code TEXT NOT NULL UNIQUE,
                        display_name TEXT NOT NULL, short_name TEXT NOT NULL DEFAULT '',
                        gid TEXT NOT NULL DEFAULT '', lifecycle_status TEXT NOT NULL DEFAULT 'active',
                        notes TEXT NOT NULL DEFAULT '', source_type_id TEXT NOT NULL DEFAULT '',
                        related_staff_id TEXT NOT NULL DEFAULT '', splunk_indexes TEXT[] NOT NULL DEFAULT '{}',
                        field_mapping JSONB NOT NULL DEFAULT '{}', email_config JSONB NOT NULL DEFAULT '{}',
                        alert_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                        legacy_customer_id UUID UNIQUE, revision INTEGER NOT NULL DEFAULT 1,
                        archived_at TIMESTAMPTZ, created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )"""
                )
                connection.execute(
                    """CREATE TABLE IF NOT EXISTS soc_catalog_history (
                        history_id BIGSERIAL PRIMARY KEY, catalog TEXT NOT NULL, record_id TEXT NOT NULL,
                        revision INTEGER NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL DEFAULT '',
                        reason TEXT NOT NULL DEFAULT '', before_json JSONB, after_json JSONB,
                        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )"""
                )
                if not hasattr(self, "uri"):
                    return self._save_customer_email_config_local(
                        connection, customer_id, normalized, actor, enabled
                    )
        from .catalog.store import CatalogStore

        with self._connect() as connection:
            row = connection.execute(
                """SELECT sc.customer_id, sc.revision, c.id::text
                   FROM customers c LEFT JOIN soc_customer sc ON sc.legacy_customer_id = c.id
                   WHERE c.id = %s::uuid OR sc.customer_id = %s
                   ORDER BY sc.customer_id NULLS LAST LIMIT 1""",
                (customer_id, customer_id),
            ).fetchone()
        if row is None or not row[0]:
            raise ValueError("customer was not found")
        catalog = CatalogStore(self.uri)
        try:
            current = catalog.require_record("customer", str(row[0]))
            values = {key: current.get(key) for key in (
                "customer_code", "display_name", "short_name", "gid", "lifecycle_status", "notes",
                "source_type_id", "related_staff_id", "splunk_indexes", "field_mapping", "email_config",
                "alert_delivery_enabled",
            )}
            values["email_config"] = normalized
            if enabled is not None:
                values["alert_delivery_enabled"] = enabled
            saved = catalog.update_record(
                "customer", str(row[0]), values, expected_revision=int(current["revision"]), actor=actor,
                reason="alert email compatibility update",
            )
        finally:
            catalog.close()
        return {
            "id": str(saved.get("legacy_customer_id") or row[2]),
            "record_id": saved["record_id"], "revision": saved["revision"],
            "gid": saved.get("gid", ""), "name": saved.get("display_name", ""),
            "display_name": saved.get("display_name", ""),
            "lifecycle_status": saved.get("lifecycle_status", ""),
            "email_config": saved.get("email_config", normalized),
            "alert_delivery_enabled": bool(saved.get("alert_delivery_enabled", False)),
        }

    @staticmethod
    def _save_customer_email_config_local(
        connection: Any,
        customer_id: str,
        normalized: dict[str, Any],
        actor: str,
        enabled: bool | None = None,
    ) -> dict[str, Any]:
        connection.execute("ALTER TABLE soc_customer ADD COLUMN IF NOT EXISTS alert_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE")
        row = connection.execute(
            "SELECT id::text, gid, name, short_name, status, source_type::text, related_staff::text, field_mapping, splunk_indexes, alert_delivery_enabled FROM customers WHERE id = %s::uuid",
            (customer_id,),
        ).fetchone()
        if row is None:
            raise ValueError("customer was not found")
        legacy_id, gid, name, short_name, status, source_type, related_staff, mapping, indexes, customer_enabled = row
        enabled = bool(customer_enabled) if enabled is None else bool(enabled)
        customer_id_text = str(legacy_id).replace("-", "")
        code = re.sub(r"[^a-z0-9_-]+", "-", str(short_name or gid or name or "customer").lower()).strip("-")[:64] or "customer"
        current = connection.execute(
            "SELECT customer_id, revision, email_config, display_name, lifecycle_status, alert_delivery_enabled FROM soc_customer WHERE legacy_customer_id = %s::uuid FOR UPDATE",
            (customer_id,),
        ).fetchone()
        before_json = None
        if current:
            revision = int(current[1]) + 1
            before_json = {"email_config": current[2] or {}, "alert_delivery_enabled": bool(current[5])}
            connection.execute(
                "UPDATE soc_customer SET email_config=%s::jsonb, alert_delivery_enabled=%s, revision=%s, updated_by=%s, updated_at=NOW() WHERE customer_id=%s",
                (json.dumps(normalized), enabled, revision, actor, current[0]),
            )
            record_id = str(current[0])
            display_name = current[3]
            lifecycle = current[4]
        else:
            revision = 1
            record_id = customer_id_text
            display_name = name or ""
            lifecycle = "active" if str(status or "active").lower() == "active" else "retired"
            connection.execute(
                """INSERT INTO soc_customer (
                    customer_id, customer_code, display_name, short_name, gid, lifecycle_status,
                    source_type_id, related_staff_id, splunk_indexes, field_mapping, email_config,
                    alert_delivery_enabled, legacy_customer_id, created_by, updated_by
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s::uuid,%s,%s)""",
                (record_id, code, display_name, short_name or "", gid or "", lifecycle,
                 source_type or "", related_staff or "", indexes or [], json.dumps(mapping or {}),
                 json.dumps(normalized), enabled, customer_id, actor, actor),
            )
        # Keep the legacy compatibility projection in the same transaction as
        # the local catalog fallback.  The normal CatalogStore path performs
        # this synchronization itself; isolated fixtures must not leave the
        # event-ingestion tables with stale recipients or authorization.
        connection.execute(
            """UPDATE customers
               SET email_config = %s::jsonb,
                   alert_delivery_enabled = %s,
                   updated_at = NOW()
             WHERE id = %s::uuid""",
            (json.dumps(normalized), enabled, customer_id),
        )
        after = {"email_config": normalized, "record_id": record_id, "revision": revision}
        connection.execute(
            """INSERT INTO soc_catalog_history (catalog,record_id,revision,action,actor,before_json,after_json)
               VALUES ('customer',%s,%s,%s,%s,%s::jsonb,%s::jsonb)""",
            (record_id, revision, "create" if before_json is None else "update", actor,
             json.dumps(before_json) if before_json is not None else None, json.dumps(after)),
        )
        return {"id": str(legacy_id), "record_id": record_id, "revision": revision, "gid": gid or "", "name": display_name, "display_name": display_name, "lifecycle_status": lifecycle, "email_config": normalized, "alert_delivery_enabled": enabled}

    def _registered_delivery_eligibility(
        self,
        connection: Any,
        row: Sequence[Any],
        *,
        require_processing: bool = False,
    ) -> tuple[bool, str]:
        """Apply the same live authorization checks to preview and sending."""

        if require_processing and row[14] != "processing":
            return False, "outbox claim is no longer processing"
        if not row[0] or row[1]:
            return False, "event is not eligible for registered delivery"
        if str(row[2]).casefold() != "active" or not bool(row[3]):
            return False, "customer authorization or delivery is disabled"
        if row[4] is None:
            return False, "registered alert is missing"
        if str(row[6]).casefold() != "active" or str(row[7]).casefold() != "ready":
            return False, "registered alert is not ready for delivery"
        if not bool(row[8]) or str(row[9]).casefold() not in {"unknown", "present"}:
            return False, "registered alert delivery or presence is invalid"
        source_indexes = list(row[10] or [])
        ownership_ok = bool(
            connection.execute(
                """
                SELECT cardinality(%s::text[]) > 0
                   AND NOT EXISTS (
                       SELECT 1
                       FROM unnest(%s::text[]) AS source(index_name)
                       WHERE NOT EXISTS (
                           SELECT 1
                           FROM sec_alert_index_ownership AS ownership
                           WHERE ownership.splunk_deployment = %s
                             AND ownership.index_name = source.index_name
                             AND ownership.customer_id = %s
                             AND ownership.status = 'active'
                             AND ownership.verified_at IS NOT NULL
                             AND ownership.verification ->> 'verified' = 'true'
                             AND ownership.verification ->> 'deployment' = ownership.splunk_deployment
                             AND ownership.verification ->> 'index_name' = ownership.index_name
                       )
                   )
                """,
                (source_indexes, source_indexes, row[11], str(row[5]) if row[5] else ""),
            ).fetchone()[0]
        )
        if not ownership_ok:
            return False, "source index ownership is no longer active and complete"
        try:
            normalize_email_config(row[12], require_recipient=True)
            normalize_email_config(row[13], require_recipient=True)
        except (TypeError, ValueError):
            return False, "recipient configuration is invalid or empty"
        return True, ""

    def registered_delivery_eligibility(self, event_id: str, customer_id: str) -> tuple[bool, str]:
        """Check current eligibility without claiming or mutating an outbox row."""

        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT e.eid, COALESCE(e.historical_email_suppressed, FALSE),
                       c.status, c.alert_delivery_enabled,
                       r.id::text, e.customer_id::text, r.registration_state,
                       r.delivery_state, r.delivery_enabled, r.presence_state,
                       r.source_indexes, r.splunk_deployment,
                       COALESCE(outbox.recipient_snapshot,
                                e.event_data -> 'recipient_snapshot', '{}'::jsonb),
                       c.email_config, outbox.status
                FROM sec_events AS e
                JOIN customers AS c ON c.id = e.customer_id
                LEFT JOIN sec_alert_registrations AS r ON r.id = e.alert_registration_id
                LEFT JOIN sec_event_email_outbox AS outbox ON outbox.event_id = e.id
                WHERE e.id = %s::uuid AND e.customer_id = %s::uuid
                """,
                (event_id, customer_id),
            ).fetchone()
            if row is None:
                return False, "event not found for this customer"
            return self._registered_delivery_eligibility(connection, row)

    def confirm_registered_delivery(self, outbox_id: str) -> tuple[bool, str]:
        """Revalidate a claimed registered run immediately before SMTP.

        Claim-time checks prevent normal queue races.  This second check closes
        the remaining window in which an administrator can deactivate a
        customer, registration, or source index after the claim but before a
        message is sent.  The outbox snapshot remains the content/destination
        authority for this run; current configuration is used only for
        authorization and scope validity.
        """
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT e.eid, COALESCE(e.historical_email_suppressed, FALSE),
                       c.status, c.alert_delivery_enabled,
                       r.id::text, e.customer_id::text, r.registration_state,
                       r.delivery_state, r.delivery_enabled, r.presence_state,
                       r.source_indexes, r.splunk_deployment,
                       COALESCE(outbox.recipient_snapshot,
                                e.event_data -> 'recipient_snapshot', '{}'::jsonb),
                       c.email_config,
                       outbox.status
                FROM sec_event_email_outbox AS outbox
                JOIN sec_events AS e ON e.id = outbox.event_id
                JOIN customers AS c ON c.id = outbox.customer_id
                LEFT JOIN sec_alert_registrations AS r ON r.id = e.alert_registration_id
                WHERE outbox.id = %s::uuid
                FOR UPDATE OF outbox
                """,
                (outbox_id,),
            ).fetchone()
            if row is None:
                return False, "outbox row was not found"
            return self._registered_delivery_eligibility(
                connection,
                row,
                require_processing=True,
            )

    def mark_held(self, outbox_id: str, reason: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_event_email_outbox
                SET status = 'held', next_attempt_at = NULL, last_error = %s,
                    claimed_at = NULL, claimed_by = NULL
                WHERE id = %s::uuid AND status = 'processing'
                """,
                (_bounded(reason), outbox_id),
            )

    def save_snapshot(self, outbox_id, snapshot):
        with self._connect() as connection:
            result = connection.execute("UPDATE sec_event_email_outbox SET delivery_snapshot=%s::jsonb WHERE id=%s::uuid AND status='processing'", (json.dumps(snapshot), outbox_id))
            if result.rowcount != 1:
                raise RuntimeError('outbox claim was lost before sending')

    def record_outcome(self, context, snapshot, outcome):
        accepted = list(dict.fromkeys(context.accepted_recipients + outcome['accepted']))
        rejected = outcome['rejected']
        # Persist permanent refusals but only keep temporary refusals in the retry envelope.
        retry = {a.casefold() for a, code in rejected.items() if 400 <= code < 500}
        remaining = {k: [a for a in values if a.casefold() in retry] for k, values in snapshot['recipients'].items()}
        next_snapshot = {**snapshot, 'recipients': remaining}
        with self._connect() as connection:
            result = connection.execute("""
                UPDATE sec_event_email_outbox SET status=CASE WHEN EXISTS (SELECT 1 FROM jsonb_each(rejected_recipients || %s::jsonb) x WHERE (x.value::text)::int >= 500) THEN 'failed' ELSE %s END, accepted_recipients=%s::jsonb,
                    rejected_recipients=rejected_recipients || %s::jsonb,
                    delivery_snapshot=%s::jsonb, provider_message_id=%s,
                    smtp_accepted_at=CASE WHEN %s THEN NOW() ELSE smtp_accepted_at END,
                    next_attempt_at=CASE WHEN %s THEN NOW()+INTERVAL '30 seconds' ELSE NULL END,
                    last_error=%s, claimed_at=NULL, claimed_by=NULL
                WHERE id=%s::uuid AND status='processing'
            """, (json.dumps(rejected), 'failed' if rejected else 'accepted', json.dumps(accepted), json.dumps(rejected),
                  json.dumps(next_snapshot), outcome['message_id'], bool(outcome['accepted']), bool(retry),
                  'recipient rejection; see recipient status' if rejected else None, context.outbox_id))
            if result.rowcount != 1:
                raise RuntimeError('outbox acknowledgement did not update its claimed row')

    def mark_disabled(self, outbox_id: str, reason: str) -> None:
        self._mark_terminal(outbox_id, "disabled", reason)

    def mark_failed(
        self,
        outbox_id: str,
        reason: str,
        *,
        retryable: bool,
        attempt_count: int,
        max_backoff_seconds: int = 300,
    ) -> None:
        delay = min(
            max(5, int(max_backoff_seconds)),
            max(5, 2 ** min(max(1, int(attempt_count)), 8)),
        ) if retryable else None
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_event_email_outbox
                SET status = 'failed', last_error = %s, next_attempt_at =
                    CASE WHEN %s::integer IS NULL THEN NULL ELSE NOW() + (%s * INTERVAL '1 second') END,
                    claimed_at = NULL, claimed_by = NULL
                WHERE id = %s::uuid AND status = 'processing'
                """,
                (_bounded(reason), delay, delay, outbox_id),
            )

    def mark_uncertain(self, outbox_id: str, reason: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_event_email_outbox
                SET status = 'uncertain', uncertain_at = NOW(), last_error = %s,
                    next_attempt_at = NULL, claimed_at = NULL, claimed_by = NULL
                WHERE id = %s::uuid AND status = 'processing'
                """,
                (_bounded(reason), outbox_id),
            )

    def _mark_terminal(self, outbox_id: str, status: str, reason: str) -> None:
        if status not in {"disabled"}:
            raise ValueError("invalid terminal email status")
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sec_event_email_outbox
                SET status = %s, last_error = %s, next_attempt_at = NULL,
                    claimed_at = NULL, claimed_by = NULL
                WHERE id = %s::uuid AND status = 'processing'
                """,
                (status, _bounded(reason), outbox_id),
            )

    def record_started(self, worker_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sec_alert_email_status (id, worker_id, last_started_at, heartbeat_at)
                VALUES (TRUE, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    worker_id = EXCLUDED.worker_id, last_started_at = EXCLUDED.last_started_at,
                    heartbeat_at = EXCLUDED.heartbeat_at, last_error = NULL
                """,
                (worker_id,),
            )

    def record_completed(self, worker_id: str, report: EmailCycleReport) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sec_alert_email_status (
                    id, worker_id, last_completed_at, last_sent_at, last_failed_at,
                    last_uncertain_at, heartbeat_at, last_sent, last_failed, last_uncertain
                ) VALUES (
                    TRUE, %s, NOW(),
                    CASE WHEN %s > 0 THEN NOW() ELSE NULL END,
                    CASE WHEN %s > 0 THEN NOW() ELSE NULL END,
                    CASE WHEN %s > 0 THEN NOW() ELSE NULL END,
                    NOW(), %s, %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    worker_id = EXCLUDED.worker_id, last_completed_at = EXCLUDED.last_completed_at,
                    last_sent_at = CASE WHEN EXCLUDED.last_sent > 0 THEN EXCLUDED.last_sent_at ELSE sec_alert_email_status.last_sent_at END,
                    last_failed_at = CASE WHEN EXCLUDED.last_failed > 0 THEN EXCLUDED.last_failed_at ELSE sec_alert_email_status.last_failed_at END,
                    last_uncertain_at = CASE WHEN EXCLUDED.last_uncertain > 0 THEN EXCLUDED.last_uncertain_at ELSE sec_alert_email_status.last_uncertain_at END,
                    heartbeat_at = EXCLUDED.heartbeat_at, last_sent = EXCLUDED.last_sent,
                    last_failed = EXCLUDED.last_failed, last_uncertain = EXCLUDED.last_uncertain,
                    last_error = CASE WHEN %s = 0 THEN NULL ELSE sec_alert_email_status.last_error END
                """,
                (
                    worker_id,
                    report.sent,
                    report.failed,
                    report.uncertain,
                    report.sent,
                    report.failed,
                    report.uncertain,
                    len(report.errors),
                ),
            )

    def record_error(self, worker_id: str, error: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sec_alert_email_status (id, worker_id, last_error, heartbeat_at)
                VALUES (TRUE, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    worker_id = EXCLUDED.worker_id, last_error = EXCLUDED.last_error,
                    heartbeat_at = EXCLUDED.heartbeat_at
                """,
                (worker_id, _bounded(error)),
            )

    def status(self) -> dict[str, Any]:
        with self._connect() as connection:
            counts = connection.execute(
                "SELECT status, count(*) FROM sec_event_email_outbox GROUP BY status"
            ).fetchall()
            row = connection.execute(
                """
                SELECT worker_id, heartbeat_at::text, last_started_at::text, last_completed_at::text,
                       last_sent_at::text, last_failed_at::text, last_uncertain_at::text, last_error,
                       last_sent, last_failed, last_uncertain
                FROM sec_alert_email_status WHERE id = TRUE
                """
            ).fetchone()
        result = {str(key): int(value) for key, value in counts}
        result["worker"] = None
        if row:
            keys = (
                "worker_id", "heartbeat_at", "last_started_at", "last_completed_at",
                "last_sent_at", "last_failed_at", "last_uncertain_at", "last_error",
                "last_sent", "last_failed", "last_uncertain",
            )
            result["worker"] = dict(zip(keys, row, strict=True))
        return result


class AlertEmailWorker:
    """Single process-safe outbox worker; the database advisory lock prevents duplicates."""

    def __init__(
        self,
        settings: ServerSettings,
        store: AlertEmailStore,
        sender: AlertEmailSender | Any | None = None,
    ) -> None:
        self.settings = settings
        self.store = store
        self.sender = sender or AlertEmailSender(settings)
        self.interval_seconds = max(1, int(settings.alert_email_interval_seconds))
        self.batch_size = max(1, min(int(settings.alert_email_batch_size), 201))
        self.max_backoff_seconds = max(self.interval_seconds, int(settings.alert_email_max_backoff_seconds))
        self.worker_id = f"{os.getpid()}-{uuid.uuid4().hex[:12]}"
        self._stop = asyncio.Event()
        self._task: asyncio.Task | None = None
        self._status: dict[str, Any] = {
            "enabled": True,
            "configured": settings.alert_email_configured,
            "running": False,
            "lock_acquired": False,
            "worker_id": self.worker_id,
            "interval_seconds": self.interval_seconds,
            "batch_size": self.batch_size,
            "last_started_at": None,
            "last_completed_at": None,
            "last_error": None,
            "last_report": EmailCycleReport().to_dict(),
        }

    @classmethod
    def from_settings(cls, settings: ServerSettings) -> "AlertEmailWorker | None":
        if not settings.alert_email_enabled:
            return None
        if not settings.alert_email_configured:
            LOGGER.error("Alert email is enabled but mailbox configuration is incomplete; worker is stopped.")
            return None
        store = AlertEmailStore.from_env()
        if store is None:
            LOGGER.error("Alert email is enabled but APP_POSTGRES_URI is not configured.")
            return None
        return cls(settings, store)

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._stop.clear()
            self._task = asyncio.create_task(self._run(), name="soc-alert-email")

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            await self._task
        self.store.close()

    def status(self) -> dict[str, Any]:
        return {**self._status, "last_report": dict(self._status["last_report"])}

    async def _wait(self, seconds: int) -> bool:
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=max(0, seconds))
        except asyncio.TimeoutError:
            return False
        return True

    async def _store_call(self, method: str, *args: Any) -> None:
        try:
            await asyncio.to_thread(getattr(self.store, method), *args)
        except Exception as exc:
            LOGGER.warning("Alert email status update failed: %s", _bounded(exc, 240))

    async def _cycle(self) -> EmailCycleReport:
        if isinstance(self.store, AlertEmailStore) and self.store._lock_connection is not None:
            await asyncio.to_thread(self.store._lock_connection.execute, "SELECT 1")
        report = EmailCycleReport()
        rules = await asyncio.to_thread(self.store.active_rules)
        rows = await asyncio.to_thread(self.store.claim, self.batch_size, self.worker_id)
        report.claimed = len(rows)
        for context in rows:
            is_registered_run = bool(context.eid)
            if is_registered_run:
                if context.metadata.get("email_held") is True:
                    await asyncio.to_thread(
                        self.store.mark_disabled,
                        context.outbox_id,
                        "alert email is held for operator review",
                    )
                    report.skipped += 1
                    continue
                if context.metadata.get("registration_active") is False:
                    await asyncio.to_thread(
                        self.store.mark_disabled,
                        context.outbox_id,
                        "customer authorization or alert scope is invalid; operator review is required",
                    )
                    report.skipped += 1
                    continue
                if context.metadata.get("customer_active") is False:
                    await asyncio.to_thread(
                        self.store.mark_disabled,
                        context.outbox_id,
                        "customer is not active; operator review is required",
                    )
                    report.skipped += 1
                    continue
                confirm_delivery = getattr(self.store, "confirm_registered_delivery", None)
                if callable(confirm_delivery):
                    eligible, reason = await asyncio.to_thread(
                        confirm_delivery,
                        context.outbox_id,
                    )
                    if not eligible:
                        await asyncio.to_thread(
                            self.store.mark_held,
                            context.outbox_id,
                            reason or "registered delivery became ineligible before sending",
                        )
                        report.skipped += 1
                        continue
                matching = []
                configured_recipients = normalize_email_config(
                    context.email_config,
                    require_recipient=False,
                )
            else:
                matching = [rule for rule in rules if rule.matches(context)]
                if not matching:
                    await asyncio.to_thread(
                        self.store.mark_disabled,
                        context.outbox_id,
                        "no enabled alert email rule matched this event",
                    )
                    report.skipped += 1
                    continue
                configured_recipients = merge_recipients(matching, context)
            try:
                if not any(configured_recipients.get(key) for key in ("recipients", "cc", "bcc")):
                    await asyncio.to_thread(
                        self.store.mark_disabled,
                        context.outbox_id,
                        "customer email recipients are empty; add recipients in Customers",
                    )
                    report.skipped += 1
                    continue
                snapshot = context.delivery_snapshot
                if snapshot is None:
                    subject, body = render_alert_email(context)
                    snapshot = dict(recipients=configured_recipients, subject=subject,
                                    body=body, html=render_html(context),
                                    message_id=f"<{uuid.uuid4()}@soc-alert.local>")
                    await asyncio.to_thread(self.store.save_snapshot, context.outbox_id, snapshot)
                accepted = {x.casefold() for x in context.accepted_recipients}
                recipients = {key: [x for x in values if x.casefold() not in accepted]
                              for key, values in snapshot['recipients'].items()}
                outcome = await self.sender.send(recipients, snapshot['subject'], snapshot['body'],
                                                 html=snapshot['html'], message_id=snapshot['message_id'])
            except ValueError as exc:
                await asyncio.to_thread(
                    self.store.mark_failed,
                    context.outbox_id,
                    str(exc),
                    retryable=False,
                    attempt_count=context.attempt_count,
                    max_backoff_seconds=self.max_backoff_seconds,
                )
                report.failed += 1
                report.errors.append(_bounded(exc, 240))
            except AlertEmailDeliveryError as exc:
                if exc.kind == "uncertain":
                    await asyncio.to_thread(self.store.mark_uncertain, context.outbox_id, exc.message)
                    report.uncertain += 1
                else:
                    await asyncio.to_thread(
                        self.store.mark_failed,
                        context.outbox_id,
                        exc.message,
                        retryable=exc.kind == "retryable",
                        attempt_count=context.attempt_count,
                        max_backoff_seconds=self.max_backoff_seconds,
                    )
                    report.failed += 1
                report.errors.append(exc.message)
            except Exception as exc:
                await asyncio.to_thread(self.store.mark_uncertain, context.outbox_id, type(exc).__name__)
                report.uncertain += 1
                report.errors.append(_bounded(type(exc).__name__, 240))
            else:
                # The provider accepted the message before PostgreSQL was
                # updated. A failed acknowledgement must become uncertain;
                # retrying it could send a duplicate notification.
                try:
                    await asyncio.to_thread(self.store.record_outcome, context, snapshot, outcome)
                    if outcome['rejected']:
                        report.failed += 1
                    else:
                        report.sent += 1
                except Exception as exc:
                    try:
                        await asyncio.to_thread(
                            self.store.mark_uncertain,
                            context.outbox_id,
                            "delivery succeeded but recording the provider id failed: " + _bounded(exc, 300),
                        )
                    except Exception:
                        LOGGER.warning("Could not mark acknowledged alert email uncertain: %s", _bounded(exc, 240))
                    report.uncertain += 1
                    report.errors.append(_bounded(exc, 240))
        return report

    async def _run(self) -> None:
        self._status["running"] = True
        try:
            try:
                acquired = await asyncio.to_thread(self.store.acquire_worker_lock)
            except Exception as exc:
                self._status["last_error"] = _bounded(exc)
                LOGGER.error("Alert email worker could not acquire its lock: %s", _bounded(exc, 240))
                return
            self._status["lock_acquired"] = acquired
            if not acquired:
                LOGGER.info("Alert email worker is already running elsewhere.")
                return
            await asyncio.to_thread(self.store.reset_stale_processing)
            delay = 0
            backoff = self.interval_seconds
            while not self._stop.is_set():
                if delay and await self._wait(delay):
                    break
                started = datetime.now(timezone.utc)
                self._status["last_started_at"] = started.isoformat()
                await self._store_call("record_started", self.worker_id)
                try:
                    report = await self._cycle()
                    self._status["last_report"] = report.to_dict()
                    self._status["last_completed_at"] = datetime.now(timezone.utc).isoformat()
                    self._status["last_error"] = report.errors[0] if report.errors else None
                    await self._store_call("record_completed", self.worker_id, report)
                    if report.errors:
                        await self._store_call("record_error", self.worker_id, report.errors[0])
                    if report.failed and not report.sent:
                        delay = backoff
                        backoff = min(self.max_backoff_seconds, max(self.interval_seconds, backoff * 2))
                    else:
                        delay = self.interval_seconds
                        backoff = self.interval_seconds
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    error = _bounded(exc)
                    self._status["last_error"] = error
                    await self._store_call("record_error", self.worker_id, error)
                    LOGGER.warning("Alert email cycle failed: %s", error)
                    delay = backoff
                    backoff = min(self.max_backoff_seconds, max(self.interval_seconds, backoff * 2))
        finally:
            self._status["running"] = False


def main() -> None:
    """Run one bounded outbox cycle for diagnostics; it never enables delivery."""
    load_server_env()
    settings = ServerSettings.from_env()
    if not settings.alert_email_enabled:
        print(json.dumps({"enabled": False, "message": "ALERT_EMAIL_ENABLED is false"}))
        return
    worker = AlertEmailWorker.from_settings(settings)
    if worker is None:
        raise SystemExit("Alert email configuration is incomplete.")
    try:
        if not worker.store.acquire_worker_lock():
            raise SystemExit("Alert email worker is already running.")
        worker.store.reset_stale_processing()
        report = asyncio.run(worker._cycle())
        print(json.dumps(report.to_dict(), default=str))
    finally:
        worker.store.close()


__all__ = [
    "AlertEmailContext",
    "AlertEmailDeliveryError",
    "AlertEmailRule",
    "AlertEmailSender",
    "AlertEmailStore",
    "AlertEmailWorker",
    "EmailCycleReport",
    "normalize_email_config",
    "render_alert_email",
]


if __name__ == "__main__":
    main()
