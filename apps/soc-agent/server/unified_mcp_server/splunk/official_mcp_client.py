"""Adapter for Splunk's official MCP Server.

The SOC services depend on the small interface historically provided by
``SplunkClient``.  This adapter keeps that interface stable while routing the
supported read operations through Splunk MCP Server 2.0.  CITIC-only writes
and search-job result reads remain available through the existing REST client
until the official server exposes equivalent, approval-aware operations.
"""

from __future__ import annotations

import asyncio
import json
import re
from contextlib import AsyncExitStack
from datetime import timedelta
from typing import Any
from urllib.parse import urlsplit

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from .splunk_client import SplunkAPIError, SplunkClient


_LOOKUP_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*\.csv$", re.IGNORECASE)


class OfficialSplunkMCPClient:
    """Compatibility client backed by the official Splunk MCP transport."""

    supports_saved_search_time_overrides = True

    def __init__(self, config: dict[str, object]):
        self.config = config
        self.endpoint = str(config.get("splunk_mcp_endpoint", "")).strip()
        self.request_timeout = float(config.get("request_timeout", 30) or 30)
        self.job_timeout = float(config.get("job_timeout", 120) or 120)
        self.verify_ssl = _bool_default(config.get("verify_ssl"), True)
        self._stack: AsyncExitStack | None = None
        self._session: ClientSession | None = None
        self._call_lock = asyncio.Lock()
        self._rest_client: SplunkClient | None = None
        self._connected = False
        self.server_version = ""

    async def connect(self) -> None:
        if not self.endpoint:
            raise SplunkAPIError("The official Splunk MCP endpoint is not configured.")
        token = str(self.config.get("splunk_token", "")).strip()
        if not token:
            raise SplunkAPIError("SPLUNK_TOKEN is required for the official Splunk MCP endpoint.")
        try:
            parsed = urlsplit(self.endpoint)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.query or parsed.fragment:
                raise ValueError
            if parsed.scheme == "http" and not _flag(self.config.get("allow_insecure_http")):
                raise ValueError("insecure HTTP is disabled")
        except ValueError as exc:
            raise SplunkAPIError("The official Splunk MCP endpoint is invalid.") from exc

        stack = AsyncExitStack()
        try:
            receive, send, _ = await stack.enter_async_context(
                streamablehttp_client(
                    self.endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=self.request_timeout,
                    sse_read_timeout=max(self.request_timeout, self.job_timeout + 5),
                    httpx_client_factory=self._httpx_client_factory,
                )
            )
            session = await stack.enter_async_context(ClientSession(receive, send))
            initialized = await session.initialize()
            server_info = getattr(initialized, "serverInfo", None)
            self.server_version = str(getattr(server_info, "version", "") or "")
            if not self.server_version.startswith("2."):
                raise SplunkAPIError(
                    "Splunk MCP Server 2.x is required for the official integration."
                )
        except SplunkAPIError:
            await stack.aclose()
            raise
        except Exception as exc:
            await stack.aclose()
            raise self._transport_error(exc, "initialize the official Splunk MCP connection") from exc
        self._stack = stack
        self._session = session
        self._connected = True

    def _httpx_client_factory(
        self,
        headers: dict[str, str] | None = None,
        timeout: httpx.Timeout | None = None,
        auth: httpx.Auth | None = None,
    ) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            headers=headers,
            timeout=timeout,
            auth=auth,
            verify=self.verify_ssl,
            follow_redirects=True,
        )

    async def disconnect(self) -> None:
        self._connected = False
        self._session = None
        if self._rest_client is not None:
            await self._rest_client.disconnect()
            self._rest_client = None
        if self._stack is not None:
            await self._stack.aclose()
            self._stack = None

    @staticmethod
    def _transport_error(exc: BaseException, operation: str) -> SplunkAPIError:
        message = str(exc).lower()
        if "403" in message or "401" in message or "token" in message or "unauthorized" in message:
            return SplunkAPIError(
                "The official Splunk MCP server rejected authentication.",
                status_code=401,
            )
        if "timeout" in message:
            return SplunkAPIError(
                "The official Splunk MCP server did not respond before the timeout.",
                error_code="runtime_limit_exceeded",
            )
        return SplunkAPIError(f"Could not {operation}.")

    async def _call(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        session = self._session
        if not self._connected or session is None:
            raise SplunkAPIError("The official Splunk MCP connection is not ready.")
        try:
            async with self._call_lock:
                result = await session.call_tool(
                    name,
                    arguments or {},
                    read_timeout_seconds=timedelta(
                        seconds=max(self.request_timeout, self.job_timeout + 5)
                    ),
                )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            raise self._transport_error(exc, f"call {name}") from exc
        if getattr(result, "isError", False):
            raise SplunkAPIError(f"The official Splunk MCP server rejected {name}.")

        structured = getattr(result, "structuredContent", None)
        if isinstance(structured, dict):
            return structured
        for content in getattr(result, "content", []) or []:
            text = getattr(content, "text", None)
            if isinstance(text, str) and text.strip():
                try:
                    value = json.loads(text)
                except json.JSONDecodeError:
                    continue
                if isinstance(value, dict):
                    return value
        raise SplunkAPIError(f"Splunk MCP returned malformed {name} results.")

    @staticmethod
    def _rows(payload: dict[str, Any], operation: str) -> tuple[list[dict[str, Any]], bool | None, int | None, dict[str, Any]]:
        rows = payload.get("results")
        if rows is None and isinstance(payload.get("result"), dict):
            rows = [payload["result"]]
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise SplunkAPIError(f"Official Splunk MCP returned malformed {operation} results.")
        truncated = payload.get("truncated")
        if truncated is not None and not isinstance(truncated, bool):
            truncated = None
        total = _nonnegative_int(payload.get("total_rows"))
        if total is None:
            total = _nonnegative_int(payload.get("total"))
        page_info = payload.get("page_info")
        if not isinstance(page_info, dict):
            page_info = {}
        return rows, truncated, total, page_info

    async def run_search_job(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_count: int = 100,
        *,
        runtime_limit: float | None = None,
    ) -> dict[str, Any]:
        del runtime_limit
        payload = await self._call(
            "splunk_run_query",
            {
                "query": query,
                "earliest_time": earliest_time,
                "latest_time": latest_time,
                "row_limit": max(1, min(int(max_count), 1000)),
            },
        )
        events, truncated, total, _page_info = self._rows(payload, "search")
        columns: list[str] = []
        for event in events:
            for key in event:
                if key not in columns:
                    columns.append(key)
        fetched_count = len(events)
        return {
            "events": events,
            "columns": columns,
            "metadata": {
                "total_result_count": total,
                "fetched_count": fetched_count,
                "returned_count": fetched_count,
                "scan_count": None,
                "run_duration": None,
                # The official response explicitly tells us whether its row
                # ceiling was reached.  Preserve unknown when it omits it.
                "splunk_result_truncated": truncated,
            },
        }

    async def search_oneshot(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_count: int = 100,
    ) -> list[dict[str, Any]]:
        result = await self.run_search_job(query, earliest_time, latest_time, max_count)
        return result["events"]

    async def get_indexes(self) -> list[dict[str, Any]]:
        return await self._paged_rows("splunk_get_indexes", "indexes")

    async def get_sourcetypes(self, *, limit: int = 1000) -> list[dict[str, Any]]:
        return await self._paged_rows("splunk_get_sourcetypes", "sourcetypes", limit=limit)

    async def get_info(self) -> dict[str, Any]:
        payload = await self._call("splunk_get_info")
        rows, _truncated, _total, _page_info = self._rows(payload, "Splunk instance information")
        return rows[0] if rows else {}

    async def list_alerts(
        self,
        *,
        app: str = "",
        enabled: bool | None = None,
        severity: int | None = None,
        offset: int = 0,
        count: int = 100,
    ) -> dict[str, Any]:
        arguments: dict[str, Any] = {
            "offset": max(0, int(offset)),
            "count": max(1, min(int(count), 1000)),
        }
        if app.strip():
            arguments["app"] = app.strip()
        if enabled is not None:
            arguments["enabled"] = bool(enabled)
        if severity is not None:
            arguments["severity"] = int(severity)
        return await self._alert_page("splunk_list_alerts", arguments, "alerts")

    async def get_alert_details(self, name: str, app: str = "") -> dict[str, Any]:
        arguments: dict[str, Any] = {"alert_name": name}
        if app.strip():
            arguments["app"] = app.strip()
        payload = await self._call("splunk_get_alert_details", arguments)
        rows, truncated, total, _page_info = self._rows(payload, "alert details")
        return {"items": rows, "total": total, "truncated": truncated}

    async def list_fired_alerts(self, **kwargs: Any) -> dict[str, Any]:
        return await self.get_fired_alerts(**kwargs)

    async def get_fired_alert_details(self, name: str, **kwargs: Any) -> dict[str, Any]:
        return await self.get_fired_alert_page(name, **kwargs)

    async def get_alert_throttle(self, name: str, app: str = "") -> dict[str, Any]:
        arguments: dict[str, Any] = {"alert_name": name}
        if app.strip():
            arguments["app"] = app.strip()
        payload = await self._call("splunk_get_alert_throttle", arguments)
        rows, truncated, total, _page_info = self._rows(payload, "alert throttle")
        return {"items": rows, "total": total, "truncated": truncated}

    async def list_active_throttles(
        self,
        *,
        app: str = "",
        count: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        arguments: dict[str, Any] = {
            "offset": max(0, int(offset)),
            "count": max(1, min(int(count), 1000)),
        }
        if app.strip():
            arguments["app"] = app.strip()
        return await self._alert_page("splunk_list_active_throttles", arguments, "active throttles")

    async def _alert_page(
        self,
        tool: str,
        arguments: dict[str, Any],
        operation: str,
    ) -> dict[str, Any]:
        payload = await self._call(tool, arguments)
        rows, truncated, total, page_info = self._rows(payload, operation)
        next_offset = _nonnegative_int(page_info.get("offset"))
        if next_offset is not None:
            next_offset += len(rows)
        elif truncated:
            next_offset = arguments["offset"] + len(rows)
        return {"items": rows, "total": total, "next_offset": next_offset, "truncated": truncated}

    async def get_metadata(
        self,
        metadata_type: str,
        *,
        index: str = "*",
        earliest_time: str = "-24h",
        latest_time: str = "now",
        limit: int = 1000,
    ) -> dict[str, Any]:
        if metadata_type not in {"hosts", "sources"}:
            raise SplunkAPIError("The official Splunk MCP server supports hosts and sources metadata.")
        payload = await self._call(
            "splunk_get_metadata",
            {
                "type": metadata_type,
                "index": index,
                "earliest_time": earliest_time,
                "latest_time": latest_time,
                "row_limit": max(1, min(int(limit), 1000)),
            },
        )
        rows, truncated, total, _page_info = self._rows(payload, f"{metadata_type} metadata")
        return {
            "items": rows,
            "total": total,
            "next_offset": None,
            "truncated": truncated,
        }

    async def _paged_rows(
        self,
        tool: str,
        operation: str,
        *,
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        page_size = max(1, min(int(limit), 1000))
        offset = 0
        rows: list[dict[str, Any]] = []
        total: int | None = None
        while True:
            payload = await self._call(tool, {"offset": offset, "count": page_size})
            page, truncated, page_total, page_info = self._rows(payload, operation)
            rows.extend(page)
            total = page_total if page_total is not None else total
            if not truncated or not page or (total is not None and len(rows) >= total):
                break
            next_offset = _nonnegative_int(page_info.get("offset"))
            next_offset = (next_offset + len(page)) if next_offset is not None else offset + len(page)
            if next_offset <= offset:
                raise SplunkAPIError(f"Official Splunk MCP returned a non-advancing {operation} page.")
            offset = next_offset
        return rows

    async def get_fired_alerts(self, *, limit: int = 50, offset: int = 0) -> dict[str, Any]:
        payload = await self._call(
            "splunk_list_fired_alerts",
            {"offset": max(0, int(offset)), "count": max(1, min(int(limit), 1000))},
        )
        rows, truncated, total, page_info = self._rows(payload, "fired alerts")
        next_offset = _nonnegative_int(page_info.get("offset"))
        if next_offset is not None:
            next_offset += len(rows)
        elif truncated:
            next_offset = max(0, int(offset)) + len(rows)
        return {"items": rows, "total": total, "next_offset": next_offset}

    async def get_fired_alert_page(
        self,
        name: str,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        payload = await self._call(
            "splunk_get_fired_alert_details",
            {
                "alert_name": name,
                "offset": max(0, int(offset)),
                "count": max(1, min(int(limit), 1000)),
            },
        )
        rows, truncated, total, page_info = self._rows(payload, "fired alert details")
        next_offset = _nonnegative_int(page_info.get("offset"))
        if next_offset is not None:
            next_offset += len(rows)
        elif truncated:
            next_offset = max(0, int(offset)) + len(rows)
        return {"items": rows, "total": total, "next_offset": next_offset}

    async def get_fired_alert(self, name: str) -> list[dict[str, Any]]:
        return (await self.get_fired_alert_page(name, limit=1000))["items"]

    async def get_lookup_table_files(
        self,
        app: str = "",
        search: str = "",
        count: int = 50,
    ) -> list[dict[str, Any]]:
        requested_count = max(1, min(int(count), 1000))
        # The official catalog currently has no name-filter argument.  Fetch
        # the full exposed page for exact CITIC lookup resolution, then apply
        # the name predicate locally; otherwise Ruleset.csv can be missed when
        # it is beyond the first default page.
        catalog_limit = 1000 if search.strip() else requested_count
        payload = await self._call(
            "splunk_get_knowledge_objects",
            {"type": "lookups", "row_limit": catalog_limit},
        )
        rows, _truncated, _total, _page_info = self._rows(payload, "lookup metadata")
        exact_name = _search_name(search)
        default_app = str(self.config.get("splunk_lookup_app", "search") or "search")
        default_owner = str(self.config.get("splunk_lookup_owner", "nobody") or "nobody")
        entries: list[dict[str, Any]] = []
        for row in rows:
            name = str(row.get("name", "")).strip()
            if not name or (exact_name and name != exact_name):
                continue
            row_app = str(row.get("app", "") or "").strip()
            # The official lookup catalog may return the eai placeholder
            # rather than the owning namespace.  A requested app is the
            # authoritative scope for CITIC's fixed lookup configuration.
            selected_app = app.strip() or (default_app if row_app.startswith("eai:") else row_app)
            if app and row_app and not row_app.startswith("eai:") and row_app != app:
                continue
            selected_owner = str(row.get("owner", "") or default_owner)
            entries.append(
                {
                    "name": name,
                    "acl": {"app": selected_app, "owner": selected_owner},
                    "content": {"app": selected_app, "owner": selected_owner},
                }
            )
        return entries[:requested_count]

    async def get_lookup_contents(self, name: str, app: str = "", owner: str = "") -> list[list[str]]:
        if not _LOOKUP_NAME.fullmatch(name.strip()):
            raise SplunkAPIError("Lookup name is invalid.")
        payload = await self._call(
            "splunk_run_query",
            {
                "query": f"| inputlookup {name.strip()}",
                "app": app.strip() or str(self.config.get("splunk_lookup_app", "search")),
                "row_limit": 1000,
            },
        )
        rows, truncated, _total, _page_info = self._rows(payload, "lookup CSV")
        if truncated is True:
            # MCP Server 2.0 caps query results at 1,000 rows and does not
            # expose a lookup-file download operation.  Preserve the existing
            # Ruleset.csv workflow through the bounded REST reader only for
            # this explicit completeness gap; a rejected official query never
            # falls through here.
            rest = await self._rest()
            try:
                return await rest.get_lookup_contents(name, app, owner)
            except SplunkAPIError as exc:
                if exc.status_code not in {401, 403, 404}:
                    raise
                # Some deployments do not install the Lookup File Editing
                # app.  The legacy REST search endpoint can still read the
                # CSV without writing it, so retain that bounded fallback for
                # this one unsupported official operation.
                legacy = await rest.run_search_job(
                    f"| inputlookup {name.strip()}",
                    max_count=10_000,
                )
                legacy_rows = legacy.get("events", [])
                legacy_meta = legacy.get("metadata", {})
                if legacy_meta.get("splunk_result_truncated") is True:
                    raise SplunkAPIError(
                        "The lookup CSV is larger than the supported complete-read limit."
                    )
                legacy_headers: list[str] = []
                for row in legacy_rows:
                    for key in row:
                        if key not in legacy_headers:
                            legacy_headers.append(key)
                return [legacy_headers] + [
                    [_cell(row.get(key)) for key in legacy_headers] for row in legacy_rows
                ] if legacy_headers else []
        headers: list[str] = []
        for row in rows:
            for key in row:
                if key not in headers:
                    headers.append(key)
        return [headers] + [[_cell(row.get(key)) for key in headers] for row in rows] if headers else []

    async def get_saved_searches(
        self,
        name: str = "",
        app: str = "",
        count: int = 50,
    ) -> list[dict[str, Any]]:
        payload = await self._call(
            "splunk_get_knowledge_objects",
            {"type": "saved_searches", "row_limit": max(1, min(int(count), 1000))},
        )
        rows, _truncated, _total, _page_info = self._rows(payload, "saved search metadata")
        needle = name.strip().casefold()
        selected: list[dict[str, Any]] = []
        for row in rows:
            row_name = str(row.get("name", ""))
            row_app = str(row.get("app", ""))
            if needle and needle not in row_name.casefold():
                continue
            if app and row_app != app.strip():
                continue
            selected.append(
                {
                    "name": row_name,
                    "search": row.get("search", ""),
                    "description": row.get("description", ""),
                    "is_scheduled": bool(row.get("cron_schedule")),
                    "cron_schedule": row.get("cron_schedule", ""),
                    "next_scheduled_time": row.get("next_scheduled_time", ""),
                    "actions": row.get("actions", ""),
                    "disabled": _bool_value(row.get("disabled", False)),
                    "app": row_app,
                    "owner": str(row.get("owner", "")),
                }
            )
        return selected[: max(1, int(count))]

    async def get_saved_search(self, search_name: str, app: str = "", owner: str = "") -> dict[str, Any]:
        # Detection editor reads need alert trigger/throttle fields that are
        # omitted from the general knowledge-object catalog.  The official
        # alert-details tool is the authoritative exact lookup when available.
        alert_arguments: dict[str, Any] = {"alert_name": search_name}
        if app.strip():
            alert_arguments["app"] = app.strip()
        try:
            alert_payload = await self._call("splunk_get_alert_details", alert_arguments)
            alert_rows, _truncated, _total, _page_info = self._rows(alert_payload, "alert details")
            if alert_rows:
                row = alert_rows[0]
                if str(row.get("name", search_name)) == search_name:
                    return {
                        "name": search_name,
                        "content": row,
                        "acl": {"app": row.get("app", app), "owner": row.get("owner", owner)},
                    }
        except SplunkAPIError:
            # Not every saved search is an alert.  Continue with the official
            # knowledge-object catalog in that case.
            pass
        searches = await self.get_saved_searches(search_name, app, 1000)
        match = next((item for item in searches if item.get("name") == search_name), None)
        if match is None:
            raise SplunkAPIError("The requested saved search was not found.", status_code=404)
        return {
            "name": match["name"],
            "content": {
                key: value
                for key, value in match.items()
                if key not in {"name", "app", "owner"}
            },
            "acl": {"app": match.get("app", app), "owner": match.get("owner", owner)},
        }

    async def run_saved_search(
        self,
        search_name: str,
        trigger_actions: bool = False,
        max_count: int = 100,
        app: str = "",
        owner: str = "",
        *,
        runtime_limit: float | None = None,
        earliest_time: str | None = None,
        latest_time: str | None = None,
    ) -> dict[str, Any]:
        del owner, runtime_limit
        if trigger_actions:
            raise SplunkAPIError("The official Splunk MCP saved-search tool does not expose action triggering.")
        arguments: dict[str, Any] = {
            "saved_search_name": search_name,
            "app": app.strip() or None,
            "row_limit": max(1, min(int(max_count), 1000)),
        }
        if earliest_time:
            arguments["earliest_time"] = earliest_time
        if latest_time:
            arguments["latest_time"] = latest_time
        arguments = {key: value for key, value in arguments.items() if value is not None}
        payload = await self._call("splunk_run_saved_search", arguments)
        events, truncated, total, _page_info = self._rows(payload, "saved search")
        return {
            "search_name": search_name,
            "job_id": "",
            "event_count": len(events),
            "events": events,
            "metrics": {},
            "metadata": {
                "total_result_count": total,
                "fetched_count": len(events),
                "returned_count": len(events),
                "splunk_result_truncated": truncated,
            },
        }

    async def get_job_result_fields(
        self,
        sid: str,
        fields: tuple[str, ...] = ("Event_GID", "Event_Rulenum"),
        *,
        max_count: int = 10,
    ) -> list[dict[str, Any]]:
        # No equivalent official MCP operation exists; this is a bounded GET
        # against an already-created SID and remains a local compatibility path.
        return await (await self._rest()).get_job_result_fields(sid, fields, max_count=max_count)

    async def create_lookup_contents(self, name: str, app: str, owner: str, rows: list[list[str]]) -> dict[str, Any]:
        return await (await self._rest()).create_lookup_contents(name, app, owner, rows)

    async def update_lookup_contents(self, name: str, app: str, owner: str, rows: list[list[str]]) -> dict[str, Any]:
        return await (await self._rest()).update_lookup_contents(name, app, owner, rows)

    async def delete_lookup_table_file(self, name: str, app: str = "", owner: str = "") -> dict[str, Any]:
        return await (await self._rest()).delete_lookup_table_file(name, app, owner)

    async def create_saved_search(self, fields: dict[str, Any]) -> dict[str, Any]:
        return await (await self._rest()).create_saved_search(fields)

    async def update_saved_search(self, search_name: str, fields: dict[str, Any]) -> dict[str, Any]:
        return await (await self._rest()).update_saved_search(search_name, fields)

    async def _rest(self) -> SplunkClient:
        if self._rest_client is None:
            config = dict(self.config)
            config.pop("splunk_mcp_endpoint", None)
            # MCP bearer tokens can be audience-bound and are not necessarily
            # accepted by Splunk's legacy REST listener.  When the deployment
            # also supplies the existing scoped REST credentials, use those
            # for the explicitly retained compatibility path.
            if config.get("splunk_username") and config.get("splunk_password"):
                config["splunk_token"] = ""
            self._rest_client = SplunkClient(config)
            await self._rest_client.connect()
        return self._rest_client


def _flag(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().casefold() in {"1", "true", "yes", "on"}


def _bool_default(value: object, default: bool) -> bool:
    if value is None or str(value).strip() == "":
        return default
    return _flag(value)


def _nonnegative_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
    return parsed if parsed is not None and parsed >= 0 else None


def _cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _bool_value(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().casefold() in {"1", "true", "yes", "on"}


def _search_name(search: str) -> str:
    # Existing callers pass the safe ``name="Ruleset.csv"`` predicate.
    match = re.search(r'name="((?:\\.|[^"\\])*)"', search or "")
    if not match:
        return ""
    return match.group(1).replace('\\"', '"').replace('\\\\', '\\')


__all__ = ["OfficialSplunkMCPClient"]
