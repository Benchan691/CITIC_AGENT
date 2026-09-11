import pytest

import unified_mcp_server.splunk.splunk_client as splunk_client_module
from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.splunk_client import SplunkClient
from unified_mcp_server.splunk.splunk_client import SplunkAPIError
from unified_mcp_server.splunk_service import SplunkService
from unified_mcp_server.tests.citic_fixtures import citic_spl


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
        "max_events": 2,
        "risk_tolerance": 75,
        "safe_timerange": "24h",
        "sanitize_output": True,
    }
    values.update(overrides)
    return SplunkSettings(**values)


@pytest.mark.asyncio
async def test_low_level_splunk_client_requires_https_and_defaults_to_certificate_verification(monkeypatch):
    with pytest.raises(SplunkAPIError, match="must use HTTPS"):
        await SplunkClient({
            "splunk_url": "http://splunk.example.com:8089",
            "splunk_token": "token",
        }).connect()

    captured = {}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def aclose(self):
            return None

    monkeypatch.setattr(splunk_client_module.httpx, "AsyncClient", FakeAsyncClient)
    client = SplunkClient({
        "splunk_url": "https://splunk.example.com:8089",
        "splunk_token": "token",
    })
    await client.connect()
    assert captured["verify"] is True
    await client.disconnect()


class FakeClient:
    def __init__(self, config):
        self.config = config
        self.connected = False
        self.closed = False
        self.search_args = None
        self.saved_content = {
            "search": citic_spl(),
            "description": "test",
            "dispatch.earliest_time": "-10m",
            "dispatch.latest_time": "now",
            "cron_schedule": "*/5 * * * *",
            "is_scheduled": "1",
            "disabled": "1",
            "actions": "email",
        }
        self.saved_acl = {"app": "search", "owner": "nobody", "sharing": "app"}

    async def connect(self):
        self.connected = True

    async def disconnect(self):
        self.closed = True

    async def run_search_job(self, *args, **kwargs):
        self.search_args = args
        return {
            "events": [{"card": "4111-1111-1111-1111", "ssn": "123-45-6789"}],
            "metadata": {
                "total_result_count": 1,
                "fetched_count": 1,
                "scan_count": 1,
                "run_duration": 0.01,
                "splunk_result_truncated": False,
            },
        }

    async def get_indexes(self):
        return [
            {"name": "main", "totalEventCount": 1234, "maxTime": "1700000000"},
            {"name": "security", "totalEventCount": 567, "maxTime": "1690000000"},
        ]

    async def get_saved_searches(self, name="", app="", count=50):
        return [
            {
                "name": "0723 Suspicious Login",
                "search": "index=main sourcetype=auth",
                "description": "Login alert",
                "app": "search",
                "owner": "nobody",
                "is_scheduled": True,
                "disabled": False,
                "cron_schedule": "*/5 * * * *",
                "next_scheduled_time": "1700000300",
                "actions": "email",
            },
            {"name": "0723 Other App", "app": "security"},
            {"name": "Errors", "app": "search"},
        ]

    async def get_saved_search(self, name, app="", owner=""):
        return {
            "name": name,
            "content": dict(self.saved_content),
            "acl": {**self.saved_acl, "app": app or self.saved_acl["app"], "owner": owner or self.saved_acl["owner"]},
        }

    async def run_saved_search(self, name, trigger_actions, max_count=100, app="", owner="", *, runtime_limit=None):
        return {
            "search_name": name,
            "trigger_actions": trigger_actions,
            "max_count": max_count,
            "app": app,
            "owner": owner,
            "events": [{"ssn": "123-45-6789"}],
        }


@pytest.mark.asyncio
async def test_search_reuses_client_caps_results_and_sanitizes():
    created = []

    def factory(config):
        client = FakeClient(config)
        created.append(client)
        return client

    service = SplunkService(settings(), factory)
    result = await service.search("index=main | head 10", max_count=500)

    assert result["result"] == {
        "type": "events",
        "rows": [{"card": "****-****-****-1111", "ssn": "***-**-****"}],
    }
    assert created[0].search_args[-1] == 2
    assert float(result["search"]["latest_time"]) - float(result["search"]["earliest_time"]) == pytest.approx(86400)
    assert result["search"] == {
        "earliest_time": result["search"]["earliest_time"],
        "latest_time": result["search"]["latest_time"],
        "time_window_resolved": True,
        "run_duration_seconds": 0.01,
        "run_duration_ms": 10,
        "scanned_events": 1,
        "result_count": 1,
        "fetched_count": 1,
        "returned_count": 1,
        "splunk_result_truncated": False,
        "mcp_context_truncated": False,
    }
    assert result["truncated"] is False
    assert "sid" not in result
    assert "dispatchState" not in result
    assert "doneProgress" not in result
    assert "4111-1111-1111-1111" not in str(result)
    assert "123-45-6789" not in str(result)
    assert len(created) == 1
    await service.close()
    assert created[0].closed is True




