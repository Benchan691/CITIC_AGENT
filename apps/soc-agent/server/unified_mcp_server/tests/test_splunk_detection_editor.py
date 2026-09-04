import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
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
async def test_write_and_update_return_editable_drafts_without_writing():
    service = SplunkService(settings(detection_write_enabled=False), MutableClient)

    created = await service.write_detection({"name": "new-rule", "spl": CURRENT_SPL})
    assert created["status"] == "draft"
    assert created["operation"] == "write"
    assert created["draft"]["name"] == "new-rule"
    assert created["draft"]["disabled"] is True
    assert created["draft"]["enabled"] is False
    for field in (
        "is_scheduled", "cron_schedule", "dispatch.earliest_time", "dispatch.latest_time",
        "dispatch.rt_backfill", "dispatch.indexedRealtime", "alert_type", "alert_comparator",
        "alert_threshold", "alert_condition", "alert.digest_mode", "alert.suppress",
        "alert.suppress.period", "alert.suppress.fields", "alert.suppress.group_name",
        "alert.expires", "alert.track", "actions",
    ):
        assert field in created["draft"]
    assert created["save_requires_explicit_action"] is True
    assert service.core._client is None

    current = await service.get_detection("rule")
    updated = await service.update_detection(
        "rule", {"spl": UPDATED_SPL, "description": "reviewed"}, current["fingerprint"], actor_id="analyst-a"
    )
    assert updated["status"] == "draft"
    assert updated["operation"] == "update"
    assert updated["expected_fingerprint"] == current["fingerprint"]
    assert updated["draft"]["spl"] == UPDATED_SPL
    assert updated["draft"]["actions"] == "notable,logevent"
    assert service.core._client.writes == []


@pytest.mark.asyncio
async def test_save_create_is_explicit_scoped_and_disabled():
    class EmptyClient(MutableClient):
        def __init__(self, config):
            super().__init__(config)
            self.exists = False

    service = SplunkService(settings(), EmptyClient)
    draft = await service.write_detection({
        "name": "new-rule",
        "spl": CURRENT_SPL,
        "cron_schedule": "*/5 * * * *",
        "actions": "notable",
        "action.notable": True,
    })
    result = await service.save_detection(
        "write", draft["draft"], name="new-rule", actor_id="analyst-a"
    )

    assert result["status"] == "saved"
    assert result["saved"] is True
    assert result["created"] is True
    assert result["enabled"] is False
    written = service.core._client.writes[0][1]
    assert written["disabled"] == "1"
    assert written["app"] == "search"
    assert written["owner"] == "nobody"
    assert written["actions"] == "notable,logevent"
    assert written["action.notable"] == "1"


