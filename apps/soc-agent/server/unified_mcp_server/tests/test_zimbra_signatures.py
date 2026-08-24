import xml.etree.ElementTree as ET

import unified_mcp_server.zimbra.zimbra as soap


def fake_response(xml):
    return ET.fromstring(xml)


def test_list_signatures_parses_plain_text_and_html(monkeypatch):
    monkeypatch.setattr(
        soap,
        "soap_request",
        lambda *args, **kwargs: fake_response(
            """<Envelope><GetSignaturesResponse>
              <signature id="1" name="Work">
                <content type="text/plain">Ben Chan\nCITIC</content>
                <content type="text/html">&lt;strong&gt;Ben Chan&lt;/strong&gt;</content>
              </signature>
            </GetSignaturesResponse></Envelope>"""
        ),
    )

    assert soap.zimbra_list_signatures("mail.example.com", "token") == [{
        "id": "1",
        "name": "Work",
        "text": "Ben Chan\nCITIC",
        "html": "<strong>Ben Chan</strong>",
    }]


def test_create_signature_escapes_content_and_returns_metadata(monkeypatch):
    captured = {}

    def fake_request(host, body, token, **kwargs):
        captured["body"] = body
        return fake_response("<Envelope><CreateSignatureResponse><signature id=\"2\" name=\"Work\"/></CreateSignatureResponse></Envelope>")

    monkeypatch.setattr(soap, "soap_request", fake_request)

    assert soap.zimbra_create_signature("mail.example.com", "token", "Work", "A & B", "<p>A</p>") == {
        "id": "2",
        "name": "Work",
    }
    assert "A &amp; B" in captured["body"]
    assert "&lt;p&gt;A&lt;/p&gt;" in captured["body"]
    assert 'type="text/plain"' in captured["body"]
    assert 'type="text/html"' in captured["body"]


def test_delete_signature_uses_exact_id(monkeypatch):
    captured = {}

    def fake_request(host, body, token, **kwargs):
        captured["body"] = body
        return fake_response("<Envelope><DeleteSignatureResponse/></Envelope>")

    monkeypatch.setattr(soap, "soap_request", fake_request)
    soap.zimbra_delete_signature("mail.example.com", "token", "sig-1")

    assert '<signature id="sig-1"/>' in captured["body"]
