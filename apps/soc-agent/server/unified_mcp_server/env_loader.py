"""Load environment files and the optional JSON Splunk configuration."""

from __future__ import annotations

import json
from collections.abc import Mapping
from os import environ
from pathlib import Path
from typing import Any

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


def splunk_config_path(values: Mapping[str, str] | None = None) -> Path:
    """Return the configured Splunk JSON path, relative to the server root."""
    env = environ if values is None else values
    configured = str(env.get("SPL_CONFIG_FILE") or env.get("SPLUNK_CONFIG_FILE") or "").strip()
    if configured:
        path = Path(configured).expanduser()
        return path if path.is_absolute() else server_root() / path

    server_config = server_root() / "spl_config.json"
    if server_config.is_file():
        return server_config
    return workspace_root() / "spl_config.json"


def load_splunk_config(values: Mapping[str, str] | None = None) -> dict[str, Any]:
    """Read and validate the Splunk JSON configuration object.

    A missing default file is allowed so existing deployments can continue to
    use their environment/database fallback. An explicitly selected file must
    exist and contain a JSON object.
    """
    env = environ if values is None else values
    configured = bool(str(env.get("SPL_CONFIG_FILE") or env.get("SPLUNK_CONFIG_FILE") or "").strip())
    path = splunk_config_path(values)
    if not path.exists():
        if configured:
            raise ValueError(f"Splunk configuration file does not exist: {path}")
        return {}
    if not path.is_file():
        raise ValueError(f"Splunk configuration path is not a file: {path}")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Unable to read Splunk configuration JSON from {path}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"Splunk configuration JSON must contain an object: {path}")
    return payload


def load_server_env() -> None:
    load_dotenv(server_root() / ".env", override=True)
    load_dotenv(workspace_root() / ".env", override=True)
