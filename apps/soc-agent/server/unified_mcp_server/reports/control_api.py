"""Authenticated host commands for report settings and file delivery."""

from __future__ import annotations

from typing import Any

from ..auth import identity_for_session
from ..errors import ServiceError
from .store import ReportStore


def _authenticated(payload):
    from ..auth_cli import _store
    store = _store()
    identity = identity_for_session(store, str(payload.get("session_id", "")))
    if identity is None:
        raise ServiceError("session_expired", "Your SOC Agent session has expired. Log in again.")
    return identity, ReportStore(store)


def report_settings_get(payload: dict[str, Any]) -> dict[str, Any]:
    identity, store = _authenticated(payload)
    return {"customers": store.get_profiles(identity.user_id, identity.zimbra_email), "account": identity.zimbra_email}


def report_settings_save(payload: dict[str, Any]) -> dict[str, Any]:
    identity, store = _authenticated(payload)
    customers = store.save_profiles(identity.user_id, identity.zimbra_email, payload.get("customers"))
    return {"customers": customers, "account": identity.zimbra_email}


def report_artifact_get(payload: dict[str, Any]) -> dict[str, Any]:
    identity, store = _authenticated(payload)
    return store.get_artifact(identity.user_id, str(payload.get("investigation_id", "")), str(payload.get("artifact_id", "")))
