from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path

import pytest


def _write_module(monkeypatch, tmp_path):
    root = Path(__file__).resolve().parents[5]
    path = root / "integrations" / "splunk_citic_write_extension" / "bin" / "citic_saved_search_write_extension.py"
    monkeypatch.setenv("CITIC_WRITE_OPERATION_DB", str(tmp_path / "operations.sqlite3"))
    monkeypatch.setenv("CITIC_WRITE_MCP_TOKEN", "extension-token")
    monkeypatch.setenv("CITIC_WRITE_ALLOWED_APPS", "search")
    monkeypatch.setenv("CITIC_WRITE_ALLOWED_OWNERS", "nobody")
    spec = importlib.util.spec_from_file_location(f"citic_write_extension_test_{uuid.uuid4().hex}", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _fields():
    return {
        "name": "CPC suspicious login",
        "search": "index=CPC_security | stats count by user",
        "app": "search",
        "owner": "nobody",
        "disabled": True,
        "is_scheduled": True,
        "cron_schedule": "*/5 * * * *",
        "actions": "citic_alert_delivery",
        "action.citic_alert_delivery": True,
        "action.citic_alert_delivery.param.registration_id": "registration-1",
    }


def _readback(fields):
    content = dict(fields)
    content["disabled"] = "1"
    content["is_scheduled"] = "1"
    content["actions"] = ["citic_alert_delivery"]
    content["action.citic_alert_delivery"] = "1"
    content["revision"] = "revision-2"
    return {"entry": [{"content": content}]}


def test_write_extension_enforces_disabled_action_and_verifies_readback(monkeypatch, tmp_path):
    module = _write_module(monkeypatch, tmp_path)
    extension = module.WriteExtension()
    extension.splunk_url = "https://splunk.example.test"
    extension.splunk_token = "splunk-token"
    fields = _fields()
    calls = []

    def rest(method, url, form=None):
        calls.append((method, url, form))
        return {} if method == "POST" else _readback(fields)

    extension._rest = rest
    result = extension.write("create_saved_search", fields, "", "create-1")
    assert result["revision"] == "revision-2"
    assert calls[0][0] == "POST"
    assert calls[0][2]["name"] == fields["name"]
    assert calls[1][0] == "GET"

    invalid = dict(fields, actions="email,citic_alert_delivery")
    with pytest.raises(ValueError, match="only the approved"):
        extension.write("create_saved_search", invalid, "", "create-2")

    unknown_parameter = dict(fields)
    unknown_parameter["action.citic_alert_delivery.param.unapproved"] = "value"
    with pytest.raises(ValueError, match="unsupported saved-search fields"):
        extension.write("create_saved_search", unknown_parameter, "", "create-3")


def test_write_extension_reconciles_timeout_without_second_write(monkeypatch, tmp_path):
    module = _write_module(monkeypatch, tmp_path)
    extension = module.WriteExtension()
    extension.splunk_url = "https://splunk.example.test"
    extension.splunk_token = "splunk-token"
    fields = _fields()
    calls = {"perform": 0, "read": 0}

    def timeout(*args, **kwargs):
        calls["perform"] += 1
        raise TimeoutError("network timeout")

    extension._perform = timeout
    with pytest.raises(TimeoutError):
        extension.write("create_saved_search", fields, "", "timeout-1")

    def rest(method, url, form=None):
        calls["read"] += 1
        assert method == "GET"
        return _readback(fields)

    extension._rest = rest
    status = extension.operation_status("timeout-1")
    assert status["status"] == "succeeded"
    assert calls == {"perform": 1, "read": 1}
    assert extension.operation_status("timeout-1")["status"] == "succeeded"
    assert calls["perform"] == 1
