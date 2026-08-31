"""Load the server's deployment environment."""

from __future__ import annotations

from os import environ
from pathlib import Path

from dotenv import load_dotenv


_NODE_ONLY_ENV_NAMES = ("SOC_ADMIN_EMAIL", "SOC_ADMIN_PASSWORD")


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
    # The static administrator identity belongs only to the Node host. Python
    # commands never need it, even when they load the shared .env file.
    for name in _NODE_ONLY_ENV_NAMES:
        environ.pop(name, None)
