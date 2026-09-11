import pytest

from unified_mcp_server.config import SplunkSettings
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
