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
    assert result["search"] == {
        "earliest_time": "-24h",
        "latest_time": "now",
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
async def test_connection_checks_read_only_index_access():
    service = SplunkService(settings(), FakeClient)

    result = await service.test_connection()

    assert result == {"connected": True, "index_count": 2}
    await service.close()


@pytest.mark.asyncio
async def test_connection_failure_keeps_actionable_client_message():
    class FailedIndexClient(FakeClient):
        async def get_indexes(self):
            raise SplunkAPIError(
                "Could not reach Splunk at the configured URL. Check SPLUNK_URL and network access."
            )

    service = SplunkService(settings(), FailedIndexClient)

    with pytest.raises(ServiceError, match="Could not reach Splunk at the configured URL"):
        await service.test_connection()

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
async def test_field_projection_happens_before_event_character_budget():
    class LargeEventClient(FakeClient):
        async def run_search_job(self, *args, **kwargs):
            self.search_args = args
            return {
                "events": [
                    {"keep": "one", "_raw": "x" * 25_000},
                    {"keep": "two", "_raw": "y" * 25_000},
                ],
                "metadata": {
                    "total_result_count": 2,
                    "fetched_count": 2,
                    "splunk_result_truncated": False,
                },
            }

    service = SplunkService(settings(), LargeEventClient)

    unprojected = await service.search("index=main")
    projected = await service.search("index=main", fields=["keep"])

    assert unprojected["result"] == {"type": "events", "rows": []}
    assert unprojected["search"]["fetched_count"] == 2
    assert unprojected["search"]["returned_count"] == 0
    assert unprojected["search"]["splunk_result_truncated"] is False
    assert unprojected["search"]["mcp_context_truncated"] is True
    assert unprojected["truncated"] is True
    assert projected["result"] == {
        "type": "events",
        "rows": [{"keep": "one"}, {"keep": "two"}],
    }
    assert projected["search"]["mcp_context_truncated"] is False


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
    assert result["search"] == {
        "earliest_time": "-24h",
        "latest_time": "now",
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
async def test_search_combines_backend_and_context_truncation_flags():
    class TruncatedClient(FakeClient):
        async def run_search_job(self, *args, **kwargs):
            return {
                "events": [{"value": "ok"}],
                "columns": ["value"],
                "metadata": {
                    "total_result_count": 2,
                    "fetched_count": 1,
                    "splunk_result_truncated": True,
                },
            }

    service = SplunkService(settings(), TruncatedClient)
    result = await service.search("index=main | stats count by value")

    assert result["search"]["result_count"] == 2
    assert result["search"]["fetched_count"] == 1
    assert result["search"]["returned_count"] == 1
    assert result["search"]["splunk_result_truncated"] is True
    assert result["search"]["mcp_context_truncated"] is False
    assert result["truncated"] is True


@pytest.mark.asyncio
async def test_search_leaves_unavailable_job_metadata_null():
    class MetadataClient(FakeClient):
        async def run_search_job(self, *args, **kwargs):
            return {"events": [{"value": "ok"}], "metadata": {}}

    service = SplunkService(settings(), MetadataClient)
    result = await service.search("index=main")

    assert result["search"]["run_duration_ms"] is None
    assert result["search"]["scanned_events"] is None
    assert result["search"]["result_count"] is None
    assert result["search"]["splunk_result_truncated"] is None
    assert result["truncated"] is False


@pytest.mark.asyncio
async def test_search_maps_untrustworthy_job_metadata_to_null():
    class MalformedMetadataClient(FakeClient):
        async def run_search_job(self, *args, **kwargs):
            return {
                "events": [{"value": "ok"}],
                "metadata": {
                    "total_result_count": "unknown",
                    "scan_count": "unknown",
                    "run_duration": "unknown",
                    "splunk_result_truncated": "unknown",
                },
            }

    service = SplunkService(settings(), MalformedMetadataClient)
    result = await service.search("index=main")

    assert result["search"]["result_count"] is None
    assert result["search"]["scanned_events"] is None
    assert result["search"]["run_duration_seconds"] is None
    assert result["search"]["run_duration_ms"] is None
    assert result["search"]["splunk_result_truncated"] is None


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
        "spl": citic_spl("index=main EventCode=4688 powershell"),
        "cron_schedule": "*/5 * * * *",
        "severity": "high",
        "mitre_attack": ["T1059.001"],
        "risk_score": 80,
        "risk_objects": ["user"],
    })
    assert result["valid"] is True
    assert result["detection"]["enabled"] is False


