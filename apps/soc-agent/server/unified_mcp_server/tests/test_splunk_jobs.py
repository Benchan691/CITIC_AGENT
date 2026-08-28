import asyncio
import json

import httpx
import pytest

from unified_mcp_server.splunk.splunk_client import SplunkAPIError, SplunkClient


def http_response(payload=None, *, status_code=200, text=None):
    request = httpx.Request("GET", "https://splunk.example.com")
    if text is not None:
        return httpx.Response(status_code, text=text, request=request)
    return httpx.Response(status_code, json=payload, request=request)


def job_status(state, **metrics):
    return {"entry": [{"content": {"dispatchState": state, **metrics}}]}


class JobHTTP:
    def __init__(
        self,
        *,
        statuses=None,
        pages=None,
        dispatch_payload=None,
        dispatch_status=200,
        result_statuses=None,
    ):
        self.statuses = list(statuses or [job_status("DONE")])
        self.pages = pages or {}
        self.dispatch_payload = (
            {"sid": "job/1"} if dispatch_payload is None else dispatch_payload
        )
        self.dispatch_status = dispatch_status
        self.result_statuses = result_statuses or {}
        self.status_index = 0
        self.post_calls = []
        self.get_calls = []

    async def post(self, path, data, params=None):
        self.post_calls.append((path, data, params))
        if path == "/services/search/jobs":
            return http_response(self.dispatch_payload, status_code=self.dispatch_status)
        if path.endswith("/control"):
            return http_response({"messages": []})
        raise AssertionError(f"unexpected POST {path}")

    async def get(self, path, params):
        self.get_calls.append((path, params))
        if path == "/services/search/jobs/job%2F1":
            payload = self.statuses[min(self.status_index, len(self.statuses) - 1)]
            self.status_index += 1
            return http_response(payload)
        if path == "/services/search/v2/jobs/job%2F1/results":
            offset = params["offset"]
            status = self.result_statuses.get(offset, 200)
            page = self.pages.get(offset, {"results": []})
            return http_response(page, status_code=status)
        raise AssertionError(f"unexpected GET {path}")


def make_client(http, *, job_timeout=30):
    client = SplunkClient({
        "splunk_host": "splunk.example.com",
        "splunk_port": 8089,
        "job_timeout": job_timeout,
    })
    client._client = http
    return client


@pytest.mark.asyncio
async def test_search_job_dispatches_polls_and_fetches_v2_pages(monkeypatch):
    async def no_sleep(_delay):
        return None

    monkeypatch.setattr("unified_mcp_server.splunk.splunk_client.asyncio.sleep", no_sleep)
    http = JobHTTP(
        statuses=[
            job_status("RUNNING"),
            job_status("DONE", resultCount="5", scanCount="42", runDuration="1.25"),
        ],
        pages={
            0: {
                "init_offset": 0,
                "total": 5,
                "fields": [{"name": "n"}],
                "results": [{"n": 1}, {"n": 2}],
            },
            2: {
                "init_offset": 2,
                "total": 5,
                "fields": ["n", "late"],
                "results": [{"n": 3, "late": "yes"}, {"n": 4}],
            },
            4: {"init_offset": 4, "total": 5, "results": [{"n": 5}]},
        },
    )

    result = await make_client(http).run_search_job(
        "index=main", earliest_time="-1h", latest_time="now", max_count=5
    )

    assert result["events"] == [
        {"n": 1},
        {"n": 2},
        {"n": 3, "late": "yes"},
        {"n": 4},
        {"n": 5},
    ]
    assert result["columns"] == ["n", "late"]
    assert result["metadata"] == {
        "total_result_count": 5,
        "fetched_count": 5,
        "returned_count": 5,
        "scan_count": 42,
        "run_duration": 1.25,
        "splunk_result_truncated": False,
    }
    assert http.post_calls[0] == (
        "/services/search/jobs",
        {
            "search": "search index=main",
            "earliest_time": "-1h",
            "latest_time": "now",
            "exec_mode": "normal",
            "search_mode": "normal",
            "max_count": 5,
            "output_mode": "json",
        },
        None,
    )
    assert [path for path, _params in http.get_calls[:2]] == [
        "/services/search/jobs/job%2F1",
        "/services/search/jobs/job%2F1",
    ]
    assert [params["offset"] for path, params in http.get_calls[2:]] == [0, 2, 4]
    assert [params["count"] for path, params in http.get_calls[2:]] == [5, 3, 1]
    assert all("oneshot" not in path for path, _data, _params in http.post_calls)


