import base64

import pytest
import xml.etree.ElementTree as ET

import unified_mcp_server.auth_cli as auth_cli
import unified_mcp_server.zimbra.mail.service as module
import unified_mcp_server.zimbra.zimbra as transport
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.zimbra_service import ZimbraService, _upstream_error
from unified_mcp_server.zimbra.filters.service import ZimbraFilterService
import unified_mcp_server.zimbra.filters.service as filter_module


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


@pytest.mark.asyncio
async def test_search_returns_metadata_but_body_requires_get(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    search_calls = []
    monkeypatch.setattr(
        module,
        "zimbra_search_messages",
        lambda *args, **kwargs: search_calls.append((args, kwargs)) or [{"id": "42", "subject": "Alert"}],
    )
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {"id": "42", "subject": "Alert", "body": "sensitive details"},
    )
    service = ZimbraService(settings(allow_move=False))

    search = await service.search_emails("subject:Alert", offset=40)
    message = await service.get_email("42")

    assert "body" not in search["messages"][0]
    assert "account" not in search["messages"][0]
    assert len(search_calls) == 1
    assert search_calls[0][0][4] == 40
    assert search["offset"] == 40
    assert message["body"] == "sensitive details"
    assert message["body_characters"] == 17
    assert message["body_truncated"] is False


def test_get_message_omits_inline_images_but_keeps_explicit_attachments(monkeypatch):
    calls = []
    source_xml = '''<GetMsgResponse xmlns="urn:zimbraMail"><m id="42">
      <su>Inline image sample</su>
      <mp part="2" ct="multipart/related">
        <mp part="2.1" ct="text/plain" body="1"><content>Body text</content></mp>
        <mp part="2.2" ct="text/html" body="1"><content>&lt;img src="https://example.test/logo.png"&gt;</content></mp>
        <mp part="2.3" filename="logo.jpg" ct="image/jpeg" ci="cid:logo" s="1"/>
        <mp part="2.4" filename="remote.jpg" ct="image/jpeg" cl="https://example.test/remote.jpg" s="1"/>
        <mp part="2.5" filename="inline.jpg" ct="image/jpeg" cd="inline" s="1"/>
        <mp part="2.6" filename="photo.jpg" ct="image/jpeg" ci="cid:photo" cd="attachment" s="1"/>
        <mp part="2.7" filename="report.pdf" ct="application/pdf" cd="attachment" s="10"/>
        <mp part="2.8" ct="message/rfc822" s="12"/>
      </mp>
    </m></GetMsgResponse>'''

    def fake_soap(host, body, token, **options):
        calls.append((host, body, token, options))
        return ET.fromstring(source_xml)

    monkeypatch.setattr(transport, "soap_request", fake_soap)

    result = transport.zimbra_get_message("mail.example.com", "token", "42")

    assert [item["filename"] for item in result["attachments"]] == [
        "photo.jpg", "report.pdf", "attachment-2-8.eml",
    ]
    assert result["inline_images_skipped"] == 3
    assert result["body"] == "Body text"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_invalid_search_query_returns_validation_error_before_network(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda *args, **kwargs: pytest.fail("login should not be called"))
    monkeypatch.setattr(module, "zimbra_search_messages", lambda *args, **kwargs: pytest.fail("search should not be called"))

    with pytest.raises(ServiceError) as error:
        await ZimbraService(settings()).search_emails("d:20260829")

    assert error.value.code == "query_validation_error"
    assert error.value.retryable is False
    assert error.value.details["invalid_operator"] == "d"
    assert error.value.details["suggested_query"] == "date:08/29/2026"




@pytest.mark.asyncio
async def test_identity_bound_service_uses_server_token_and_rejects_account_selection(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        module,
        "zimbra_list_folders",
        lambda host, token, **kwargs: captured.update(host=host, token=token) or [],
    )
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(email="legacy@example.com", password="must-not-be-used"), identity=identity)

    with pytest.raises(ServiceError) as error:
        await service.list_folders("another-account")
    assert error.value.code == "account_selection_disabled"

    result = await service.list_folders()
    assert captured == {"host": "mail.example.com", "token": "server-token"}
    assert result["account"]["email"] == "a***@example.com"
    assert result["account_id"] == "authenticated"


