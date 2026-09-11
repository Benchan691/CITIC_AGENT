import pytest

import unified_mcp_server.zimbra_service as module
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.zimbra_service import ZimbraService, _upstream_error


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