@pytest.mark.asyncio
async def test_search_job_reports_splunk_truncation_when_ceiling_is_reached(monkeypatch):
    async def no_sleep(_delay):
        return None

    monkeypatch.setattr("unified_mcp_server.splunk.splunk_client.asyncio.sleep", no_sleep)
    http = JobHTTP(
        statuses=[job_status("DONE", resultCount="5")],
        pages={
            0: {"results": [{"n": 1}, {"n": 2}], "total": 5},
            2: {"results": [{"n": 3}], "total": 5},
        },
    )

    result = await make_client(http).run_search_job("index=main", max_count=3)

    assert result["metadata"]["total_result_count"] == 5
    assert result["metadata"]["fetched_count"] == 3
    assert result["metadata"]["splunk_result_truncated"] is True
    assert [params["offset"] for _path, params in http.get_calls[1:]] == [0, 2]


@pytest.mark.asyncio
async def test_search_job_keeps_truncation_unknown_without_splunk_counts(monkeypatch):
    async def no_sleep(_delay):
        return None

    monkeypatch.setattr("unified_mcp_server.splunk.splunk_client.asyncio.sleep", no_sleep)
    http = JobHTTP(
        statuses=[job_status("DONE")],
        pages={0: {"results": [{"n": 1}]}},
    )

    result = await make_client(http).run_search_job("index=main", max_count=3)

    assert result["events"] == [{"n": 1}]
    assert result["metadata"]["total_result_count"] is None
    assert result["metadata"]["splunk_result_truncated"] is None


@pytest.mark.asyncio
async def test_saved_search_reuses_job_lifecycle_with_actions_disabled(monkeypatch):
    async def no_sleep(_delay):
        return None

    monkeypatch.setattr("unified_mcp_server.splunk.splunk_client.asyncio.sleep", no_sleep)
    dispatch_path = "/servicesNS/nobody/security/saved/searches/Daily%20alerts/dispatch"

    class SavedJobHTTP(JobHTTP):
        async def post(self, path, data, params=None):
            self.post_calls.append((path, data, params))
            if path == dispatch_path:
                return http_response({"sid": "job/1"})
            if path.endswith("/control"):
                return http_response({"messages": []})
            raise AssertionError(f"unexpected POST {path}")

        async def get(self, path, params):
            self.get_calls.append((path, params))
            if path == "/services/search/jobs/job%2F1":
                return http_response(job_status("DONE", resultCount="1"))
            if path == "/services/search/jobs/job%2F1/results":
                return http_response({"results": [{"rule": "allow"}]})
            raise AssertionError(f"unexpected GET {path}")

    http = SavedJobHTTP()
    result = await make_client(http).run_saved_search(
        "Daily alerts", trigger_actions=False, max_count=2,
        app="security", owner="nobody",
    )

    assert result["job_id"] == "job/1"
    assert result["events"] == [{"rule": "allow"}]
    assert http.post_calls[0] == (
        dispatch_path,
        {"trigger_actions": "0", "output_mode": "json"},
        None,
    )
    assert http.get_calls[-1] == (
        "/services/search/jobs/job%2F1/results",
        {"output_mode": "json", "count": 2, "offset": 0},
    )


@pytest.mark.asyncio
async def test_search_job_timeout_cancels_remote_job():
    http = JobHTTP(statuses=[job_status("RUNNING")])

    with pytest.raises(SplunkAPIError, match="timed out"):
        await make_client(http, job_timeout=0).run_search_job("index=main")

    assert http.post_calls[-1] == (
        "/services/search/jobs/job%2F1/control",
        {"action": "cancel"},
        {"output_mode": "json"},
    )