@pytest.mark.asyncio
async def test_mail_and_filters_keep_identities_isolated_without_legacy_storage(monkeypatch, tmp_path):
    legacy_file = tmp_path / "accounts.enc"
    legacy_file.write_bytes(b"must never be decrypted")
    configured = settings(accounts_file=str(legacy_file), key_file=str(tmp_path / "missing.key"))
    calls = []
    for target in (module, filter_module):
        monkeypatch.setattr(target, "zimbra_login", lambda *_: pytest.fail("must use the authenticated token"))
    monkeypatch.setattr(module, "zimbra_list_folders", lambda host, token, **kw: calls.append(token) or [])
    monkeypatch.setattr(filter_module, "zimbra_get_filter_rules", lambda host, token, **kw: calls.append(token) or [])

    for user in ("alice", "bob"):
        identity = ZimbraIdentity(user, f"{user}@example.com", f"token-{user}", f"session-{user}")
        for service, operation in (
            (ZimbraService(configured, identity=identity), "list_folders"),
            (ZimbraFilterService(configured, identity=identity), "list_email_filters"),
        ):
            with pytest.raises(ServiceError) as error:
                await getattr(service, operation)("legacy")
            assert error.value.code == "account_selection_disabled"
            result = await getattr(service, operation)()
            assert result["account"]["email"] == f"{user[0]}***@example.com"
    assert calls == ["token-alice", "token-alice", "token-bob", "token-bob"]
    assert not (tmp_path / "missing.key").exists()


@pytest.mark.asyncio
async def test_signature_draft_keeps_authenticated_identity(monkeypatch):
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    monkeypatch.setattr(module, "zimbra_login", lambda *_: pytest.fail("must use the authenticated token"))
    monkeypatch.setattr(module, "zimbra_list_signatures", lambda host, token, **kw: [
        {"id": "1", "name": "Work", "text": "SOC analyst", "html": "<p>SOC analyst</p>"},
    ])
    draft = await ZimbraService(settings(), identity=identity).use_signature_on_email(
        "recipient@example.com", "Update", "Reviewed", "1",
    )
    assert draft["draft"]["body"] == "Reviewed<br><br><p>SOC analyst</p>"
    assert draft["draft"]["account_id"] == "authenticated"
    assert draft["draft"]["signature"] == {"id": "1", "name": "Work"}








@pytest.mark.asyncio
async def test_move_email_is_gated_validated_and_verified(monkeypatch):
    service = ZimbraService(settings(allow_move=False))
    with pytest.raises(ServiceError) as disabled:
        await service.move_email("42", "99")
    assert disabled.value.code == "operation_disabled"

    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_list_folders",
        lambda *args, **kwargs: [{"id": "99", "name": "Quarantine", "path": "/Quarantine"}],
    )
    messages = iter([
        {"id": "42", "folder_id": "2"},
        {"id": "42", "folder_id": "99"},
    ])
    monkeypatch.setattr(module, "zimbra_get_message", lambda *args, **kwargs: next(messages))
    moved = []
    monkeypatch.setattr(
        module, "zimbra_move_message",
        lambda host, token, message_id, folder_id, **kwargs: moved.append((message_id, folder_id)),
    )

    result = await ZimbraService(settings(allow_move=True)).move_email("42", "99")

    assert moved == [("42", "99")]
    assert result["moved"] is True
    assert result["original_folder_id"] == "2"
    assert result["rollback"] == {
        "tool": "zimbra_move_email",
        "message_id": "42",
        "folder_id": "2",
        "account_id": "legacy",
    }




