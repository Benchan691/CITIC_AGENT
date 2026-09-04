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
from unified_mcp_server.tests.citic_fixtures import citic_spl


CURRENT_SPL = citic_spl()
UPDATED_SPL = citic_spl("index=main critical")


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
        "detection_approval_ttl_seconds": 600,
    }
    values.update(overrides)
    return SplunkSettings(**values)


class MutableClient:
    def __init__(self, _config):
        self.exists = True
        self.writes = []
        self.content = {
            "search": CURRENT_SPL,
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
    proposal = await service.update_detection(
        "rule",
        {
            "spl": UPDATED_SPL,
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
    assert proposal["diff"]["spl"] == {"before": CURRENT_SPL, "after": UPDATED_SPL}
    assert proposal["proposal"]["after"]["actions"] == "notable,logevent"

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
                "search": UPDATED_SPL,
                "description": "reviewed",
                "is_scheduled": "1",
                "cron_schedule": "*/5 * * * *",
                "dispatch.earliest_time": "-10m",
                "dispatch.latest_time": "now",
                "disabled": "1",
                "app": "search",
                "owner": "nobody",
                "actions": "notable,logevent",
                "action.logevent": "1",
                "action.logevent.param.event": '{ Ticketnumber="$result.Fix_Ticketnumber$" TriggerTime="$result.Fix_TriggerTime$" Index="$result.Fix_Index$" SourceType="$result.Fix_Source Type$" Hostname="$result.Event_Hostname$" DateTime="$result.Event_Date Time$" }',
                "action.logevent.param.source": "$name$",
                "action.logevent.param.sourcetype": "ticket_details",
                "action.logevent.param.host": "",
                "action.logevent.param.index": "ticket_summary",
            },
        )
    ]
    with pytest.raises(ServiceError) as replay:
        await service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-a")
    assert replay.value.code == "approval_consumed"


@pytest.mark.asyncio
async def test_alert_settings_and_actions_are_proposed_hashed_and_written_disabled():
    service = SplunkService(settings(), MutableClient)
    current = await service.get_detection("rule")
    proposal = await service.update_detection(
        "rule",
        {
            "is_scheduled": True,
            "cron_schedule": "*/15 * * * *",
            "dispatch.earliest_time": "-15m",
            "dispatch.latest_time": "now",
            "alert_type": "number of events",
            "alert_comparator": "greater than",
            "alert_threshold": 0,
            "alert.digest_mode": True,
            "alert.suppress": False,
            "alert.expires": "24h",
            "alert.track": True,
            "actions": "email",
            "action.email": True,
            "action.email.to": "soc@example.invalid",
        },
        current["fingerprint"],
        actor_id="analyst-a",
    )

    assert service.core._client.writes == []
    assert proposal["actions_updated"] is True
    assert proposal["proposal"]["after"]["disabled"] is True
    for key in (
        "alert_type",
        "alert_comparator",
        "alert_threshold",
        "alert.digest_mode",
        "alert.suppress",
        "alert.expires",
        "alert.track",
        "actions",
        "action.email",
        "action.email.to",
    ):
        assert key in proposal["diff"]

    approval = await service.approve_detection_change(
        proposal["proposal_id"], proposal["proposal_hash"], actor_id="analyst-a"
    )
    result = await service.apply_approved_detection_change(
        approval["approval_id"], actor_id="analyst-a"
    )

    written = service.core._client.writes[0][2]
    assert written["alert_type"] == "number of events"
    assert written["alert_comparator"] == "greater than"
    assert written["alert_threshold"] == "0"
    assert written["alert.digest_mode"] == "1"
    assert written["alert.suppress"] == "0"
    assert written["alert.expires"] == "24h"
    assert written["alert.track"] == "1"
    assert written["actions"] == "email,logevent"
    assert written["action.email"] == "1"
    assert written["action.email.to"] == "soc@example.invalid"
    assert written["action.logevent"] == "1"
    assert written["action.logevent.param.source"] == "$name$"
    assert written["action.logevent.param.sourcetype"] == "ticket_details"
    assert written["action.logevent.param.host"] == ""
    assert written["action.logevent.param.index"] == "ticket_summary"
    assert written["disabled"] == "1"
    assert result["enabled"] is False
    assert result["actions_preserved"] is False
    assert result["actions_updated"] is True
    assert result["detection"]["action.email.to"] == "soc@example.invalid"
    assert result["detection"]["fingerprint"] != current["fingerprint"]


@pytest.mark.asyncio
async def test_secret_action_fields_are_hidden_preserved_and_rejected_from_patches():
    class SecretClient(MutableClient):
        def __init__(self, config):
            super().__init__(config)
            self.content.update({
                "action.email": "1",
                "action.email.to": "soc@example.invalid",
                "action.email.auth_password": "remote-secret",
            })

    service = SplunkService(settings(), SecretClient)
    current = await service.get_detection("rule")
    assert "action.email.auth_password" not in current
    assert "remote-secret" not in str(current)

    proposal = await service.update_detection(
        "rule", {"description": "reviewed"}, current["fingerprint"], actor_id="analyst-a"
    )
    assert "action.email.auth_password" not in str(proposal)
    assert "remote-secret" not in str(proposal)
    approval = await service.approve_detection_change(
        proposal["proposal_id"], proposal["proposal_hash"], actor_id="analyst-a"
    )
    result = await service.apply_approved_detection_change(
        approval["approval_id"], actor_id="analyst-a"
    )
    written = service.core._client.writes[0][2]
    assert all("password" not in key.lower() for key in written)
    assert service.core._client.content["action.email.auth_password"] == "remote-secret"
    assert "action.email.auth_password" not in result["detection"]

    refreshed = await service.get_detection("rule")
    with pytest.raises(ServiceError) as error:
        await service.update_detection(
            "rule",
            {"action.email.auth_password": None},
            refreshed["fingerprint"],
            actor_id="analyst-a",
        )
    assert error.value.code == "invalid_input"


