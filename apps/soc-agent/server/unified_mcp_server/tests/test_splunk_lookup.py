import pytest
import httpx

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.core.service import SplunkCore
from unified_mcp_server.splunk.search.service import SplunkSearchService
from unified_mcp_server.splunk.splunk_client import SplunkAPIError, SplunkClient
from unified_mcp_server.splunk.search.lookup import (
    canonical_csv_text,
    parse_csv_text,
)


def settings(**overrides):
    values = {
        "host": "splunk.example.com",
        "port": 8089,
        "username": "",
        "password": "",
        "token": "token",
        "verify_ssl": True,
        "request_timeout": 30,
        "job_timeout": 120,
        "max_events": 100,
        "risk_tolerance": 75,
        "safe_timerange": "24h",
        "sanitize_output": True,
    }
    values.update(overrides)
    return SplunkSettings(**values)


LOOKUPS = [
    {
        "name": "Ruleset.csv",
        "acl": {
            "app": "search",
            "owner": "nobody",
            "sharing": "app",
            "perms": {"read": ["*"], "write": []},
        },
    },
    {"name": "Other.csv", "acl": {"app": "search", "owner": "alice", "sharing": "global"}},
    {"name": "NoAcl.csv"},
]


class FakeLookupClient:
    instances = []

    def __init__(self, config):
        self.lookup_args = []
        self.__class__.instances.append(self)

    async def connect(self):
        pass

    async def disconnect(self):
        pass

    async def get_lookup_table_files(self, *, app="", search="", count=50):
        self.lookup_args.append((app, search, count))
        return LOOKUPS

    async def run_search_job(self, *args, **kwargs):
        self.search_args = args
        return {
            "events": [{"rule": "allow"}],
            "metadata": {
                "total_result_count": 1,
                "fetched_count": 1,
                "splunk_result_truncated": False,
            },
        }


@pytest.mark.asyncio
async def test_find_lookup_normalizes_metadata_and_acl():
    core = SplunkCore(settings(), FakeLookupClient)
    service = SplunkSearchService(core)

    result = await service.find_lookup("Ruleset.csv")

    assert result == {
        "lookup": {
            "name": "Ruleset.csv",
            "app": "search",
            "owner": "nobody",
            "sharing": "app",
            "acl": LOOKUPS[0]["acl"],
        }
    }
    assert FakeLookupClient.instances[-1].lookup_args[-1] == ("", 'name="Ruleset.csv"', 20)
    await core.close()


@pytest.mark.asyncio
async def test_find_lookup_reports_not_found():
    core = SplunkCore(settings(), FakeLookupClient)
    service = SplunkSearchService(core)

    with pytest.raises(ServiceError) as error:
        await service.find_lookup("Missing.csv")

    assert error.value.code == "not_found"
    await core.close()


@pytest.mark.asyncio
async def test_list_lookups_filters_app_and_name_and_tolerates_missing_acl():
    core = SplunkCore(settings(), FakeLookupClient)
    service = SplunkSearchService(core)

    result = await service.list_lookups(app="search", name="rules")
    all_result = await service.list_lookups()

    assert [lookup["name"] for lookup in result["lookups"]] == ["Ruleset.csv"]
    assert all_result["count"] == 3
    assert all_result["lookups"][2]["acl"] == {}
    assert all_result["lookups"][2]["app"] == ""
    await core.close()


@pytest.mark.asyncio
async def test_lookup_client_uses_read_only_rest_endpoint_and_filters():
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"entry": LOOKUPS}

    class HttpClient:
        def __init__(self):
            self.call = None

        async def get(self, path, params):
            self.call = (path, params)
            return Response()

    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})
    client._client = HttpClient()

    result = await client.get_lookup_table_files(app="search", search='name="Ruleset.csv"')

    assert result == LOOKUPS[:2]
    assert client._client.call == (
        "/services/data/lookup-table-files",
        {"output_mode": "json", "count": 50, "search": 'name="Ruleset.csv"'},
    )


@pytest.mark.asyncio
async def test_lookup_client_uses_read_only_content_endpoint():
    class Response:
        def __init__(self, payload=None):
            self.payload = payload or {"ok": True}

        def raise_for_status(self):
            pass

        def json(self):
            return self.payload

    class HttpClient:
        def __init__(self):
            self.call = None

        async def get(self, path, params):
            self.call = (path, params)
            return Response([["id"], ["1"]])

    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})
    client._client = HttpClient()

    assert await client.get_lookup_contents("Ruleset.csv", "search", "nobody") == [["id"], ["1"]]
    assert client._client.call == (
        "/services/data/lookup_edit/lookup_contents",
        {
            "output_mode": "json",
            "lookup_file": "Ruleset.csv",
            "namespace": "search",
            "lookup_type": "csv",
            "owner": "nobody",
        },
    )
    assert not hasattr(client, "create_lookup_contents")
    assert not hasattr(client, "update_lookup_contents")
    assert not hasattr(client, "delete_lookup_table_file")


@pytest.mark.asyncio
async def test_index_connection_failure_has_actionable_message():
    class HttpClient:
        async def get(self, _path, params=None):
            raise httpx.ConnectError("All connection attempts failed")

    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})
    client._client = HttpClient()

    with pytest.raises(SplunkAPIError, match="Could not reach Splunk at the configured URL"):
        await client.get_indexes()


