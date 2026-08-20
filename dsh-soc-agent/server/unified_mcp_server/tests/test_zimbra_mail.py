import pytest

import unified_mcp_server.zimbra.mail.service as module
from unified_mcp_server.account_store import AccountStore
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.zimbra.mail.service import ZimbraMailService


def settings(**overrides):
    values = {
        "host": "mail.example.com",
        "email": "analyst@example.com",
        "password": "secret",
        "verify_ssl": True,
        "timeout": 60,
        "allow_send": False,
        "allow_folder_write": False,
    }
    values.update(overrides)
    return ZimbraSettings(**values)


@pytest.mark.asyncio
async def test_folder_writes_are_disabled_before_network_access(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda *args, **kwargs: pytest.fail("login should not be called"))
    service = ZimbraMailService(settings())

    with pytest.raises(ServiceError) as error:
        await service.create_folder("Investigations")

    assert error.value.code == "operation_disabled"


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["", "Parent/Child"])
async def test_folder_name_is_a_single_direct_child(monkeypatch, name):
    service = ZimbraMailService(settings(allow_folder_write=True))
    monkeypatch.setattr(module, "zimbra_login", lambda *args, **kwargs: pytest.fail("login should not be called"))

    with pytest.raises(ServiceError) as error:
        await service.create_folder(name)

    assert error.value.code == "invalid_input"


@pytest.mark.asyncio
async def test_parent_id_must_be_numeric(monkeypatch):
    service = ZimbraMailService(settings(allow_folder_write=True))
    monkeypatch.setattr(module, "zimbra_login", lambda *args, **kwargs: pytest.fail("login should not be called"))

    with pytest.raises(ServiceError) as error:
        await service.create_folder("Investigations", "root")

    assert error.value.code == "invalid_input"


@pytest.mark.asyncio
async def test_missing_parent_is_rejected(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(module, "zimbra_list_folders", lambda *args, **kwargs: [{"id": "1", "name": "", "path": "/"}])
    monkeypatch.setattr(module, "zimbra_create_folder", lambda *args, **kwargs: pytest.fail("create should not be called"))
    service = ZimbraMailService(settings(allow_folder_write=True))

    with pytest.raises(ServiceError) as error:
        await service.create_folder("Investigations", "99")

    assert error.value.code == "folder_parent_not_found"


@pytest.mark.asyncio
async def test_folder_creation_uses_selected_account_and_returns_safe_metadata(monkeypatch, tmp_path):
    captured = []
    store = AccountStore(str(tmp_path / "accounts.enc"), str(tmp_path / "accounts.key"))
    store.add(label="One", email="one@example.com", username="one-user", password="one-secret")
    second = store.add(label="Two", email="two@example.com", username="two-user", password="two-secret")
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: captured.append(cfg) or "token")
    monkeypatch.setattr(module, "zimbra_list_folders", lambda *args, **kwargs: [{"id": "1", "name": "", "path": "/"}])
    monkeypatch.setattr(
        module,
        "zimbra_create_folder",
        lambda *args, **kwargs: {"id": "42", "name": "Investigations", "path": "/Investigations", "parent_id": "1", "view": ""},
    )
    service = ZimbraMailService(settings(email="", password="", allow_folder_write=True), store)

    result = await service.create_folder("Investigations", account_id=second.id)

    assert result == {"folder": {"id": "42", "name": "Investigations", "path": "/Investigations", "parent_id": "1", "view": ""}}
    assert captured[0]["zimbra_email"] == "two@example.com"
    assert captured[0]["zimbra_password"] == "two-secret"
    assert "token" not in str(result)


@pytest.mark.asyncio
async def test_malformed_create_folder_response_is_safe(monkeypatch):
    monkeypatch.setattr(module, "zimbra_login", lambda cfg: "token")
    monkeypatch.setattr(module, "zimbra_list_folders", lambda *args, **kwargs: [{"id": "1", "name": "", "path": "/"}])
    monkeypatch.setattr(module, "zimbra_create_folder", lambda *args, **kwargs: (_ for _ in ()).throw(ValueError("raw response")))
    service = ZimbraMailService(settings(allow_folder_write=True))

    with pytest.raises(ServiceError) as error:
        await service.create_folder("Investigations")

    assert error.value.code == "zimbra_malformed_response"
    assert "raw response" not in error.value.message
