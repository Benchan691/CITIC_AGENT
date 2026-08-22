import asyncio
from types import SimpleNamespace

import unified_mcp_server.admin_cli as module


def test_send_email_forwards_the_direct_rpc_payload(monkeypatch):
    captured = {}

    class FakeService:
        def __init__(self, settings, accounts):
            captured["settings"] = settings
            captured["accounts"] = accounts

        async def send_email(self, to, subject, body, account_id, *, cc, bcc):
            captured.update(to=to, subject=subject, body=body, account_id=account_id, cc=cc, bcc=bcc)
            return {"sent": True}

    monkeypatch.setattr(module, "_settings", lambda _store: SimpleNamespace(zimbra="zimbra-settings"))
    monkeypatch.setattr(module, "PostgresAccountStore", lambda _store: "account-store")
    monkeypatch.setattr(module, "ZimbraService", FakeService)

    result = asyncio.run(module.send_email(
        "store",
        {
            "to": ["to@example.com"],
            "cc": ["cc@example.com"],
            "bcc": ["bcc@example.com"],
            "subject": "Subject",
            "body": "Body",
            "account_id": "primary",
        },
    ))

    assert result == {"sent": True}
    assert captured == {
        "settings": "zimbra-settings",
        "accounts": "account-store",
        "to": ["to@example.com"],
        "cc": ["cc@example.com"],
        "bcc": ["bcc@example.com"],
        "subject": "Subject",
        "body": "Body",
        "account_id": "primary",
    }