@pytest.mark.asyncio
async def test_signature_writes_are_disabled_before_network_access(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda *args, **kwargs: pytest.fail("login should not be called"))
    service = ZimbraService(settings(allow_signature_write=False))

    with pytest.raises(ServiceError) as error:
        await service.create_signature("Work", "text")
    assert error.value.code == "operation_disabled"

    with pytest.raises(ServiceError) as error:
        await service.delete_signature("1")
    assert error.value.code == "operation_disabled"






def test_create_email_draft_is_local_and_structured(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda *args, **kwargs: pytest.fail("draft must not log in"))
    draft = ZimbraService(settings()).create_email_draft(
        ["to@example.com"],
        "Subject",
        "Body",
        ["cc@example.com"],
        "bcc@example.com",
    )

    assert draft["draft"]["to"] == ["to@example.com"]
    assert draft["draft"]["cc"] == ["cc@example.com"]
    assert draft["draft"]["bcc"] == ["bcc@example.com"]
    assert draft["draft"]["account_id"] == "legacy"


@pytest.mark.asyncio
async def test_new_send_action_uses_html(monkeypatch):
    captured = {}
    monkeypatch.setattr(module, "zimbra_login", lambda *_: "token")
    monkeypatch.setattr(
        module,
        "zimbra_send_message",
        lambda host, token, recipients, subject, body, **kwargs: captured.update(options=kwargs) or {"message_id": "sent-8"},
    )
    service = ZimbraService(settings(allow_send=True))

    draft = (await service.create_email_action_draft(
        action="send", to=["to@example.com"], subject="Subject", body="Body",
    ))["draft"]
    assert draft["body_format"] == "html"
    result = await service.send_email(["to@example.com"], "Subject", "Body")

    assert result["message_id"] == "sent-8"
    assert captured["options"]["body_format"] == "html"


