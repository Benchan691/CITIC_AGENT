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
    assert parsed.tests[0] == FilterTest("subject", "contains", "alert", "Subject", False)
    assert parsed.actions[0] == FilterAction("file_into", folder="/Inbox")

    xml = serialize_filter_rules([parsed])
    assert '<filterRule name="Inbox alerts" active="1"' in xml
    assert "actionFileInto" in xml
    assert 'header="Subject"' in xml






def test_supported_filter_tests_round_trip_semantically():
    cases = [
        *(("header", operator) for operator in ("is", "contains", "matches", "exists", "not_exists")),
        *(("subject", operator) for operator in ("is", "contains", "matches", "exists", "not_exists")),
        *(("body", operator) for operator in ("is", "contains", "matches")),
        ("attachment", "exists"),
        ("attachment", "not_exists"),
        ("size", "over"),
        ("size", "under"),
        ("date", "before"),
        ("date", "after"),
    ]
    for test_type, operator in cases:
        test = {"type": test_type, "operator": operator}
        if test_type == "header":
            test["field"] = "X-SOC-Test"
        if operator not in {"exists", "not_exists"}:
            test["value"] = "10K" if test_type == "size" else "1700000000" if test_type == "date" else "alert"
        rule = EmailFilter.from_payload({
            **valid_payload(name="Round trip", tests=[test]),
            "order": 1,
        })

        parsed = EmailFilter.from_zimbra(rule.to_zimbra(), order=1).tests[0]

        assert (parsed.type, parsed.operator, parsed.value) == (
            test_type, operator, test.get("value", ""),
        )
        if test_type == "header":
            assert parsed.field == "X-SOC-Test"








@pytest.mark.asyncio
async def test_validation_checks_supported_inputs_and_existing_folder(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(settings(allow_filter_write=False))

    result = await service.validate_email_filter(valid_payload(actions=[{"type": "file_into", "folder": "/Missing"}]))

    assert result["valid"] is False
    assert any("folder" in error["field"] for error in result["errors"])


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










@pytest.mark.asyncio
async def test_create_rewrites_unsafe_rules_and_reports_lossiness(monkeypatch):
    unsupported = ET.fromstring(
        '<filterRule name="Unsupported" active="1"><filterTests condition="allof">'
        '<addressTest header="From" value="sender@example.com"/></filterTests>'
        '<filterActions><actionKeep/></filterActions></filterRule>'
    )
    fake_zimbra(monkeypatch, rules=[rule_xml(), unsupported])
    captured = {}
    monkeypatch.setattr(
        filter_module,
        "zimbra_modify_filter_rules",
        lambda _host, _token, xml, **_options: captured.setdefault("xml", xml),
    )
    service = ZimbraFilterService(settings(allow_filter_write=True))
    current = await service.list_email_filters()

    result = await service.create_email_filter(valid_payload(name="New rule"), current["fingerprint"])

    assert result["created"] is True
    assert result["lossy"] is True
    assert result["lossy_filters"] == [{
        "name": "Unsupported",
        "unsupported": ["test element addressTest"],
    }]
    assert any("Unsupported" in warning for warning in result["warnings"])
    assert "addressTest" not in captured["xml"]
    assert "actionKeep" in captured["xml"]
    assert current["filters"][1]["round_trip_safe"] is False


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