@pytest.mark.asyncio
async def test_search_job_resource_runtime_limit_cancels_remote_job(monkeypatch):
    async def no_sleep(_delay):
        return None

    monkeypatch.setattr("unified_mcp_server.splunk.splunk_client.asyncio.sleep", no_sleep)
    http = JobHTTP(statuses=[job_status("RUNNING")])

    with pytest.raises(SplunkAPIError) as error:
        await make_client(http, job_timeout=30).run_search_job(
            "index=main", runtime_limit=0.01
        )

    assert error.value.error_code == "runtime_limit_exceeded"
    assert http.post_calls[-1][0] == "/services/search/jobs/job%2F1/control"


@pytest.mark.asyncio
async def test_search_job_task_cancellation_cancels_remote_job():
    started = asyncio.Event()

    class BlockingHTTP(JobHTTP):
        async def get(self, path, params):
            self.get_calls.append((path, params))
            started.set()
            await asyncio.Event().wait()

    http = BlockingHTTP()
    task = asyncio.create_task(make_client(http).run_search_job("index=main"))
    await started.wait()
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task

    assert http.post_calls[-1][0] == "/services/search/jobs/job%2F1/control"


@pytest.mark.asyncio
@pytest.mark.parametrize("state", ["FAILED", "PAUSED", "USER_CANCEL", "UNKNOWN"])
async def test_search_job_rejects_non_successful_or_unknown_states(state):
    http = JobHTTP(statuses=[job_status(state)])

    with pytest.raises(SplunkAPIError):
        await make_client(http).run_search_job("index=main")

    assert http.post_calls[-1][0] == "/services/search/jobs/job%2F1/control"


@pytest.mark.asyncio
async def test_search_job_rejects_malformed_status_payload():
    http = JobHTTP(statuses=[{}])

    with pytest.raises(SplunkAPIError, match="malformed"):
        await make_client(http).run_search_job("index=main")

    assert http.post_calls[-1][0] == "/services/search/jobs/job%2F1/control"


@pytest.mark.asyncio
async def test_search_job_rejects_missing_sid_and_dispatch_errors():
    missing_sid = JobHTTP(dispatch_payload={})
    with pytest.raises(SplunkAPIError, match="no SID"):
        await make_client(missing_sid).run_search_job("index=main")
    assert len(missing_sid.post_calls) == 1

    message_error = JobHTTP(
        dispatch_payload={"messages": [{"type": "ERROR", "text": "bad SPL"}]}
    )
    with pytest.raises(SplunkAPIError, match="bad SPL"):
        await make_client(message_error).run_search_job("index=main")


@pytest.mark.asyncio
async def test_search_job_rejects_http_and_malformed_result_failures():
    dispatch_http_error = JobHTTP(dispatch_status=500)
    with pytest.raises(SplunkAPIError) as dispatch_error:
        await make_client(dispatch_http_error).run_search_job("index=main")
    assert dispatch_error.value.status_code == 500

    malformed = JobHTTP(
        statuses=[job_status("DONE")],
        pages={0: {"results": ["not-an-object"]}},
    )
    with pytest.raises(SplunkAPIError, match="malformed"):
        await make_client(malformed).run_search_job("index=main")

    result_http_error = JobHTTP(
        statuses=[job_status("DONE")],
        result_statuses={0: 502},
    )
    with pytest.raises(SplunkAPIError) as result_error:
        await make_client(result_http_error).run_search_job("index=main")
    assert result_error.value.status_code == 502


@pytest.mark.parametrize(
    "payload",
    [
        "{broken",
        json.dumps({"messages": [{"type": "ERROR", "text": "failed"}]}),
        json.dumps({"results": ["not-an-object"]}),
        json.dumps({"results": [], "fields": [{"name": ""}]}),
    ],
)
def test_search_job_result_parser_rejects_malformed_payloads(payload):
    with pytest.raises(SplunkAPIError):
        SplunkClient._parse_result_page(payload, "search job")


def test_job_metadata_rejects_non_integral_and_non_finite_numbers():
    assert SplunkClient._optional_int(4.5) is None
    assert SplunkClient._optional_int("4.5") is None
    assert SplunkClient._optional_int("4") == 4
    assert SplunkClient._optional_float(float("inf")) is None
    assert SplunkClient._optional_float("4.2") == 4.2
