import json

import pytest
import httpx

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.core.service import SplunkCore
from unified_mcp_server.splunk.search.service import SplunkSearchService
from unified_mcp_server.splunk.splunk_client import SplunkAPIError, SplunkClient
from unified_mcp_server.splunk.search.lookup import (
    canonical_csv_text,
    lookup_fingerprint,
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
async def test_lookup_client_uses_content_editor_for_create_update_and_delete():
    class Response:
        def __init__(self, payload=None):
            self.payload = payload or {"ok": True}

        def raise_for_status(self):
            pass

        def json(self):
            return self.payload

    class HttpClient:
        def __init__(self):
            self.calls = []

        async def get(self, path, params):
            self.calls.append(("get", path, params))
            return Response([["id"], ["1"]])

        async def post(self, path, data, params=None):
            self.calls.append(("post", path, data, params))
            return Response()

        async def delete(self, path, params=None):
            self.calls.append(("delete", path, params))
            return Response()

    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})
    client._client = HttpClient()

    assert await client.get_lookup_contents("Ruleset.csv", "search", "nobody") == [["id"], ["1"]]
    await client.create_lookup_contents("Ruleset.csv", "search", "nobody", [["id"], ["1"]])
    await client.update_lookup_contents("Ruleset.csv", "search", "nobody", [["id"], ["2"]])
    await client.delete_lookup_table_file("Ruleset.csv", "search", "nobody")

    assert client._client.calls[0] == (
        "get",
        "/services/data/lookup_edit/lookup_contents",
        {
            "output_mode": "json",
            "lookup_file": "Ruleset.csv",
            "namespace": "search",
            "lookup_type": "csv",
            "owner": "nobody",
        },
    )
    for call in client._client.calls[1:3]:
        assert call[0:2] == ("post", "/services/data/lookup_edit/lookup_contents")
        assert json.loads(call[2]["contents"]) == [["id"], ["1"]] or json.loads(call[2]["contents"]) == [["id"], ["2"]]
    assert client._client.calls[3] == (
        "delete",
        "/servicesNS/nobody/search/data/lookup-table-files/Ruleset.csv",
        {"output_mode": "json"},
    )


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
                    "content": {"search": "index=main error", "disabled": "0"},
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
    assert client._client.call == (
        "/services/saved/searches",
        {"output_mode": "json", "count": 50, "search": 'name="*0723*" AND app="search"'},
    )

    await client.get_saved_searches(app="search")
    assert client._client.call == (
        "/services/saved/searches",
        {"output_mode": "json", "count": 50, "search": 'app="search"'},
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


def test_csv_editor_validation_canonicalizes_and_rejects_unsafe_shapes():
    canonical, rows = canonical_csv_text("id,name\r\n1,alice\r\n")
    assert canonical == "id,name\n1,alice\n"
    assert rows == [["id", "name"], ["1", "alice"]]
    assert parse_csv_text("id\n-1\n") == [["id"], ["-1"]]

    for content in ("id\n=cmd\n", "id,name\n1\n", "id,ID\n1,2\n", "\n"):
        with pytest.raises(ValueError):
            parse_csv_text(content)


class MutableLookupClient:
    instances = []

    def __init__(self, _config):
        self.files = {
            "rules.csv": "id,name\n1,one\n",
        }
        self.writes = []
        self.__class__.instances.append(self)

    async def connect(self):
        pass

    async def disconnect(self):
        pass

    async def get_lookup_table_files(self, *, app="", search="", count=50):
        del count
        requested = search.removeprefix('name="').removesuffix('"') if search else ""
        names = [requested] if requested else list(self.files)
        return [
            {
                "name": name,
                "acl": {"app": app or "search", "owner": "nobody", "sharing": "app"},
            }
            for name in names
            if name in self.files
        ]

    async def get_lookup_contents(self, name, app="", owner=""):
        del app, owner
        if name not in self.files:
            raise SplunkAPIError("missing lookup", status_code=404)
        return {"contents": json.loads(json.dumps([row.split(",") for row in self.files[name].splitlines()]))}

    async def create_lookup_contents(self, name, app, owner, rows):
        del app, owner
        if name in self.files:
            raise SplunkAPIError("already exists", status_code=409)
        content, _rows = canonical_csv_text("\n".join(",".join(row) for row in rows) + "\n")
        self.files[name] = content
        self.writes.append(("create", name))
        return {"ok": True}

    async def update_lookup_contents(self, name, app, owner, rows):
        del app, owner
        content, _rows = canonical_csv_text("\n".join(",".join(row) for row in rows) + "\n")
        self.files[name] = content
        self.writes.append(("update", name))
        return {"ok": True}

    async def delete_lookup_table_file(self, name, app, owner):
        del app, owner
        self.files.pop(name, None)
        self.writes.append(("delete", name))
        return {"ok": True}


@pytest.mark.asyncio
async def test_lookup_crud_uses_drafts_fingerprints_and_authenticated_save():
    core = SplunkCore(settings(lookup_write_enabled=True), MutableLookupClient)
    service = SplunkSearchService(core)
    client = core._client
    assert client is None

    current = await service.get_lookup("rules.csv")
    assert current["content"] == "id,name\n1,one\n"
    assert current["summary"]["row_count"] == 1
    assert current["fingerprint"] == lookup_fingerprint("rules.csv", "search", "nobody", current["content"])

    create_draft = await service.write_lookup("new.csv", "id,name\n2,two\n")
    assert create_draft["status"] == "draft"
    assert create_draft["operation"] == "write"
    assert create_draft["draft"]["content"] == "id,name\n2,two\n"
    assert core._client.files == {"rules.csv": "id,name\n1,one\n"}

    with pytest.raises(ServiceError) as missing_actor:
        await service.save_lookup("write", "new.csv", content="id\n2\n")
    assert missing_actor.value.code == "not_authorized"

    saved = await service.save_lookup(
        "write", "new.csv", content="id,name\n2,two\n", actor_id="analyst-a"
    )
    assert saved["created"] is True
    assert saved["content"] == "id,name\n2,two\n"

    fresh = await service.get_lookup("new.csv")
    update_draft = await service.update_lookup(
        "new.csv", "id,name\n3,three\n", fresh["fingerprint"], actor_id="analyst-a"
    )
    assert update_draft["expected_fingerprint"] == fresh["fingerprint"]
    assert update_draft["draft"]["fingerprint"] == fresh["fingerprint"]
    before_writes = list(core._client.writes)
    with pytest.raises(ServiceError) as invalid:
        await service.save_lookup(
            "update", "new.csv", content="id\n=bad\n",
            expected_fingerprint=fresh["fingerprint"], actor_id="analyst-a",
        )
    assert invalid.value.code == "lookup_invalid"
    assert core._client.writes == before_writes

    core._client.files["new.csv"] = "id,name\n9,changed\n"
    with pytest.raises(ServiceError) as stale:
        await service.save_lookup(
            "update", "new.csv", content="id,name\n3,three\n",
            expected_fingerprint=fresh["fingerprint"], actor_id="analyst-a",
        )
    assert stale.value.code == "lookup_changed"
    assert core._client.writes == before_writes

    changed = await service.get_lookup("new.csv")
    updated = await service.save_lookup(
        "update", "new.csv", content="id,name\n3,three\n",
        expected_fingerprint=changed["fingerprint"], actor_id="analyst-a",
    )
    assert updated["updated"] is True
    delete_state = await service.get_lookup("new.csv")
    delete_draft = await service.delete_lookup("new.csv", delete_state["fingerprint"], actor_id="analyst-a")
    assert delete_draft["operation"] == "delete"
    deleted = await service.save_lookup(
        "delete", "new.csv", expected_fingerprint=delete_state["fingerprint"], actor_id="analyst-a"
    )
    assert deleted["deleted"] is True
    assert "new.csv" not in core._client.files
    await core.close()


@pytest.mark.asyncio
async def test_lookup_save_gate_and_target_checks_fail_before_writes():
    disabled_core = SplunkCore(settings(), MutableLookupClient)
    disabled = SplunkSearchService(disabled_core)
    with pytest.raises(ServiceError) as error:
        await disabled.save_lookup("write", "rules.csv", content="id\n1\n", actor_id="analyst")
    assert error.value.code == "operation_disabled"
    await disabled_core.close()

    core = SplunkCore(settings(lookup_write_enabled=True), MutableLookupClient)
    service = SplunkSearchService(core)
    with pytest.raises(ServiceError) as exists:
        await service.save_lookup("write", "rules.csv", content="id\n1\n", actor_id="analyst")
    assert exists.value.code == "target_exists"
    with pytest.raises(ServiceError) as absent:
        await service.save_lookup(
            "update", "missing.csv", content="id\n1\n", expected_fingerprint="x", actor_id="analyst"
        )
    assert absent.value.code == "target_not_found"
    await core.close()


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
async def test_saved_search_timeout_cancels_the_remote_job():
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
        "splunk_host": "splunk.example.com", "splunk_port": 8089, "job_timeout": 0,
    })
    client._client = HttpClient()

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
