import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ConfigurationError, ServiceError
from unified_mcp_server.splunk_service import SplunkService


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


class FakeClient:
    def __init__(self, config):
        self.config = config
        self.connected = False
        self.closed = False
        self.search_args = None
        self.metadata_args = []

    async def connect(self):
        self.connected = True

    async def disconnect(self):
        self.closed = True

    async def search_oneshot(self, *args):
        self.search_args = args
        if args[0].startswith("| metadata"):
            self.metadata_args.append(args)
            if "index=main" in args[0]:
                return [{"sourcetype": "syslog"}, {"sourcetype": "linux_secure"}]
            return [{"sourcetype": "windows"}]
        return [{"card": "4111-1111-1111-1111", "ssn": "123-45-6789"}]

    async def get_indexes(self):
        return [
            {"name": "main", "totalEventCount": 1234, "maxTime": "1700000000"},
            {"name": "security", "totalEventCount": 567, "maxTime": "1690000000"},
        ]

    async def get_saved_searches(self, name="", app=""):
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

    async def get_saved_search(self, name):
        return {
            "name": name,
            "content": {
                "search": "index=main error",
                "description": "test",
                "dispatch.earliest_time": "-10m",
                "dispatch.latest_time": "now",
                "cron_schedule": "*/5 * * * *",
                "disabled": True,
            },
            "acl": {},
        }

    async def create_saved_search(self, fields):
        self.created_fields = fields
        return {"entry": [{"name": fields["name"]}]}

    async def update_saved_search(self, name, fields):
        self.updated_fields = (name, fields)
        return {"entry": [{"name": name}]}

    async def run_saved_search(self, name, trigger_actions):
        return {
            "search_name": name,
            "trigger_actions": trigger_actions,
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

    assert result["event_count"] == 1
    assert created[0].search_args[-1] == 2
    assert "4111-1111-1111-1111" not in str(result)
    assert "123-45-6789" not in str(result)
    assert (await service.list_indexes())["count"] == 2
    assert len(created) == 1
    await service.close()
    assert created[0].closed is True


@pytest.mark.asyncio
async def test_connection_checks_read_only_index_access():
    service = SplunkService(settings(), FakeClient)

    result = await service.test_connection()

    assert result == {"connected": True, "index_count": 2}
    await service.close()


@pytest.mark.asyncio
async def test_data_source_discovery_returns_bounded_sourcetypes_and_index_metadata():
    service = SplunkService(settings(), FakeClient)

    result = await service.list_data_sources("main")
    client = service.core._client

    assert result["count"] == 1
    assert result["data_sources"] == [{
        "index": "main",
        "sourcetypes": ["linux_secure", "syslog"],
        "event_count": 1234,
        "latest_event_time": "1700000000",
    }]
    assert result["indexes"][0]["name"] == "main"
    assert len(client.metadata_args) == 1
    assert client.metadata_args[0][0] == "| metadata type=sourcetypes index=main | head 100"
    assert client.metadata_args[0][-1] == 2
    await service.close()


@pytest.mark.asyncio
async def test_saved_search_discovery_filters_partial_name_and_app():
    service = SplunkService(settings(), FakeClient)

    result = await service.list_saved_searches(name="0723", app="search")

    assert result["count"] == 1
    assert result["saved_searches"][0]["name"] == "0723 Suspicious Login"
    assert result["saved_searches"][0]["search"] == "index=main sourcetype=auth"
    assert result["saved_searches"][0]["is_scheduled"] is True
    assert result["saved_searches"][0]["disabled"] is False
    assert result["saved_searches"][0]["actions"] == "email"
    await service.close()


@pytest.mark.asyncio
async def test_saved_search_disables_actions_and_sanitizes_results():
    service = SplunkService(settings(), FakeClient)

    result = await service.run_saved_search("Daily alerts")

    assert result["trigger_actions"] is False
    assert result["events"][0]["ssn"] == "***-**-****"


@pytest.mark.asyncio
async def test_unconfigured_splunk_returns_configuration_error():
    service = SplunkService(settings(host="", token=""))
    with pytest.raises(ConfigurationError):
        await service.list_indexes()


def test_high_risk_query_is_reported_before_execution():
    service = SplunkService(settings(risk_tolerance=0))
    result = service.validate("index=* | transaction host", earliest_time="0")
    assert result["would_execute"] is False
    assert result["risk_score"] > 0


@pytest.mark.asyncio
async def test_high_risk_query_is_blocked_before_client_creation():
    service = SplunkService(settings(risk_tolerance=0), lambda _: pytest.fail("client should not be created"))
    with pytest.raises(ServiceError, match="risk tolerance") as error:
        await service.search("index=* | transaction host", earliest_time="0")
    assert error.value.code == "query_blocked"


def test_detection_validation_reports_metadata_findings():
    service = SplunkService(settings())
    result = service.validate_detection({
        "name": "PowerShell download",
        "spl": "index=main EventCode=4688 powershell",
        "cron_schedule": "*/5 * * * *",
        "severity": "high",
        "mitre_attack": ["T1059.001"],
        "risk_score": 80,
        "risk_objects": ["user"],
    })
    assert result["valid"] is True
    assert result["detection"]["enabled"] is False


@pytest.mark.asyncio
async def test_backtest_and_writes_are_guarded_and_structured():
    service = SplunkService(settings(), FakeClient)
    with pytest.raises(ServiceError) as error:
        await service.create_detection_draft({"name": "x", "spl": "index=main error"})
    assert error.value.code == "operation_disabled"

    writable = SplunkService(
        settings(detection_write_enabled=True, detection_enable_enabled=True), FakeClient
    )
    payload = {"name": "x", "spl": "index=main error", "cron_schedule": "*/5 * * * *"}
    draft = await writable.create_detection_draft(payload)
    assert draft["enabled"] is False
    backtest = await writable.backtest_detection(payload, max_count=10)
    assert backtest["match_count"] == 1
    disabled = await writable.set_detection_enabled("x", False)
    assert disabled["enabled"] is False
