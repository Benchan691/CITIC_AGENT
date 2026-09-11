import json

import pytest

import unified_mcp_server.splunk.splunk_client as splunk_client_module
from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ConfigurationError, ServiceError
from unified_mcp_server.splunk.splunk_client import SplunkClient
from unified_mcp_server.splunk.splunk_client import SplunkAPIError
from unified_mcp_server.splunk.search.executor import SearchExecutor
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


def test_search_and_detection_services_share_one_executor():
    service = SplunkService(settings(), FakeClient)

    assert isinstance(service.search_service.executor, SearchExecutor)
    assert service.search_service.executor is service.detection_service.executor


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
async def test_saved_search_policy_blocks_side_effecting_saved_spl_before_dispatch():
    class UnsafeSavedClient(FakeClient):
        async def get_saved_search(self, name, app="", owner=""):
            return {
                "name": name,
                "content": {
                    "search": "index=main | outputlookup evidence.csv",
                    "dispatch.earliest_time": "-10m",
                    "dispatch.latest_time": "now",
                },
            }

        async def run_saved_search(self, *args, **kwargs):
            pytest.fail("unsafe saved search must not be dispatched")

    service = SplunkService(settings(), UnsafeSavedClient)
    with pytest.raises(ServiceError) as error:
        await service.run_saved_search("Unsafe")
    assert error.value.code == "query_blocked"


@pytest.mark.asyncio
async def test_search_projects_requested_fields_after_sanitizing():
    service = SplunkService(settings(), FakeClient)

    result = await service.search("index=main", fields=["card"])

    assert result["result"] == {
        "type": "events",
        "rows": [{"card": "****-****-****-1111"}],
    }
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
async def test_search_formats_analytical_spl_as_a_table_and_preserves_columns():
    class AnalyticalClient(FakeClient):
        async def run_search_job(self, *args, **kwargs):
            self.search_args = args
            return {
                "events": [
                    {"rule": "Failed Login", "count": "12891"},
                    {"rule": "MFA Failure", "count": "14"},
                ],
                "columns": ["rule", "count"],
                "metadata": {
                    "total_result_count": 2,
                    "fetched_count": 2,
                    "scan_count": 823144,
                    "run_duration": 1.82,
                    "splunk_result_truncated": False,
                },
            }

    service = SplunkService(settings(), AnalyticalClient)

    result = await service.search("index=security | stats count by rule")

    assert result["query"] == "index=security | stats count by rule"
    assert result["result"] == {
        "type": "table",
        "columns": ["rule", "count"],
        "rows": [
            {"rule": "Failed Login", "count": "12891"},
            {"rule": "MFA Failure", "count": "14"},
        ],
    }
    assert float(result["search"]["latest_time"]) - float(result["search"]["earliest_time"]) == pytest.approx(86400)
    assert result["search"] == {
        "earliest_time": result["search"]["earliest_time"],
        "latest_time": result["search"]["latest_time"],
        "time_window_resolved": True,
        "run_duration_seconds": 1.82,
        "run_duration_ms": 1820,
        "scanned_events": 823144,
        "result_count": 2,
        "fetched_count": 2,
        "returned_count": 2,
        "splunk_result_truncated": False,
        "mcp_context_truncated": False,
    }
    assert result["truncated"] is False












@pytest.mark.asyncio
async def test_high_risk_query_is_blocked_before_client_creation():
    service = SplunkService(settings(risk_tolerance=0), lambda _: pytest.fail("client should not be created"))
    with pytest.raises(ServiceError, match="risk tolerance") as error:
        await service.search("index=* | transaction host", earliest_time="0")
    assert error.value.code == "query_blocked"


@pytest.mark.asyncio
async def test_job_failures_are_returned_as_clean_service_errors():
    class FailedJobClient(FakeClient):
        async def run_search_job(self, *args, **kwargs):
            raise SplunkAPIError("job failed", status_code=400)

    service = SplunkService(settings(), FailedJobClient)

    with pytest.raises(ServiceError) as error:
        await service.search("index=main")

    assert error.value.code == "splunk_api_error"
    assert error.value.details == {"status_code": 400}


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


