"""Control-server protocol and dispatch tests, plus a real subprocess e2e."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from unified_mcp_server.auth_cli import command_failure, dispatch_command
from unified_mcp_server.control_server import handle_request
from unified_mcp_server.errors import ServiceError


@pytest.mark.parametrize("operation", ["write", "update", "delete"])
async def test_lookup_save_dispatches_through_persistent_channel(monkeypatch, operation):
    from unified_mcp_server import auth_cli

    calls = []

    class LookupService:
        async def save_lookup(self, *args, **kwargs):
            calls.append((args, kwargs))
            return {"status": "saved", "operation": operation}

        async def close(self):
            calls.append("closed")

    monkeypatch.setattr(auth_cli, "_splunk_service", lambda payload: (LookupService(), "fixture-actor"))
    payload = {"operation": operation, "name": "fixture.csv", "expected_fingerprint": "fixture-version"}
    if operation != "delete":
        payload["content"] = "key,value\nexample,1\n"
    result = await handle_request({"id": "lookup-save", "command": "save-lookup", "payload": payload})

    assert result == {"id": "lookup-save", "ok": True, "result": {"status": "saved", "operation": operation}}
    assert calls == [
        ((operation, "fixture.csv"), {
            "content": payload.get("content"),
            "expected_fingerprint": "fixture-version",
            "actor_id": "fixture-actor",
        }),
        "closed",
    ]


async def test_handle_request_returns_result_envelope():
    response = await handle_request({"id": "a1", "command": "no-real-command-can-run-here", "payload": {}})
    # Unknown commands surface as bounded operation failures, not crashes.
    assert response["id"] == "a1"
    assert response["ok"] is False
    assert response["error"]["code"] == "operation_failed"


async def test_handle_request_rejects_non_object_requests():
    response = await handle_request(["not", "an", "object"])
    assert response["id"] == ""
    assert response["ok"] is False
    assert response["error"]["code"] == "invalid_request"


async def test_handle_request_defaults_missing_fields():
    response = await handle_request({"command": "unknown-command"})
    assert response["id"] == ""
    assert response["ok"] is False


async def test_dispatch_rejects_unknown_command():
    with pytest.raises(ValueError):
        await dispatch_command("definitely-not-a-command", {})


def test_command_failure_shapes_are_bounded_and_credential_free():
    login_failure = command_failure("login", RuntimeError("password was hunter2"))
    assert login_failure == {"code": "authentication_failed", "message": "authentication failed", "details": {}}
    service_failure = command_failure("catalog-list", ServiceError("not_configured", "Catalog storage missing."))
    assert service_failure["code"] == "not_configured"
    generic = command_failure("save-detection", RuntimeError("boom"))
    assert generic == {"code": "operation_failed", "message": "The requested operation failed.", "details": {}}


def test_control_server_end_to_end_line_protocol():
    """Spawn the real server and verify framing, ids, and error shapes."""
    server_dir = Path(__file__).resolve().parents[2]
    process = subprocess.Popen(
        [sys.executable, "-m", "unified_mcp_server.control_server"],
        cwd=server_dir,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    try:
        ready = json.loads(process.stdout.readline())
        assert ready == {"ready": True}

        requests = [
            {"id": "r1", "command": "no-such-command", "payload": {}},
            {"id": "r2", "command": "logout", "payload": {"session_id": "e2e-bogus"}},
            "not json at all",
        ]
        for request in requests:
            if isinstance(request, str):
                process.stdin.write(request + "\n")
            else:
                process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()

        responses = {}
        while len(responses) < 3:
            line = process.stdout.readline()
            assert line, "control server closed stdout before all responses arrived"
            response = json.loads(line)
            responses[response.get("id") or "invalid"] = response

        assert responses["r1"]["ok"] is False
        assert responses["r1"]["error"]["code"] == "operation_failed"
        # Without APP_POSTGRES_URI the logout path fails bounded; with one
        # configured it returns a deletion result. Both are valid envelopes.
        assert responses["r2"]["ok"] in {True, False}
        assert responses["invalid"]["error"]["code"] == "invalid_request"
    finally:
        process.terminate()
        process.wait(timeout=10)
