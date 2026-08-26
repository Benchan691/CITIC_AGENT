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


def test_unsupported_existing_filter_serializes_as_supported_subset():
    element = ET.fromstring(
        '<filterRule name="Unsupported" active="1" custom="drop">'
        '<filterTests condition="allof">'
        '<addressTest header="From" value="sender@example.com"/>'
        '<filtertest name="mystery" index="1"/>'
        '<headerTest header="Subject" stringComparison="unknown" value="alert"/>'
        '</filterTests>'
        '<filterActions><filteraction name="mystery"/><actionKeep/></filterActions>'
        '</filterRule>'
    )

    parsed = EmailFilter.from_zimbra(element, order=1)
    xml = serialize_filter_rules([parsed])

    assert parsed.round_trip_safe is False
    assert "test element addressTest" in parsed.unsupported
    assert "filtertest type mystery" in parsed.unsupported
    assert "filter test subject/unknown" in parsed.unsupported
    assert "filteraction type mystery" in parsed.unsupported
    assert "addressTest" not in xml
    assert "mystery" not in xml
    assert 'stringComparison="unknown"' not in xml
    assert "actionKeep" in xml


@pytest.mark.parametrize(
    ("test_type", "operator"),
    [
        *(('header', operator) for operator in ('is', 'contains', 'matches', 'exists', 'not_exists')),
        *(('subject', operator) for operator in ('is', 'contains', 'matches', 'exists', 'not_exists')),
        *(('body', operator) for operator in ('is', 'contains', 'matches')),
        ('attachment', 'exists'), ('attachment', 'not_exists'),
        ('size', 'over'), ('size', 'under'),
        ('date', 'before'), ('date', 'after'),
    ],
)
def test_supported_filter_tests_round_trip_semantically(test_type, operator):
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


def test_filter_response_is_parsed_inside_soap_envelope(monkeypatch):
    xml = f'''<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
      <soap:Body><GetFilterRulesResponse xmlns="urn:zimbraMail">
        <filterRules>{ET.tostring(rule_xml(), encoding="unicode")}</filterRules>
      </GetFilterRulesResponse></soap:Body>
    </soap:Envelope>'''
    monkeypatch.setattr(zimbra, "soap_request", lambda *args, **kwargs: ET.fromstring(xml))

    rules = zimbra.zimbra_get_filter_rules("mail.example.com", "token")

    assert len(rules) == 1
    assert rules[0].get("name") == "Inbox alerts"


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
async def test_delete_removes_rule_and_renumbers_remaining_rules(monkeypatch):
    rules = [rule_xml("First"), rule_xml("Second"), rule_xml("Third")]
    fake_zimbra(monkeypatch, rules=rules)
    service = ZimbraFilterService(settings(allow_filter_write=True))
    captured = {}

    async def fake_write(account, proposed, expected):
        captured["account"] = account
        captured["rules"] = proposed
        captured["expected"] = expected
        return service._fingerprint(proposed)

    monkeypatch.setattr(service, "_write_rules", fake_write)
    current = [EmailFilter.from_zimbra(item, order=index) for index, item in enumerate(rules, 1)]
    expected = service._fingerprint(current)

    result = await service.delete_email_filter("Second", expected)

    assert result["deleted"] is True
    assert result["filter"]["name"] == "Second"
    assert [item.name for item in captured["rules"]] == ["First", "Third"]
    assert [item.order for item in captured["rules"]] == [1, 2]
    assert captured["expected"] == expected


@pytest.mark.asyncio
async def test_delete_final_rule_writes_empty_rule_set(monkeypatch):
    rules = [rule_xml()]
    fake_zimbra(monkeypatch, rules=rules)
    service = ZimbraFilterService(settings(allow_filter_write=True))
    captured = {}
    monkeypatch.setattr(
        filter_module,
        "zimbra_modify_filter_rules",
        lambda _host, _token, xml, **_options: captured.setdefault("xml", xml),
    )
    current = [EmailFilter.from_zimbra(rules[0], order=1)]

    result = await service.delete_email_filter("Inbox alerts", service._fingerprint(current))

    assert result["deleted"] is True
    assert captured["xml"] == "<filterRules />"


