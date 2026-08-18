import json

from unified_mcp_server.account_store import AccountStore


def test_account_store_encrypts_and_round_trips(tmp_path):
    path = tmp_path / "accounts.enc"
    key_path = tmp_path / "accounts.key"
    store = AccountStore(str(path), str(key_path))
    account = store.add(label="Work", email="work@example.com", username="work-user", password="secret-value")

    raw = path.read_bytes()
    assert b"secret-value" not in raw
    assert store.get(account.id).password == "secret-value"
    assert store.list_public() == [{"id": account.id, "label": "Work", "email": "work@example.com", "username": "work-user"}]

    reopened = AccountStore(str(path), str(key_path))
    assert reopened.get(account.id).password == "secret-value"
    assert "password" not in json.dumps(reopened.list_public())