@pytest.mark.asyncio
@pytest.mark.parametrize("note, requested_format, expected_format, plain_note, html_note", [
    ("Review <this> & reply", "html", "html", "Review  & reply", "Review  &amp; reply"),
    ("<p>Review &amp; reply</p>", "html", "html", "Review & reply", "<p>Review &amp; reply</p>"),
    ("<p>Default HTML note</p>", None, "html", "Default HTML note", "<p>Default HTML note</p>"),
    ("", "html", "html", "", ""),
])
async def test_forward_action_draft_then_confirmed_send_uses_package_and_preserves_attachments(
    monkeypatch, note, requested_format, expected_format, plain_note, html_note,
):
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(), identity=identity)
    requests = []
    original = "Original content " + "x" * 20_000
    source_xml = f'''<GetMsgResponse xmlns="urn:zimbraMail"><m id="42">
      <su>Incident update</su><e t="f" a="sender@example.com"/><e t="t" a="analyst@example.com"/>
      <mp ct="multipart/mixed"><mp ct="text/plain" body="1"><content>{original}</content></mp>
      <mp ct="text/html" body="1"><content>&lt;p&gt;Original HTML&lt;/p&gt;</content></mp>
      <mp part="2" filename="report.pdf" ct="application/pdf" cd="attachment" s="10"/></mp>
      </m></GetMsgResponse>'''

    def fake_soap(host, body, auth_token="", **options):
        assert host == "mail.example.com"
        assert auth_token == "server-token"
        assert options["verify_ssl"] is True
        request = ET.fromstring(body)
        requests.append(request)
        if request.tag.endswith("GetMsgRequest"):
            assert request.find("{*}m").get("id") == "42"
            return ET.fromstring(source_xml)
        assert request.tag.endswith("SendMsgRequest")
        return ET.fromstring('<SendMsgResponse xmlns="urn:zimbraMail"><m id="99"/></SendMsgResponse>')

    monkeypatch.setattr(transport, "soap_request", fake_soap)
    monkeypatch.setattr(module, "zimbra_login", lambda *_: pytest.fail("must use the authenticated token"))
    draft = (await service.create_email_action_draft(
        action="forward", message_id="42", to=["to@example.com"], body=note,
        cc=["cc@example.com"], bcc=["bcc@example.com"], body_format=requested_format,
    ))["draft"]
    assert len(requests) == 1 and requests[0].tag.endswith("GetMsgRequest")
    assert draft["body"] == note
    assert draft["subject"] == "Fwd: Incident update"
    assert draft["action"] == "forward"
    assert draft["source_message_id"] == "42"
    assert draft["body_format"] == expected_format
    assert draft["account_id"] == "authenticated"
    assert draft["source_message"]["body_truncated"] is True
    assert len(draft["source_message"]["body"]) == 20_000
    assert draft["source_message"]["attachments"][0]["filename"] == "report.pdf"

    # Exercise the same private command as the confirmed UI, with the editable note only.
    monkeypatch.setattr(auth_cli, "_service", lambda payload: service)
    result = await auth_cli.dispatch_command("send-email", {
        **{key: draft[key] for key in ("to", "cc", "bcc", "subject", "body", "action", "source_message_id")},
        "body_format": requested_format, "session_id": "app-session",
    })
    assert result["sent"] is True and result["message_id"] == "99"
    assert [request.tag.rsplit("}", 1)[-1] for request in requests] == [
        "GetMsgRequest", "GetMsgRequest", "SendMsgRequest",
    ]
    message = requests[-1].find("{*}m")
    assert message.attrib == {"origid": "42", "rt": "w"}
    assert message.find("{*}su").text == "Fwd: Incident update"
    assert [(item.get("t"), item.get("a")) for item in message.findall("{*}e")] == [
        ("t", "to@example.com"), ("c", "cc@example.com"), ("b", "bcc@example.com"),
    ]
    assert message.find("{*}attach/{*}mp").attrib == {"mid": "42", "part": "2"}
    parts = {part.get("ct"): part.findtext("{*}content") for part in message.findall(".//{*}mp") if part.find("{*}content") is not None}
    assert parts["text/plain"].startswith(plain_note)
    assert original in parts["text/plain"]
    assert parts["text/html"].startswith(html_note)
    assert "<p>Original HTML</p>" in parts["text/html"]
    assert parts["text/plain"].count("---------- Forwarded message ----------") == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("requested_format, expected_format, note, plain_note, html_note", [
    (None, "html", "<p>Review &amp; reply</p>", "Review & reply", "<p>Review &amp; reply</p>"),
    ("html", "html", "<p>Review <this> &amp; reply</p>", "Review  & reply", "<p>Review  &amp; reply</p>"),
])
async def test_reply_action_derives_recipients_sets_headers_and_keeps_mime_alternatives(
    monkeypatch, requested_format, expected_format, note, plain_note, html_note,
):
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(), identity=identity)
    requests = []
    source_xml = '''<GetMsgResponse xmlns="urn:zimbraMail"><m id="42">
      <su>Incident update</su>
      <e t="f" a="sender@example.com"/><e t="r" a="reply@example.com"/>
      <e t="t" a="analyst@example.com"/>
      <e t="t" a="peer@example.com"/><e t="c" a="copy@example.com"/>
      <header n="Message-ID">&lt;message-42@example.com&gt;</header>
      <mp ct="text/plain" body="1"><content>Original content</content></mp>
      <mp ct="text/html" body="1"><content>&lt;p&gt;Original HTML&lt;/p&gt;</content></mp>
    </m></GetMsgResponse>'''

    def fake_soap(host, body, auth_token="", **options):
        assert host == "mail.example.com"
        assert auth_token == "server-token"
        request = ET.fromstring(body)
        requests.append(request)
        if request.tag.endswith("GetMsgRequest"):
            return ET.fromstring(source_xml)
        assert request.tag.endswith("SendMsgRequest")
        return ET.fromstring('<SendMsgResponse xmlns="urn:zimbraMail"><m id="100"/></SendMsgResponse>')

    monkeypatch.setattr(transport, "soap_request", fake_soap)
    monkeypatch.setattr(module, "zimbra_login", lambda *_: pytest.fail("must use the authenticated token"))
    draft = (await service.create_email_action_draft(
        action="reply", message_id="42", body=note, reply_all=True, body_format=requested_format,
    ))["draft"]

    assert draft["action"] == "reply"
    assert draft["to"] == []
    assert draft["subject"] == "Re: Incident update"
    assert draft["source_message_id"] == "42"
    assert draft["reply_all"] is True
    assert draft["body_format"] == expected_format

    monkeypatch.setattr(auth_cli, "_service", lambda payload: service)
    result = await auth_cli.dispatch_command("send-email", {
        **{key: draft[key] for key in ("to", "cc", "bcc", "subject", "body", "action", "source_message_id", "reply_all")},
        "body_format": requested_format, "session_id": "app-session",
    })

    assert result["sent"] is True and result["message_id"] == "100"
    assert [request.tag.rsplit("}", 1)[-1] for request in requests] == [
        "GetMsgRequest", "GetMsgRequest", "SendMsgRequest",
    ]
    message = requests[-1].find("{*}m")
    assert message.attrib == {"origid": "42", "rt": "r", "irt": "<message-42@example.com>"}
    assert [(item.get("t"), item.get("a")) for item in message.findall("{*}e")] == [
        ("t", "reply@example.com"), ("c", "peer@example.com"), ("c", "copy@example.com"),
    ]
    assert message.find("{*}su").text == "Re: Incident update"
    parts = {
        part.get("ct"): part.findtext("{*}content")
        for part in message.findall(".//{*}mp")
        if part.find("{*}content") is not None
    }
    assert parts["text/plain"].startswith(plain_note)
    assert "Original content" in parts["text/plain"]
    assert parts["text/html"].startswith(html_note)
    assert "Original HTML" in parts["text/html"]
    assert "Forwarded message" not in parts["text/plain"]


