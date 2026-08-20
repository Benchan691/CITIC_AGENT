import xml.etree.ElementTree as ET

import unified_mcp_server.zimbra.zimbra as zimbra


def test_search_query_escapes_input_and_caps_limit(monkeypatch):
    captured = {}

    def fake_request(host, body, token, **options):
        captured.update(host=host, body=body, token=token, options=options)
        return ET.fromstring('<SearchResponse xmlns="urn:zimbraMail"><m id="42"/></SearchResponse>')

    monkeypatch.setattr(zimbra, "soap_request", fake_request)
    ids = zimbra.zimbra_search_query("mail.example.com", "token", 'from:a@example.com <x>', 500)

    assert ids == ["42"]
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


def test_list_folders_normalizes_counts(monkeypatch):
    xml = """<GetFolderResponse xmlns="urn:zimbraMail"><folder id="2" name="Inbox"
      absFolderPath="/Inbox" l="1" u="3" n="8"/></GetFolderResponse>"""
    monkeypatch.setattr(zimbra, "soap_request", lambda *args, **kwargs: ET.fromstring(xml))

    assert zimbra.zimbra_list_folders("mail.example.com", "token") == [
        {"id": "2", "name": "Inbox", "path": "/Inbox", "parent_id": "1", "unread_count": 3, "message_count": 8}
    ]

