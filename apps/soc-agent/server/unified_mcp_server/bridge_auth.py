"""Authenticate calls from the Node host to private Python helpers.

The browser/session identity is resolved by the host process. Python helper
commands must not treat a JSON ``actor_id`` or ``admin`` flag as proof of that
identity, especially when a helper is invoked directly from a shell. The host
therefore signs a short-lived capability and passes the matching secret only
to its child process.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from collections.abc import Mapping
from typing import Any

from .errors import ServiceError


BRIDGE_VERSION = 1
BRIDGE_MAX_AGE_SECONDS = 300


def _decode(value: str) -> bytes:
    try:
        padding = "=" * (-len(value) % 4)
        return base64.urlsafe_b64decode(value + padding)
    except (TypeError, ValueError) as exc:
        raise ServiceError("bridge_authentication_required", "private helper authentication is invalid") from exc


def verify_host_capability(token: Any, *, command: str, kind: str) -> dict[str, Any]:
    """Verify a host-issued capability and return its trusted claims."""

    secret = os.environ.get("SOC_AGENT_BRIDGE_SECRET", "").strip()
    raw = str(token or "").strip()
    if not secret or not raw:
        raise ServiceError("bridge_authentication_required", "private helper authentication is required")
    parts = raw.split(".")
    if len(parts) != 2 or not all(parts):
        raise ServiceError("bridge_authentication_required", "private helper authentication is invalid")
    encoded, supplied_signature = parts
    expected_signature = hmac.new(
        secret.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256
    ).digest()
    actual_signature = _decode(supplied_signature)
    if not hmac.compare_digest(actual_signature, expected_signature):
        raise ServiceError("bridge_authentication_required", "private helper authentication is invalid")
    claims_value = _decode(encoded)
    try:
        claims = json.loads(claims_value.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ServiceError("bridge_authentication_required", "private helper authentication is invalid") from exc
    if not isinstance(claims, Mapping):
        raise ServiceError("bridge_authentication_required", "private helper authentication is invalid")
    if claims.get("version") != BRIDGE_VERSION or claims.get("command") != command or claims.get("kind") != kind:
        raise ServiceError(
            "bridge_authentication_required",
            "private helper authentication is not valid for this operation",
        )
    issued_at = claims.get("issued_at")
    if isinstance(issued_at, bool) or not isinstance(issued_at, int):
        raise ServiceError("bridge_authentication_required", "private helper authentication is expired")
    if abs(int(time.time()) - issued_at) > BRIDGE_MAX_AGE_SECONDS:
        raise ServiceError("bridge_authentication_required", "private helper authentication is expired")
    actor_id = claims.get("actor_id", "")
    if not isinstance(actor_id, str) or len(actor_id) > 320:
        raise ServiceError("bridge_authentication_required", "private helper actor is invalid")
    return {"kind": kind, "command": command, "actor_id": actor_id.strip()}


def require_host_capability(payload: Mapping[str, Any], *, command: str, kind: str) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        raise ServiceError("bridge_authentication_required", "private helper authentication is required")
    return verify_host_capability(payload.get("_host_capability"), command=command, kind=kind)


__all__ = [
    "BRIDGE_MAX_AGE_SECONDS",
    "BRIDGE_VERSION",
    "require_host_capability",
    "verify_host_capability",
]