@pytest.mark.asyncio
async def test_email_action_validation_and_send_gate_run_before_network(monkeypatch):
    monkeypatch.setattr(transport, "soap_request", lambda *a, **kw: pytest.fail("invalid request must not contact Zimbra"))
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(), identity=identity)
    with pytest.raises(ServiceError) as error:
        await service.create_email_action_draft(action="invalid", to=["to@example.com"], subject="Subject")
    assert error.value.code == "invalid_input"
    with pytest.raises(ServiceError) as error:
        await service.create_email_action_draft(action="reply")
    assert error.value.code == "invalid_input"
    with pytest.raises(ServiceError) as error:
        await service.create_email_action_draft(action="send", message_id="42", to=["to@example.com"], subject="Subject")
    assert error.value.code == "invalid_input"
    with pytest.raises(ServiceError) as error:
        await service.create_email_action_draft(action="forward", message_id="42", to=["to@example.com"], reply_all=True)
    assert error.value.code == "invalid_input"
    for invalid_id in ("", "other-mailbox:42", "42,43", "-1", "0"):
        with pytest.raises(ServiceError) as error:
            await service.create_email_action_draft(action="forward", message_id=invalid_id, to=["to@example.com"])
        assert error.value.code == "invalid_input"
        with pytest.raises(ServiceError) as error:
            await service.send_email(
                ["to@example.com"], "Fwd: subject", "", action="forward", source_message_id=invalid_id,
            )
        assert error.value.code == "invalid_input"
    with pytest.raises(ServiceError) as error:
        await service.create_email_action_draft(action="forward", message_id="42", to=["invalid-recipient"])
    assert error.value.code == "invalid_input"
    with pytest.raises(ServiceError) as error:
        await service.send_email(
            ["to@example.com"], "Fwd: subject", "", "another-account", action="forward", source_message_id="42",
        )
    assert error.value.code == "account_selection_disabled"
    service.settings = settings(allow_send=False)
    with pytest.raises(ServiceError) as error:
        await service.send_email(
            ["to@example.com"], "Fwd: subject", "", action="forward", source_message_id="42",
        )
    assert error.value.code == "operation_disabled"


