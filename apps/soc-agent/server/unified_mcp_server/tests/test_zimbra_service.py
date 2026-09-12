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
    assert draft["draft"]["body"] == "Reviewed\n\nSOC analyst"
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
@pytest.mark.parametrize("note, body_format, plain_note, html_note", [
    ("Review <this> & reply", "text", "Review <this> & reply", "Review &lt;this&gt; &amp; reply"),
    ("<p>Review &amp; reply</p>", "html", "Review & reply", "<p>Review &amp; reply</p>"),
    ("", "text", "", ""),
])
async def test_forward_draft_then_confirmed_send_uses_package_and_preserves_attachments(
    monkeypatch, note, body_format, plain_note, html_note,
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
    draft = (await service.create_forward_draft(
        "42", ["to@example.com"], note, cc=["cc@example.com"], bcc=["bcc@example.com"],
    ))["draft"]
    assert len(requests) == 1 and requests[0].tag.endswith("GetMsgRequest")
    assert draft["body"] == note
    assert draft["subject"] == "Fwd: Incident update"
    assert draft["forward_message_id"] == "42"
    assert draft["account_id"] == "authenticated"
    assert draft["forwarded_message"]["body_truncated"] is True
    assert len(draft["forwarded_message"]["body"]) == 20_000
    assert draft["forwarded_message"]["attachments"][0]["filename"] == "report.pdf"

    # Exercise the same private command as the confirmed UI, with the editable note only.
    monkeypatch.setattr(auth_cli, "_service", lambda payload: service)
    result = await auth_cli.dispatch_command("send-email", {
        **{key: draft[key] for key in ("to", "cc", "bcc", "subject", "body", "forward_message_id")},
        "body_format": body_format, "session_id": "app-session",
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
async def test_forward_validation_and_send_gate_run_before_network(monkeypatch):
    monkeypatch.setattr(transport, "soap_request", lambda *a, **kw: pytest.fail("invalid request must not contact Zimbra"))
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(), identity=identity)
    for invalid_id in ("", "other-mailbox:42", "42,43", "-1", "0"):
        with pytest.raises(ServiceError) as error:
            await service.create_forward_draft(invalid_id, ["to@example.com"])
        assert error.value.code == "invalid_input"
        with pytest.raises(ServiceError) as error:
            await service.send_email(["to@example.com"], "Fwd: subject", "", forward_message_id=invalid_id)
        assert error.value.code == "invalid_input"
    with pytest.raises(ServiceError) as error:
        await service.create_forward_draft("42", ["invalid-recipient"])
    assert error.value.code == "invalid_input"
    with pytest.raises(ServiceError) as error:
        await service.send_email(["to@example.com"], "Fwd: subject", "", "another-account", forward_message_id="42")
    assert error.value.code == "account_selection_disabled"
    service.settings = settings(allow_send=False)
    with pytest.raises(ServiceError) as error:
        await service.send_email(["to@example.com"], "Fwd: subject", "", forward_message_id="42")
    assert error.value.code == "operation_disabled"


@pytest.mark.asyncio
async def test_forward_missing_source_and_failed_delivery_never_report_success(monkeypatch):
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraService(settings(), identity=identity)
    monkeypatch.setattr(module, "zimbra_get_message", lambda *a, **kw: None)
    with pytest.raises(ServiceError) as error:
        await service.create_forward_draft("42", ["to@example.com"])
    assert error.value.code == "not_found"
    monkeypatch.setattr(transport, "soap_request", lambda *a, **kw: ET.fromstring(
        '<GetMsgResponse xmlns="urn:zimbraMail"><m id="42"><su>Subject</su></m></GetMsgResponse>'
        if "GetMsgRequest" in a[1] else '<SendMsgResponse xmlns="urn:zimbraMail"/>',
    ))
    with pytest.raises(ServiceError):
        await service.send_email(["to@example.com"], "Fwd: Subject", "", forward_message_id="42")






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
    with pytest.raises(ServiceError) as unsupported:
        await service.get_attachment_text("42", "2")
    assert unsupported.value.code == "attachment_unsupported"