@pytest.mark.asyncio
async def test_stale_fingerprint_and_wrong_actor_never_write():
    service = SplunkService(settings(), MutableClient)
    current = await service.get_detection("rule")
    proposal = await service.update_detection(
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
    proposal = await service.update_detection(
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
async def test_write_is_disabled_and_requires_exact_approval():
    class EmptyClient(MutableClient):
        def __init__(self, config):
            super().__init__(config)
            self.exists = False

    service = SplunkService(settings(), EmptyClient)
    proposal = await service.write_detection(
        {
            "name": "new-rule",
            "spl": CURRENT_SPL,
            "cron_schedule": "*/5 * * * *",
            "actions": "notable",
            "action.notable": True,
            "enabled": True,
        },
        actor_id="analyst-a",
    )
    assert proposal["operation"] == "write"
    assert proposal["proposal"]["after"]["disabled"] is True
    assert proposal["proposal"]["after"]["enabled"] is False
    assert proposal["proposal"]["after"]["actions"] == "notable,logevent"
    assert proposal["proposal"]["after"]["action.notable"] == "1"
    assert proposal["requires_action_configuration"] is False
    approval = await service.approve_detection_change(proposal["proposal_id"], actor_id="analyst-a")
    created = await service.apply_approved_detection_change(approval["approval_id"], actor_id="analyst-a")
    assert created["created"] is True
    assert created["enabled"] is False


@pytest.mark.asyncio
async def test_write_is_create_only_and_existing_target_fails_at_apply():
    service = SplunkService(settings(), MutableClient)
    proposal = await service.write_detection(
        {"name": "rule", "spl": CURRENT_SPL},
        actor_id="analyst-a",
    )
    approval = await service.approve_detection_change(
        proposal["proposal_id"], proposal["proposal_hash"], actor_id="analyst-a"
    )

    with pytest.raises(ServiceError) as error:
        await service.apply_approved_detection_change(
            approval["approval_id"], actor_id="analyst-a"
        )

    assert error.value.code == "target_mismatch"
    assert service.core._client.writes == []


@pytest.mark.parametrize("operation", ["enable", "disable"])
def test_enable_and_disable_proposals_are_rejected(operation):
    store = DetectionApprovalStore()

    with pytest.raises(ServiceError) as error:
        store.create_proposal(
            operation=operation,
            target_id="rule",
            current_fingerprint="fingerprint",
            before={"name": "rule"},
            after={"name": "rule", "disabled": True},
            created_by="analyst-a",
        )

    assert error.value.code == "proposal_payload_mismatch"


@pytest.mark.asyncio
async def test_outputcsv_proposal_is_approved_and_written_disabled_without_execution():
    class EmptyClient(MutableClient):
        def __init__(self, config):
            super().__init__(config)
            self.exists = False

    spl = CURRENT_SPL
    service = SplunkService(settings(), EmptyClient)
    proposal = await service.write_detection(
        {
            "name": "client-csv-rule",
            "spl": spl,
            "is_scheduled": True,
            "cron_schedule": "*/15 * * * *",
            "dispatch.earliest_time": "-15m",
            "dispatch.latest_time": "now",
            "alert.track": True,
            "actions": "logevent",
            "action.logevent": True,
        },
        actor_id="analyst-a",
    )

    assert proposal["status"] == "approval_required"
    assert proposal["enabled"] is False
    assert any("outputcsv" in warning for warning in proposal["validation_warnings"])
    assert service.core._client is None

    approval = await service.approve_detection_change(
        proposal["proposal_id"], proposal["proposal_hash"], actor_id="analyst-a"
    )
    result = await service.apply_approved_detection_change(
        approval["approval_id"], actor_id="analyst-a"
    )

    assert result["created"] is True
    assert result["enabled"] is False
    assert service.core._client.writes[0][1]["search"] == spl
    assert service.core._client.writes[0][1]["disabled"] == "1"


@pytest.mark.asyncio
async def test_update_of_enabled_detection_is_forced_disabled():
    service = SplunkService(settings(), MutableClient)
    await service.get_detection("rule")
    client = service.core._client
    client.content["disabled"] = "0"
    current = await service.get_detection("rule")

    proposal = await service.update_detection(
        "rule", {"description": "updated while enabled"}, current["fingerprint"], actor_id="analyst-a"
    )
    assert proposal["proposal"]["after"]["disabled"] is True
    approval = await service.approve_detection_change(
        proposal["proposal_id"], proposal["proposal_hash"], actor_id="analyst-a"
    )
    result = await service.apply_approved_detection_change(
        approval["approval_id"], actor_id="analyst-a"
    )

    assert result["enabled"] is False
    assert client.writes[-1][2]["disabled"] == "1"


@pytest.mark.asyncio
async def test_concurrent_apply_and_cancellation_cannot_replay_one_approval():
    service = SplunkService(settings(), MutableClient)
    current = await service.get_detection("rule")
    proposal = await service.update_detection(
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
    proposal = await cancelled_service.update_detection(
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