@pytest.mark.asyncio
async def test_forward_missing_source_and_failed_delivery_never_report_success(monkeypatch):
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(), identity=identity)
    monkeypatch.setattr(module, "zimbra_get_message", lambda *a, **kw: None)
    with pytest.raises(ServiceError) as error:
        await service.create_email_action_draft(action="forward", message_id="42", to=["to@example.com"])
    assert error.value.code == "not_found"
    monkeypatch.setattr(transport, "soap_request", lambda *a, **kw: ET.fromstring(
        '<GetMsgResponse xmlns="urn:zimbraMail"><m id="42"><su>Subject</su></m></GetMsgResponse>'
        if "GetMsgRequest" in a[1] else '<SendMsgResponse xmlns="urn:zimbraMail"/>',
    ))
    with pytest.raises(ServiceError):
        await service.send_email(
            ["to@example.com"], "Fwd: Subject", "", action="forward", source_message_id="42",
        )






@pytest.mark.asyncio
async def test_send_email_is_gated_validated_and_uses_selected_account(monkeypatch, tmp_path):
    store = AccountStore(str(tmp_path / "accounts.enc"), str(tmp_path / "accounts.key"))
    account = store.add(label="Primary", email="primary@example.com", username="primary", password="secret")
    captured = {}
    def fake_login(cfg):
        captured["config"] = cfg
        return "token"

    monkeypatch.setattr(module, "zimbra_login", fake_login)
    monkeypatch.setattr(
        module,
        "zimbra_send_message",
        lambda host, token, recipients, subject, body, **kwargs: captured.update(
            host=host, token=token, recipients=recipients, subject=subject, body=body, options=kwargs
        ) or {"message_id": "sent-7"},
    )

    service = ZimbraService(settings(email="", password=""), store)
    result = await service.send_email(
        ["to@example.com"],
        " Subject ",
        "Body",
        account.id,
        cc="cc@example.com",
        body_format="html",
    )

    assert result["sent"] is True
    assert result["message_id"] == "sent-7"
    assert captured["config"]["zimbra_email"] == "primary@example.com"
    assert captured["options"] == {
        "cc": ["cc@example.com"],
        "bcc": [],
        "body_format": "html",
        "verify_ssl": True,
        "timeout": 60,
        "allow_insecure_http": False,
        }


