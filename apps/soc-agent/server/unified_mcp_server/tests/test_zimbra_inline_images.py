"""Signature images stay in related HTML MIME parts, separate from real files."""

import base64
import xml.etree.ElementTree as ET

import pytest

from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.config import ZimbraSettings
import unified_mcp_server.zimbra.mail.service as mail_module
import unified_mcp_server.zimbra.zimbra as transport


@pytest.mark.asyncio
@pytest.mark.parametrize("action", ["reply", "forward"])
@pytest.mark.parametrize("selected_count", [0, 2])
async def test_signature_images_are_inline_and_real_files_stay_attached(monkeypatch, action, selected_count):
    original_html = '''<div>Original signature</div>
<img alt='src="keep.jpg" >' SRC='cid:logo%40example.test'/>
<img src=cid:logo@example.test>
<a href="https://mail.example.test/banner.png?a=1&amp;b=2">Banner link</a>
<img src="https://mail.example.test/banner.png?a=1&amp;b=2">
<img src="cid:outlook@example.test">
<img src="https://external.example.test/remote.png">'''
    response = ET.fromstring('''<GetMsgResponse xmlns="urn:zimbraMail"><m id="42">
      <su>Incident update</su>
      <e t="f" a="sender@example.test"/><e t="t" a="analyst@example.test"/>
      <header n="Message-ID">&lt;original@example.test&gt;</header>
      <mp ct="multipart/mixed">
        <mp ct="multipart/alternative">
          <mp ct="text/plain" body="1"><content>Original signature</content></mp>
          <mp ct="multipart/related">
            <mp ct="text/html" body="1"><content/></mp>
            <mp part="2.3" filename="logo.png" ct="image/png" ci="&lt;logo@example.test&gt;" cd="inline"/>
            <mp part="2.4" filename="banner.png" ct="image/png" cl="https://mail.example.test/banner.png?a=1&amp;b=2"/>
            <mp part="2.5" filename="outlook.png" ct="image/png" ci="outlook@example.test" cd="attachment"/>
            <mp part="2.6" filename="unused.png" ct="image/png" ci="unused@example.test" cd="inline"/>
          </mp>
        </mp>
        <mp part="3" filename="week1.csv" ct="text/csv" cd="attachment"/>
        <mp part="4" filename="week2.csv" ct="text/csv" cd="attachment"/>
        <mp part="5" filename="week3.csv" ct="text/csv" cd="attachment"/>
        <mp part="6" filename="week4.csv" ct="text/csv" cd="attachment"/>
        <mp part="7" filename="week5.csv" ct="text/csv" cd="attachment"/>
        <mp part="8" filename="attached-image.png" ct="image/png" ci="logo@example.test" cd="attachment"/>
      </mp>
    </m></GetMsgResponse>''')
    response.find(".//{*}mp[@ct='text/html']/{*}content").text = original_html
    requests = []
    uploads = []

    def fake_soap(host, body, token, **options):
        assert host == "mail.example.test"
        assert token == "authenticated-token"
        assert options["verify_ssl"] is True
        request = ET.fromstring(body)
        requests.append(request)
        if request.tag.endswith("GetMsgRequest"):
            assert request.find("{*}m").get("id") == "42"
            assert request.find("{*}m").get("html") == "1"
            return response
        assert request.tag.endswith("SendMsgRequest")
        return ET.fromstring('<SendMsgResponse xmlns="urn:zimbraMail"><m id="sent-test"/></SendMsgResponse>')

    def fake_upload(self, attachments):
        uploads.extend(attachments or ())
        return tuple(f"upload-{index}" for index, _ in enumerate(attachments or ()))

    monkeypatch.setattr(transport, "soap_request", fake_soap)
    monkeypatch.setattr(transport._TokenClient, "_upload_attachments", fake_upload)
    monkeypatch.setattr(mail_module, "zimbra_login", lambda *_: pytest.fail("must use the authenticated identity"))
    service = mail_module.ZimbraMailService(
        ZimbraSettings(host="mail.example.test", verify_ssl=True, timeout=60, allow_send=True),
        identity=ZimbraIdentity("user-1", "analyst@example.test", "authenticated-token", "session-1"),
    )
    selected_files = [
        {"filename": "selected.pdf", "content_type": "application/pdf", "data": base64.b64encode(b"selected PDF").decode()},
        {"filename": "selected.png", "content_type": "image/png", "data": base64.b64encode(b"selected PNG").decode()},
    ][:selected_count]
    result = await service.send_email(
        ["recipient@example.test"] if action == "forward" else None,
        "", "<p>Review signature</p>", action=action, source_message_id="42",
        body_format="html", attachments=selected_files,
    )
    assert result["message_id"] == "sent-test"
    assert [request.tag.rsplit("}", 1)[-1] for request in requests] == ["GetMsgRequest", "SendMsgRequest"]
    message = requests[-1].find("{*}m")
    assert message.get("origid") == "42"
    assert message.get("rt") == ("r" if action == "reply" else "w")
    if action == "reply":
        assert message.get("irt") == "<original@example.test>"
    assert message.find("{*}su").text == ("Re: Incident update" if action == "reply" else "Fwd: Incident update")

    body = message.find("{*}mp[@ct='multipart/alternative']")
    assert body is not None
    assert "Original signature" in body.findtext("{*}mp[@ct='text/plain']/{*}content")
    related = body.find("{*}mp[@ct='multipart/related']")
    assert related is not None
    rendered_html = related.findtext("{*}mp[@ct='text/html']/{*}content")
    assert rendered_html.startswith("<p>Review signature</p>")
    assert 'alt=\'src="keep.jpg" >\'' in rendered_html
    assert '<a href="https://mail.example.test/banner.png?a=1&amp;b=2">Banner link</a>' in rendered_html
    assert '<img src="https://external.example.test/remote.png">' in rendered_html

    inline_images = related.findall("{*}mp[@ci]")
    assert len(inline_images) == 3
    assert len({part.get("ci") for part in inline_images}) == 3
    inline_sources = set()
    for part in inline_images:
        assert part.get("ct") == "image/png"
        assert f'"cid:{part.get("ci")}"' in rendered_html
        inline_sources.add(tuple(part.find("{*}attach/{*}mp").get(key) for key in ("mid", "part")))
    assert inline_sources == {("42", "2.3"), ("42", "2.4"), ("42", "2.5")}
    logo = next(part for part in inline_images if part.find("{*}attach/{*}mp").get("part") == "2.3")
    assert rendered_html.count(f'"cid:{logo.get("ci")}"') == 2

    # Zimbra reads one normal attachment section; inline images must never be
    # copied through it, even alongside five CSVs and selected upload files.
    normal_attachments = message.findall("{*}attach")
    assert len(normal_attachments) == (1 if action == "forward" or selected_count else 0)
    if normal_attachments:
        normal = normal_attachments[0]
        assert normal.get("aid", "") == ",".join(f"upload-{index}" for index in range(selected_count))
        normal_sources = {tuple(part.get(key) for key in ("mid", "part")) for part in normal.findall("{*}mp")}
        assert normal_sources == ({("42", str(part)) for part in range(3, 9)} if action == "forward" else set())
        assert normal_sources.isdisjoint(inline_sources)
    assert [attachment.filename for attachment in uploads] == [item["filename"] for item in selected_files]


