"""Synthetic service boundaries with real MCP registrations, guards and draft builders.

No arbitrary SPL emulation: unsupported queries fail explicitly, never return a
canned success. All state is per-case memory; no provider can persist or send.
"""
from __future__ import annotations

import inspect
import json
import re
import shlex
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from mcp.server.fastmcp import Context, FastMCP

from scenarios import BASE_SPL, RULE
from unified_mcp_server.auth import identity_for_session
from unified_mcp_server.postgres_store import AuthenticatedSession
from unified_mcp_server.config import ServerSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.responses import success, failure
from unified_mcp_server.splunk_service import SplunkService
from unified_mcp_server.catalog.service import CatalogService
from unified_mcp_server.splunk.search.tools import register_tools as search_tools
from unified_mcp_server.splunk.detection.tools import register_tools as detection_tools
from unified_mcp_server.splunk.security_queue.tools import register_tools as queue_tools
from unified_mcp_server.catalog.tools import register_tools as catalog_tools
from unified_mcp_server.zimbra.mail.tools import register_tools as mail_tools


def instant(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()


def bounded_window(item, earliest, latest):
    try:
        start, end = instant(earliest), instant(latest)
    except (ValueError, TypeError):
        raise ServiceError("benchmark_scope", "Use the explicit fixture UTC timestamps or epoch seconds.")
    if not instant(item["window"]["start"]) <= start < end <= instant(item["window"]["end"]):
        raise ServiceError("benchmark_scope", "The search exceeds the authorized fixture window.")
    return start, end


class FixtureStore:
    def __init__(self, session_id):
        now = datetime.now(timezone.utc)
        self.session = AuthenticatedSession(session_id, "fixture-analyst", "analyst@soc.example", "fixture-token", now, now + timedelta(hours=1))

    def get_app_session(self, session_id):
        return self.session if self.session is not None and session_id == self.session.session_id and self.session.expires_at > datetime.now(timezone.utc) else None

    def list_records(self, catalog, search="", limit=20, offset=0, **_):
        rows = [{"record_id": "a" * 32, "catalog": "rule", "revision": 1, "rule_number": "7901", "rule_name_en": RULE, "status": "active"}]
        if catalog == "customer":
            rows = [{"record_id": "b" * 32, "catalog": "customer", "revision": 1, "customer_code": "ORCHID", "display_name": "Fictional Orchid"}]
        rows = [r for r in rows if search.casefold() in json.dumps(r).casefold()]
        return {"catalog": catalog, "items": rows[offset:offset + limit], "total": len(rows), "limit": limit, "offset": offset}

    def require_record(self, catalog, record_id):
        for row in self.list_records(catalog)["items"]:
            if row["record_id"] == record_id:
                return row
        raise ServiceError("not_found", "No fixture record with that ID.")


class FixtureSplunk:
    def __init__(self, item):
        self.item = item
        self.compiled = {}
        self.current_spl = BASE_SPL

    async def connect(self): pass
    async def disconnect(self): pass

    async def get_indexes(self):
        return [{"name": "bench_orchid"}]

    async def get_saved_search(self, name, app="", owner=""):
        if name != RULE:
            raise ServiceError("not_found", "No fixture detection with that name.")
        return {"name": RULE, "content": {"search": self.current_spl, "description": "Authentication failures", "disabled": "1", "is_scheduled": "1", "cron_schedule": "*/5 * * * *", "dispatch.earliest_time": "-5m", "dispatch.latest_time": "now", "actions": "logevent"}, "acl": {"app": "search", "owner": "nobody", "sharing": "app"}}

    async def get_saved_searches(self, name="", app="", count=20):
        return [await self.get_saved_search(RULE)] if not name or name in RULE else []

    async def run_search_job(self, query, earliest_time="-24h", latest_time="now", max_count=20, **kwargs):
        start, end = bounded_window(self.item, earliest_time, latest_time)
        query = self.compiled.get(query, query)
        # Only equality conjunctions and simple count/projection are supported.
        # Complex SPL belongs in the opt-in lab suite, not an approximate interpreter.
        parts = query.split("|")
        terms = shlex.split(parts[0])
        if terms and terms[0] == "search": terms.pop(0)
        filters = {}
        for term in terms:
            if term == "AND": continue
            match = re.fullmatch(r"(index|host|user|EventCode|action|src_ip|job|change_id)=([^*?]+)", term)
            if not match or match[1] in filters:
                raise ServiceError("fixture_query_unsupported", "Synthetic queries support equality conjunctions and fields/table/head/stats count. Use the lab for other SPL.")
            filters[match[1]] = match[2]
        if filters.get("index") != "bench_orchid":
            raise ServiceError("benchmark_scope", "Only the supplied customer index is authorized.")
        rows = [dict(r) for r in self.item["events"] if start <= instant(r["_time"]) < end and all(str(r.get(k, "")) == v for k, v in filters.items())]
        for stage in parts[1:]:
            tokens = shlex.split(stage.strip())
            if not tokens: continue
            if tokens[0] in {"fields", "table"} and all(re.fullmatch(r"[\w,]+", t) for t in tokens[1:]):
                fields = " ".join(tokens[1:]).replace(",", " ").split()
                rows = [{k: v for k, v in r.items() if k in fields} for r in rows]
            elif tokens[:2] == ["stats", "count"] and (len(tokens) == 2 or len(tokens) == 4 and tokens[2] == "as"):
                rows = [{tokens[3] if len(tokens) == 4 else "count": len(rows)}]
            elif len(tokens) == 2 and tokens[0] == "head" and tokens[1].isdigit():
                rows = rows[:int(tokens[1])]
            else:
                raise ServiceError("fixture_query_unsupported", "This pipeline needs the lab; no synthetic result was fabricated.")
        limit = int(max_count)
        return {"events": rows[:limit], "metadata": {"total_result_count": None if self.item.get("truncated") else len(rows), "fetched_count": len(rows[:limit]), "splunk_result_truncated": bool(self.item.get("truncated") or len(rows) > limit)}}

    def __getattr__(self, name):
        raise ServiceError("fixture_operation_unsupported", "No fixture provider for this operation.")


class Queue:
    def __init__(self, item): self.item = item

    async def list_security_findings(self, status, urgency, owner, detection, earliest, latest, limit, cursor):
        bounded_window(self.item, earliest, latest)
        rows = self.item["findings"]
        for key, value in (("status", status), ("urgency", urgency), ("owner", owner), ("detection", detection)):
            if value: rows = [r for r in rows if r.get(key) == value]
        if cursor: raise ServiceError("fixture_operation_unsupported", "Fixture queue fits on one page.")
        return {"source": "splunk_fired_alerts", "findings": rows[:limit], "count": len(rows[:limit]), "total_count": len(rows), "total_count_exact": True, "next_cursor": None, "truncated": len(rows) > limit, "partial": False, "partial_reason": None, "retention_limited": True, "capabilities": {"status": False, "owner": False}}

    async def get_security_finding(self, finding_id):
        for row in self.item["findings"]:
            if row["finding_id"] == finding_id: return dict(row)
        raise ServiceError("not_found", "No fixture finding with that ID.")


class Mail:
    def __init__(self, item, settings, identity):
        from unified_mcp_server.zimbra.mail.service import ZimbraMailService
        self.item = item
        self.drafts = ZimbraMailService(settings.zimbra, None, settings.markitdown, identity)

    def message(self, id):
        for row in self.item["emails"]:
            if row["message_id"] == id: return row
        raise ServiceError("not_found", "No fixture message with that ID.")

    async def search_emails(self, query, limit, offset=0):
        if not all(t in query for t in ("in:Inbox", "from:security@orchid.example", "date:09/08/2026")):
            raise ServiceError("benchmark_scope", "Use the authorized mailbox query.")
        rows = [{k: v for k, v in r.items() if k not in {"body", "attachments"}} for r in self.item["emails"]]
        return {"messages": rows[offset:offset + limit], "has_more": len(rows) > offset + limit}

    async def get_email(self, message_id, max_body_chars=2000):
        row = dict(self.message(message_id))
        row["body_truncated"] = len(row["body"]) > max_body_chars
        row["body"] = row["body"][:max_body_chars]
        return row

    async def get_email_headers(self, message_id, names=None):
        self.message(message_id)
        return {"message_id": message_id, "headers": {"Authentication-Results": "mx.soc.example; dkim=pass; spf=pass"}}

    async def get_attachment_text(self, message_id, part, max_chars=2000):
        import hashlib
        self.message(message_id)
        if part != "2": raise ServiceError("benchmark_scope", "Only the incident attachment is relevant.")
        text = self.item.get("attachment", "")
        return {"message_id": message_id, "part": part, "text": text[:max_chars], "sha256": hashlib.sha256(text.encode()).hexdigest(), "truncated": len(text) > max_chars, "filename": "incident.txt", "format": "text/plain"}

    def create_email_draft(self, to, subject, body, cc=None, bcc=None):
        if to != ["security@orchid.example"] or cc or bcc:
            raise ServiceError("benchmark_scope", "The only authorized recipient is security@orchid.example.")
        return self.drafts.create_email_draft(to, subject, body, cc, bcc)


def create_fixture_server(item, session_id, record):
    from contextlib import asynccontextmanager
    from functools import wraps
    settings = ServerSettings.from_env({"SPLUNK_HOST": "splunk.fixture.invalid", "SPLUNK_TOKEN": "fixture-token", "SPLUNK_MAX_EVENTS": "20"})
    client = FixtureSplunk(item)
    splunk = SplunkService(settings.splunk, lambda _: client)
    # Existing-rule update validates the real compiled production format.
    compiled = splunk.detection_service.compile_citic_detection(detection_logic=BASE_SPL, rulename="7901", threat_name="Authentication failures", threat_type="Authentication", case_prefix="ORC", event_field_mappings={"Fix_Source Type": '"Windows Security"', "Event_Hostname": "host", "Event_Date Time": "_time"})
    client.current_spl = compiled["production_spl"]
    client.compiled[compiled["backtest_spl"]] = BASE_SPL
    store = FixtureStore(session_id)
    runtime = SimpleNamespace(identity=None, splunk_search=splunk.search_service, splunk_detection=splunk.detection_service, splunk_security_queue=Queue(item), zimbra_mail=Mail(item, settings, identity_for_session(store, session_id)), catalog=CatalogService(store, settings.splunk))
    @asynccontextmanager
    async def lifespan(_):
        try: yield runtime
        finally: await splunk.close()
    server = FastMCP("CITIC synthetic benchmark", lifespan=lifespan)

    async def fresh(ctx):
        # The stdio launcher is the trusted transport principal. Prompt/tool
        # arguments never select identity. Production session resolution is reused.
        runtime.identity = identity_for_session(store, session_id)
        if runtime.identity is None: raise ServiceError("session_expired", "Fixture session expired.")
        return runtime

    async def execute(ctx, service, operation, action):
        await fresh(ctx)
        if service in item.get("unavailable", []):
            raise ServiceError("source_unavailable", "Fixture source unavailable; coverage is unknown.")
        result = action()
        if inspect.isawaitable(result): result = await result
        return success(service, operation, result)

    common = dict(get_runtime=lambda _: runtime, fresh_runtime=fresh, execute=execute, success=success, failure=failure, service_error=ServiceError)
    for register in (search_tools, detection_tools, catalog_tools): register(server, **common)
    queue_tools(server, get_runtime=common["get_runtime"], execute=execute)
    mail_tools(server, **{k: v for k, v in common.items() if k not in {"failure", "service_error"}})

    @server.tool(annotations={"readOnlyHint": True})
    async def system_get_status(ctx: Context) -> dict:
        await fresh(ctx)
        payload = settings.public_readiness()
        for source in ("splunk", "zimbra"):
            payload["services"][source]["configured"] = source not in item.get("unavailable", [])
        return success("system", "get_status", payload)

    # Wrap the registered callable, preserving its original schema and validation.
    for tool in server._tool_manager.list_tools():
        original, name = tool.fn, tool.name
        @wraps(original)
        async def traced(*args, _fn=original, _name=name, **kwargs):
            from grading import request_violations
            arguments = {k: v for k, v in kwargs.items() if k != "ctx"}
            problems = request_violations(item, _name, arguments)
            try:
                if problems: raise ServiceError("benchmark_scope", "; ".join(problems))
                value = await _fn(*args, **kwargs)
            except ServiceError as exc:
                value = failure("benchmark", _name, exc.code, exc.message)
            except Exception as exc:
                value = failure("benchmark", _name, "fixture_internal_error", type(exc).__name__)
            if _name == "splunk_compile_citic_detection" and value.get("ok"):
                client.compiled[value["data"]["backtest_spl"]] = arguments["detection_logic"]
            value.setdefault("meta", {})["benchmark_evidence_id"] = record(_name, arguments, value)
            if not value.get("ok"):
                # FastMCP marks raised failures isError; the trace retains the envelope.
                raise ValueError(json.dumps(value))
            return value
        tool.fn = traced
    return server, runtime, store
