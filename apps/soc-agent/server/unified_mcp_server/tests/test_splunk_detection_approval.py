import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.detection.approval import (
    DetectionApprovalStore,
    compute_proposal_hash,
)
from unified_mcp_server.splunk.splunk_client import SplunkAPIError
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
        "detection_write_enabled": True,
        "detection_enable_enabled": True,
        "detection_approval_ttl_seconds": 600,
    }
    values.update(overrides)
    return SplunkSettings(**values)


class MutableClient:
    def __init__(self, _config):
        self.exists = True
        self.writes = []
        self.content = {
            "search": "index=main error",
            "description": "old",
            "dispatch.earliest_time": "-10m",
            "dispatch.latest_time": "now",
            "cron_schedule": "*/5 * * * *",
            "is_scheduled": "1",
            "disabled": "1",
            "actions": "notable",
        }
        self.acl = {"app": "search", "owner": "nobody", "sharing": "app"}

    async def connect(self):
        pass

    async def disconnect(self):
        pass

    async def get_saved_search(self, name, app="", owner=""):
        if not self.exists:
            raise SplunkAPIError("not found", status_code=404)
        return {"name": name, "content": dict(self.content), "acl": dict(self.acl)}

    async def create_saved_search(self, fields):
        self.writes.append(("create", dict(fields)))
        self.exists = True
        self.content = {key: value for key, value in fields.items() if key not in {"name", "app", "owner"}}
        self.acl.update({"app": fields["app"], "owner": fields["owner"]})
        return {}

    async def update_saved_search(self, name, fields):
        self.writes.append(("update", name, dict(fields)))
        self.content.update({key: value for key, value in fields.items() if key not in {"app", "owner"}})
        return {}


@pytest.mark.asyncio
async def test_update_is_only_a_proposal_until_exact_approval_and_apply():
    service = SplunkService(settings(), MutableClient)
    current = await service.get_detection("rule")
    proposal = await service.update_detection_draft(
        "rule",
        {
            "spl": "index=main critical",
            "description": "reviewed",
            "severity": "high",
            "mitre_attack": ["T1059.001"],
            "risk_score": 80,
            "risk_objects": ["user"],
            "suppression_window": "10m",
        },
        current["fingerprint"],
        actor_id="analyst-a",
    )
    client = service.core._client
    assert client.writes == []
    assert proposal["status"] == "approval_required"
    assert proposal["diff"]["spl"] == {"before": "index=main error", "after": "index=main critical"}
    assert proposal["proposal"]["after"]["actions"] == "notable"

    with pytest.raises(ServiceError) as mismatch:
        await service.approve_detection_change(
            proposal["proposal_id"], "not-the-stored-hash", actor_id="analyst-a"
        )
    assert mismatch.value.code == "proposal_hash_mismatch"

    approval = await service.approve_detection_change(
        proposal["proposal_id"], proposal["proposal_hash"], actor_id="analyst-a"
    )
    with pytest.raises(ServiceError) as wrong_target:
        await service.apply_approved_detection_change(
            approval["approval_id"], target_id="other-rule", actor_id="analyst-a"
        )
    assert wrong_target.value.code == "target_mismatch"
    assert client.writes == []

    result = await service.apply_approved_detection_change(
        approval["approval_id"], actor_id="analyst-a"
    )
    assert result["status"] == "applied"
    assert client.writes == [
        (
            "update",
            "rule",
            {
                "name": "rule",
                "search": "index=main critical",
                "description": "reviewed",
                "is_scheduled": "1",
                "cron_schedule": "*/5 * * * *",
                "dispatch.earliest_time": "-10m",
                "dispatch.latest_time": "now",
                "disabled": "1",
                "app": "search",
                "owner": "nobody",
            },
        )
    ]
    with pytest.raises(ServiceError) as replay:
        await service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-a")
    assert replay.value.code == "approval_consumed"


@pytest.mark.asyncio
async def test_stale_fingerprint_and_wrong_actor_never_write():
    service = SplunkService(settings(), MutableClient)
    current = await service.get_detection("rule")
    proposal = await service.update_detection_draft(
        "rule", {"description": "new"}, current["fingerprint"], actor_id="analyst-a"
    )
    approval = await service.approve_detection_change(
        proposal["proposal_id"], actor_id="analyst-a"
    )
    with pytest.raises(ServiceError) as unauthorized:
        await service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-b")
    assert unauthorized.value.code == "not_authorized"
    assert service.core._client.writes == []

    service.core._client.content["description"] = "changed outside proposal"
    with pytest.raises(ServiceError) as stale:
        await service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-a")
    assert stale.value.code == "stale_fingerprint"
    assert service.core._client.writes == []


