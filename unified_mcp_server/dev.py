"""Start the local MCP server, LangGraph server, and frontend together."""

from __future__ import annotations

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
UI_DIR = ROOT / "deep-agents-ui"
LANGGRAPH_COMPOSE_OVERRIDE = ROOT / "docker-compose.langgraph.yml"


def _docker_postgres_uri(uri: str) -> str:
    """Make a host PostgreSQL URI reachable from Docker Desktop."""
    uri = uri.strip()
    if not uri:
        return ""
    parsed = urlsplit(uri)
    if parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        return uri
    hostname = parsed.hostname
    start = parsed.netloc.lower().rfind(hostname.lower())
    if start < 0:
        return uri
    if (
        start > 0
        and parsed.netloc[start - 1] == "["
        and start + len(hostname) < len(parsed.netloc)
        and parsed.netloc[start + len(hostname)] == "]"
    ):
        netloc = (
            f"{parsed.netloc[:start - 1]}host.docker.internal"
            f"{parsed.netloc[start + len(hostname) + 1:]}"
        )
        return urlunsplit(parsed._replace(netloc=netloc))
    netloc = f"{parsed.netloc[:start]}host.docker.internal{parsed.netloc[start + len(hostname):]}"
    return urlunsplit(parsed._replace(netloc=netloc))


def _wait_for_port(
    process: subprocess.Popen,
    port: int,
    label: str,
    timeout_seconds: int = 45,
) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"{label} stopped before port {port} became available.")
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return
        except OSError:
            time.sleep(0.25)
    raise RuntimeError(f"Timed out waiting for {label} on port {port}.")


def _command(name: str, fallback: str) -> str:
    return shutil.which(name) or fallback


def _langgraph_command(environment: dict[str, str]) -> list[str]:
    """Build the persistent, Docker-backed LangGraph command.

    ``langgraph dev`` uses an in-memory checkpointer, so its threads disappear
    when the process restarts. ``langgraph up`` provisions PostgreSQL in a
    named Docker volume unless an external URI is supplied.
    """

    command = [
        _command("langgraph", "langgraph"),
        "up",
        "--port",
        "2024",
        "--docker-compose",
        str(LANGGRAPH_COMPOSE_OVERRIDE),
    ]
    command.append(
        "--pull"
        if environment.get("LANGGRAPH_PULL", "false").lower() in {"1", "true", "yes"}
        else "--no-pull"
    )
    postgres_uri = next(
        (
            _docker_postgres_uri(environment.get(name, ""))
            for name in ("LANGGRAPH_POSTGRES_URI", "POSTGRES_URI", "APP_POSTGRES_URI")
            if environment.get(name, "").strip()
        ),
        "",
    )
    if postgres_uri:
        command.extend(["--postgres-uri", postgres_uri])
    return command


def main() -> None:
    load_dotenv(ROOT / ".env")
    environment = os.environ.copy()
    try:
        langgraph_startup_timeout = max(
            45,
            int(environment.get("LANGGRAPH_STARTUP_TIMEOUT_SECONDS", "600")),
        )
    except ValueError as exc:
        raise SystemExit("LANGGRAPH_STARTUP_TIMEOUT_SECONDS must be an integer.") from exc
    environment.update(
        {
            "MCP_TRANSPORT": "streamable-http",
            # The LangGraph API runs in Docker and reaches this host process
            # through host.docker.internal.
            "MCP_HOST": "0.0.0.0",
            "MCP_PORT": "8050",
            "MCP_SERVER_URL": "http://127.0.0.1:8050/mcp",
        }
    )
    langgraph_environment = environment.copy()
    langgraph_environment["APP_POSTGRES_URI_DOCKER"] = _docker_postgres_uri(
        environment.get("APP_POSTGRES_URI", "")
    )
    langgraph_environment["APP_POSTGRES_URI"] = langgraph_environment["APP_POSTGRES_URI_DOCKER"]
    for name in ("LANGGRAPH_POSTGRES_URI", "POSTGRES_URI"):
        if langgraph_environment.get(name, "").strip():
            langgraph_environment[name] = _docker_postgres_uri(langgraph_environment[name])

    processes: list[subprocess.Popen] = []

    def stop_all(*_args) -> None:
        for process in reversed(processes):
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass

    signal.signal(signal.SIGINT, stop_all)
    signal.signal(signal.SIGTERM, stop_all)

    try:
        processes.append(
            subprocess.Popen(
                [sys.executable, "-m", "unified_mcp_server.server"],
                cwd=ROOT,
                env=environment,
                start_new_session=True,
            )
        )
        _wait_for_port(processes[-1], 8050, "MCP server")

        processes.append(
            subprocess.Popen(
                _langgraph_command(langgraph_environment),
                cwd=ROOT,
                env=langgraph_environment,
                start_new_session=True,
            )
        )
        _wait_for_port(
            processes[-1],
            2024,
            "LangGraph server",
            timeout_seconds=langgraph_startup_timeout,
        )

        processes.append(
            subprocess.Popen(
                [_command("corepack", "corepack"), "yarn", "--cwd", str(UI_DIR), "dev"],
                cwd=ROOT,
                env=environment,
                start_new_session=True,
            )
        )
        print("\nUI: http://localhost:3000")
        print("Press Ctrl+C to stop the UI, LangGraph, and MCP server.\n", flush=True)
        processes[-1].wait()
    except (OSError, RuntimeError) as exc:
        print(f"\nStartup failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    finally:
        stop_all()


if __name__ == "__main__":
    main()
