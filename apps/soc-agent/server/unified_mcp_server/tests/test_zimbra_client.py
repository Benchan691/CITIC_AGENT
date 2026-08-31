import xml.etree.ElementTree as ET

import pytest
from zimbra_client import SendResult, Signature
from zimbra_client.errors import ZimbraLimitError

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


def test_login_uses_zimbra_client_and_returns_its_token(monkeypatch):
    captured = {}

    class FakeClient:
        def __init__(self, config):
            captured["config"] = config
            self._auth_token = ""

        def login(self):
            self._auth_token = "login-token"
            return self

    monkeypatch.setattr(zimbra, "ZimbraClient", FakeClient)

    token = zimbra.zimbra_login({
        "zimbra_host": "mail.example.com",
        "zimbra_email": "user@example.com",
        "zimbra_password": "password",
    })

    assert token == "login-token"
    assert captured["config"]["zimbra_email"] == "user@example.com"
    assert captured["config"]["verify_ssl"] is True


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


def test_typed_signature_and_message_operations_keep_legacy_shapes(monkeypatch):
    calls = []

    class FakeClient:
        def list_signatures(self):
            return (Signature("1", "Work", "plain", "<b>html</b>"),)

        def create_signature(self, name, *, text, html):
            calls.append(("create", name, text, html))
            return Signature("2", name, text, html)

        def delete_signature(self, signature_id):
            calls.append(("delete", signature_id))

        def move_message(self, message_id, folder_id):
            calls.append(("move", message_id, folder_id))

        def send_message(self, **kwargs):
            calls.append(("send", kwargs))
            return SendResult("sent-2")

    monkeypatch.setattr(zimbra, "_token_client", lambda *args, **kwargs: FakeClient())

    assert zimbra.zimbra_list_signatures("host", "token") == [{
        "id": "1", "name": "Work", "text": "plain", "html": "<b>html</b>",
    }]
    assert zimbra.zimbra_create_signature("host", "token", "Work", "plain", "<b>html</b>") == {
        "id": "2", "name": "Work",
    }
    zimbra.zimbra_delete_signature("host", "token", "2")
    zimbra.zimbra_move_message("host", "token", "42", "99")
    assert zimbra.zimbra_send_message("host", "token", ["to@example.com"], "Subject", "Body") == {
        "message_id": "sent-2",
    }

    assert calls == [
        ("create", "Work", "plain", "<b>html</b>"),
        ("delete", "2"),
        ("move", "42", "99"),
        ("send", {
            "to": ["to@example.com"],
            "cc": None,
            "bcc": None,
            "subject": "Subject",
            "text": "Body",
        }),
    ]


def test_download_attachment_maps_package_size_limit(monkeypatch):
    class FakeClient:
        def download_attachment(self, message_id, part, *, max_bytes):
            assert (message_id, part, max_bytes) == ("42", "2", 10)
            raise ZimbraLimitError("too large", limit=max_bytes)

    captured = {}

    def fake_client(*args, **kwargs):
        captured.update(args=args, kwargs=kwargs)
        return FakeClient()

    monkeypatch.setattr(zimbra, "_token_client", fake_client)

    with pytest.raises(ValueError, match="attachment_too_large"):
        zimbra.download_attachment(
            {
                "zimbra_host": "mail.example.com",
                "zimbra_email": "user@example.com",
                "verify_ssl": True,
                "timeout": 9,
            },
            "token",
            "42",
            "2",
            10,
        )

    assert captured["kwargs"] == {
        "email": "user@example.com",
        "verify_ssl": True,
        "timeout": 9,
        "allow_insecure_http": False,
    }


def test_send_message_rejects_unknown_body_format():
    with pytest.raises(ValueError, match="body_format"):
        zimbra.zimbra_send_message("mail.example.com", "token", ["to@example.com"], "Subject", "Body", body_format="markdown")


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


def test_search_messages_uses_zimbra_anywhere_query(monkeypatch):
    captured = []

    def fake_request(_host, body, _token, **_options):
        captured.append(body)
        return ET.fromstring('<SearchResponse xmlns="urn:zimbraMail"/>')

    monkeypatch.setattr(zimbra, "soap_request", fake_request)
    zimbra.zimbra_search_messages("mail.example.com", "token", "in:anywhere")
    zimbra.zimbra_search_messages("mail.example.com", "token", "")

    assert all("<query>is:anywhere</query>" in body for body in captured)


