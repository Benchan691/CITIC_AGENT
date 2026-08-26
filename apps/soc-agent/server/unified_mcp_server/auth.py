"""Zimbra-backed application authentication helpers."""

from __future__ import annotations

from dataclasses import dataclass

from .postgres_store import AuthenticatedSession, PostgresStore, normalize_zimbra_email


@dataclass(frozen=True)
class ZimbraIdentity:
    """The request-scoped identity used by Zimbra services."""

    user_id: str
    zimbra_email: str
    zimbra_token: str
    session_id: str

    @classmethod
    def from_session(cls, session: AuthenticatedSession) -> "ZimbraIdentity":
        return cls(
            user_id=session.user_id,
            zimbra_email=normalize_zimbra_email(session.zimbra_email),
            zimbra_token=session.zimbra_token,
            session_id=session.session_id,
        )


def public_session(session: AuthenticatedSession) -> dict[str, object]:
    """Return the browser/CLI-safe part of a session without its token."""
    return {
        "session_id": session.session_id,
        "user": {"id": session.user_id, "zimbra_email": session.zimbra_email},
        "expires_at": session.expires_at.isoformat(),
    }


def identity_for_session(store: PostgresStore | None, session_id: str) -> ZimbraIdentity | None:
    if store is None:
        return None
    session = store.get_app_session(session_id)
    return None if session is None else ZimbraIdentity.from_session(session)
