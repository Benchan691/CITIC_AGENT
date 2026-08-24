"""Load environment files from the server and workspace roots."""

from __future__ import annotations

from os import environ
from pathlib import Path

from dotenv import load_dotenv


def server_root() -> Path:
    return Path(__file__).resolve().parents[1]


def workspace_root() -> Path:
    explicit = (
        environ.get("MCP_SERVER_ROOT", "").strip()
        or environ.get("MCP_SEVER_ROOT", "").strip()
    )
    if explicit:
        return Path(explicit)
    return server_root().parents[2]


def load_server_env() -> None:
    load_dotenv(server_root() / ".env", override=True)
    load_dotenv(workspace_root() / ".env", override=True)
