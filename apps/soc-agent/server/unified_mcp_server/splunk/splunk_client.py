"""Splunk REST API Client for async operations."""

import asyncio
import httpx
import json
import math
from time import monotonic
from typing import Optional, Dict, Any, List
from urllib.parse import parse_qs, quote, urlsplit


class SplunkAPIError(Exception):
    """Custom exception for Splunk API errors."""
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        details: Optional[dict] = None,
        *,
        error_code: str | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.error_code = error_code
        super().__init__(self.message)


class SplunkClient:
    """Async client for Splunk REST API operations."""
    
    def __init__(self, config: dict):
        """Initialize Splunk client with configuration.
        
        Args:
            config: Dictionary containing:
                - splunk_host: Splunk server hostname
                - splunk_port: Splunk management port (default: 8089)
                - splunk_username: Username for basic auth (optional)
                - splunk_password: Password for basic auth (optional)
                - splunk_token: Token for token auth (optional)
                - verify_ssl: Whether to verify SSL certificates
        """
        self.config = config
        self.base_url = (
            str(config.get("splunk_url", "")).strip().rstrip("/")
            or f"https://{config['splunk_host']}:{config['splunk_port']}"
        )
        self._client: Optional[httpx.AsyncClient] = None
        
    async def connect(self):
        """Create and configure the HTTP client."""
        self._validate_base_url()
        # Setup authentication - prefer token over basic auth
        auth = None
        headers = {}
        
        if self.config.get("splunk_token"):
            headers["Authorization"] = f"Splunk {self.config['splunk_token']}"
        elif self.config.get("splunk_username") and self.config.get("splunk_password"):
            auth = httpx.BasicAuth(self.config["splunk_username"], self.config["splunk_password"])
        else:
            raise SplunkAPIError("No valid authentication configured. Set either SPLUNK_TOKEN or SPLUNK_USERNAME/SPLUNK_PASSWORD.")
        
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            auth=auth,
            headers=headers,
            verify=self.config.get("verify_ssl", True),
            timeout=float(self.config.get("request_timeout", 30))
        )

    def _validate_base_url(self):
        """Fail closed before sending credentials to an unsafe endpoint."""
        try:
            parsed = urlsplit(self.base_url)
            parsed.port
            hostname = parsed.hostname
        except ValueError as exc:
            raise SplunkAPIError("Splunk URL is invalid.") from exc
        if (
            parsed.scheme.lower() not in {"http", "https"}
            or not parsed.netloc
            or not hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            raise SplunkAPIError("Splunk URL is invalid.")
        allow_insecure_http = self.config.get("allow_insecure_http", False)
        if isinstance(allow_insecure_http, str):
            allow_insecure_http = allow_insecure_http.strip().lower() in {"1", "true", "yes", "on"}
        if parsed.scheme.lower() == "http" and not allow_insecure_http:
            raise SplunkAPIError(
                "Splunk URL must use HTTPS unless SPLUNK_ALLOW_INSECURE_HTTP is true."
            )
        
    async def disconnect(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
            
    def _ensure_connected(self):
        """Ensure client is connected."""
        if not self._client:
            raise SplunkAPIError("Client not connected. Call connect() first or use async context manager.")

    @staticmethod
    def _response_json(response, operation: str) -> dict[str, Any]:
        """Return a strict JSON object or raise a client-level API error."""
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise SplunkAPIError(
                f"Splunk {operation} failed.",
                status_code=exc.response.status_code,
            ) from exc
        try:
            payload = response.json()
        except (TypeError, ValueError) as exc:
            raise SplunkAPIError(f"Splunk returned malformed {operation} JSON.") from exc
        if not isinstance(payload, dict):
            raise SplunkAPIError(f"Splunk returned a malformed {operation} response.")
        return payload

    @staticmethod
    def _raise_message_errors(payload: dict[str, Any], operation: str) -> None:
        error = payload.get("error")
        if error:
            raise SplunkAPIError(f"Splunk returned an error for {operation}.")
        messages = payload.get("messages", [])
        if messages is None:
            return
        if not isinstance(messages, list):
            raise SplunkAPIError(f"Splunk returned malformed {operation} messages.")
        for message in messages:
            if not isinstance(message, dict):
                raise SplunkAPIError(f"Splunk returned malformed {operation} messages.")
            if str(message.get("type", "")).upper() in {"ERROR", "FATAL"}:
                raise SplunkAPIError(f"Splunk returned an error for {operation}.")

    @staticmethod
    def _resource_items(payload: dict[str, Any], operation: str) -> list[dict[str, Any]]:
        """Extract a bounded list from the named read-only REST resources."""
        candidates: Any = None
        for key in ("entry", "items", "results", "data"):
            if key in payload:
                candidates = payload[key]
                break
        if isinstance(candidates, dict):
            nested = candidates.get(
                "items",
                candidates.get("entry", candidates.get("results")),
            )
            candidates = nested if nested is not None else (
                [candidates]
                if any(
                    key in candidates
                    for key in ("id", "finding_id", "findingId", "sid")
                )
                else None
            )
        if candidates is None and any(
            key in payload
            for key in ("id", "finding_id", "findingId", "sid")
        ):
            candidates = [payload]
        if not isinstance(candidates, list) or any(not isinstance(item, dict) for item in candidates):
            raise SplunkAPIError(f"Splunk returned malformed {operation} items.")
        return candidates

    async def _get_queue_json(
        self,
        path: str,
        *,
        params: dict[str, Any],
        operation: str,
    ) -> dict[str, Any]:
        try:
            response = await self._client.get(path, params=params)
            payload = self._response_json(response, operation)
            self._raise_message_errors(payload, operation)
            return payload
        except SplunkAPIError:
            raise
        except httpx.RequestError as exc:
            raise SplunkAPIError(f"Splunk could not retrieve {operation}.") from exc
        except Exception as exc:
            raise SplunkAPIError(f"Splunk could not retrieve {operation}.") from exc

    @staticmethod
    def _queue_page(payload: dict[str, Any], operation: str) -> dict[str, Any]:
        items = SplunkClient._resource_items(payload, operation)
        paging = payload.get("paging")
        if not isinstance(paging, dict):
            paging = {}
        meta = payload.get("meta")
        if not isinstance(meta, dict):
            meta = {}

        def page_value(name: str) -> Any:
            for container in (payload, paging, meta):
                value = container.get(name)
                if value is not None:
                    return value
            return None

        total = next(
            (
                parsed
                for key in (
                    "total",
                    "total_count",
                    "totalResults",
                    "totalCount",
                    "total_results",
                    "opensearch:totalResults",
                )
                if (parsed := SplunkClient._optional_int(page_value(key))) is not None
            ),
            None,
        )
        next_offset = SplunkClient._optional_int(page_value("next_offset"))
        if next_offset is None:
            next_link = page_value("next") or page_value("nextLink")
            if isinstance(next_link, str) and next_link.strip():
                query = parse_qs(urlsplit(next_link).query)
                values = query.get("offset") or query.get("start")
                if values:
                    next_offset = SplunkClient._optional_int(values[0])
        return {"items": items, "total": total, "next_offset": next_offset}

    @staticmethod
    def _optional_int(value: Any) -> int | None:
        if value is None or isinstance(value, bool):
            return None
        if isinstance(value, int):
            parsed = value
        elif isinstance(value, float):
            if not math.isfinite(value) or not value.is_integer():
                return None
            parsed = int(value)
        elif isinstance(value, str):
            raw = value.strip()
            if not raw or (raw[0] in "+-" and not raw[1:].isdigit()) or (
                raw[0] not in "+-" and not raw.isdigit()
            ):
                return None
            try:
                parsed = int(raw)
            except ValueError:
                return None
        else:
            return None
        return parsed if parsed >= 0 else None

    @staticmethod
    def _optional_float(value: Any) -> float | None:
        if value is None or isinstance(value, bool):
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        return parsed if math.isfinite(parsed) and parsed >= 0 else None

    @staticmethod
    def _job_content(payload: dict[str, Any], operation: str) -> tuple[dict[str, Any], str]:
        entries = payload.get("entry")
        if not isinstance(entries, list) or not entries or not isinstance(entries[0], dict):
            raise SplunkAPIError(f"Splunk returned malformed {operation} status.")
        content = entries[0].get("content")
        if not isinstance(content, dict):
            raise SplunkAPIError(f"Splunk returned malformed {operation} status.")
        state = str(content.get("dispatchState", "")).strip().upper()
        if not state:
            raise SplunkAPIError(f"Splunk returned a job status without dispatchState.")
        return content, state

    @staticmethod
    def _job_sid(payload: dict[str, Any], operation: str) -> str:
        sid = payload.get("sid")
        if not isinstance(sid, str) or not sid.strip():
            raise SplunkAPIError(f"Splunk returned no SID for {operation}.")
        return sid.strip()

    async def _cancel_job(self, sid: str) -> None:
        """Cancel a remote job without masking the original failure."""
        try:
            response = await self._client.post(
                f"/services/search/jobs/{quote(sid, safe='')}/control",
                data={"action": "cancel"},
                params={"output_mode": "json"},
            )
            response.raise_for_status()
        except Exception:
            # Cancellation is best effort; the original job error is more useful.
            return

    @staticmethod
    def _deadline_error(
        label: str,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> SplunkAPIError:
        if error_code == "runtime_limit_exceeded":
            return SplunkAPIError(
                f"{label} exceeded its runtime limit.",
                details=details,
                error_code=error_code,
            )
        return SplunkAPIError(f"{label} timed out.", details=details)

    async def _poll_job(
        self,
        sid: str,
        deadline: float,
        label: str,
        *,
        timeout_error_code: str | None = None,
        timeout_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        job_url = f"/services/search/jobs/{quote(sid, safe='')}"
        poll_delay = 0.5
        terminal_states = {
            "FAILED",
            "PAUSE",
            "PAUSED",
            "INTERNAL_CANCEL",
            "USER_CANCEL",
            "BAD_INPUT_CANCEL",
            "QUIT",
            "CANCELED",
            "CANCELLED",
            "ABORTED",
        }
        active_states = {"QUEUED", "PARSING", "RUNNING", "FINALIZING", "ROLLINGBACK"}

        while True:
            remaining = deadline - monotonic()
            if remaining <= 0:
                raise self._deadline_error(label, timeout_error_code, timeout_details)
            try:
                response = await asyncio.wait_for(
                    self._client.get(job_url, params={"output_mode": "json"}),
                    timeout=remaining,
                )
                payload = self._response_json(response, f"{label} status")
                self._raise_message_errors(payload, f"{label} status")
                content, state = self._job_content(payload, label)
            except asyncio.TimeoutError as exc:
                raise self._deadline_error(label, timeout_error_code, timeout_details) from exc
            except SplunkAPIError:
                raise
            except httpx.RequestError as exc:
                raise SplunkAPIError(f"Splunk could not retrieve {label} status.") from exc
            except Exception as exc:
                raise SplunkAPIError(f"Splunk could not retrieve {label} status.") from exc

            if state == "DONE":
                return content
            if state in terminal_states:
                raise SplunkAPIError(f"{label} entered terminal state {state}.")
            if state not in active_states:
                raise SplunkAPIError(f"Splunk returned unknown {label} state {state}.")

            await asyncio.sleep(min(poll_delay, max(0.0, remaining)))
            poll_delay = min(poll_delay * 2, 2.0)

    @staticmethod
    def _parse_result_columns(payload: dict[str, Any], operation: str) -> list[str]:
        fields = payload.get("fields")
        if fields is None:
            return []
        if not isinstance(fields, list):
            raise SplunkAPIError(f"Splunk returned malformed {operation} fields.")

        columns: list[str] = []
        for field in fields:
            if isinstance(field, str):
                name = field.strip()
            elif isinstance(field, dict):
                name = field.get("name")
                if isinstance(name, str):
                    name = name.strip()
            else:
                name = None
            if not isinstance(name, str) or not name:
                raise SplunkAPIError(f"Splunk returned malformed {operation} fields.")
            if name not in columns:
                columns.append(name)
        return columns

    @staticmethod
    def _parse_result_page(
        response_text: str,
        operation: str,
    ) -> tuple[list[dict[str, Any]], int | None, int | None, list[str]]:
        try:
            payload = json.loads(response_text)
        except json.JSONDecodeError:
            # Preserve compatibility with line-delimited JSON returned by older
            # Splunk deployments while still rejecting unrecognizable payloads.
            return SplunkClient._parse_response(response_text), None, None, []
        if not isinstance(payload, dict):
            raise SplunkAPIError(f"Splunk returned malformed {operation} results.")
        SplunkClient._raise_message_errors(payload, operation)
        results = payload.get("results")
        if results is None and "result" in payload:
            results = [payload["result"]]
        if not isinstance(results, list) or any(not isinstance(item, dict) for item in results):
            raise SplunkAPIError(f"Splunk returned malformed {operation} results.")
        init_offset = SplunkClient._optional_int(payload.get("init_offset"))
        reported_total = next(
            (
                parsed
                for key in ("total", "total_result_count", "resultCount")
                if (parsed := SplunkClient._optional_int(payload.get(key))) is not None
            ),
            None,
        )
        return results, init_offset, reported_total, SplunkClient._parse_result_columns(payload, operation)

    async def _fetch_result_page(
        self,
        results_url: str,
        offset: int,
        count: int,
        label: str,
        deadline: float | None = None,
        *,
        timeout_error_code: str | None = None,
        timeout_details: dict[str, Any] | None = None,
    ) -> tuple[list[dict[str, Any]], int | None, int | None, list[str]]:
        try:
            if deadline is not None:
                remaining = deadline - monotonic()
                if remaining <= 0:
                    raise self._deadline_error(label, timeout_error_code, timeout_details)
            request = self._client.get(
                results_url,
                params={"output_mode": "json", "count": count, "offset": offset},
            )
            if deadline is None:
                response = await request
            else:
                try:
                    response = await asyncio.wait_for(request, timeout=remaining)
                except asyncio.TimeoutError as exc:
                    raise self._deadline_error(label, timeout_error_code, timeout_details) from exc
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise SplunkAPIError(
                    f"Splunk {label} result retrieval failed.",
                    status_code=exc.response.status_code,
                ) from exc
            return self._parse_result_page(response.text, label)
        except SplunkAPIError:
            raise
        except httpx.RequestError as exc:
            raise SplunkAPIError(f"Splunk could not retrieve {label} results.") from exc
        except Exception as exc:
            raise SplunkAPIError(f"Splunk could not retrieve {label} results.") from exc

    async def _run_job(
        self,
        *,
        dispatch_url: str,
        dispatch_params: dict[str, Any],
        max_count: int,
        results_path_prefix: str,
        label: str,
        runtime_limit: float | None = None,
    ) -> tuple[str, dict[str, Any], list[dict[str, Any]], int | None, list[str]]:
        sid: str | None = None
        job_complete = False
        try:
            try:
                response = await self._client.post(dispatch_url, data=dispatch_params)
                payload = self._response_json(response, f"{label} dispatch")
                candidate_sid = payload.get("sid")
                if isinstance(candidate_sid, str) and candidate_sid.strip():
                    sid = candidate_sid.strip()
                self._raise_message_errors(payload, f"{label} dispatch")
                if sid is None:
                    sid = self._job_sid(payload, label)
            except SplunkAPIError:
                raise
            except httpx.RequestError as exc:
                raise SplunkAPIError(f"Splunk could not dispatch {label}.") from exc
            except Exception as exc:
                raise SplunkAPIError(f"Splunk could not dispatch {label}.") from exc

            configured_timeout = float(self.config.get("job_timeout", 120))
            effective_timeout = configured_timeout
            timeout_error_code: str | None = None
            timeout_details: dict[str, Any] | None = None
            if runtime_limit is not None:
                try:
                    requested_runtime = float(runtime_limit)
                except (TypeError, ValueError) as exc:
                    raise SplunkAPIError("Invalid search runtime limit.") from exc
                if not math.isfinite(requested_runtime) or requested_runtime <= 0:
                    raise SplunkAPIError("Invalid search runtime limit.")
                effective_timeout = min(configured_timeout, requested_runtime)
                if requested_runtime <= configured_timeout:
                    timeout_error_code = "runtime_limit_exceeded"
                    timeout_details = {"runtime_limit_seconds": requested_runtime}
            deadline = monotonic() + effective_timeout
            content = await self._poll_job(
                sid,
                deadline,
                label,
                timeout_error_code=timeout_error_code,
                timeout_details=timeout_details,
            )

            limit = max(1, int(max_count))
            page_size = min(limit, 10_000)
            results_url = f"{results_path_prefix}/{quote(sid, safe='')}/results"
            events: list[dict[str, Any]] = []
            columns: list[str] = []
            offset = 0
            page_total: int | None = None
            status_total = self._optional_int(content.get("resultCount"))

            while len(events) < limit:
                requested_count = min(page_size, limit - len(events))
                page, page_offset, reported_total, page_columns = await self._fetch_result_page(
                    results_url,
                    offset,
                    requested_count,
                    label,
                    deadline,
                    timeout_error_code=timeout_error_code,
                    timeout_details=timeout_details,
                )
                if reported_total is not None:
                    page_total = reported_total
                if not page:
                    break

                fetched_page = page[:requested_count]
                events.extend(fetched_page)
                for column in page_columns:
                    if column not in columns:
                        columns.append(column)
                for event in fetched_page:
                    for column in event:
                        if column not in columns:
                            columns.append(column)
                next_offset = (page_offset if page_offset is not None else offset) + len(fetched_page)
                if next_offset <= offset:
                    next_offset = offset + len(fetched_page)
                total = status_total if status_total is not None else page_total
                if total is not None and next_offset >= total:
                    break
                if len(page) < requested_count and total is None:
                    break
                offset = next_offset

            total = status_total if status_total is not None else page_total
            job_complete = True
            return sid, content, events, total, columns
        finally:
            if sid is not None and not job_complete:
                await self._cancel_job(sid)

    @staticmethod
    def _flag(value: Any) -> bool:
        return value is True or str(value).strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _saved_searches_path(app: str = "", owner: str = "") -> str:
        if app or owner:
            return f"/servicesNS/{quote(owner or 'nobody', safe='')}/{quote(app or 'search', safe='')}/saved/searches"
        return "/services/saved/searches"
            
    @staticmethod
    def _parse_response(response_text: str) -> List[Dict[str, Any]]:
        """Parse JSON results without converting malformed responses into false zeroes."""
        def results(payload: Any) -> list[dict[str, Any]] | None:
            if not isinstance(payload, dict):
                raise SplunkAPIError("Splunk returned an unexpected JSON response.")
            SplunkClient._raise_message_errors(payload, "results")
            values = payload.get("results")
            if values is None and "result" in payload:
                values = [payload["result"]]
            if values is None:
                return None
            if not isinstance(values, list) or any(not isinstance(item, dict) for item in values):
                raise SplunkAPIError("Splunk returned malformed result records.")
            return values

        try:
            payload = json.loads(response_text)
        except json.JSONDecodeError:
            events: list[dict[str, Any]] = []
            for line in response_text.splitlines():
                if not line.strip():
                    continue
                try:
                    values = results(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise SplunkAPIError("Splunk returned malformed JSON results.") from exc
                if values is not None:
                    events.extend(values)
            if events:
                return events
            raise SplunkAPIError("Splunk returned no recognizable result records.")
        values = results(payload)
        if values is None:
            raise SplunkAPIError("Splunk returned no recognizable result records.")
        return values

    async def run_search_job(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_count: int = 100,
        *,
        runtime_limit: float | None = None,
    ) -> Dict[str, Any]:
        """Run a normal asynchronous search job and return bounded results."""
        self._ensure_connected()
        if query.strip().startswith("|"):
            search_query = query.strip()
        else:
            search_query = f"search {query.strip()}"
        limit = max(1, int(max_count))
        _, content, events, total, columns = await self._run_job(
            dispatch_url="/services/search/jobs",
            dispatch_params={
                "search": search_query,
                "earliest_time": earliest_time,
                "latest_time": latest_time,
                "exec_mode": "normal",
                "search_mode": "normal",
                "max_count": limit,
                "output_mode": "json",
            },
            max_count=limit,
            results_path_prefix="/services/search/v2/jobs",
            label="search job",
            runtime_limit=runtime_limit,
        )
        fetched_count = len(events)
        return {
            "events": events,
            "columns": columns,
            "metadata": {
                "total_result_count": total,
                "fetched_count": fetched_count,
                "returned_count": fetched_count,
                "scan_count": self._optional_int(content.get("scanCount")),
                "run_duration": self._optional_float(content.get("runDuration")),
                "splunk_result_truncated": (
                    total is not None and total > fetched_count
                    if total is not None
                    else None
                ),
            },
        }
            
    async def search_oneshot(self, query: str, earliest_time: str = "-24h", 
                           latest_time: str = "now", max_count: int = 100) -> List[Dict[str, Any]]:
        """Execute a oneshot search and return results immediately.
        
        Args:
            query: SPL search query
            earliest_time: Start time for search
            latest_time: End time for search  
            max_count: Maximum number of results
            
        Returns:
            List of event dictionaries
        """
        self._ensure_connected()
        
        # Don't prepend "search" if query starts with a pipe (|)
        if query.strip().startswith("|"):
            search_query = query
        else:
            search_query = f"search {query}"
            
        params = {
            "search": search_query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "count": max_count,
            "output_mode": "json"
        }
        
        try:
            response = await self._client.post("/services/search/jobs/oneshot", data=params)
            response.raise_for_status()
            return self._parse_response(response.text)
        except SplunkAPIError:
            raise
        except httpx.HTTPStatusError as e:
            raise SplunkAPIError("Search failed.", status_code=e.response.status_code) from e
        except Exception as e:
            raise SplunkAPIError("Search failed.") from e
            
    async def get_indexes(self) -> List[Dict[str, Any]]:
        """Get list of all indexes with detailed information.
        
        Returns:
            List of index dictionaries with properties
        """
        self._ensure_connected()
        
        try:
            response = await self._client.get("/services/data/indexes", params={"output_mode": "json"})
            response.raise_for_status()
            
            data = response.json()
            indexes = []
            
            for entry in data.get("entry", []):
                content = entry.get("content", {})
                indexes.append({
                    "name": entry.get("name", ""),
                    "datatype": content.get("datatype", "event"),
                    "totalEventCount": int(content.get("totalEventCount", "0")),
                    "currentDBSizeMB": float(content.get("currentDBSizeMB", "0")),
                    "maxDataSize": content.get("maxDataSize", "auto"),
                    "maxTotalDataSizeMB": content.get("maxTotalDataSizeMB", "unknown"),
                    "minTime": content.get("minTime", ""),
                    "maxTime": content.get("maxTime", ""),
                    "disabled": content.get("disabled", False),
                    "frozenTimePeriodInSecs": content.get("frozenTimePeriodInSecs", "")
                })
            
            return indexes
        except httpx.TimeoutException as e:
            raise SplunkAPIError(
                "Splunk did not respond before the timeout. Check network access or increase SPLUNK_REQUEST_TIMEOUT."
            ) from e
        except httpx.ConnectError as e:
            raise SplunkAPIError(
                "Could not reach Splunk at the configured URL. Check SPLUNK_URL, the port, network access, and that Splunk is running."
            ) from e
        except httpx.HTTPStatusError as e:
            raise SplunkAPIError(
                f"Splunk rejected the index request (HTTP {e.response.status_code}). Check the credentials and index permissions.",
                status_code=e.response.status_code,
            ) from e
        except httpx.RequestError as e:
            raise SplunkAPIError("The request to Splunk failed. Check the URL and network access.") from e
        except Exception as e:
            raise SplunkAPIError("Splunk returned an invalid index response.") from e

    async def get_fired_alerts(self, *, limit: int = 50, offset: int = 0) -> dict[str, Any]:
        """Read the bounded catalog of standard Splunk fired alerts."""
        self._ensure_connected()
        payload = await self._get_queue_json(
            "/services/alerts/fired_alerts",
            params={
                "output_mode": "json",
                "count": max(1, min(int(limit), 201)),
                "offset": max(0, int(offset)),
            },
            operation="fired alerts",
        )
        return self._queue_page(payload, "fired alerts")

    async def get_fired_alert(self, name: str) -> list[dict[str, Any]]:
        """Read the unexpired instances for one named fired alert."""
        self._ensure_connected()
        payload = await self._get_queue_json(
            f"/services/alerts/fired_alerts/{quote(name, safe='')}",
            params={"output_mode": "json"},
            operation="fired alert",
        )
        return self._resource_items(payload, "fired alert")

    async def get_lookup_table_files(self, app: str = "", search: str = "", count: int = 50) -> List[Dict[str, Any]]:
        """List visible lookup-table knowledge objects without modifying them."""
        self._ensure_connected()
        params = {"output_mode": "json", "count": max(1, min(int(count), 200))}
        if search.strip():
            params["search"] = search.strip()

        try:
            response = await self._client.get("/services/data/lookup-table-files", params=params)
            response.raise_for_status()
            entries = response.json().get("entry", [])
            if not app.strip():
                return entries

            requested_app = app.strip()
            filtered = []
            for entry in entries:
                acl = entry.get("acl") if isinstance(entry.get("acl"), dict) else {}
                content = entry.get("content") if isinstance(entry.get("content"), dict) else {}
                entry_app = acl.get("app") or content.get("app") or ""
                if entry_app == requested_app:
                    filtered.append(entry)
            return filtered
        except httpx.HTTPStatusError as e:
            raise SplunkAPIError(
                "Failed to get lookup-table files",
                status_code=e.response.status_code,
            ) from e
        except Exception as e:
            raise SplunkAPIError("Failed to get lookup-table files.") from e
            
    async def get_saved_searches(self, name: str = "", app: str = "", count: int = 50) -> List[Dict[str, Any]]:
        """Get list of all saved searches.
        
        Returns:
            List of saved search dictionaries
        """
        self._ensure_connected()
        
        params = {"output_mode": "json", "count": max(1, min(int(count), 200))}
        name = name.strip()
        app = app.strip()
        predicates = []
        if name:
            escaped = name.replace("\\", "\\\\").replace('"', '\\"').replace("*", "\\*")
            predicates.append(f'name="*{escaped}*"')
        if app:
            escaped_app = app.replace("\\", "\\\\").replace('"', '\\"').replace("*", "\\*")
            predicates.append(f'app="{escaped_app}"')
        if predicates:
            params["search"] = " AND ".join(predicates)

        try:
            response = await self._client.get("/services/saved/searches", params=params)
            response.raise_for_status()
            
            data = response.json()
            saved_searches = []
            
            for entry in data.get("entry", []):
                content = entry.get("content", {})
                if not isinstance(content, dict):
                    content = {}
                acl = entry.get("acl", {})
                if not isinstance(acl, dict):
                    acl = {}
                saved_searches.append({
                    "name": entry.get("name", ""),
                    "search": content.get("search", ""),
                    "description": content.get("description", ""),
                    "is_scheduled": self._flag(content.get("is_scheduled", False)),
                    "cron_schedule": content.get("cron_schedule", ""),
                    "next_scheduled_time": content.get("next_scheduled_time", ""),
                    "actions": content.get("actions", ""),
                    "disabled": self._flag(content.get("disabled", False)),
                    "app": acl.get("app") or content.get("app", ""),
                    "owner": acl.get("owner") or content.get("owner", ""),
                })
            
            return saved_searches
        except httpx.HTTPStatusError as e:
            raise SplunkAPIError("Failed to get saved searches.", status_code=e.response.status_code) from e
        except Exception as e:
            raise SplunkAPIError("Failed to get saved searches.") from e

    async def get_saved_search(self, search_name: str, app: str = "", owner: str = "") -> Dict[str, Any]:
        """Retrieve one saved search, including its ACL and schedule fields."""
        self._ensure_connected()
        try:
            url = f"{self._saved_searches_path(app, owner)}/{quote(search_name, safe='')}"
            response = await self._client.get(url, params={"output_mode": "json"})
            response.raise_for_status()
            entry = response.json().get("entry", [{}])[0]
            return {
                "name": entry.get("name", search_name),
                "content": entry.get("content", {}),
                "acl": entry.get("acl", {}),
                "links": entry.get("links", {}),
            }
        except httpx.HTTPStatusError as e:
            raise SplunkAPIError("Failed to get saved search.", status_code=e.response.status_code) from e
        except Exception as e:
            raise SplunkAPIError("Failed to get saved search.") from e

    async def create_saved_search(self, fields: Dict[str, Any]) -> Dict[str, Any]:
        """Create a saved search using the standard Splunk REST fields."""
        self._ensure_connected()
        try:
            values = {str(key): str(value) for key, value in fields.items() if value is not None}
            scope = {key: values.pop(key) for key in ("app", "owner") if key in values}
            response = await self._client.post(
                self._saved_searches_path(scope.get("app", ""), scope.get("owner", "")),
                data=values,
                params={"output_mode": "json"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise SplunkAPIError("Failed to create saved search.", status_code=e.response.status_code) from e
        except Exception as e:
            raise SplunkAPIError("Failed to create saved search.") from e

    async def update_saved_search(self, search_name: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        """Update fields on an existing saved search."""
        self._ensure_connected()
        try:
            values = {str(key): str(value) for key, value in fields.items() if value is not None}
            scope = {key: values.pop(key) for key in ("app", "owner") if key in values}
            url = f"{self._saved_searches_path(scope.get('app', ''), scope.get('owner', ''))}/{quote(search_name, safe='')}"
            response = await self._client.post(
                url,
                data=values,
                params={"output_mode": "json"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise SplunkAPIError("Failed to update saved search.", status_code=e.response.status_code) from e
        except Exception as e:
            raise SplunkAPIError("Failed to update saved search.") from e
            
    async def run_saved_search(
        self,
        search_name: str,
        trigger_actions: bool = False,
        max_count: int = 100,
        app: str = "",
        owner: str = "",
        *,
        runtime_limit: float | None = None,
    ) -> Dict[str, Any]:
        """Run a saved search by name and get results.
        
        Args:
            search_name: Name of the saved search
            trigger_actions: Whether to trigger configured actions
            
        Returns:
            Dictionary with job info and results
        """
        self._ensure_connected()
        dispatch_url = f"{self._saved_searches_path(app, owner)}/{quote(search_name, safe='')}/dispatch"
        job_id, content, events, _, _columns = await self._run_job(
            dispatch_url=dispatch_url,
            dispatch_params={
                "trigger_actions": "1" if trigger_actions else "0",
                "output_mode": "json",
            },
            max_count=max(1, min(int(max_count), 10_000)),
            results_path_prefix="/services/search/jobs",
            label="saved search",
            runtime_limit=runtime_limit,
        )
        return {
            "search_name": search_name,
            "job_id": job_id,
            "event_count": len(events),
            "events": events,
            "metrics": {
                key: content.get(key)
                for key in (
                    "runDuration",
                    "scanCount",
                    "eventCount",
                    "resultCount",
                    "sid",
                )
                if content.get(key) is not None
            },
        }