@pytest.mark.asyncio
async def test_delete_rejects_invalid_missing_and_disabled_requests(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(settings(allow_filter_write=True))

    with pytest.raises(ServiceError) as error:
        await service.delete_email_filter("", "fingerprint")
    assert error.value.code == "invalid_input"

    with pytest.raises(ServiceError) as error:
        await service.delete_email_filter("Inbox alerts", "")
    assert error.value.code == "expected_fingerprint_required"

    current = await service.list_email_filters()
    with pytest.raises(ServiceError) as error:
        await service.delete_email_filter("Missing", current["fingerprint"])
    assert error.value.code == "not_found"

    disabled = ZimbraFilterService(settings(allow_filter_write=False))
    with pytest.raises(ServiceError) as error:
        await disabled.delete_email_filter("Inbox alerts", current["fingerprint"])
    assert error.value.code == "operation_disabled"


@pytest.mark.asyncio
async def test_delete_allows_unsafe_and_rejects_stale_rule_sets(monkeypatch):
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
    result = await service.delete_email_filter("Inbox alerts", current["fingerprint"])
    assert result["deleted"] is True
    assert result["lossy"] is True
    assert result["lossy_filters"] == [{
        "name": "Unsupported",
        "unsupported": ["test element addressTest"],
    }]
    assert "addressTest" not in captured["xml"]
    assert "actionKeep" in captured["xml"]

    initial = [rule_xml()]
    changed = [rule_xml(name="Changed by someone else")]
    sequence = iter([initial, changed])
    monkeypatch.setattr(filter_module, "zimbra_get_filter_rules", lambda *args, **kwargs: next(sequence))
    service = ZimbraFilterService(settings(allow_filter_write=True))
    expected = service._fingerprint([EmailFilter.from_zimbra(initial[0], order=1)])
    with pytest.raises(ServiceError) as error:
        await service.delete_email_filter("Inbox alerts", expected)
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


@pytest.mark.asyncio
async def test_dangerous_filter_can_be_disabled_without_dangerous_action_gate(monkeypatch):
    redirect = ET.fromstring(
        '<filterRule name="Redirect" active="1"><filterTests condition="allof">'
        '<headerTest header="Subject" stringComparison="contains" value="alert"/></filterTests>'
        '<filterActions><actionRedirect a="external@example.com"/></filterActions></filterRule>'
    )
    fake_zimbra(monkeypatch, rules=[redirect])
    service = ZimbraFilterService(settings(allow_filter_write=True, allow_filter_redirect=False))
    current = [EmailFilter.from_zimbra(redirect, order=1)]

    async def fake_write(account, proposed, expected):
        assert proposed[0].enabled is False
        return service._fingerprint(proposed)

    monkeypatch.setattr(service, "_write_rules", fake_write)

    result = await service.set_email_filter_enabled(
        "Redirect", False, service._fingerprint(current)
    )

    assert result["filter"]["enabled"] is False


@pytest.mark.asyncio
async def test_multi_account_selection_uses_selected_credentials(monkeypatch, tmp_path):
    captured = []
    store = AccountStore(str(tmp_path / "accounts.enc"), str(tmp_path / "accounts.key"))
    store.add(label="One", email="one@example.com", username="one-user", password="one-secret")
    second = store.add(label="Two", email="two@example.com", username="two-user", password="two-secret")
    monkeypatch.setattr(filter_module, "zimbra_login", lambda cfg: captured.append(cfg) or "token")
    monkeypatch.setattr(filter_module, "zimbra_get_filter_rules", lambda *args, **kwargs: [rule_xml()])
    service = ZimbraFilterService(settings(email="", password=""), store)

    result = await service.list_email_filters(second.id)

    assert captured[0]["zimbra_email"] == "two@example.com"
    assert captured[0]["zimbra_username"] == "two-user"
    assert captured[0]["zimbra_password"] == "two-secret"
    assert result["details_included"] is False
    assert result["filters"] == [{
        "name": "Inbox alerts", "enabled": True, "order": 1,
        "round_trip_safe": True,
    }]


@pytest.mark.asyncio
async def test_filter_listing_includes_full_rules_only_when_requested(monkeypatch):
    fake_zimbra(monkeypatch)
    service = ZimbraFilterService(settings())

    result = await service.list_email_filters(include_details=True)

    assert result["details_included"] is True
    assert result["filters"][0]["tests"][0]["field"] == "Subject"


@pytest.mark.asyncio
async def test_filter_operation_reuses_one_token_per_consistency_phase(monkeypatch):
    rules = [rule_xml()]
    logins = []
    filter_tokens = []
    folder_tokens = []
    write_tokens = []

    def login(_config):
        token = f"token-{len(logins) + 1}"
        logins.append(token)
        return token

    monkeypatch.setattr(filter_module, "zimbra_login", login)
    monkeypatch.setattr(
        filter_module,
        "zimbra_get_filter_rules",
        lambda _host, token, **_options: filter_tokens.append(token) or rules,
    )
    monkeypatch.setattr(
        filter_module,
        "zimbra_list_folders",
        lambda _host, token, **_options: folder_tokens.append(token)
        or [{"id": "2", "name": "Inbox", "path": "/Inbox"}],
    )
    monkeypatch.setattr(
        filter_module,
        "zimbra_modify_filter_rules",
        lambda _host, token, _xml, **_options: write_tokens.append(token),
    )
    service = ZimbraFilterService(settings(allow_filter_write=True))
    fingerprint = service._fingerprint(
        [EmailFilter.from_zimbra(rules[0], order=1)]
    )

    await service.create_email_filter(
        valid_payload(name="Second rule"),
        fingerprint,
    )

    assert logins == ["token-1"]
    assert filter_tokens == ["token-1", "token-1"]
    assert folder_tokens == ["token-1"]
    assert write_tokens == ["token-1"]