@pytest.mark.asyncio
async def test_save_update_persists_complete_alert_settings_and_stays_disabled():
    service = SplunkService(settings(), MutableClient)
    current = await service.get_detection("rule")
    draft = await service.update_detection(
        "rule",
        {
            "spl": UPDATED_SPL,
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
    )
    result = await service.save_detection(
        "update",
        draft["draft"],
        name="rule",
        expected_fingerprint=draft["expected_fingerprint"],
        actor_id="analyst-a",
    )

    written = service.core._client.writes[0][2]
    assert result["updated"] is True
    assert written["search"] == UPDATED_SPL
    assert written["alert_type"] == "number of events"
    assert written["alert_comparator"] == "greater than"
    assert written["alert_threshold"] == "0"
    assert written["alert.digest_mode"] == "1"
    assert written["alert.suppress"] == "0"
    assert written["alert.expires"] == "24h"
    assert written["alert.track"] == "1"
    assert written["action.email"] == "1"
    assert written["action.email.to"] == "soc@example.invalid"
    assert written["action.logevent"] == "1"
    assert written["disabled"] == "1"
    assert result["enabled"] is False


@pytest.mark.asyncio
async def test_save_rejects_disabled_gate_enablement_existing_target_and_stale_update():
    disabled = SplunkService(settings(detection_write_enabled=False), MutableClient)
    draft = await disabled.write_detection({"name": "new-rule", "spl": CURRENT_SPL})
    with pytest.raises(ServiceError) as gate:
        await disabled.save_detection("write", draft["draft"], actor_id="analyst-a")
    assert gate.value.code == "operation_disabled"

    service = SplunkService(settings(), MutableClient)
    existing = await service.write_detection({"name": "rule", "spl": CURRENT_SPL})
    with pytest.raises(ServiceError) as target:
        await service.save_detection("write", existing["draft"], actor_id="analyst-a")
    assert target.value.code == "target_mismatch"
    assert service.core._client.writes == []

    with pytest.raises(ServiceError) as invalid:
        await service.save_detection(
            "write",
            {"name": "invalid", "spl": CURRENT_SPL, "alert_type": "number of events"},
            actor_id="analyst-a",
        )
    assert invalid.value.code == "detection_invalid"
    assert service.core._client.writes == []

    current = await service.get_detection("rule")
    update = await service.update_detection("rule", {"description": "new"}, current["fingerprint"])
    service.core._client.content["description"] = "changed outside editor"
    with pytest.raises(ServiceError) as stale:
        await service.save_detection(
            "update",
            update["draft"],
            name="rule",
            expected_fingerprint=update["expected_fingerprint"],
            actor_id="analyst-a",
        )
    assert stale.value.code == "detection_changed"
    assert service.core._client.writes == []


@pytest.mark.asyncio
async def test_save_requires_authenticated_actor_and_rejects_enablement():
    service = SplunkService(settings(), MutableClient)
    draft = await service.write_detection({"name": "new-rule", "spl": CURRENT_SPL})

    with pytest.raises(ServiceError) as unauthorized:
        await service.save_detection("write", draft["draft"])
    assert unauthorized.value.code == "not_authorized"

    with pytest.raises(ServiceError) as enabled:
        await service.save_detection(
            "write", {"name": "new-rule", "spl": CURRENT_SPL, "enabled": True}, actor_id="analyst-a"
        )
    assert enabled.value.code == "invalid_input"


@pytest.mark.asyncio
async def test_secret_action_fields_are_hidden_preserved_and_rejected():
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
    draft = await service.update_detection("rule", {"description": "reviewed"}, current["fingerprint"])
    assert "auth_password" not in str(draft)
    result = await service.save_detection(
        "update",
        draft["draft"],
        name="rule",
        expected_fingerprint=draft["expected_fingerprint"],
        actor_id="analyst-a",
    )
    assert service.core._client.content["action.email.auth_password"] == "remote-secret"
    assert "action.email.auth_password" not in result["detection"]

    refreshed = await service.get_detection("rule")
    with pytest.raises(ServiceError) as error:
        await service.save_detection(
            "update",
            {"description": "bad", "action.email.auth_password": "secret"},
            name="rule",
            expected_fingerprint=refreshed["fingerprint"],
            actor_id="analyst-a",
        )
    assert error.value.code == "invalid_input"


@pytest.mark.asyncio
async def test_outputcsv_draft_is_saveable_without_execution():
    class EmptyClient(MutableClient):
        def __init__(self, config):
            super().__init__(config)
            self.exists = False

    service = SplunkService(settings(), EmptyClient)
    draft = await service.write_detection({
        "name": "client-csv-rule",
        "spl": CURRENT_SPL,
        "is_scheduled": True,
        "cron_schedule": "*/15 * * * *",
        "actions": "logevent",
        "action.logevent": True,
    })
    assert any("outputcsv" in warning for warning in draft["validation_warnings"])
    assert service.core._client is None
    result = await service.save_detection("write", draft["draft"], actor_id="analyst-a")
    assert result["created"] is True
    assert service.core._client.writes[0][1]["search"] == CURRENT_SPL
    assert service.core._client.writes[0][1]["disabled"] == "1"