def test_detection_validation_reports_metadata_findings():
    service = SplunkService(settings())
    result = service.validate_detection({
        "name": "PowerShell download",
        "spl": citic_spl("index=main EventCode=4688 powershell"),
        "cron_schedule": "*/5 * * * *",
        "severity": "high",
        "mitre_attack": ["T1059.001"],
        "risk_score": 80,
        "risk_objects": ["user"],
    })
    assert result["valid"] is True
    assert result["detection"]["enabled"] is False
    assert "cron_schedule" not in result["detection"]


def test_detection_validation_ignores_schedule_and_realtime_activation_fields():
    service = SplunkService(settings())

    result = service.validate_detection({
        "name": "Realtime error alert",
        "spl": citic_spl(),
        "is_scheduled": True,
        "cron_schedule": "*/5 * * * *",
        "next_scheduled_time": "1700000300",
        "dispatch.earliest_time": "rt-5m",
        "dispatch.latest_time": "rt",
        "dispatch.rt_backfill": True,
        "dispatch.indexedRealtime": True,
        "dispatch.indexedRealtimeOffset": "5m",
        "dispatch.indexedRealtimeMinSpan": "1m",
        "dispatch.rt_maximum_span": "10m",
        "counttype": "number of events",
        "relation": "greater than",
        "quantity": 0,
        "alert.digest_mode": True,
        "alert.suppress": False,
        "actions": "email",
        "action.email": True,
        "action.email.to": "soc@example.invalid",
    })

    assert result["valid"] is True
    assert result["query_validation"]["decision"] == "allow"
    assert result["detection"]["alert_type"] == "number of events"
    assert result["detection"]["alert_comparator"] == "greater than"
    assert result["detection"]["alert_threshold"] == "0"
    assert result["detection"]["earliest_time"] == "-10m"
    assert result["detection"]["latest_time"] == "now"
    assert result["detection"]["action.email"] == "1"
    assert not {
        "is_scheduled", "cron_schedule", "next_scheduled_time",
        "dispatch.earliest_time", "dispatch.latest_time", "dispatch.rt_backfill",
        "dispatch.indexedRealtime", "dispatch.indexedRealtimeOffset",
        "dispatch.indexedRealtimeMinSpan", "dispatch.rt_maximum_span",
    } & result["detection"].keys()


def test_detection_validation_allows_outputcsv_only_as_a_saved_search_definition():
    service = SplunkService(settings())
    result = service.validate_detection({
        "name": "Client CSV alert",
        "spl": citic_spl(),
        "is_scheduled": True,
        "cron_schedule": "*/15 * * * *",
        "dispatch.earliest_time": "-15m",
        "dispatch.latest_time": "now",
    })

    assert result["valid"] is True
    assert result["query_validation"]["decision"] == "allow"
    assert result["query_validation"]["allowed_commands"] == ["outputcsv"]
    assert result["detection"]["earliest_time"] == "-15m"
    assert result["detection"]["latest_time"] == "now"
    assert not {"is_scheduled", "cron_schedule"} & result["detection"].keys()
    assert any("outputcsv" in warning for warning in result["warnings"])


def test_detection_validation_keeps_other_writers_blocked():
    service = SplunkService(settings())
    for command in ["outputlookup", "sendemail"]:
        spl = citic_spl().replace(
            '\n| table ', f'\n| {command} destination\n| table ', 1
        )

        result = service.validate_detection({"name": "unsafe", "spl": spl})

        assert result["valid"] is False
        assert command in result["query_validation"]["blocked_commands"]






def test_detection_validation_supports_custom_condition_per_result_throttle_and_expiry():
    service = SplunkService(settings())

    result = service.validate_detection({
        "name": "Custom throttled alert",
        "spl": citic_spl(),
        "alert_type": "custom",
        "alert_condition": "severity=critical",
        "alert.digest_mode": False,
        "alert.suppress": True,
        "alert.suppress.period": "15m",
        "alert.suppress.fields": "host, user",
        "alert.suppress.group_name": "critical-errors",
        "alert.expires": "24h",
        "alert.track": True,
        "dispatch.rt_maximum_span": "5m",
        "actions": "webhook",
        "action.webhook": True,
        "action.webhook.param.url": "https://example.invalid/hook",
    })

    assert result["valid"] is True
    assert result["detection"]["alert_condition"] == "severity=critical"
    assert result["detection"]["alert.digest_mode"] == "0"
    assert result["detection"]["alert.suppress.fields"] == "host, user"
    assert "dispatch.rt_maximum_span" not in result["detection"]






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
