import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.search.executor import SearchExecutor
from unified_mcp_server.splunk.search.planner import SearchIntent, SearchPlanner
from unified_mcp_server.splunk.search.schema_registry import SearchSchema, SearchSchemaRegistry
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
        "max_events": 100,
        "risk_tolerance": 75,
        "safe_timerange": "24h",
        "sanitize_output": True,
    }
    values.update(overrides)
    return SplunkSettings(**values)


class PlanningClient:
    def __init__(self, _config):
        self.queries = []
        self.empty = False

    async def connect(self):
        return None

    async def disconnect(self):
        return None

    async def run_search_job(self, query, *args, **kwargs):
        self.queries.append((query, args, kwargs))
        if self.empty:
            return {"events": [], "metadata": {"total_result_count": 0}}
        if "stats count" in query:
            return {
                "events": [{"host": "host-1", "count": "3"}],
                "columns": ["host", "count"],
                "metadata": {"total_result_count": 1, "scan_count": 3},
            }
        return {
            "events": [{"_time": "2026-08-28T00:00:00Z", "src_ip": "10.1.2.3"}],
            "columns": ["_time", "src_ip"],
            "metadata": {"total_result_count": 1, "scan_count": 3},
        }


def test_planner_uses_curated_scope_and_expands_entity_aliases():
    plan = SearchPlanner().plan(
        SearchIntent(
            objective="find failed authentication activity for this IP",
            entity_type="ip",
            entity="10.1.2.3",
        ),
        SearchSchemaRegistry.default(),
    )

    assert plan.indexes == ["windows"]
    assert plan.sourcetypes == ["WinEventLog:Security", "XmlWinEventLog:Security"]
    assert plan.strategy == "timeline"
    assert "src_ip=\"10.1.2.3\"" in plan.spl
    assert "Source_Network_Address=\"10.1.2.3\"" in plan.spl
    assert "IpAddress=\"10.1.2.3\"" in plan.spl
    assert plan.confidence_label == "high"




def test_unknown_schema_fails_without_inventing_scope_or_fields():
    with pytest.raises(ServiceError) as error:
        SearchPlanner().plan(
            SearchIntent(
                objective="find proprietary telemetry",
                entity_type="device_serial",
                entity="serial-1",
            )
        )

    assert error.value.code == "planning_failed"
    assert "index=" not in str(error.value.details)


def test_entity_value_is_quoted_instead_of_becoming_spl():
    plan = SearchPlanner().plan(
        SearchIntent(
            objective="find failed authentication activity for this IP",
            entity_type="ip",
            entity='10.1.2.3" | delete',
        )
    )

    assert '10.1.2.3\\" | delete' in plan.spl
    assert "delete" not in SearchExecutor._pipeline_commands(plan.spl)