@pytest.mark.asyncio
async def test_saved_search_client_uses_read_only_name_filter():
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"entry": [
                {
                    "name": "0723 Suspicious Login",
                    "content": {
                        "search": "index=main error",
                        "disabled": "0",
                        "is_scheduled": "1",
                        "cron_schedule": "*/5 * * * *",
                        "next_scheduled_time": "1700000300",
                    },
                    "acl": {"app": "search", "owner": "nobody"},
                },
            ]}

    class HttpClient:
        def __init__(self):
            self.call = None

        async def get(self, path, params):
            self.call = (path, params)
            return Response()

    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})
    client._client = HttpClient()

    result = await client.get_saved_searches(name="0723", app="search")

    assert result[0]["name"] == "0723 Suspicious Login"
    assert result[0]["app"] == "search"
    assert result[0]["owner"] == "nobody"
    assert not {"is_scheduled", "cron_schedule", "next_scheduled_time"} & result[0].keys()
    assert client._client.call == (
        "/services/saved/searches",
        {"output_mode": "json", "count": 50, "search": 'name="*0723*" AND app="search"'},
    )

    await client.get_saved_searches(app="search")
    assert client._client.call == (
        "/services/saved/searches",
        {"output_mode": "json", "count": 50, "search": 'app="search"'},
    )


@pytest.mark.asyncio
async def test_saved_search_details_omit_schedule_metadata():
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"entry": [{
                "name": "Realtime fixture",
                "content": {
                    "search": "index=main error",
                    "is_scheduled": "1",
                    "cron_schedule": "*/5 * * * *",
                    "next_scheduled_time": "1700000300",
                    "dispatch.earliest_time": "rt-5m",
                    "dispatch.latest_time": "rt",
                    "dispatch.indexedRealtime": "1",
                },
                "acl": {"app": "search", "owner": "nobody"},
            }]}

    class HttpClient:
        async def get(self, _path, params=None):
            return Response()

    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})
    client._client = HttpClient()

    result = await client.get_saved_search("Realtime fixture", "search", "nobody")

    assert result["content"] == {"search": "index=main error"}


def test_inputlookup_is_readable_and_outputlookup_is_blocked():
    core = SplunkCore(settings(risk_tolerance=100), FakeLookupClient)

    input_validation = core.validate_query("| inputlookup Ruleset.csv | head 100")
    output_validation = core.validate_query("| outputlookup Ruleset.csv")
    output_validation_without_pipe = core.validate_query("outputlookup Ruleset.csv")

    assert input_validation["would_execute"] is True
    assert output_validation["risk_score"] == 100
    assert output_validation["would_execute"] is False
    assert output_validation_without_pipe["risk_score"] == 100
    assert output_validation_without_pipe["would_execute"] is False


def test_csv_editor_validation_canonicalizes_and_rejects_unsafe_shapes():
    canonical, rows = canonical_csv_text("id,name\r\n1,alice\r\n")
    assert canonical == "id,name\n1,alice\n"
    assert rows == [["id", "name"], ["1", "alice"]]
    assert parse_csv_text("id\n-1\n") == [["id"], ["-1"]]

    for content in ("id\n=cmd\n", "id,name\n1\n", "id,ID\n1,2\n", "\n"):
        with pytest.raises(ValueError):
            parse_csv_text(content)


@pytest.mark.asyncio
async def test_saved_search_stops_polling_on_failed_job_state():
    class Response:
        text = "{}"

        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            pass

        def json(self):
            return self.payload

    class HttpClient:
        async def post(self, path, data, params=None):
            return Response({"sid": "job-1"})

        async def get(self, path, params):
            return Response({"entry": [{"content": {"dispatchState": "FAILED"}}]})

    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})
    client._client = HttpClient()

    with pytest.raises(Exception, match="terminal state FAILED"):
        await client.run_saved_search("Failed search")


@pytest.mark.asyncio
@pytest.mark.asyncio
async def test_saved_search_timeout_cancels_the_remote_job(monkeypatch):
    class Response:
        text = "{}"

        def __init__(self, payload=None):
            self.payload = payload or {}

        def raise_for_status(self):
            pass

        def json(self):
            return self.payload

    class HttpClient:
        def __init__(self):
            self.posts = []

        async def post(self, path, data, params=None):
            self.posts.append((path, data, params))
            return Response({"sid": "job-2"})

        async def get(self, path, params):
            return Response({"entry": [{"content": {"dispatchState": "RUNNING"}}]})

    client = SplunkClient({
        "splunk_host": "splunk.example.com", "splunk_port": 8089, "job_timeout": 5,
    })
    client._client = HttpClient()

    # The job budget bounds the dispatch too; force the timeout inside the
    # poll phase so the SID exists and the finally block cancels the job.
    async def timed_out_poll(*_args, **_kwargs):
        raise client._deadline_error("saved search")

    monkeypatch.setattr(client, "_poll_job", timed_out_poll)

    with pytest.raises(Exception, match="timed out"):
        await client.run_saved_search("Slow search")

    assert client._client.posts[-1] == (
        "/services/search/jobs/job-2/control",
        {"action": "cancel"},
        {"output_mode": "json"},
    )


@pytest.mark.parametrize(
    "payload",
    ["{broken", '{"messages":[{"type":"ERROR","text":"failed"}]}', '{"results":["not-an-object"]}'],
)
def test_splunk_result_parser_rejects_malformed_or_message_only_payloads(payload):
    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})

    with pytest.raises(SplunkAPIError):
        client._parse_response(payload)