@pytest.mark.asyncio
async def test_email_attachment_payload_is_validated_and_html_is_sanitized(monkeypatch):
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(allow_send=True), identity=identity)
    monkeypatch.setattr(module, "zimbra_send_message", lambda *args, **kwargs: pytest.fail("invalid payload reached transport"))
    with pytest.raises(ServiceError, match="body_format=html"):
        await service.send_email(["to@example.com"], "Subject", "Body", body_format="text")
    invalid_payloads = [
        {"filename": "../report.txt", "content_type": "text/plain", "data": "aGVsbG8="},
        {"filename": "report.txt", "content_type": "text/plain; charset=utf-8", "data": "aGVsbG8="},
        {"filename": "report.txt", "content_type": "text/plain", "data": "not-base64"},
        {"filename": "report.txt", "content_type": "text/plain", "data": "aGVsbG8="},
    ]
    for payload in invalid_payloads[:3]:
        with pytest.raises(ServiceError) as error:
            await service.send_email(["to@example.com"], "Subject", "<p>Body</p>", attachments=[payload])
        assert error.value.code == "invalid_input"

    monkeypatch.setattr(module, "_MAX_EMAIL_ATTACHMENT_BYTES", 2)
    with pytest.raises(ServiceError, match="10 MB"):
        await service.send_email(
            ["to@example.com"], "Subject", "Body",
            attachments=[{
                "filename": "report.txt", "content_type": "text/plain",
                "data": base64.b64encode(b"abc").decode(),
            }],
        )
    monkeypatch.setattr(module, "_MAX_EMAIL_ATTACHMENT_BYTES", 10_000_000)
    monkeypatch.setattr(module, "_MAX_EMAIL_TOTAL_BYTES", 2)
    with pytest.raises(ServiceError, match="50 MB"):
        await service.send_email(
            ["to@example.com"], "Subject", "Body",
            attachments=[invalid_payloads[3]],
        )
    monkeypatch.setattr(module, "_MAX_EMAIL_TOTAL_BYTES", 50_000_000)
    with pytest.raises(ServiceError, match="No more than 5"):
        await service.send_email(
            ["to@example.com"], "Subject", "Body",
            attachments=[invalid_payloads[3]] * 6,
        )

    captured = {}
    monkeypatch.setattr(
        module,
        "zimbra_send_message",
        lambda host, token, recipients, subject, body, **kwargs: captured.update(
            body=body, options=kwargs,
        ) or {"message_id": "sent-attachment"},
    )
    result = await service.send_email(
        ["to@example.com"],
        "Subject",
        '<p style="color: red; position: fixed">Safe<img src="https://evil.test/x" onerror="alert(1)"></p><script>alert(2)</script><a href="javascript:alert(3)">link</a>',
        body_format="html",
        attachments=[invalid_payloads[3]],
    )
    assert result["message_id"] == "sent-attachment"
    assert captured["options"]["body_format"] == "html"
    assert captured["options"]["attachments"][0].filename == "report.txt"
    assert captured["options"]["attachments"][0].data == b"hello"
    assert "script" not in captured["body"].lower()
    assert "img" not in captured["body"].lower()
    assert "javascript:" not in captured["body"].lower()
    assert "onerror" not in captured["body"].lower()
    assert "position: fixed" not in captured["body"].lower()


@pytest.mark.asyncio
async def test_selected_attachments_are_sent_for_new_reply_and_forward_and_forward_preserves_source(monkeypatch):
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(allow_send=True), identity=identity)
    upload_calls = []
    requests = []
    source_xml = '''<GetMsgResponse xmlns="urn:zimbraMail"><m id="42">
      <su>Incident update</su>
      <e t="f" a="sender@example.com"/><e t="r" a="reply@example.com"/><e t="t" a="analyst@example.com"/>
      <mp ct="text/plain" body="1"><content>Original content</content></mp>
      <mp ct="text/html" body="1"><content>&lt;p&gt;Original HTML&lt;/p&gt;</content></mp>
      <mp part="2" filename="source.pdf" ct="application/pdf" cd="attachment" s="10"/>
      <header n="Message-ID">&lt;message-42@example.com&gt;</header>
    </m></GetMsgResponse>'''

    def fake_upload(self, attachments):
        upload_calls.append(list(attachments))
        return tuple(f"aid-{len(upload_calls)}-{index}" for index, _ in enumerate(attachments))

    def fake_soap(host, body, auth_token="", **options):
        request = ET.fromstring(body)
        requests.append(request)
        if request.tag.endswith("GetMsgRequest"):
            return ET.fromstring(source_xml)
        return ET.fromstring('<SendMsgResponse xmlns="urn:zimbraMail"><m id="sent-attachment"/></SendMsgResponse>')

    monkeypatch.setattr(transport._TokenClient, "_upload_attachments", fake_upload)
    monkeypatch.setattr(transport, "soap_request", fake_soap)
    attachment = {
        "filename": "selected.txt",
        "content_type": "text/plain",
        "data": base64.b64encode(b"selected bytes").decode(),
    }

    for kwargs in (
        {"action": "send", "to": ["to@example.com"], "subject": "New"},
        {"action": "reply", "source_message_id": "42"},
        {"action": "forward", "source_message_id": "42", "to": ["to@example.com"]},
    ):
        result = await service.send_email(
            kwargs.pop("to", None),
            kwargs.pop("subject", "Re: Incident update"),
            "<p>Selected note</p>",
            attachments=[attachment],
            body_format="html",
            **kwargs,
        )
        assert result["sent"] is True

    assert len(upload_calls) == 3
    assert all(items[0].data == b"selected bytes" for items in upload_calls)
    send_requests = [request for request in requests if request.tag.endswith("SendMsgRequest")]
    assert len(send_requests) == 3
    new_attachment = send_requests[0].find(".//{*}attach[@aid='aid-1-0']")
    assert new_attachment is not None
    reply_attachment = send_requests[1].find(".//{*}attach[@aid='aid-2-0']")
    assert reply_attachment is not None
    forward_message = send_requests[2].find("{*}m")
    assert forward_message.find("{*}attach[@aid='aid-3-0']") is not None
    source_attachments = forward_message.findall("{*}attach/{*}mp")
    assert {(item.get("mid"), item.get("part")) for item in source_attachments} == {("42", "2")}








