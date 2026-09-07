from __future__ import annotations

from datetime import datetime, timezone

import pytest

from unified_mcp_server.alert_ingest import AlertIngestionService
from unified_mcp_server.splunk.splunk_client import SplunkAPIError


class FakeSplunk:
    def __init__(self, *, rows=None, instances=None):
        self.rows = rows or [{"Event_GID": "TEST-G0001", "Event_Rulenum": "0101"}]
        self.instances = instances or [
            {
                "content": {
                    "sid": "scheduler_test_1",
                    "trigger_time": "2026-09-07T08:00:00Z",
                    "result_count": "3",
                    "severity": "high",
                    "raw_event": "must not be persisted",
                }
            }
        ]

    async def get_fired_alerts(self, *, limit):
        return {"items": [{"name": "0101_Test_Alert", "content": {"triggered_alert_count": 1}}]}

    async def get_fired_alert(self, name):
        assert name == "0101_Test_Alert"
        return self.instances

    async def get_job_result_fields(self, sid, fields, *, max_count):
        assert sid == "scheduler_test_1"
        assert fields == ("Event_GID", "Event_Rulenum")
        assert max_count == 10
        return self.rows


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
    report = await AlertIngestionService(FakeSplunk(), store).ingest(limit=10)

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
    report = await AlertIngestionService(FakeSplunk(), store).ingest(limit=10, dry_run=True)

    assert report.inserted == 0
    assert report.skipped == 1
    assert report.would_insert == 0
    assert store.events == []


@pytest.mark.asyncio
async def test_unresolved_alert_is_quarantined():
    store = FakeStore(mapping=None)
    report = await AlertIngestionService(FakeSplunk(), store).ingest(limit=10)

    assert report.quarantined == 1
    assert report.inserted == 0
    assert store.quarantined[0][1].startswith("Event_GID/Event_Rulenum")


@pytest.mark.asyncio
async def test_multiple_mapping_pairs_are_quarantined():
    store = FakeStore()
    client = FakeSplunk(
        rows=[
            {"Event_GID": "TEST-G0001", "Event_Rulenum": "0101"},
            {"Event_GID": "TEST-G0002", "Event_Rulenum": "0102"},
        ]
    )

    report = await AlertIngestionService(client, store).ingest(limit=10)

    assert report.quarantined == 1
    assert report.inserted == 0
    assert store.events == []


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
    report = await AlertIngestionService(client, store).ingest(limit=1)

    assert report.found == 2
    assert report.inserted == 2
    assert client.catalog_offsets == [0, 1]
    assert client.instance_offsets == [("alert-a", 0), ("alert-b", 0)]


class TransientSidSplunk(FakeSplunk):
    async def get_job_result_fields(self, sid, fields, *, max_count):
        raise SplunkAPIError("temporary outage")


@pytest.mark.asyncio
async def test_transient_sid_failure_is_retried_instead_of_quarantined():
    store = FakeStore()
    report = await AlertIngestionService(TransientSidSplunk(), store).ingest(limit=10)

    assert report.failed == 1
    assert report.retryable is True
    assert report.quarantined == 0
    assert store.quarantined == []
