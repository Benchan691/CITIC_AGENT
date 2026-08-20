import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.core.service import SplunkCore
from unified_mcp_server.splunk.search.service import SplunkSearchService
from unified_mcp_server.splunk.splunk_client import SplunkClient


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

    async def get_lookup_table_files(self, *, app="", search=""):
        self.lookup_args.append((app, search))
        return LOOKUPS

    async def search_oneshot(self, *args):
        self.search_args = args
        return [{"rule": "allow"}]


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
    assert FakeLookupClient.instances[-1].lookup_args[-1] == ("", 'name="Ruleset.csv"')
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
        {"output_mode": "json", "search": 'name="Ruleset.csv"'},
    )


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