def test_search_messages_normalizes_summary_without_get_message(monkeypatch):
    xml = """<SearchResponse xmlns="urn:zimbraMail">
      <m id="42" d="1700000000000" l="2" f="u" s="123">
        <e t="f" a="sender@example.com"/><e t="t" a="analyst@example.com"/>
        <su>Incident report</su><fr>Host app-01 failed</fr>
      </m>
    </SearchResponse>"""
    monkeypatch.setattr(zimbra, "soap_request", lambda *args, **kwargs: ET.fromstring(xml))

    messages = zimbra.zimbra_search_messages("mail.example.com", "token", "subject:Incident")

    assert messages == [{
        "id": "42",
        "subject": "Incident report",
        "from": "sender@example.com",
        "to": ["analyst@example.com"],
        "cc": [],
        "date": "2023-11-14T22:13:20+00:00",
        "folder_id": "2",
        "flags": "u",
        "size": 123,
        "fragment": "Host app-01 failed",
    }]


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


def test_get_message_headers_requests_and_returns_only_selected_headers(monkeypatch):
    captured = {}
    xml = """<GetMsgResponse xmlns="urn:zimbraMail"><m id="42">
      <header n="Message-ID">&lt;id@example.com&gt;</header>
      <header n="Received">hop-one</header><header n="Received">hop-two</header>
      <mp ct="text/plain"><content>must not be returned</content></mp>
    </m></GetMsgResponse>"""

    def fake_request(host, body, token, **options):
        captured["body"] = body
        return ET.fromstring(xml)

    monkeypatch.setattr(zimbra, "soap_request", fake_request)

    result = zimbra.zimbra_get_message_headers(
        "mail.example.com", "token", "42", ["Message-ID", "Received"]
    )

    assert result == {
        "message_id": "42",
        "headers": {
            "Message-ID": ["<id@example.com>"],
            "Received": ["hop-one", "hop-two"],
        },
    }
    assert 'max="0"' in captured["body"]
    assert '<header n="Message-ID"/>' in captured["body"]


def test_list_folders_normalizes_counts(monkeypatch):
    xml = """<GetFolderResponse xmlns="urn:zimbraMail"><folder id="2" name="Inbox"
      absFolderPath="/Inbox" l="1" u="3" n="8"/></GetFolderResponse>"""
    monkeypatch.setattr(zimbra, "soap_request", lambda *args, **kwargs: ET.fromstring(xml))

    assert zimbra.zimbra_list_folders("mail.example.com", "token") == [
        {"id": "2", "name": "Inbox", "path": "/Inbox", "parent_id": "1", "unread_count": 3, "message_count": 8}
    ]


def test_create_folder_generates_soap_and_parses_envelope(monkeypatch):
    captured = {}
    response = ET.fromstring(
        '''<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body><CreateFolderResponse xmlns="urn:zimbraMail">
            <folder id="42" name="Investigations" absFolderPath="/Investigations" l="1" view="message"/>
          </CreateFolderResponse></soap:Body>
        </soap:Envelope>'''
    )

    def fake_request(host, body, token, **options):
        captured.update(host=host, body=body, token=token, options=options)
        return response

    monkeypatch.setattr(zimbra, "soap_request", fake_request)

    folder = zimbra.zimbra_create_folder("mail.example.com", "token", "Investigations", "1")

    assert folder == {
        "id": "42",
        "name": "Investigations",
        "path": "/Investigations",
        "parent_id": "1",
        "view": "message",
    }
    assert "CreateFolderRequest" in captured["body"]
    assert 'name="Investigations"' in captured["body"]
    assert 'l="1"' in captured["body"]


def test_create_folder_rejects_malformed_response(monkeypatch):
    monkeypatch.setattr(
        zimbra,
        "soap_request",
        lambda *args, **kwargs: ET.fromstring("<CreateFolderResponse xmlns=\"urn:zimbraMail\"/>")
    )

    with pytest.raises(ValueError, match="Malformed"):
        zimbra.zimbra_create_folder("mail.example.com", "token", "Investigations", "1")
