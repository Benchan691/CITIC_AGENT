from __future__ import annotations

from datetime import datetime, timezone

import pytest

from unified_mcp_server.alert_ingest import AlertIngestionService
class FakeSplunk:
    def __init__(self, *, instances=None):
        self.instances = instances or [
            {
                "content": {
                    "sid": "scheduler_test_1",
                    "trigger_time": "2026-09-07T08:00:00Z",
                    "result_count": "3",
                    "severity": "high",
                    "Event_GID": "TEST-G0001",
                    "Event_Rulenum": "0101",
                    "raw_event": "must not be persisted",
                }
            }
        ]

    async def get_fired_alerts(self, *, limit):
        return {"items": [{"name": "0101_Test_Alert", "content": {"triggered_alert_count": 1}}]}

    async def get_fired_alert(self, name):
        assert name == "0101_Test_Alert"
        return self.instances

class FakeStore:
    def __init__(self, *, mapping=("customer-1", "ruleset-1"), event_exists=False):
        self.mapping = mapping
        self._event_exists = event_exists
        self.events = []
        self.quarantined = []

    def resolve(self, event_gid, event_rulenum):
        assert event_gid == "TEST-G0001"
        assert event_rulenum == "0101"
        return self.mapping

    def event_exists(self, alert):
        return self._event_exists

    def quarantine_exists(self, alert):
        return False

    def insert_event(self, alert, customer_id, ruleset_id):
        self.events.append((alert, customer_id, ruleset_id))
        return True

    def insert_quarantine(self, alert, reason):
        self.quarantined.append((alert, reason))
        return True


@pytest.mark.asyncio
async def test_valid_alert_is_inserted_with_selected_metadata_only():
    store = FakeStore()
    report = await AlertIngestionService(FakeSplunk(), store, legacy_mode=True).ingest(limit=10)

    assert report.to_dict() == {
        "found": 1,
        "inserted": 1,
        "skipped": 0,
        "quarantined": 0,
        "failed": 0,
        "would_insert": 0,
        "errors": [],
    }
    alert = store.events[0][0]
    assert alert.event_gid == "TEST-G0001"
    assert alert.event_rulenum == "0101"
    assert alert.trigger_time == datetime(2026, 9, 7, 8, 0, tzinfo=timezone.utc)
    assert "raw_event" not in alert.event_data
    assert alert.event_data["Event_GID"] == "TEST-G0001"


@pytest.mark.asyncio
async def test_duplicate_alert_is_skipped_in_dry_run():
    store = FakeStore(event_exists=True)
    report = await AlertIngestionService(FakeSplunk(), store, legacy_mode=True).ingest(limit=10, dry_run=True)

    assert report.inserted == 0
    assert report.skipped == 1
    assert report.would_insert == 0
    assert store.events == []


@pytest.mark.asyncio
async def test_unresolved_alert_is_quarantined():
    store = FakeStore(mapping=None)
    report = await AlertIngestionService(FakeSplunk(), store, legacy_mode=True).ingest(limit=10)

    assert report.quarantined == 1
    assert report.inserted == 0
    assert store.quarantined[0][1].startswith("Event_GID/Event_Rulenum")


class PagedSplunk:
    def __init__(self):
        self.catalog_offsets = []
        self.instance_offsets = []

    async def get_fired_alerts(self, *, limit, offset):
        self.catalog_offsets.append(offset)
        if offset == 0:
            return {"items": [{"name": "alert-a"}], "total": 2}
        if offset == 1:
            return {"items": [{"name": "alert-b"}], "total": 2}
        return {"items": [], "total": 2}

    async def get_fired_alert_page(self, name, *, limit, offset):
        self.instance_offsets.append((name, offset))
        if offset:
            return {"items": []}
        return {
            "items": [
                {
                    "content": {
                        "sid": f"{name}-sid",
                        "trigger_time": "2026-09-07T08:00:00Z",
                        "Event_GID": "TEST-G0001",
                        "Event_Rulenum": "0101",
                    }
                }
            ],
            "total": 1,
        }


@pytest.mark.asyncio
async def test_catalog_and_instances_are_paginated():
    store = FakeStore()
    client = PagedSplunk()
    report = await AlertIngestionService(client, store, legacy_mode=True).ingest(limit=1)

    assert report.found == 2
    assert report.inserted == 2
    assert client.catalog_offsets == [0, 1]
    assert client.instance_offsets == [("alert-a", 0), ("alert-b", 0)]


class DefinitionDiscoveryStore:
    def __init__(self):
        self.registered = []
        self.retired = []
        self.finished = []

    def sync_catalog_indexes(self, deployment):
        self.deployment = deployment
        return 0

    def start_discovery_run(self, deployment):
        self.deployment = deployment
        return "run-1"

    def register_definition(self, definition, **kwargs):
        self.registered.append((definition, kwargs))
        return {"id": f"registration-{len(self.registered)}", "status": "registered"}

    def attach_discovery_run(self, registration_id, run_id):
        assert run_id == "run-1"

    def retire_unseen_discoveries(self, deployment, before):
        self.retired.append((deployment, before))
        return 0

    def finish_discovery_run(self, run_id, **kwargs):
        self.finished.append((run_id, kwargs))


class DefinitionDiscoveryClient:
    deployment_identity = "splunk-prod"

    def __init__(self, definitions, *, complete):
        self.definitions = definitions
        self.last_saved_search_catalog_complete = complete
        self.last_saved_search_catalog_error = "catalog capped" if not complete else ""
        self.last_saved_search_catalog_page_count = 2

    async def get_saved_searches(self, *, count):
        assert count == 100_000
        return self.definitions


@pytest.mark.asyncio
async def test_definition_discovery_registers_disabled_alerts_but_not_reports():
    store = DefinitionDiscoveryStore()
    client = DefinitionDiscoveryClient([
        {"name": "disabled alert", "search": "index=main", "disabled": True,
         "alert_type": "number of events", "actions": ""},
        {"name": "ordinary report", "search": "index=main", "disabled": False,
         "cron_schedule": "0 1 * * *", "actions": "email"},
    ], complete=True)

    result = await AlertIngestionService(client, store).discover_alerts()

    assert len(result) == 1
    assert store.registered[0][0]["name"] == "disabled alert"
    assert store.registered[0][1]["action_configured"] is False
    assert len(store.retired) == 1
    assert store.finished[0][1]["status"] == "complete"


@pytest.mark.asyncio
async def test_incomplete_definition_catalog_never_marks_alerts_missing():
    store = DefinitionDiscoveryStore()
    client = DefinitionDiscoveryClient([], complete=False)

    assert await AlertIngestionService(client, store).discover_alerts() == []
    assert store.retired == []
    assert store.finished[0][1]["status"] == "incomplete"
    assert store.finished[0][1]["error"] == "catalog capped"


@pytest.mark.asyncio
async def test_malformed_definition_fails_pass_without_marking_alerts_missing():
    store = DefinitionDiscoveryStore()
    client = DefinitionDiscoveryClient(["not-an-object"], complete=True)

    with pytest.raises(RuntimeError, match="malformed saved-search definition"):
        await AlertIngestionService(client, store).discover_alerts()
    assert store.retired == []
    assert store.finished[0][1]["status"] == "failed"