@pytest.mark.asyncio
async def test_executor_owns_field_validation_before_splunk_execution():
    service = SplunkService(settings(), lambda _: pytest.fail("client should not be created"))

    with pytest.raises(ServiceError) as error:
        await service.search("index=main", fields=["x" * 129])

    assert error.value.code == "invalid_input"








@pytest.mark.asyncio
async def test_saved_search_disables_actions_and_sanitizes_results():
    class SavedSearchClient(FakeClient):
        def __init__(self, config):
            super().__init__(config)
            self.saved_content["search"] = "index=main error"

    service = SplunkService(settings(), SavedSearchClient)

    result = await service.run_saved_search(
        "Daily alerts", max_count=500, app="security", owner="nobody"
    )

    assert result["trigger_actions"] is False
    assert result["max_count"] == 2
    assert result["app"] == "security"
    assert result["owner"] == "nobody"
    assert result["events"][0]["ssn"] == "***-**-****"
    assert result["event_budget"]["returned_count"] == 1






















@pytest.mark.asyncio
async def test_high_risk_query_is_blocked_before_client_creation():
    service = SplunkService(settings(risk_tolerance=0), lambda _: pytest.fail("client should not be created"))
    with pytest.raises(ServiceError, match="risk tolerance") as error:
        await service.search("index=* | transaction host", earliest_time="0")
    assert error.value.code == "query_blocked"




@pytest.mark.asyncio
async def test_mutating_spl_is_blocked_independently_of_risk_tolerance():
    service = SplunkService(settings(risk_tolerance=100), lambda _: pytest.fail("client should not be created"))

    for command in [
        "delete",
        "collect",
        "mcollect",
        "meventcollect",
        "outputlookup",
        "outputcsv",
        "sendemail",
        "script",
        "external",
    ]:
        validation = service.validate(f"index=main | {command}")
        assert validation["would_execute"] is False
        assert command in validation["blocked_commands"]
        with pytest.raises(ServiceError, match="safety policy"):
            await service.search(f"index=main | {command}")




















@pytest.mark.asyncio
async def test_backtest_is_read_only_bounded_and_structured():
    service = SplunkService(settings(), FakeClient)
    payload = {"name": "x", "spl": citic_spl(), "cron_schedule": "*/5 * * * *"}
    backtest = await service.backtest_detection(
        {**payload, "spl": "index=main error"}, max_count=10, fields=["card"]
    )
    assert backtest["sample_count"] == 1
    assert backtest["sample_budget"]["returned_count"] == 1
    assert backtest["sample_budget"]["truncated"] is False
    assert backtest["search_metadata"]["returned_count"] == 1
    assert backtest["search_metadata"]["mcp_context_truncated"] is False
    assert backtest["fields"] == ["card"]
    assert backtest["sample_events"] == [{"card": "****-****-****-1111"}]


@pytest.mark.asyncio
async def test_detection_reads_omit_schedule_and_realtime_metadata():
    class RealtimeClient(FakeClient):
        def __init__(self, config):
            super().__init__(config)
            self.saved_content.update({
                "dispatch.earliest_time": "rt-5m",
                "dispatch.latest_time": "rt",
                "dispatch.rt_backfill": "1",
                "dispatch.indexedRealtime": "1",
                "dispatch.rt_maximum_span": "5m",
            })

    service = SplunkService(settings(), RealtimeClient)

    result = await service.get_detection("Realtime fixture")

    assert result["earliest_time"] == ""
    assert result["latest_time"] == ""
    assert not {
        "is_scheduled", "cron_schedule", "next_scheduled_time",
        "dispatch.earliest_time", "dispatch.latest_time", "dispatch.rt_backfill",
        "dispatch.indexedRealtime", "dispatch.rt_maximum_span",
    } & result.keys()
    assert result["actions"] == "email"
    await service.close()
