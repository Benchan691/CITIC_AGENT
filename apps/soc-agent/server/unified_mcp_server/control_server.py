"""Persistent private control channel for authenticated host operations.

The host keeps one long-lived Python process instead of paying interpreter
startup for every UI RPC (settings reloads, mail services, and module imports
are paid once rather than per operation).

Protocol: one JSON request object per stdin line
``{"id": "...", "command": "...", "payload": {...}}`` and one JSON response
object per stdout line ``{"id": "...", "ok": true, "result": ...}`` or
``{"id": "...", "ok": false, "error": {...}}``. Responses carry the request id
and may complete out of order; requests run concurrently. The first stdout
line is ``{"ready": true}`` so the host can bound startup. Failure payloads
are exactly the bounded, credential-free objects the CLI emits on stderr.
"""

from __future__ import annotations

import asyncio
import json
import sys
import threading
from typing import Any

from .auth_cli import _expire_session_on_auth_error, command_failure, dispatch_command
from .env_loader import load_server_env

# Detection saves carry full SPL and catalog saves carry record payloads;
# this bound keeps one malformed or oversized line from consuming memory.
MAX_LINE_BYTES = 8_000_000
MAX_CONCURRENT_REQUESTS = 8


async def handle_request(request: Any) -> dict[str, Any]:
    """Execute one control request and return its response object."""
    if not isinstance(request, dict):
        return {"id": "", "ok": False, "error": {"code": "invalid_request", "message": "Request must be an object.", "details": {}}}
    request_id = str(request.get("id", "") or "")[:64]
    command = str(request.get("command", "") or "")
    payload = request.get("payload")
    if not isinstance(payload, dict):
        payload = {}
    try:
        result = await dispatch_command(command, payload)
    except Exception as exc:
        _expire_session_on_auth_error(payload, exc)
        error = command_failure(command, exc)
        error["details"] = error.get("details") or {}
        return {"id": request_id, "ok": False, "error": error}
    return {"id": request_id, "ok": True, "result": result}


class ControlServer:
    """Line-protocol loop over stdin/stdout with concurrent request handling.

    Responses are written synchronously under a lock: lines are bounded and
    the host drains stdout continuously, so a blocking flush only waits for
    the pipe buffer and never stalls a concurrent request's handling.
    """

    def __init__(self, reader: asyncio.StreamReader, output) -> None:
        self.reader = reader
        self._output = output
        self._write_lock = threading.Lock()
        self._in_flight: set[asyncio.Task] = set()

    def _write_line(self, payload: dict[str, Any]) -> None:
        line = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode() + b"\n"
        with self._write_lock:
            self._output.write(line)
            self._output.flush()

    async def _run_one(self, request: Any) -> None:
        try:
            response = await handle_request(request)
        except Exception:
            response = {"id": "", "ok": False, "error": {"code": "operation_failed", "message": "The requested operation failed.", "details": {}}}
        await asyncio.get_running_loop().run_in_executor(None, self._write_line, response)

    async def serve(self) -> None:
        self._write_line({"ready": True})
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

        async def guarded(request: Any) -> None:
            async with semaphore:
                await self._run_one(request)

        while True:
            line = await self.reader.readline()
            if not line:
                return
            if len(line) > MAX_LINE_BYTES:
                await asyncio.get_running_loop().run_in_executor(None, self._write_line, {"id": "", "ok": False, "error": {"code": "invalid_request", "message": "Request line is too large.", "details": {}}})
                continue
            try:
                request = json.loads(line)
            except (json.JSONDecodeError, UnicodeDecodeError):
                await asyncio.get_running_loop().run_in_executor(None, self._write_line, {"id": "", "ok": False, "error": {"code": "invalid_request", "message": "Request line is not valid JSON.", "details": {}}})
                continue
            task = asyncio.create_task(guarded(request))
            self._in_flight.add(task)
            task.add_done_callback(self._in_flight.discard)


async def main() -> None:
    load_server_env()
    try:
        reader = asyncio.StreamReader()
        await asyncio.get_running_loop().connect_read_pipe(
            lambda: asyncio.StreamReaderProtocol(reader), sys.stdin
        )
    except Exception:
        print(json.dumps({"ready": False, "error": "stdin is not a readable pipe"}), file=sys.stderr)
        raise SystemExit(1) from None
    await ControlServer(reader, sys.stdout.buffer).serve()


if __name__ == "__main__":
    asyncio.run(main())
