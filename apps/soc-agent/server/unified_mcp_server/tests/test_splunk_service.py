import json

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
        self.saved_content = {
            "search": "index=main error",
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

    async def search_oneshot(self, *args):
        self.search_args = args
        return [{"card": "4111-1111-1111-1111", "ssn": "123-45-6789"}]

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

    async def create_saved_search(self, fields):
        self.created_fields = fields
        self.saved_content = {
            key: value for key, value in fields.items()
            if key not in {"name", "app", "owner"}
        }
        self.saved_acl = {"app": fields.get("app", "search"), "owner": fields.get("owner", "nobody"), "sharing": "app"}
        return {"entry": [{"name": fields["name"]}]}

    async def update_saved_search(self, name, fields):
        self.updated_fields = (name, fields)
        self.saved_content.update({
            key: value for key, value in fields.items()
            if key not in {"name", "app", "owner"}
        })
        return {"entry": [{"name": name}]}

    async def run_saved_search(self, name, trigger_actions, max_count=100, app="", owner=""):
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

    assert result["event_count"] == 1
    assert created[0].search_args[-1] == 2
    assert "4111-1111-1111-1111" not in str(result)
    assert "123-45-6789" not in str(result)
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
async def test_saved_search_discovery_filters_partial_name_and_app():
    service = SplunkService(settings(), FakeClient)

    result = await service.list_saved_searches(name="0723", app="search")

    assert result["count"] == 1
    assert result["saved_searches"][0]["name"] == "0723 Suspicious Login"
    assert "search" not in result["saved_searches"][0]
    assert result["saved_searches"][0]["is_scheduled"] is True
    assert result["saved_searches"][0]["disabled"] is False
    assert result["saved_searches"][0]["actions"] == "email"

    with_spl = await service.list_saved_searches(
        name="0723", app="search", include_spl=True
    )
    assert with_spl["saved_searches"][0]["search"] == "index=main sourcetype=auth"
    await service.close()


@pytest.mark.asyncio
async def test_saved_search_disables_actions_and_sanitizes_results():
    service = SplunkService(settings(), FakeClient)

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
async def test_search_projects_requested_fields_after_sanitizing():
    service = SplunkService(settings(), FakeClient)

    result = await service.search("index=main", fields=["card"])

    assert result["fields"] == ["card"]
    assert result["events"] == [{"card": "****-****-****-1111"}]
    await service.close()


def test_event_budget_keeps_complete_prefix_and_reports_oversized_event():
    service = SplunkService(settings())
    first = {"value": "ok"}
    second = {"raw": "🚨" * 100}
    limit = len(json.dumps([first], ensure_ascii=True, separators=(",", ":")))

    bounded, budget = service.core.bound_events([first, second], limit)

    assert bounded == [first]
    assert budget == {
        "received_count": 2,
        "returned_count": 1,
        "characters": limit,
        "character_limit": limit,
        "truncated": True,
        "first_omitted_event_characters": len(
            json.dumps(second, ensure_ascii=True, separators=(",", ":"))
        ),
        "hint": "Retry with fields limited to the evidence needed.",
    }
    assert second["raw"] == "🚨" * 100


@pytest.mark.asyncio
async def test_field_projection_happens_before_event_character_budget():
    class LargeEventClient(FakeClient):
        async def search_oneshot(self, *args):
            self.search_args = args
            return [
                {"keep": "one", "_raw": "x" * 25_000},
                {"keep": "two", "_raw": "y" * 25_000},
            ]

    service = SplunkService(settings(), LargeEventClient)

    unprojected = await service.search("index=main")
    projected = await service.search("index=main", fields=["keep"])

    assert unprojected["events"] == []
    assert unprojected["event_budget"]["received_count"] == 2
    assert unprojected["event_budget"]["truncated"] is True
    assert projected["events"] == [{"keep": "one"}, {"keep": "two"}]
    assert projected["event_budget"]["truncated"] is False


@pytest.mark.asyncio
async def test_unconfigured_splunk_returns_configuration_error():
    service = SplunkService(settings(host="", token=""))
    with pytest.raises(ConfigurationError):
        await service.test_connection()


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


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "command",
    ["delete", "collect", "mcollect", "meventcollect", "outputlookup", "outputcsv", "sendemail", "script", "external"],
)
async def test_mutating_spl_is_blocked_independently_of_risk_tolerance(command):
    service = SplunkService(settings(risk_tolerance=100), lambda _: pytest.fail("client should not be created"))

    validation = service.validate(f"index=main | {command}")
    assert validation["would_execute"] is False
    assert command in validation["blocked_commands"]
    with pytest.raises(ServiceError, match="safety policy"):
        await service.search(f"index=main | {command}")


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
    assert "splunk" not in draft
    assert draft["requires_action_configuration"] is True
    assert draft["review_only_metadata"]["persisted"] is False
    backtest = await writable.backtest_detection(payload, max_count=10, fields=["card"])
    assert backtest["sample_count"] == 1
    assert backtest["sample_budget"]["returned_count"] == 1
    assert backtest["sample_budget"]["truncated"] is False
    assert backtest["fields"] == ["card"]
    assert backtest["sample_events"] == [{"card": "****-****-****-1111"}]
    disabled = await writable.set_detection_enabled(
        "x", False, draft["detection"]["fingerprint"]
    )
    assert disabled["enabled"] is False
    assert "splunk" not in disabled
    assert writable.core._client.updated_fields == (
        "x",
        {
            "disabled": "1",
            "app": writable.settings.detection_app,
            "owner": writable.settings.detection_owner,
        },
    )


@pytest.mark.asyncio
async def test_detection_update_preserves_actions_and_enable_requires_runnable_state():
    service = SplunkService(
        settings(detection_write_enabled=True, detection_enable_enabled=True), FakeClient
    )
    draft = await service.create_detection_draft({
        "name": "x", "spl": "index=main error", "cron_schedule": "*/5 * * * *",
    })
    with pytest.raises(ServiceError) as not_runnable:
        await service.set_detection_enabled("x", True, draft["detection"]["fingerprint"])
    assert not_runnable.value.code == "detection_not_runnable"

    client = service.core._client
    client.saved_content["actions"] = "notable"
    current = await service.get_detection("x")
    updated = await service.update_detection_draft(
        "x", {"description": "reviewed"}, current["fingerprint"]
    )
    assert updated["actions_preserved"] is True
    assert updated["detection"]["actions"] == "notable"
    assert "actions" not in client.updated_fields[1]

    enabled = await service.set_detection_enabled(
        "x", True, updated["detection"]["fingerprint"]
    )
    assert enabled["enabled"] is True


@pytest.mark.asyncio
async def test_detection_modification_rejects_a_stale_fingerprint():
    service = SplunkService(settings(detection_write_enabled=True), FakeClient)
    current = await service.get_detection("x")

    with pytest.raises(ServiceError) as error:
        await service.update_detection_draft("x", {"description": "changed"}, "stale")

    assert error.value.code == "detection_changed"