@pytest.mark.asyncio
async def test_new_message_keeps_all_selected_files_in_one_attachment_section(monkeypatch):
    requests = []
    monkeypatch.setattr(transport._TokenClient, "_upload_attachments", lambda self, files: tuple(f"upload-{index}" for index, _ in enumerate(files)))

    def fake_soap(host, body, token, **options):
        assert token == "authenticated-token"
        request = ET.fromstring(body)
        requests.append(request)
        assert request.tag.endswith("SendMsgRequest")
        return ET.fromstring('<SendMsgResponse xmlns="urn:zimbraMail"><m id="new-message"/></SendMsgResponse>')

    monkeypatch.setattr(transport, "soap_request", fake_soap)
    service = mail_module.ZimbraMailService(
        ZimbraSettings(host="mail.example.test", verify_ssl=True, timeout=60, allow_send=True),
        identity=ZimbraIdentity("user-1", "analyst@example.test", "authenticated-token", "session-1"),
    )
    selected_files = [
        {"filename": f"week{index}.csv", "content_type": "text/csv", "data": base64.b64encode(b"a,b\n1,2").decode()}
        for index in range(5)
    ]
    await service.send_email(["recipient@example.test"], "Weekly CSVs", "<p>Reports</p>", attachments=selected_files)
    assert len(requests) == 1
    message = requests[0].find("{*}m")
    normal_attachments = message.findall("{*}attach")
    assert len(normal_attachments) == 1
    assert normal_attachments[0].get("aid") == ",".join(f"upload-{index}" for index in range(5))
    assert message.find(".//{*}mp[@ct='multipart/related']") is None


@pytest.mark.parametrize("original_html", [
    '<p>Original text only &amp; content</p>',
    '<img src="cid:missing@example.test">',
    '<img src="cid:">',
])
def test_unmatched_image_references_are_not_guessed(original_html):
    response = ET.fromstring('<GetMsgResponse xmlns="urn:zimbraMail"><m id="42">'
                             '<mp part="2" filename="unrelated.png" ct="image/png" cd="inline"/>'
                             '</m></GetMsgResponse>')
    rewritten, images = transport._inline_image_parts(response, "42", original_html)
    assert rewritten == original_html
    assert images == []