def test_upstream_errors_are_actionable_without_returning_raw_details():
    error = _upstream_error(RuntimeError("Zimbra SOAP fault: authentication failed for secret@example.com"))

    assert error.code == "zimbra_auth_error"
    assert "authentication failed" in error.message.lower()
    assert "secret@example.com" not in error.message










@pytest.mark.asyncio
async def test_attachment_limits_and_unsupported_types_return_stable_errors(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {
            "id": "42",
            "attachments": [{"part": "2", "filename": "archive.bin", "content_type": "application/octet-stream", "size": 50}],
        },
    )
    service = ZimbraService(settings(max_attachment_bytes=10, max_attachment_text_chars=20))

    with pytest.raises(ServiceError) as oversized:
        await service.get_attachment_text("42", "2")
    assert oversized.value.code == "attachment_too_large"

    service.settings = settings(max_attachment_bytes=100, max_attachment_text_chars=20)
    monkeypatch.setattr(module, "download_attachment", lambda *args, **kwargs: b"binary")
    unsupported = await service.get_attachment_text("42", "2")
    assert unsupported["skipped"] is True
    assert unsupported["readable"] is False
    assert unsupported["skip_reason"] == "attachment_unsupported"


@pytest.mark.asyncio
async def test_attachment_conversion_failure_is_skipped_and_other_parts_remain_readable(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {
            "id": "42",
            "attachments": [
                {"part": "2", "filename": "image.jpg", "content_type": "image/jpeg", "size": 4},
                {"part": "3", "filename": "notes.txt", "content_type": "text/plain", "size": 4},
            ],
        },
    )
    monkeypatch.setattr(
        module,
        "download_attachment",
        lambda *args, **kwargs: b"bad" if args[3] == "2" else b"good",
    )

    class Converter:
        def convert(self, data, filename, content_type, limits):
            if data == b"bad":
                raise ServiceError("attachment_unsupported", "not readable")
            return {"filename": filename, "content_type": content_type, "text": "readable"}

    service = ZimbraService(settings(max_attachment_bytes=100),)
    service._attachment_converter = Converter()

    skipped = await service.get_attachment_text("42", "2")
    readable = await service.get_attachment_text("42", "3")

    assert skipped["readable"] is False
    assert skipped["skipped"] is True
    assert skipped["skip_reason"] == "attachment_unsupported"
    assert "text" not in skipped
    assert readable["text"] == "readable"


@pytest.mark.asyncio
async def test_unexpected_converter_exception_is_skipped_after_successful_download(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {
            "id": "42",
            "attachments": [{"part": "3", "filename": "forwarded.eml", "content_type": "message/rfc822", "size": 4}],
        },
    )
    monkeypatch.setattr(module, "download_attachment", lambda *args, **kwargs: b"mail")

    class Converter:
        def convert(self, *args, **kwargs):
            raise RuntimeError("converter plugin crashed")

    service = ZimbraService(settings(max_attachment_bytes=100))
    service._attachment_converter = Converter()

    result = await service.get_attachment_text("42", "3")

    assert result["readable"] is False
    assert result["skipped"] is True
    assert result["skip_reason"] == "attachment_conversion_failed"
    assert "text" not in result