def test_detection_validation_supports_realtime_alerts_and_input_aliases():
    service = SplunkService(settings())

    result = service.validate_detection({
        "name": "Realtime error alert",
        "spl": citic_spl(),
        "is_scheduled": True,
        "dispatch.earliest_time": "rt-5m",
        "dispatch.latest_time": "rt",
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
    assert result["detection"]["dispatch.earliest_time"] == "rt-5m"
    assert result["detection"]["dispatch.latest_time"] == "rt"
    assert result["detection"]["action.email"] == "1"
    assert any("real-time" in warning for warning in result["warnings"])


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
    assert any("outputcsv" in warning for warning in result["warnings"])


@pytest.mark.parametrize("command", ["outputlookup", "sendemail"])
def test_detection_validation_keeps_other_writers_blocked(command):
    service = SplunkService(settings())
    spl = citic_spl().replace(
        '\n| table ', f'\n| {command} destination\n| table ', 1
    )

    result = service.validate_detection({"name": "unsafe", "spl": spl})

    assert result["valid"] is False
    assert command in result["query_validation"]["blocked_commands"]


def test_detection_validation_rejects_dual_spl_payloads():
    service = SplunkService(settings())

    with pytest.raises(ServiceError, match="dual SPL"):
        service.validate_detection({
            "name": "dual",
            "spl": citic_spl(),
            "production_spl": citic_spl(),
            "backtest_spl": "index=main error",
        })


@pytest.mark.asyncio
async def test_backtest_rejects_outputcsv_before_execution():
    service = SplunkService(
        settings(),
        lambda _: pytest.fail("outputcsv backtest must not create a client"),
    )
    with pytest.raises(ServiceError) as error:
        await service.backtest_detection({
            "name": "Client CSV alert",
            "spl": "index=main error | outputcsv [| stats count | return $filename]",
        }, earliest_time="-15m", latest_time="now")

    assert error.value.code == "detection_invalid"


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
    assert result["detection"]["dispatch.rt_maximum_span"] == "5m"


@pytest.mark.parametrize(
    "alert_fields",
    [
        {
            "is_scheduled": True,
            "dispatch.earliest_time": "rt-5m",
            "dispatch.latest_time": "now",
        },
        {
            "alert_type": "number of events",
            "alert_comparator": "rises by perc",
            "alert_threshold": "101%",
        },
        {
            "alert_type": "number of events",
            "alert_comparator": "greater than",
            "alert_threshold": 0,
            "alert.digest_mode": False,
            "alert.suppress": True,
            "alert.suppress.period": "15m",
        },
    ],
)
def test_detection_validation_rejects_invalid_alert_combinations(alert_fields):
    service = SplunkService(settings())
    result = service.validate_detection({
        "name": "Invalid alert",
        "spl": "index=main error",
        **alert_fields,
    })

    assert result["valid"] is False
    assert result["errors"]


def test_detection_validation_rejects_non_scalar_action_parameters():
    service = SplunkService(settings())

    with pytest.raises(ServiceError) as error:
        service.validate_detection({
            "name": "Invalid action",
            "spl": "index=main error",
            "actions": "webhook",
            "action.webhook.param.url": ["https://example.invalid/hook"],
        })

    assert error.value.code == "invalid_input"


@pytest.mark.asyncio
async def test_backtest_and_writes_are_guarded_and_structured():
    service = SplunkService(settings(), FakeClient)
    draft_without_write_gate = await service.write_detection({"name": "x", "spl": citic_spl()})
    assert draft_without_write_gate["status"] == "draft"

    writable = SplunkService(
        settings(detection_write_enabled=True), FakeClient
    )
    payload = {"name": "x", "spl": citic_spl(), "cron_schedule": "*/5 * * * *"}
    draft = await writable.write_detection(payload)
    assert draft["status"] == "draft"
    assert draft["enabled"] is False
    assert "splunk" not in draft
    assert draft["requires_action_configuration"] is False
    assert draft["review_only_metadata"]["persisted"] is False
    backtest = await writable.backtest_detection(
        {**payload, "spl": "index=main error"}, max_count=10, fields=["card"]
    )
    assert backtest["sample_count"] == 1
    assert backtest["sample_budget"]["returned_count"] == 1
    assert backtest["sample_budget"]["truncated"] is False
    assert backtest["search_metadata"]["returned_count"] == 1
    assert backtest["search_metadata"]["mcp_context_truncated"] is False
    assert backtest["fields"] == ["card"]
    assert backtest["sample_events"] == [{"card": "****-****-****-1111"}]
    current = await writable.get_detection("x")
    update_draft = await writable.update_detection(
        "x", {"description": "updated"}, current["fingerprint"], actor_id="test-analyst"
    )
    disabled = await writable.save_detection(
        "update",
        update_draft["draft"],
        name="x",
        expected_fingerprint=update_draft["expected_fingerprint"],
        actor_id="test-analyst",
    )
    assert disabled["enabled"] is False
    assert "splunk" not in disabled
    assert writable.core._client.updated_fields[0] == "x"
    assert writable.core._client.updated_fields[1]["disabled"] == "1"
    assert "alert.track" not in writable.core._client.updated_fields[1]


@pytest.mark.asyncio
async def test_detection_update_adds_company_log_event_and_forces_disabled_state():
    service = SplunkService(
        settings(detection_write_enabled=True), FakeClient
    )
    draft = await service.write_detection({
        "name": "x", "spl": citic_spl(), "cron_schedule": "*/5 * * * *",
    })
    assert draft["status"] == "draft"
    current = await service.get_detection("x")
    update_draft = await service.update_detection(
        "x", {"description": "reviewed"}, current["fingerprint"], actor_id="test-analyst"
    )
    assert update_draft["draft"]["disabled"] is True
    updated = await service.save_detection(
        "update",
        update_draft["draft"],
        name="x",
        expected_fingerprint=update_draft["expected_fingerprint"],
        actor_id="test-analyst",
    )
    assert updated["actions_preserved"] is False
    assert updated["actions_updated"] is True
    assert updated["detection"]["actions"] == "email,logevent"
    assert service.core._client.updated_fields[1]["actions"] == "email,logevent"


@pytest.mark.asyncio
async def test_detection_modification_rejects_a_stale_fingerprint():
    service = SplunkService(settings(detection_write_enabled=True), FakeClient)
    current = await service.get_detection("x")

    with pytest.raises(ServiceError) as error:
        await service.update_detection("x", {"description": "changed"}, "stale")

    assert error.value.code == "detection_changed"
