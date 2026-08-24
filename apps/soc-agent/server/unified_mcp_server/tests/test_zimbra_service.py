import io

import pytest
from pypdf import PdfWriter

import unified_mcp_server.zimbra_service as module
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ConfigurationError, ServiceError
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.zimbra_service import ZimbraService, _upstream_error
from unified_mcp_server.zimbra.mail.service import ZimbraMailService


def settings(**overrides):
    values = {
        "host": "mail.example.com",
        "email": "analyst@example.com",
        "password": "secret",
        "verify_ssl": True,
        "timeout": 60,
        "allow_send": False,
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
    service = ZimbraService(settings())

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
async def test_get_email_bounds_body_for_agent_context(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {"id": "42", "body": "abcdefghij"},
    )

    message = await ZimbraService(settings()).get_email("42", max_body_chars=4)

    assert message["body"] == "abcd"
    assert message["body_characters"] == 10
    assert message["body_truncated"] is True


@pytest.mark.asyncio
async def test_get_email_headers_returns_bounded_untrusted_evidence(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    captured = {}

    def fake_headers(host, token, message_id, names, **kwargs):
        captured["names"] = names
        return {"message_id": message_id, "headers": {name: [] for name in names}}

    monkeypatch.setattr(module, "zimbra_get_message_headers", fake_headers)

    result = await ZimbraService(settings()).get_email_headers(
        "42", names=["message-id", "authentication-results"]
    )

    assert captured["names"] == ["Message-ID", "Authentication-Results"]
    assert result["untrusted_evidence"] is True
    assert "body" not in result


@pytest.mark.asyncio
async def test_move_email_is_gated_validated_and_verified(monkeypatch):
    service = ZimbraService(settings())
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
async def test_send_is_disabled_by_default():
    with pytest.raises(ServiceError) as error:
        await ZimbraService(settings()).send_email(["to@example.com"], "Subject", "Body")
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
    assert draft["send_tool"] == "zimbra_send_email"


def test_runtime_email_draft_does_not_require_a_zimbra_host():
    draft = ZimbraMailService(settings(host="")).create_email_draft(
        ["to@example.com"], "Subject", "Body"
    )

    assert draft["draft"]["account_id"] == "legacy"


def test_email_draft_rejects_missing_or_malformed_recipients():
    service = ZimbraService(settings())

    with pytest.raises(ServiceError, match="recipient"):
        service.create_email_draft([], "Subject", "Body")
    with pytest.raises(ServiceError, match="recipient"):
        service.create_email_draft(["not-an-email"], "Subject", "Body")
    with pytest.raises(ServiceError, match="recipient"):
        service.create_email_draft(["to@example.com"], "Subject", "Body", cc=["bad"])


@pytest.mark.asyncio
async def test_send_forwards_copy_recipients(monkeypatch):
    captured = {}

    def fake_send(config, to, subject, body, **kwargs):
        captured.update(config=config, to=to, subject=subject, body=body, **kwargs)

    monkeypatch.setattr(module, "zimbra_send_email", fake_send)
    service = ZimbraService(settings(allow_send=True))
    result = await service.send_email(
        ["to@example.com"],
        "Subject",
        "Body",
        cc=["cc@example.com"],
        bcc=["bcc@example.com"],
    )

    assert captured["to"] == ["to@example.com"]
    assert captured["cc"] == ["cc@example.com"]
    assert captured["bcc"] == ["bcc@example.com"]
    assert captured["config"]["zimbra_email"] == "analyst@example.com"
    assert captured["config"]["zimbra_password"] == "secret"
    assert result["sent"] is True


@pytest.mark.asyncio
async def test_unconfigured_zimbra_reports_missing_environment():
    with pytest.raises(ConfigurationError):
        await ZimbraService(settings(host="")).list_folders()


@pytest.mark.asyncio
async def test_multiple_accounts_use_the_selected_credentials(monkeypatch, tmp_path):
    captured = []
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: captured.append(cfg) or "token")
    monkeypatch.setattr(module, "zimbra_search_messages", lambda *args, **kwargs: [])
    store = AccountStore(str(tmp_path / "accounts.enc"), str(tmp_path / "accounts.key"))
    first = store.add(label="One", email="one@example.com", username="one-user", password="one-secret")
    second = store.add(label="Two", email="two@example.com", username="two-user", password="two-secret")
    service = ZimbraService(settings(email="", password=""), store)

    await service.search_emails("subject:Alert", account_id=second.id)

    assert captured[0]["zimbra_email"] == "two@example.com"
    assert captured[0]["zimbra_username"] == "two-user"
    assert captured[0]["zimbra_password"] == "two-secret"
    assert first.id != second.id


def test_upstream_errors_are_actionable_without_returning_raw_details():
    error = _upstream_error(RuntimeError("Zimbra SOAP fault: authentication failed for secret@example.com"))

    assert error.code == "zimbra_auth_error"
    assert "authentication failed" in error.message.lower()
    assert "secret@example.com" not in error.message


@pytest.mark.asyncio
async def test_attachment_text_is_bounded_and_returns_evidence_metadata(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {
            "id": "42",
            "attachments": [{"part": "2", "filename": "evidence.txt", "content_type": "text/plain", "size": 8}],
        },
    )
    monkeypatch.setattr(module, "download_attachment", lambda *args, **kwargs: b"evidence")

    result = await ZimbraService(settings(max_attachment_bytes=20, max_attachment_text_chars=20)).get_attachment_text("42", "2")

    assert result["filename"] == "evidence.txt"
    assert result["text"] == "evidence"
    assert result["bytes"] == 8
    assert result["sha256"] == "ee8250fb76e094b34b471f13a73dbbe51d1ae142e9df59d7c0d31ec20f0a0a8e"


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


@pytest.mark.parametrize(
    ("filename", "content_type", "data", "code"),
    [
        ("evidence.json", "application/json", b"{broken", "attachment_malformed"),
        ("evidence.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"not-a-zip", "attachment_malformed"),
    ],
)
@pytest.mark.asyncio
async def test_malformed_attachments_return_stable_errors(monkeypatch, filename, content_type, data, code):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {
            "id": "42",
            "attachments": [{"part": "2", "filename": filename, "content_type": content_type, "size": len(data)}],
        },
    )
    monkeypatch.setattr(module, "download_attachment", lambda *args, **kwargs: data)

    with pytest.raises(ServiceError) as error:
        await ZimbraService(settings()).get_attachment_text("42", "2")
    assert error.value.code == code


@pytest.mark.asyncio
async def test_encrypted_pdf_returns_stable_error(monkeypatch):
    writer = PdfWriter()
    writer.add_blank_page(width=10, height=10)
    writer.encrypt("secret")
    buffer = io.BytesIO()
    writer.write(buffer)
    data = buffer.getvalue()
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {
            "id": "42",
            "attachments": [{"part": "2", "filename": "evidence.pdf", "content_type": "application/pdf", "size": len(data)}],
        },
    )
    monkeypatch.setattr(module, "download_attachment", lambda *args, **kwargs: data)

    with pytest.raises(ServiceError) as error:
        await ZimbraService(settings()).get_attachment_text("42", "2")
    assert error.value.code == "attachment_encrypted"


@pytest.mark.asyncio
async def test_extracted_text_is_truncated_to_the_requested_limit(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {
            "id": "42",
            "attachments": [{"part": "2", "filename": "evidence.txt", "content_type": "text/plain", "size": 8}],
        },
    )
    monkeypatch.setattr(module, "download_attachment", lambda *args, **kwargs: b"evidence")

    result = await ZimbraService(settings(max_attachment_text_chars=20)).get_attachment_text(
        "42", "2", max_chars=4
    )

    assert result["text"] == "evid"
    assert result["characters"] == 8
    assert result["text_truncated"] is True
