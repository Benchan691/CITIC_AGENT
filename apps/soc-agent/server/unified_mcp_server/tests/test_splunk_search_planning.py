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


def test_planner_selects_aggregation_and_does_not_default_to_raw_events():
    count = SearchPlanner().plan(
        SearchIntent(objective="how many failed logins occurred", result_mode="count")
    )
    distribution = SearchPlanner().plan(
        SearchIntent(objective="which hosts had the most failures", result_mode="distribution")
    )
    timeline = SearchPlanner().plan(
        SearchIntent(
            objective="show activity around this incident",
            preferred_index="windows",
        )
    )

    assert count.strategy == "stats"
    assert "| stats count" in count.spl
    assert "| stats count by" not in count.spl
    assert distribution.strategy == "stats"
    assert "| stats count by host" in distribution.spl
    assert timeline.strategy == "timeline"
    assert "| fields" in timeline.spl
    assert "| head" in timeline.spl


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


@pytest.mark.asyncio
async def test_search_intent_plans_then_uses_the_existing_executor():
    clients = []

    def factory(config):
        client = PlanningClient(config)
        clients.append(client)
        return client

    service = SplunkService(settings(), factory)
    result = await service.search_intent(
        SearchIntent(
            objective="find failed authentication activity for this IP",
            entity_type="ip",
            entity="10.1.2.3",
            requested_fields=["_time", "src_ip"],
            max_count=5,
        ),
        principal_id="analyst-a",
    )

    assert len(clients) == 1
    assert len(clients[0].queries) == 1
    assert clients[0].queries[0][0].startswith("index=windows")
    assert result["plan"]["strategy"] == "timeline"
    assert result["query"] == clients[0].queries[0][0]
    assert result["verification"]["conclusion"] == "matches_observed"
    await service.close()


@pytest.mark.asyncio
async def test_zero_result_is_reported_as_observed_scope_not_absolute_absence():
    clients = []

    def factory(config):
        client = PlanningClient(config)
        client.empty = True
        clients.append(client)
        return client

    service = SplunkService(settings(), factory)
    result = await service.search_intent(
        SearchIntent(
            objective="find failed authentication activity for this IP",
            entity_type="ip",
            entity="10.1.2.3",
            preferred_index="windows",
        )
    )

    assert len(clients[0].queries) == 1
    assert result["verification"]["conclusion"] == "no_match_observed"
    assert result["verification"]["confidence"] == "high"
    assert "not proof of absence" in result["verification"]["reason"]
    await service.close()


@pytest.mark.asyncio
async def test_low_confidence_refinement_uses_a_bounded_trusted_alternative():
    registry = SearchSchemaRegistry(
        [
            SearchSchema(
                name="primary",
                indexes=("primary",),
                entities={},
                keywords=("generic",),
            ),
            SearchSchema(
                name="secondary",
                indexes=("secondary",),
                entities={},
                keywords=("backup",),
            ),
        ]
    )

    class RefiningClient(PlanningClient):
        async def run_search_job(self, query, *args, **kwargs):
            self.queries.append((query, args, kwargs))
            if "index=primary" in query:
                return {"events": [{"_time": "now"}], "metadata": {"total_result_count": 1}}
            return {"events": [], "metadata": {"total_result_count": 0}}

    clients = []

    def factory(config):
        client = RefiningClient(config)
        clients.append(client)
        return client

    service = SplunkService(settings(), factory)
    service.search_service.schema_registry = registry
    service.search_service.planner = SearchPlanner(max_refinements=1)
    result = await service.search_intent(
        SearchIntent(
            objective="generic",
            event_type="backup",
        )
    )

    assert len(clients[0].queries) == 2
    assert "index=secondary" in clients[0].queries[0][0]
    assert "index=primary" in clients[0].queries[1][0]
    assert result["verification"]["refinement_count"] == 1
    assert result["verification"]["conclusion"] == "matches_observed"
    await service.close()
