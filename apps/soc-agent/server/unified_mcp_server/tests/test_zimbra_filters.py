import xml.etree.ElementTree as ET

import pytest

import unified_mcp_server.zimbra.filters.service as filter_module
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.zimbra.filters.model import EmailFilter
from unified_mcp_server.zimbra.filters.service import ZimbraFilterService


def settings(**overrides):
    values = {
        "host": "mail.example.com",
        "email": "analyst@example.com",
        "password": "secret",
        "verify_ssl": True,
        "timeout": 60,
    }
    values.update(overrides)
    return ZimbraSettings(**values)


def rule_xml(name="Inbox alerts", active="1"):
    return ET.fromstring(
        f'''<filterrule name="{name}" active="{active}">
          <filtertests condition="allof">
            <filtertest name="header" index="0" header="Subject" stringComparison="contains" value="alert"/>
          </filtertests>
          <filteractions><filteraction name="fileinto" index="0" folder="/Inbox"/></filteractions>
        </filterrule>'''
    )


def fake_zimbra(monkeypatch, rules=None, folders=None):
    rules = rules if rules is not None else [rule_xml()]
    monkeypatch.setattr(filter_module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(filter_module, "zimbra_get_filter_rules", lambda *args, **kwargs: rules)
    monkeypatch.setattr(filter_module, "zimbra_list_folders", lambda *args, **kwargs: folders or [{"id": "2", "name": "Inbox", "path": "/Inbox"}])


def valid_payload(**overrides):
    payload = {
        "name": "Inbox alerts",
        "enabled": True,
        "condition": "allof",
        "tests": [{"type": "header", "field": "Subject", "operator": "contains", "value": "alert"}],
        "actions": [{"type": "file_into", "folder": "/Inbox"}],
    }
    payload.update(overrides)
    return payload


















@pytest.mark.asyncio
async def test_preview_reports_changed_fields_position_fingerprint_gate_and_lossiness(monkeypatch):
    unsupported = ET.fromstring(
        '<filterRule name="Unsupported" active="1"><filterTests condition="allof">'
        '<addressTest header="From" value="sender@example.com"/></filterTests>'
        '<filterActions><actionKeep/></filterActions></filterRule>'
    )
    fake_zimbra(monkeypatch, rules=[rule_xml(), unsupported])
    service = ZimbraFilterService(settings(allow_filter_write=False))

    result = await service.preview_email_filter_update("Inbox alerts", {"enabled": False, "order": 1})

    assert result["current_rule"]["enabled"] is True
    assert result["proposed_rule"]["enabled"] is False
    assert result["changed_fields"] == ["enabled"]
    assert result["resulting_rule_position"] == 1
    assert len(result["current_fingerprint"]) == 64
    assert result["valid"] is True
    assert result["server_allowed"] is False
    assert "filter_write" in result["gate_violations"]
    assert result["lossy"] is True
    assert result["lossy_filters"] == [{
        "name": "Unsupported",
        "unsupported": ["test element addressTest"],
    }]
    assert any("Unsupported" in warning for warning in result["warnings"])


@pytest.mark.asyncio
async def test_writes_are_disabled_but_validation_works(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(settings(allow_filter_write=False))

    validation = await service.validate_email_filter(valid_payload(name="New rule"))
    assert validation["valid"] is True

    with pytest.raises(ServiceError) as error:
        await service.create_email_filter(valid_payload(name="New rule"), validation["fingerprint"])
    assert error.value.code == "operation_disabled"


@pytest.mark.asyncio
async def test_redirect_and_discard_require_separate_gates(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(
        settings(allow_filter_write=False, allow_filter_redirect=False, allow_filter_discard=False)
    )

    redirect = await service.validate_email_filter(valid_payload(name="Redirect", actions=[{"type": "redirect", "address": "ops@example.com"}]))
    discard = await service.validate_email_filter(valid_payload(name="Discard", actions=[{"type": "discard"}]))

    assert redirect["valid"] is True
    assert redirect["server_allowed"] is False
    assert "redirect" in redirect["gate_violations"]
    assert discard["server_allowed"] is False
    assert "discard" in discard["gate_violations"]


@pytest.mark.asyncio
async def test_concurrent_modification_is_rejected(monkeypatch):
    initial = [rule_xml()]
    changed = [rule_xml(name="Changed by someone else")]
    sequence = iter([initial, changed])
    monkeypatch.setattr(filter_module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(filter_module, "zimbra_get_filter_rules", lambda *args, **kwargs: next(sequence))
    monkeypatch.setattr(filter_module, "zimbra_list_folders", lambda *args, **kwargs: [{"id": "2", "name": "Inbox", "path": "/Inbox"}])
    service = ZimbraFilterService(settings(allow_filter_write=True))
    fingerprint = service._fingerprint([EmailFilter.from_zimbra(initial[0], order=1)])

    with pytest.raises(ServiceError) as error:
        await service.update_email_filter("Inbox alerts", {"enabled": False}, fingerprint)
    assert error.value.code == "filter_rules_changed"
