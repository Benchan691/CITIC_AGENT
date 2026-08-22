"""Authenticated client for the webserver subscription API."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

import httpx

from ..config import EmailServerSettings
from ..errors import ConfigurationError, ServiceError


class EmailSubscriptionService:
    def __init__(self, settings: EmailServerSettings, client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings
        self._client = client or httpx.AsyncClient(
            base_url=settings.url,
            follow_redirects=True,
            timeout=settings.timeout,
        )
        self._owns_client = client is None
        self._authenticated = False

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    def _require_configuration(self) -> None:
        if not self.settings.configured:
            raise ConfigurationError("Email server", self.settings.missing)

    async def _login(self) -> None:
        self._require_configuration()
        try:
            response = await self._client.post(
                "/login",
                data={
                    "username": self.settings.username,
                    "password": self.settings.password,
                },
            )
        except httpx.TimeoutException as exc:
            raise ServiceError(
                "email_server_unavailable",
                "The email webserver login timed out.",
                retryable=True,
            ) from exc
        except httpx.RequestError as exc:
            raise ServiceError(
                "email_server_unavailable",
                "The email webserver could not be reached.",
                retryable=True,
            ) from exc
        if response.status_code >= 400 or response.url.path == "/login":
            raise ServiceError(
                "email_server_auth_failed",
                "The email webserver credentials were rejected.",
            )
        self._authenticated = True

    @staticmethod
    def _remote_message(response: httpx.Response) -> str:
        if "application/json" in response.headers.get("content-type", ""):
            try:
                payload = response.json()
            except ValueError:
                payload = None
            if isinstance(payload, Mapping) and isinstance(payload.get("error"), str):
                return payload["error"]
        return "The email webserver rejected the request."

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        self._require_configuration()
        if not self._authenticated:
            await self._login()
        try:
            response = await self._client.request(method, path, **kwargs)
            if response.status_code == 401:
                self._authenticated = False
                await self._login()
                response = await self._client.request(method, path, **kwargs)
        except httpx.TimeoutException as exc:
            raise ServiceError(
                "email_server_unavailable",
                "The email webserver request timed out.",
                retryable=True,
            ) from exc
        except httpx.RequestError as exc:
            raise ServiceError(
                "email_server_unavailable",
                "The email webserver could not be reached.",
                retryable=True,
            ) from exc

        if response.status_code >= 500 or response.status_code in {408, 429}:
            raise ServiceError(
                "email_server_unavailable",
                "The email webserver is temporarily unavailable.",
                retryable=True,
                details={"status_code": response.status_code},
            )
        if response.status_code >= 400:
            raise ServiceError(
                "email_server_request_failed",
                self._remote_message(response),
                details={"status_code": response.status_code},
            )
        try:
            payload = response.json()
        except ValueError as exc:
            raise ServiceError("email_server_invalid_response", "The email webserver returned invalid JSON.") from exc
        if not isinstance(payload, dict):
            raise ServiceError("email_server_invalid_response", "The email webserver returned an unexpected response.")
        return payload

    @staticmethod
    def _email_path(email: str) -> str:
        return f"/api/subscriptions/{quote(email, safe='')}"

    @staticmethod
    def _profile(value: dict[str, Any] | None, name: str) -> dict[str, Any] | None:
        if value is not None and not isinstance(value, dict):
            raise ServiceError("invalid_input", f"{name} must be an object.")
        return value

    async def list_subscriptions(self) -> dict[str, Any]:
        payload = await self._request("GET", "/api/subscriptions")
        return {"subscriptions": payload.get("data", [])}

    async def get_subscription_schema(self) -> dict[str, Any]:
        """Return the live subscriber-facing configuration schema."""
        return await self._request("GET", "/api/subscriptions/schema")

    async def preview_subscription(
        self,
        mode: str = "create",
        email: str = "",
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        mode = str(mode or "").strip().lower()
        if mode not in {"create", "update"}:
            raise ServiceError("invalid_input", "mode must be create or update.")
        email = str(email or "").strip()
        if mode == "update" and not email:
            raise ServiceError("invalid_input", "email is required for update preview.")
        payload: dict[str, Any] = {"mode": mode}
        if email:
            payload["email"] = email
        if self._profile(newsletter_profile, "newsletter_profile") is not None:
            payload["newsletter_profile"] = newsletter_profile
        if self._profile(report_profile, "report_profile") is not None:
            payload["report_profile"] = report_profile
        return await self._request("POST", "/api/subscriptions/preview", json=payload)

    async def create_subscription(
        self,
        email: str,
        team: str,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        email = str(email or "").strip()
        team = str(team or "").strip()
        if not email or not team:
            raise ServiceError("invalid_input", "email and team are required.")
        payload: dict[str, Any] = {"email": email, "team": team}
        if self._profile(newsletter_profile, "newsletter_profile") is not None:
            payload["newsletter_profile"] = newsletter_profile
        if self._profile(report_profile, "report_profile") is not None:
            payload["report_profile"] = report_profile
        return await self._request("POST", "/api/subscriptions", json=payload)

    async def update_subscription(
        self,
        email: str,
        team: str | None = None,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        email = str(email or "").strip()
        if not email:
            raise ServiceError("invalid_input", "email is required.")
        if team is None and newsletter_profile is None and report_profile is None:
            raise ServiceError("invalid_input", "At least one subscription field is required.")
        payload: dict[str, Any] = {}
        if team is not None:
            team = str(team).strip()
            if not team:
                raise ServiceError("invalid_input", "team cannot be empty.")
            payload["team"] = team
        if self._profile(newsletter_profile, "newsletter_profile") is not None:
            payload["newsletter_profile"] = newsletter_profile
        if self._profile(report_profile, "report_profile") is not None:
            payload["report_profile"] = report_profile
        return await self._request("PUT", self._email_path(email), json=payload)

    async def delete_subscription(self, email: str) -> dict[str, Any]:
        email = str(email or "").strip()
        if not email:
            raise ServiceError("invalid_input", "email is required.")
        return await self._request("DELETE", self._email_path(email))
