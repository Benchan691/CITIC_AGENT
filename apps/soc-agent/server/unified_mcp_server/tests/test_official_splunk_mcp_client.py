import pytest

from unified_mcp_server.splunk.official_mcp_client import OfficialSplunkMCPClient
from unified_mcp_server.splunk.errors import SplunkAPIError


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
async def test_saved_search_catalog_cap_is_explicitly_incomplete(monkeypatch):
    adapter = client()

    async def call(name, arguments):
        assert name == "splunk_get_knowledge_objects"
        return {
            "results": [{"name": "one", "search": "index=main"}],
            "truncated": True,
            "total_rows": 2,
            "page_info": {"offset": 0, "perPage": 1},
        }

    monkeypatch.setattr(adapter, "_call", call)
    assert [item["name"] for item in await adapter.get_saved_searches(count=1)] == ["one"]
    assert adapter.last_saved_search_catalog_complete is False
    assert "cap" in adapter.last_saved_search_catalog_error


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
async def test_lookup_content_rejects_mcp_truncation_without_fallback(monkeypatch):
    adapter = client()

    async def call(_name, _arguments):
        return {"results": [{"rule": "one"}], "truncated": True}

    monkeypatch.setattr(adapter, "_call", call)
    with pytest.raises(SplunkAPIError, match="exceeds the official Splunk MCP result limit"):
        await adapter.get_lookup_contents("Ruleset.csv", "search", "nobody")


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
                }
            ],
            "truncated": False,
        }

    monkeypatch.setattr(adapter, "_call", call)
    result = await adapter.get_saved_search("rule-1", "search", "nobody")

    assert result["content"]["alert_threshold"] == "2"
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
async def test_official_tool_rejection_is_propagated(monkeypatch):
    adapter = client()

    async def call(_name, _arguments):
        raise SplunkAPIError("The official Splunk MCP server rejected splunk_run_query.")

    monkeypatch.setattr(adapter, "_call", call)
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
