import pytest

import unified_mcp_server.zimbra_service as module
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ConfigurationError, ServiceError
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.zimbra_service import ZimbraService, _upstream_error


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
    monkeypatch.setattr(module, "zimbra_search_query", lambda *args, **kwargs: ["42"])
    monkeypatch.setattr(
        module,
        "zimbra_get_message",
        lambda *args, **kwargs: {"id": "42", "subject": "Alert", "body": "sensitive details"},
    )
    service = ZimbraService(settings())

    search = await service.search_emails("subject:Alert")
    message = await service.get_email("42")

    assert "body" not in search["messages"][0]
    assert message["body"] == "sensitive details"


@pytest.mark.asyncio
async def test_send_is_disabled_by_default():
    with pytest.raises(ServiceError) as error:
        await ZimbraService(settings()).send_email(["to@example.com"], "Subject", "Body")
    assert error.value.code == "operation_disabled"


@pytest.mark.asyncio
async def test_unconfigured_zimbra_reports_missing_environment():
    with pytest.raises(ConfigurationError):
        await ZimbraService(settings(host="")).list_folders()


@pytest.mark.asyncio
async def test_multiple_accounts_use_the_selected_credentials(monkeypatch, tmp_path):
    captured = []
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: captured.append(cfg) or "token")
    monkeypatch.setattr(module, "zimbra_search_query", lambda *args, **kwargs: [])
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
