import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.splunk.core.service import SplunkCore, _default_client_factory
from unified_mcp_server.splunk.official_mcp_client import OfficialSplunkMCPClient
from unified_mcp_server.splunk.search.executor import SearchExecutor
from unified_mcp_server.splunk.splunk_client import SplunkAPIError, SplunkClient


def client() -> OfficialSplunkMCPClient:
    return OfficialSplunkMCPClient(
        {
            "splunk_mcp_endpoint": "http://splunk.example:8000/services/mcp",
            "splunk_token": "token",
            "allow_insecure_http": True,
            "request_timeout": 5,
            "job_timeout": 30,
            "splunk_lookup_app": "search",
            "splunk_lookup_owner": "nobody",
        }
    )


def test_default_factory_selects_official_client_only_when_endpoint_is_set():
    assert isinstance(
        _default_client_factory({"splunk_mcp_endpoint": "https://splunk.example/mcp"}),
        OfficialSplunkMCPClient,
    )
    assert isinstance(
        _default_client_factory({"splunk_host": "splunk.example", "splunk_port": 8089}),
        SplunkClient,
    )


def test_splunk_clients_expose_no_mutation_methods():
    for client_type in (OfficialSplunkMCPClient, SplunkClient):
        for name in (
            "create_lookup_contents",
            "update_lookup_contents",
            "delete_lookup_table_file",
            "create_saved_search",
            "update_saved_search",
        ):
            assert not hasattr(client_type, name)


@pytest.mark.asyncio
async def test_official_path_bypasses_local_query_and_resource_admission():
    class Provider:
        def __init__(self, _config):
            self.called = False

        async def connect(self):
            pass

        async def disconnect(self):
            pass

        async def run_search_job(self, *args, **kwargs):
            self.called = True
            return {
                "events": [{"ok": True}],
                "columns": ["ok"],
                "metadata": {"total_result_count": 1, "splunk_result_truncated": False},
            }

    settings = SplunkSettings(
        host="splunk.example",
        port=8089,
        username="",
        password="",
        token="token",
        verify_ssl=True,
        request_timeout=5,
        job_timeout=30,
        max_events=1000,
        risk_tolerance=0,
        safe_timerange="24h",
        sanitize_output=True,
        mcp_endpoint="https://splunk.example/mcp",
    )
    core = SplunkCore(settings, Provider)
    result = await SearchExecutor(core).execute(
        "index=* | outputlookup should_be_rejected_by_provider.csv",
        earliest_time="0",
        latest_time="now",
        limit=10_000,
    )

    assert result["validation"]["decision"] == "allow"
    assert result["validation"]["policy"]["local_enforcement"] is False
    assert result["limit"] == 1_000
    assert core._client.called is True
    await core.close()


@pytest.mark.asyncio
async def test_official_query_normalizes_rows_and_explicit_truncation(monkeypatch):
    adapter = client()

    async def call(name, arguments):
        assert name == "splunk_run_query"
        assert arguments["row_limit"] == 2
        return {
            "results": [{"host": "a"}, {"host": "b"}],
            "truncated": True,
            "total_rows": 4,
        }

    monkeypatch.setattr(adapter, "_call", call)
    result = await adapter.run_search_job("index=main", max_count=2)

    assert result["events"] == [{"host": "a"}, {"host": "b"}]
    assert result["columns"] == ["host"]
    assert result["metadata"]["total_result_count"] == 4
    assert result["metadata"]["splunk_result_truncated"] is True


@pytest.mark.asyncio
async def test_official_index_pagination_advances_from_page_info(monkeypatch):
    adapter = client()
    calls = []

    async def call(name, arguments):
        calls.append((name, arguments))
        if arguments["offset"] == 0:
            return {
                "results": [{"name": "one"}, {"name": "two"}],
                "truncated": True,
                "total_rows": 3,
                "page_info": {"offset": 0, "perPage": 2},
            }
        return {
            "results": [{"name": "three"}],
            "truncated": False,
            "total_rows": 3,
            "page_info": {"offset": 2, "perPage": 2},
        }

    monkeypatch.setattr(adapter, "_call", call)
    assert await adapter.get_indexes() == [
        {"name": "one"},
        {"name": "two"},
        {"name": "three"},
    ]
    assert [arguments["offset"] for _name, arguments in calls] == [0, 2]


