import xml.etree.ElementTree as ET

import pytest

import unified_mcp_server.zimbra.zimbra as zimbra
import unified_mcp_server.zimbra.filters.service as filter_module
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.zimbra.filters.model import EmailFilter, FilterAction, FilterTest, serialize_filter_rules
from unified_mcp_server.zimbra.filters.service import ZimbraFilterService


def settings(**overrides):
    values = {
        "host": "mail.example.com",
        "email": "analyst@example.com",
        "password": "secret",
        "verify_ssl": True,
        "timeout": 60,
        "allow_send": False,
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


def test_parse_and_serialize_zimbra_filter_rules():
    parsed = EmailFilter.from_zimbra(rule_xml(), order=1)

    assert parsed.name == "Inbox alerts"
    assert parsed.tests[0] == FilterTest("header", "contains", "alert", "Subject", False)
    assert parsed.actions[0] == FilterAction("file_into", folder="/Inbox")

    xml = serialize_filter_rules([parsed])
    assert '<filterRule name="Inbox alerts" active="1"' in xml
    assert "actionFileInto" in xml
    assert 'header="Subject"' in xml


def test_parse_canonical_zimbra_filter_elements():
    element = ET.fromstring(
        '<filterRule name="Canonical" active="0">'
        '<filterTests condition="anyof"><headerExistsTest header="X-Alert"/>'
        '<sizeTest numberComparison="over" s="50K"/></filterTests>'
        '<filterActions><actionTag tagName="review"/><actionRedirect a="ops@example.com"/></filterActions>'
        '</filterRule>'
    )

    parsed = EmailFilter.from_zimbra(element, order=2)

    assert parsed.enabled is False
    assert parsed.condition == "anyof"
    assert parsed.tests[0].operator == "exists"
    assert parsed.tests[1].value == "50K"
    assert parsed.actions[0].tag == "review"
    assert parsed.actions[1].address == "ops@example.com"


def test_modify_filter_rules_uses_the_expected_soap_request(monkeypatch):
    captured = {}
    monkeypatch.setattr(zimbra, "soap_request", lambda host, body, token, **kwargs: captured.update(host=host, body=body, token=token, kwargs=kwargs))

    zimbra.zimbra_modify_filter_rules("mail.example.com", "token", serialize_filter_rules([EmailFilter.from_zimbra(rule_xml(), order=1)]))

    assert captured["token"] == "token"
    assert "ModifyFilterRulesRequest" in captured["body"]
    assert "Inbox alerts" in captured["body"]
    assert "secret" not in captured["body"]


def test_malformed_filter_response_is_rejected(monkeypatch):
    monkeypatch.setattr(zimbra, "soap_request", lambda *args, **kwargs: ET.fromstring("<GetFilterRulesResponse><unexpected/></GetFilterRulesResponse>"))

    with pytest.raises(ValueError, match="Malformed"):
        zimbra.zimbra_get_filter_rules("mail.example.com", "token")


@pytest.mark.asyncio
async def test_validation_checks_supported_inputs_and_existing_folder(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(settings())

    result = await service.validate_email_filter(valid_payload(actions=[{"type": "file_into", "folder": "/Missing"}]))

    assert result["valid"] is False
    assert any("folder" in error["field"] for error in result["errors"])


@pytest.mark.asyncio
async def test_preview_reports_changed_fields_position_fingerprint_and_gate_state(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(settings())

    result = await service.preview_email_filter_update("Inbox alerts", {"enabled": False, "order": 1})

    assert result["current_rule"]["enabled"] is True
    assert result["proposed_rule"]["enabled"] is False
    assert result["changed_fields"] == ["enabled"]
    assert result["resulting_rule_position"] == 1
    assert len(result["current_fingerprint"]) == 64
    assert result["valid"] is True
    assert result["server_allowed"] is False
    assert "filter_write" in result["gate_violations"]


@pytest.mark.asyncio
async def test_writes_are_disabled_but_validation_works(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(settings())

    validation = await service.validate_email_filter(valid_payload(name="New rule"))
    assert validation["valid"] is True

    with pytest.raises(ServiceError) as error:
        await service.create_email_filter(valid_payload(name="New rule"), validation["fingerprint"])
    assert error.value.code == "operation_disabled"


@pytest.mark.asyncio
async def test_redirect_and_discard_require_separate_gates(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(settings())

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


@pytest.mark.asyncio
async def test_enable_disable_and_ordering_use_complete_ordered_set(monkeypatch):
    rules = [rule_xml("First"), rule_xml("Second", active="0")]
    fake_zimbra(monkeypatch, rules=rules)
    service = ZimbraFilterService(settings(allow_filter_write=True))
    captured = {}

    async def fake_write(account, proposed, expected):
        captured["rules"] = proposed
        return service._fingerprint(proposed)

    monkeypatch.setattr(service, "_write_rules", fake_write)
    fingerprint = service._fingerprint([EmailFilter.from_zimbra(item, order=i) for i, item in enumerate(rules, 1)])

    enabled = await service.set_email_filter_enabled("Second", True, fingerprint)
    assert enabled["filter"]["enabled"] is True
    await service.reorder_email_filter("Second", 1, fingerprint)
    assert [item.name for item in captured["rules"]] == ["Second", "First"]


@pytest.mark.asyncio
async def test_multi_account_selection_uses_selected_credentials(monkeypatch, tmp_path):
    captured = []
    store = AccountStore(str(tmp_path / "accounts.enc"), str(tmp_path / "accounts.key"))
    store.add(label="One", email="one@example.com", username="one-user", password="one-secret")
    second = store.add(label="Two", email="two@example.com", username="two-user", password="two-secret")
    monkeypatch.setattr(filter_module, "zimbra_login", lambda cfg: captured.append(cfg) or "token")
    monkeypatch.setattr(filter_module, "zimbra_get_filter_rules", lambda *args, **kwargs: [rule_xml()])
    service = ZimbraFilterService(settings(email="", password=""), store)

    await service.list_email_filters(second.id)

    assert captured[0]["zimbra_email"] == "two@example.com"
    assert captured[0]["zimbra_username"] == "two-user"
    assert captured[0]["zimbra_password"] == "two-secret"
