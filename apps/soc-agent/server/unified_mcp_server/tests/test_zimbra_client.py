import xml.etree.ElementTree as ET

import pytest

import unified_mcp_server.zimbra.zimbra as zimbra


def test_send_message_escapes_recipients_and_parses_message_id(monkeypatch):
    captured = {}

    def fake_request(_client, body, auth_token=""):
        captured.update(body=body, token=auth_token)
        return ET.fromstring('<SendMsgResponse xmlns="urn:zimbraMail"><m id="sent-7"/></SendMsgResponse>')

    monkeypatch.setattr(zimbra._TokenClient, "_request_once", fake_request)

    result = zimbra.zimbra_send_message(
        "mail.example.com",
        "token",
        ["to@example.com"],
        "Subject <one>",
        "Body & details",
        cc=["cc@example.com"],
        bcc=["b@example.com"],
        body_format="html",
    )

    assert result == {"message_id": "sent-7"}
    body = ET.tostring(captured["body"], encoding="unicode")
    assert 't="t" a="to@example.com"' in body
    assert 't="c" a="cc@example.com"' in body
    assert 't="b" a="b@example.com"' in body
    assert "Subject &lt;one&gt;" in body
    assert "Body &amp; details" in body
    assert 'ct="text/html"' in body
    assert captured["token"] == "token"


def test_token_client_forwards_existing_token_without_login(monkeypatch):
    captured = {}

    def fake_request(_client, body, auth_token=""):
        captured.update(body=body, token=auth_token)
        return ET.Element("Response")

    monkeypatch.setattr(zimbra._TokenClient, "_request_once", fake_request)
    monkeypatch.setattr(zimbra._TokenClient, "login", lambda _client: pytest.fail("login should not be called"))

    client = zimbra._token_client("mail.example.com", "session-token", verify_ssl=True, timeout=7)
    client.request("<NoOpRequest/>")

    assert ET.tostring(captured["body"], encoding="unicode") == "<NoOpRequest />"
    assert captured["token"] == "session-token"




def test_low_level_zimbra_client_requires_https_unless_explicitly_allowed(monkeypatch):
    with pytest.raises(ValueError, match="must use HTTPS"):
        zimbra._token_client("http://mail.example.com", "token")

    captured = {}

    def fake_request(_client, body, auth_token=""):
        captured.update(body=body, token=auth_token)
        return ET.Element("Response")

    monkeypatch.setattr(zimbra._TokenClient, "_request_once", fake_request)
    zimbra._token_client(
        "http://mail.example.com",
        "token",
        allow_insecure_http=True,
    ).request("<NoOpRequest/>")
    assert captured["token"] == "token"








def test_search_messages_escapes_input_and_caps_limit(monkeypatch):
    captured = {}

    def fake_request(host, body, token, **options):
        captured.update(host=host, body=body, token=token, options=options)
        return ET.fromstring('<SearchResponse xmlns="urn:zimbraMail"><m id="42"/></SearchResponse>')

    monkeypatch.setattr(zimbra, "soap_request", fake_request)
    messages = zimbra.zimbra_search_messages("mail.example.com", "token", 'from:a@example.com <x>', 500)

    assert messages[0]["id"] == "42"
    assert "limit=\"100\"" in captured["body"]
    assert "&lt;x&gt;" in captured["body"]






def test_get_message_returns_body_metadata_and_attachments(monkeypatch):
    xml = """<GetMsgResponse xmlns="urn:zimbraMail">
      <m id="42" d="1700000000000" l="2" f="u" s="123">
        <e t="f" a="sender@example.com"/><e t="t" a="analyst@example.com"/>
        <su>Incident report</su>
        <mp ct="text/plain"><content>Host app-01 failed</content></mp>
        <mp ct="application/pdf" filename="report.pdf" part="2" cd="attachment"/>
      </m>
    </GetMsgResponse>"""
    monkeypatch.setattr(zimbra, "soap_request", lambda *args, **kwargs: ET.fromstring(xml))

    message = zimbra.zimbra_get_message("mail.example.com", "token", "42")

    assert message["subject"] == "Incident report"
    assert message["from"] == "sender@example.com"
    assert message["body"] == "Host app-01 failed"
    assert message["body_type"] == "text/plain"
    assert message["attachments"][0]["filename"] == "report.pdf"
    assert message["date"].endswith("+00:00")