@pytest.mark.asyncio
async def test_lookup_catalog_fetches_full_page_for_exact_ruleset_lookup(monkeypatch):
    adapter = client()
    captured = {}

    async def call(name, arguments):
        captured.update(arguments)
        return {
            "results": [
                {"name": "Other.csv", "app": "search"},
                {"name": "Ruleset.csv", "app": "eai:appName"},
            ],
            "truncated": False,
        }

    monkeypatch.setattr(adapter, "_call", call)
    assert await adapter.get_lookup_table_files(
        app="search", search='name="Ruleset.csv"', count=20
    ) == [
        {
            "name": "Ruleset.csv",
            "acl": {"app": "search", "owner": "nobody"},
            "content": {"app": "search", "owner": "nobody"},
        }
    ]
    assert captured["row_limit"] == 1000


@pytest.mark.asyncio
async def test_lookup_content_uses_bounded_rest_fallback_only_when_mcp_truncates(monkeypatch):
    adapter = client()

    async def call(_name, _arguments):
        return {"results": [{"rule": "one"}], "truncated": True}

    class Rest:
        async def get_lookup_contents(self, name, app, owner):
            assert (name, app, owner) == ("Ruleset.csv", "search", "nobody")
            return [["rule"], ["one"]]

    async def rest():
        return Rest()

    monkeypatch.setattr(adapter, "_call", call)
    monkeypatch.setattr(adapter, "_rest", rest)
    assert await adapter.get_lookup_contents("Ruleset.csv", "search", "nobody") == [["rule"], ["one"]]


@pytest.mark.asyncio
async def test_detection_reads_use_official_alert_details_and_keep_trigger_fields(monkeypatch):
    adapter = client()
    calls = []

    async def call(name, arguments):
        calls.append(name)
        assert arguments == {"alert_name": "rule-1", "app": "search"}
        return {
            "results": [
                {
                    "name": "rule-1",
                    "app": "search",
                    "owner": "admin",
                    "search": "index=main",
                    "alert_type": "number of events",
                    "alert_threshold": "2",
                    "is_scheduled": True,
                    "cron_schedule": "*/5 * * * *",
                    "next_scheduled_time": "1700000300",
                    "dispatch.rt_backfill": True,
                }
            ],
            "truncated": False,
        }

    monkeypatch.setattr(adapter, "_call", call)
    result = await adapter.get_saved_search("rule-1", "search", "nobody")

    assert result["content"]["alert_threshold"] == "2"
    assert not {
        "is_scheduled", "cron_schedule", "next_scheduled_time", "dispatch.rt_backfill",
    } & result["content"].keys()
    assert calls == ["splunk_get_alert_details"]


@pytest.mark.asyncio
async def test_saved_search_execution_passes_service_time_bounds(monkeypatch):
    adapter = client()
    captured = {}

    async def call(name, arguments):
        captured.update({"name": name, **arguments})
        return {"results": [{"event": "ok"}], "truncated": False, "total_rows": 1}

    monkeypatch.setattr(adapter, "_call", call)
    result = await adapter.run_saved_search(
        "rule-1",
        max_count=5,
        app="search",
        earliest_time="-1h",
        latest_time="now",
    )

    assert captured == {
        "name": "splunk_run_saved_search",
        "saved_search_name": "rule-1",
        "app": "search",
        "row_limit": 5,
        "earliest_time": "-1h",
        "latest_time": "now",
    }
    assert result["events"] == [{"event": "ok"}]


@pytest.mark.asyncio
async def test_official_tool_rejection_never_falls_back_to_rest(monkeypatch):
    adapter = client()

    async def call(_name, _arguments):
        raise SplunkAPIError("The official Splunk MCP server rejected splunk_run_query.")

    async def rest():
        raise AssertionError("rejected official calls must not use REST fallback")

    monkeypatch.setattr(adapter, "_call", call)
    monkeypatch.setattr(adapter, "_rest", rest)
    with pytest.raises(SplunkAPIError):
        await adapter.run_search_job("index=main")


def test_official_transport_errors_are_secret_free():
    error = OfficialSplunkMCPClient._transport_error(
        RuntimeError("403 Invalid token audience: test-secret"),
        "call the server",
    )
    assert isinstance(error, SplunkAPIError)
    assert "test-secret" not in str(error)
    assert error.status_code == 401
