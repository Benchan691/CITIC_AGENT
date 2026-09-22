from __future__ import annotations

import xml.etree.ElementTree as ET

import pytest
from zimbra_client.errors import ZimbraSOAPFault

import unified_mcp_server.zimbra.zimbra as module


CONFIG = {
    "zimbra_host": "mail.example.test",
    "zimbra_email": "analyst@example.com",
    "zimbra_password": "submitted-password",
    "verify_ssl": True,
    "timeout": 60,
}


def auth_response(*, token: str, required: bool = False, lifetime: str = "") -> ET.Element:
    root = ET.Element("{urn:zimbraAccount}AuthResponse")
    ET.SubElement(root, "{urn:zimbraAccount}authToken").text = token
    if required:
        ET.SubElement(root, "{urn:zimbraAccount}twoFactorAuthRequired").text = "true"
        ET.SubElement(root, "{urn:zimbraAccount}lifetime").text = lifetime
    return root


def test_normal_auth_response_returns_final_token(monkeypatch):
    requests = []

    def fake_soap(host, body, **kwargs):
        requests.append((host, body, kwargs))
        return auth_response(token="final-token")

    monkeypatch.setattr(module, "soap_request", fake_soap)
    attempt = module.zimbra_login_start(CONFIG)

    assert attempt.token == "final-token"
    assert attempt.two_factor_required is False
    body = requests[0][1]
    assert module._local_name(body.tag) == "AuthRequest"
    assert module._response_text(body, "account") == "analyst@example.com"
    assert module._response_text(body, "password") == "submitted-password"


def test_two_factor_response_preserves_only_temporary_token_and_lifetime(monkeypatch):
    requests = []

    def fake_soap(host, body, **kwargs):
        requests.append(body)
        return auth_response(token="temporary-token", required=True, lifetime="120000")

    monkeypatch.setattr(module, "soap_request", fake_soap)
    attempt = module.zimbra_login_start(CONFIG)

    assert attempt.token == ""
    assert attempt.temporary_token == "temporary-token"
    assert attempt.lifetime_ms == 120000
    assert "submitted-password" not in repr(attempt)
    assert module._response_text(requests[0], "password") == "submitted-password"


def test_final_two_factor_request_contains_no_password(monkeypatch):
    requests = []

    def fake_soap(host, body, **kwargs):
        requests.append(body)
        return auth_response(token="final-token")

    monkeypatch.setattr(module, "soap_request", fake_soap)
    token = module.zimbra_complete_two_factor(CONFIG, "temporary-token", "123456")

    assert token == "final-token"
    assert module._response_text(requests[0], "authToken") == "temporary-token"
    assert module._response_text(requests[0], "twoFactorCode") == "123456"
    assert module._response_text(requests[0], "password") == ""
    assert "submitted-password" not in ET.tostring(requests[0], encoding="unicode")


def test_final_response_that_still_requires_two_factor_is_an_invalid_code(monkeypatch):
    monkeypatch.setattr(
        module,
        "soap_request",
        lambda *_args, **_kwargs: auth_response(token="temporary-again", required=True),
    )
    with pytest.raises(module.ZimbraAuthFlowError) as caught:
        module.zimbra_complete_two_factor(CONFIG, "temporary-token", "123456")
    assert caught.value.code == "two_factor_invalid"


@pytest.mark.parametrize(
    ("fault_code", "expected"),
    [
        ("account.TWO_FACTOR_AUTH_FAILED", "two_factor_invalid"),
        ("account.AUTH_TOKEN_EXPIRED", "two_factor_expired"),
        ("service.TEMPORARILY_UNAVAILABLE", "authentication_unavailable"),
    ],
)
def test_final_two_factor_faults_are_redacted_and_categorized(monkeypatch, fault_code, expected):
    def fake_soap(*_args, **_kwargs):
        raise ZimbraSOAPFault(fault_code, "upstream detail containing a secret")

    monkeypatch.setattr(module, "soap_request", fake_soap)
    with pytest.raises(module.ZimbraAuthFlowError) as caught:
        module.zimbra_complete_two_factor(CONFIG, "temporary-token", "123456")

    assert caught.value.code == expected
    assert "upstream detail" not in str(caught.value)
    assert "secret" not in str(caught.value)


def test_initial_setup_required_is_classified_without_exposing_upstream_fault(monkeypatch):
    def fake_soap(*_args, **_kwargs):
        raise ZimbraSOAPFault("account.TWO_FACTOR_SETUP_REQUIRED", "private setup detail")

    monkeypatch.setattr(module, "soap_request", fake_soap)
    with pytest.raises(module.ZimbraAuthFlowError) as caught:
        module.zimbra_login_start(CONFIG)

    assert caught.value.code == "two_factor_setup_required"
    assert str(caught.value) == "Two-factor authentication setup is required."


def test_invalid_code_is_rejected_before_transport(monkeypatch):
    called = False

    def fake_soap(*_args, **_kwargs):
        nonlocal called
        called = True
        return auth_response(token="never")

    monkeypatch.setattr(module, "soap_request", fake_soap)
    with pytest.raises(module.ZimbraAuthFlowError) as caught:
        module.zimbra_complete_two_factor(CONFIG, "temporary-token", "１２３４５６")

    assert caught.value.code == "two_factor_invalid"
    assert called is False