def test_proposal_hash_is_deterministic_and_does_not_include_runtime_metadata():
    left = {
        "operation": "update",
        "target_id": "rule",
        "current_fingerprint": "abc",
        "before": {"spl": "index=main"},
        "after": {"spl": "index=security"},
    }
    right = {
        "after": {"spl": "index=security"},
        "before": {"spl": "index=main"},
        "current_fingerprint": "abc",
        "target_id": "rule",
        "operation": "update",
    }
    assert compute_proposal_hash(left) == compute_proposal_hash(right)


@pytest.mark.asyncio
async def test_expired_approval_and_missing_approval_are_rejected():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    clock = lambda: now
    store = DetectionApprovalStore(ttl_seconds=60, clock=clock)
    service = SplunkService(settings(), MutableClient, approval_store=store)
    current = await service.get_detection("rule")
    proposal = await service.update_detection_draft(
        "rule", {"description": "expires"}, current["fingerprint"], actor_id="analyst-a"
    )
    now = now + timedelta(seconds=61)
    with pytest.raises(ServiceError) as expired:
        await service.approve_detection_change(proposal["proposal_id"], actor_id="analyst-a")
    assert expired.value.code == "approval_expired"
    with pytest.raises(ServiceError) as missing:
        await service.apply_approved_detection_change("dca_missing", actor_id="analyst-a")
    assert missing.value.code == "approval_not_found"


@pytest.mark.asyncio
async def test_create_is_disabled_and_enable_requires_a_separate_approval():
    class EmptyClient(MutableClient):
        def __init__(self, config):
            super().__init__(config)
            self.exists = False

    service = SplunkService(settings(), EmptyClient)
    proposal = await service.create_detection_draft(
        {"name": "new-rule", "spl": "index=main error", "cron_schedule": "*/5 * * * *"},
        actor_id="analyst-a",
    )
    assert proposal["operation"] == "create"
    assert proposal["proposal"]["after"]["disabled"] is True
    approval = await service.approve_detection_change(proposal["proposal_id"], actor_id="analyst-a")
    created = await service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-a")
    assert created["created"] is True
    assert created["enabled"] is False

    client = service.core._client
    client.content["actions"] = "notable"
    current = await service.get_detection("new-rule")
    enable_proposal = await service.set_detection_enabled(
        "new-rule", True, current["fingerprint"], actor_id="analyst-a"
    )
    assert enable_proposal["operation"] == "enable"
    enable_approval = await service.approve_detection_change(
        enable_proposal["proposal_id"], actor_id="analyst-a"
    )
    enabled = await service.apply_approved_detection_change(
        enable_approval["approval_id"], actor_id="analyst-a"
    )
    assert enabled["enabled"] is True


@pytest.mark.asyncio
async def test_concurrent_apply_and_cancellation_cannot_replay_one_approval():
    service = SplunkService(settings(), MutableClient)
    current = await service.get_detection("rule")
    proposal = await service.update_detection_draft(
        "rule", {"description": "once"}, current["fingerprint"], actor_id="analyst-a"
    )
    approval = await service.approve_detection_change(proposal["proposal_id"], actor_id="analyst-a")
    outcomes = await asyncio.gather(
        service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-a"),
        service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-a"),
        return_exceptions=True,
    )
    assert sum(isinstance(outcome, dict) and outcome.get("status") == "applied" for outcome in outcomes) == 1
    errors = [outcome for outcome in outcomes if isinstance(outcome, ServiceError)]
    assert len(errors) == 1
    assert errors[0].code == "approval_consumed"
    assert len(service.core._client.writes) == 1

    class BlockingClient(MutableClient):
        def __init__(self, config):
            super().__init__(config)
            self.started = asyncio.Event()
            self.release = asyncio.Event()

        async def update_saved_search(self, name, fields):
            self.started.set()
            await self.release.wait()
            return await super().update_saved_search(name, fields)

    cancelled_service = SplunkService(settings(), BlockingClient)
    current = await cancelled_service.get_detection("rule")
    proposal = await cancelled_service.update_detection_draft(
        "rule", {"description": "cancelled"}, current["fingerprint"], actor_id="analyst-a"
    )
    approval = await cancelled_service.approve_detection_change(proposal["proposal_id"], actor_id="analyst-a")
    task = asyncio.create_task(
        cancelled_service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-a")
    )
    await asyncio.wait_for(cancelled_service.core._client.started.wait(), timeout=1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert cancelled_service.core._client.writes == []
    assert cancelled_service.detection_service.approval_store.get_approval(approval["approval_id"]).consumed is True
