"""Client for Splunk's official MCP Server."""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from contextlib import AsyncExitStack
from datetime import timedelta
from typing import Any
from urllib.parse import urlsplit

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from .errors import SplunkAPIError


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
        self.write_endpoint = str(config.get("splunk_write_mcp_endpoint", "") or "").strip()
        self.write_token = str(config.get("splunk_write_mcp_token", "") or "").strip()
        self.write_tool = str(config.get("splunk_write_mcp_tool", "citic_write_saved_search") or "citic_write_saved_search").strip()
        self._write_stack: AsyncExitStack | None = None
        self._write_session: ClientSession | None = None
        self._write_call_lock = asyncio.Lock()
        self._connected = False
        self.server_version = ""
        self.last_saved_search_catalog_complete = False
        self.last_saved_search_catalog_error = ""
        self.last_saved_search_catalog_page_count = 0

    @property
    def deployment_identity(self) -> str:
        """Return the configured, non-secret identity used for index ownership."""
        configured = str(self.config.get("splunk_deployment_id", "") or "").strip()
        if configured:
            return configured[:512]
        parsed = urlsplit(self.endpoint)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")[:512]

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
        if self._stack is not None:
            await self._stack.aclose()
            self._stack = None
        self._write_session = None
        if self._write_stack is not None:
            await self._write_stack.aclose()
            self._write_stack = None

    async def _connect_write_extension(self) -> None:
        if self._write_session is not None:
            return
        if not self.write_endpoint or not self.write_token:
            raise SplunkAPIError(
                "The approved Splunk write MCP extension is not configured."
            )
        try:
            parsed = urlsplit(self.write_endpoint)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.query or parsed.fragment:
                raise ValueError
            if parsed.scheme == "http" and not _flag(self.config.get("allow_insecure_http")):
                raise ValueError("insecure HTTP is disabled")
        except ValueError as exc:
            raise SplunkAPIError("The approved Splunk write MCP endpoint is invalid.") from exc
        stack = AsyncExitStack()
        try:
            receive, send, _ = await stack.enter_async_context(
                streamablehttp_client(
                    self.write_endpoint,
                    headers={"Authorization": f"Bearer {self.write_token}"},
                    timeout=self.request_timeout,
                    sse_read_timeout=max(self.request_timeout, self.job_timeout + 5),
                    httpx_client_factory=self._httpx_client_factory,
                )
            )
            session = await stack.enter_async_context(ClientSession(receive, send))
            await session.initialize()
        except Exception as exc:
            await stack.aclose()
            if isinstance(exc, SplunkAPIError):
                raise
            raise self._transport_error(exc, "initialize the approved Splunk write extension") from exc
        self._write_stack = stack
        self._write_session = session

    async def _call_write_extension(self, operation: str, arguments: dict[str, Any]) -> dict[str, Any]:
        await self._connect_write_extension()
        session = self._write_session
        if session is None:
            raise SplunkAPIError("The approved Splunk write extension is not ready.")
        try:
            async with self._write_call_lock:
                result = await session.call_tool(
                    self.write_tool,
                    {"operation": operation, **arguments},
                    read_timeout_seconds=timedelta(
                        seconds=max(self.request_timeout, self.job_timeout + 5)
                    ),
                )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            raise self._transport_error(exc, f"call the approved Splunk write extension for {operation}") from exc
        if getattr(result, "isError", False):
            raise SplunkAPIError(
                f"The approved Splunk write extension rejected {operation}."
            )
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
        raise SplunkAPIError("The approved Splunk write extension returned malformed results.")

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
            raise SplunkAPIError(
                "The lookup CSV exceeds the official Splunk MCP result limit."
            )
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
        requested_count = max(1, min(int(count), 100_000))
        self.last_saved_search_catalog_complete = False
        self.last_saved_search_catalog_error = ""
        self.last_saved_search_catalog_page_count = 0
        page_size = min(requested_count, 1_000)
        offset = 0
        rows: list[dict[str, Any]] = []
        try:
            while True:
                arguments: dict[str, Any] = {
                    "type": "saved_searches",
                    "row_limit": page_size,
                }
                if offset:
                    arguments["offset"] = offset
                payload = await self._call("splunk_get_knowledge_objects", arguments)
                page, truncated, total, page_info = self._rows(payload, "saved search metadata")
                self.last_saved_search_catalog_page_count += 1
                rows.extend(page)
                if not page:
                    self.last_saved_search_catalog_complete = True
                    break
                if total is not None and len(rows) >= total:
                    self.last_saved_search_catalog_complete = True
                    break
                if truncated is False:
                    self.last_saved_search_catalog_complete = True
                    break
                if truncated is not True and total is None and len(page) < page_size:
                    self.last_saved_search_catalog_complete = True
                    break
                if len(rows) >= requested_count or len(rows) >= 100_000:
                    self.last_saved_search_catalog_error = "saved-search catalog reached the configured discovery cap"
                    break
                page_offset = _nonnegative_int(page_info.get("offset"))
                next_offset = page_offset + len(page) if page_offset is not None else offset + len(page)
                if next_offset <= offset:
                    raise SplunkAPIError("Official Splunk MCP returned a non-advancing saved-search page.")
                offset = next_offset
        except Exception as exc:
            self.last_saved_search_catalog_complete = False
            self.last_saved_search_catalog_error = str(exc)[:500]
            raise
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
                    "is_scheduled": _bool_value(
                        row.get("is_scheduled", bool(row.get("cron_schedule")))
                    ),
                    "cron_schedule": row.get("cron_schedule", ""),
                    "dispatch.earliest_time": row.get(
                        "dispatch.earliest_time", row.get("earliest_time", "")
                    ),
                    "dispatch.latest_time": row.get(
                        "dispatch.latest_time", row.get("latest_time", "")
                    ),
                    "next_scheduled_time": row.get("next_scheduled_time", ""),
                    "actions": row.get("actions", ""),
                    "alert_type": row.get("alert_type", ""),
                    "alert_comparator": row.get("alert_comparator", ""),
                    "alert_threshold": row.get("alert_threshold", ""),
                    "alert_condition": row.get("alert_condition", ""),
                    "alert.track": row.get("alert.track", ""),
                    "disabled": _bool_value(row.get("disabled", False)),
                    "app": row_app,
                    "owner": str(row.get("owner", "")),
                    "stable_id": str(
                        row.get("stable_id") or row.get("guid") or row.get("uid") or ""
                    ).strip()[:512],
                    "definition_revision": row.get("definition_revision") or row.get("revision"),
                    "source_indexes": row.get("source_indexes") or row.get("indexes") or [],
                }
            )
        return selected[:requested_count]

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
        fields: tuple[str, ...] = (),
        *,
        max_count: int = 10,
    ) -> list[dict[str, Any]]:
        del sid, fields, max_count
        raise SplunkAPIError(
            "The official Splunk MCP server does not expose search-job result reads."
        )

    async def create_lookup_contents(self, name: str, app: str, owner: str, rows: list[list[str]]) -> dict[str, Any]:
        del name, app, owner, rows
        raise SplunkAPIError(
            "The official Splunk MCP server does not expose lookup writes."
        )

    async def update_lookup_contents(self, name: str, app: str, owner: str, rows: list[list[str]]) -> dict[str, Any]:
        del name, app, owner, rows
        raise SplunkAPIError(
            "The official Splunk MCP server does not expose lookup writes."
        )

    async def delete_lookup_table_file(self, name: str, app: str = "", owner: str = "") -> dict[str, Any]:
        del name, app, owner
        raise SplunkAPIError(
            "The official Splunk MCP server does not expose lookup writes."
        )

    async def upload_lookup_contents(
        self,
        name: str,
        app: str,
        owner: str,
        content: str,
    ) -> dict[str, Any]:
        del name, app, owner, content
        raise SplunkAPIError(
            "The official Splunk MCP server does not expose lookup writes."
        )

    async def get_write_capabilities(self) -> dict[str, Any]:
        """Verify the separately deployed extension before a write."""
        return await self._call_write_extension("capabilities", {})

    async def get_write_operation_status(self, operation_id: str) -> dict[str, Any]:
        if not isinstance(operation_id, str) or not operation_id.strip():
            raise SplunkAPIError("A write operation ID is required for reconciliation.")
        return await self._call_write_extension("operation_status", {"operation_id": operation_id.strip()})

    async def create_saved_search(
        self,
        fields: dict[str, Any],
        *,
        idempotency_key: str | None = None,
        expected_revision: str | int | None = None,
    ) -> dict[str, Any]:
        if not isinstance(fields, dict):
            raise SplunkAPIError("Saved-search write fields are invalid.")
        encoded = json.dumps({"operation": "create_saved_search", "fields": fields}, sort_keys=True, default=str, separators=(",", ":"))
        idempotency_key = str(idempotency_key or hashlib.sha256(encoded.encode("utf-8")).hexdigest()).strip()
        arguments: dict[str, Any] = {"fields": fields, "idempotency_key": idempotency_key}
        if expected_revision is not None:
            arguments["expected_revision"] = str(expected_revision)
        return await self._call_write_extension(
            "create_saved_search",
            arguments,
        )

    async def update_saved_search(
        self,
        search_name: str,
        fields: dict[str, Any],
        *,
        idempotency_key: str | None = None,
        expected_revision: str | int | None = None,
    ) -> dict[str, Any]:
        if not isinstance(search_name, str) or not search_name.strip() or not isinstance(fields, dict):
            raise SplunkAPIError("Saved-search update fields are invalid.")
        encoded = json.dumps(
            {"operation": "update_saved_search", "search_name": search_name, "fields": fields},
            sort_keys=True,
            default=str,
            separators=(",", ":"),
        )
        idempotency_key = str(idempotency_key or hashlib.sha256(encoded.encode("utf-8")).hexdigest()).strip()
        arguments: dict[str, Any] = {"search_name": search_name, "fields": fields, "idempotency_key": idempotency_key}
        if expected_revision is not None:
            arguments["expected_revision"] = str(expected_revision)
        return await self._call_write_extension(
            "update_saved_search",
            arguments,
        )


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
