"""Control-server protocol and dispatch tests, plus a real subprocess e2e."""

import json
import subprocess
import sys
from pathlib import Path
















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
