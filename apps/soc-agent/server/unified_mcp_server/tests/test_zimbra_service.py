import io
import zipfile

import pytest
from pypdf import PdfWriter

import unified_mcp_server.zimbra_service as module
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ConfigurationError, ServiceError
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.zimbra_service import ZimbraService, _upstream_error
from unified_mcp_server.zimbra.mail.service import ZimbraMailService


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


def test_identity_bound_core_never_reports_legacy_environment_account():
    identity = ZimbraIdentity("user-1", "analyst@example.com", "server-token", "app-session")
    service = ZimbraMailService(settings(email="legacy@example.com", password="must-not-be-used"), identity=identity)

    assert service.account_count() == 1
    assert service.list_accounts() == [{
        "id": "authenticated",
        "label": "Authenticated Zimbra account",
        "email": "a***@example.com",
    }]


def test_http_auth_status_is_classified_as_zimbra_auth_failure():
    error = _upstream_error(RuntimeError("401 Client Error: Forbidden"))

    assert error.code == "zimbra_auth_error"


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
async def test_signature_list_create_and_delete_are_verified(monkeypatch):
    existing = [{"id": "1", "name": "Existing", "text": "old", "html": ""}]
    created_signature = {"id": "2", "name": "Work", "text": "new", "html": "<b>new</b>"}
    state = {"created": False, "deleted": False}
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    def list_signatures(*args, **kwargs):
        values = list(existing)
        if state["created"] and not state["deleted"]:
            values.append(created_signature)
        return values
    monkeypatch.setattr(module, "zimbra_list_signatures", list_signatures)
    monkeypatch.setattr(
        module,
        "zimbra_create_signature",
        lambda *args, **kwargs: state.update(created=True) or {"id": "2", "name": "Work"},
    )
    monkeypatch.setattr(module, "zimbra_delete_signature", lambda *args, **kwargs: state.update(deleted=True))
    service = ZimbraService(settings(allow_signature_write=True))

    listed = await service.list_signatures()
    assert listed["count"] == 1
    assert listed["signatures"][0]["name"] == "Existing"

    created = await service.create_signature("Work", "new", "<b>new</b>")
    assert created["signature"]["id"] == "2"

    deleted = await service.delete_signature("2")
    assert deleted["deleted"]["name"] == "Work"


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


def test_signature_create_requires_content_and_rejects_duplicate(monkeypatch):
    service = ZimbraService(settings(allow_signature_write=True))

    with pytest.raises(ServiceError, match="text or html"):
        import asyncio
        asyncio.run(service.create_signature("Work"))

    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_list_signatures",
        lambda *args, **kwargs: [{"id": "1", "name": "Work", "text": "old", "html": ""}],
    )
    monkeypatch.setattr(module, "zimbra_create_signature", lambda *args, **kwargs: pytest.fail("duplicate must not be created"))
    with pytest.raises(ServiceError, match="already exists"):
        import asyncio
        asyncio.run(service.create_signature("work", "new"))


@pytest.mark.asyncio
async def test_use_signature_on_email_returns_local_draft_with_selected_format(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(
        module,
        "zimbra_list_signatures",
        lambda *args, **kwargs: [{"id": "1", "name": "Work", "text": "-- Ben", "html": "<b>-- Ben</b>"}],
    )
    draft = await ZimbraService(settings()).use_signature_on_email(
        ["to@example.com"], "Subject", "Body", "1", body_format="html", placement="above"
    )

    assert draft["draft"]["body"] == "<b>-- Ben</b><br><br>Body"
    assert draft["draft"]["body_format"] == "html"
    assert draft["draft"]["signature"] == {"id": "1", "name": "Work"}


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
async def test_send_email_is_disabled_before_login(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda *args, **kwargs: pytest.fail("login should not be called"))
    service = ZimbraService(settings(allow_send=False))

    with pytest.raises(ServiceError) as error:
        await service.send_email(["to@example.com"], "Subject", "Body")
    assert error.value.code == "operation_disabled"


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


def test_upstream_query_errors_are_classified_for_agent_correction():
    error = _upstream_error(RuntimeError("Zimbra SOAP fault: service.PARSE_ERROR: invalid search query"))

    assert error.code == "query_validation_error"
    assert error.retryable is False
    assert "date:MM/DD/YYYY" in error.message
    assert "suggested_query" not in error.details


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
    assert result["title"] is None
    assert result["format"] == {"content_type": "text/plain", "extension": ".txt"}
    assert result["converter"]["name"] == "markitdown"
    assert result["llm_enabled"] is False


def test_markitdown_receives_bounded_stream_and_attachment_metadata(monkeypatch):
    captured = {}

    class FakeResult:
        markdown = "# Converted"
        title = "Evidence"

    class FakeMarkItDown:
        def __init__(self, **kwargs):
            captured["init"] = kwargs

        def convert_stream(self, stream, *, stream_info):
            captured["data"] = stream.read()
            captured["stream_info"] = stream_info
            return FakeResult()

    monkeypatch.setattr(module, "MarkItDown", FakeMarkItDown)
    service = ZimbraService(settings())
    text, title = service._convert_attachment_text(b"evidence", "report.txt", "text/plain")

    assert text == "# Converted"
    assert title == "Evidence"
    assert captured["init"] == {"enable_builtins": True, "enable_plugins": False}
    assert captured["data"] == b"evidence"
    assert captured["stream_info"].filename == "report.txt"
    assert captured["stream_info"].mimetype == "text/plain"
    assert captured["stream_info"].extension == ".txt"


def test_archive_member_limit_is_enforced():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for index in range(module._MAX_ARCHIVE_MEMBERS + 1):
            archive.writestr(f"{index}.txt", "x")

    with pytest.raises(ServiceError) as error:
        module._validate_archive_safety(buffer.getvalue(), "bundle.zip", "application/zip")
    assert error.value.code == "attachment_too_complex"


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
