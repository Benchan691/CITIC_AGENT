"""Authenticated client for the webserver subscription API."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

import httpx

from ..config import EmailServerSettings, redact_endpoint
from ..errors import ConfigurationError, ServiceError


class EmailSubscriptionService:
    MAX_REDIRECTS = 5

    def __init__(self, settings: EmailServerSettings, client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings
        self._client = client or httpx.AsyncClient(
            base_url=settings.url,
            follow_redirects=False,
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
        try:
            parsed = httpx.URL(self.settings.url)
        except httpx.InvalidURL as exc:
            raise ConfigurationError("Email server", ["SUBSCRIPTION_SERVER_URL"]) from exc
        if parsed.scheme not in {"http", "https"} or not parsed.host:
            raise ConfigurationError("Email server", ["SUBSCRIPTION_SERVER_URL"])
        if parsed.scheme == "http" and not self.settings.allow_insecure_http:
            raise ConfigurationError(
                "Email server",
                ["SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP"],
            )

    @staticmethod
    def _effective_port(url: httpx.URL) -> int | None:
        if url.port is not None:
            return url.port
        return {"http": 80, "https": 443}.get(url.scheme)

    def _validate_redirect(self, current: httpx.URL, target: httpx.URL) -> None:
        if target.scheme not in {"http", "https"} or not target.host:
            raise ServiceError(
                "email_server_redirect_rejected",
                "The email webserver returned an unsupported redirect.",
            )
        if target.username or target.password:
            raise ServiceError(
                "email_server_redirect_rejected",
                "The email webserver returned a redirect with embedded credentials.",
            )
        same_authority = (
            current.host.casefold() == target.host.casefold()
            and self._effective_port(current) == self._effective_port(target)
        )
        if not same_authority:
            raise ServiceError(
                "email_server_redirect_rejected",
                "The email webserver returned a cross-authority redirect.",
            )
        if current.scheme == "https" and target.scheme != "https":
            raise ServiceError(
                "email_server_redirect_rejected",
                "The email webserver returned an insecure redirect.",
            )

    async def _request_with_redirects(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            response = await self._client.request(
                method,
                path,
                follow_redirects=False,
                **kwargs,
            )
        except httpx.InvalidURL as exc:
            raise ServiceError(
                "email_server_redirect_rejected",
                "The email webserver returned a malformed redirect.",
            ) from exc
        redirects = 0
        while response.status_code in {301, 302, 303, 307, 308}:
            if redirects >= self.MAX_REDIRECTS:
                raise ServiceError(
                    "email_server_redirect_rejected",
                    "The email webserver returned too many redirects.",
                )
            try:
                next_request = getattr(response, "next_request", None)
            except (httpx.InvalidURL, RuntimeError, ValueError):
                next_request = None
            if next_request is None:
                raise ServiceError(
                    "email_server_redirect_rejected",
                    "The email webserver returned a malformed redirect.",
                )
            self._validate_redirect(response.url, next_request.url)
            await response.aread()
            await response.aclose()
            try:
                response = await self._client.send(next_request, follow_redirects=False)
            except httpx.InvalidURL as exc:
                raise ServiceError(
                    "email_server_redirect_rejected",
                    "The email webserver returned a malformed redirect.",
                ) from exc
            redirects += 1
        return response

    async def _login(self) -> None:
        self._require_configuration()
        try:
            response = await self._request_with_redirects(
                "POST",
                "/login/local",
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
        if response.status_code >= 400 or response.url.path == "/login/local":
            raise ServiceError(
                "email_server_auth_failed",
                "The email webserver credentials were rejected.",
            )
        self._authenticated = True

    @staticmethod
    def _remote_message(response: httpx.Response) -> str:
        # Remote response bodies are untrusted and may reflect submitted
        # credentials. Keep them out of the local error surface entirely.
        return "The email webserver rejected the request."

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        self._require_configuration()
        if not self._authenticated:
            await self._login()
        try:
            response = await self._request_with_redirects(method, path, **kwargs)
            if response.status_code == 401:
                self._authenticated = False
                await self._login()
                response = await self._request_with_redirects(method, path, **kwargs)
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
    def _subscription_path(subscription_id: str) -> str:
        return f"/api/subscriptions/{quote(subscription_id, safe='')}"

    @staticmethod
    def _emails(value: list[str] | None, *, required: bool = False) -> list[str] | None:
        if value is None:
            if required:
                raise ServiceError("invalid_input", "emails are required.")
            return None
        if not isinstance(value, list):
            raise ServiceError("invalid_input", "emails must be a list.")
        emails = [str(item or "").strip() for item in value]
        if not emails or any(not email for email in emails):
            raise ServiceError("invalid_input", "emails must contain at least one address.")
        if len(emails) > 50:
            raise ServiceError("invalid_input", "emails cannot contain more than 50 addresses.")
        return emails

    @staticmethod
    def _profile(value: dict[str, Any] | None, name: str) -> dict[str, Any] | None:
        if value is not None and not isinstance(value, dict):
            raise ServiceError("invalid_input", f"{name} must be an object.")
        return value

    async def list_subscriptions(self) -> dict[str, Any]:
        payload = await self._request("GET", "/api/subscriptions")
        return {"subscriptions": payload.get("data", [])}

    async def test_connection(self) -> dict[str, Any]:
        result = await self.list_subscriptions()
        return {
            "ok": True,
            "url": redact_endpoint(self.settings.url),
            "subscription_count": len(result["subscriptions"]),
        }

    async def get_subscription_schema(self) -> dict[str, Any]:
        return await self._request("GET", "/api/subscriptions/schema")

    async def preview_subscription(
        self,
        mode: str = "create",
        subscription_id: str = "",
        username: str = "",
        emails: list[str] | None = None,
        organization: str = "",
        local_subscription: bool = False,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        mode = str(mode or "").strip().lower()
        if mode not in {"create", "update"}:
            raise ServiceError("invalid_input", "mode must be create or update.")
        payload: dict[str, Any] = {"mode": mode}
        subscription_id = str(subscription_id or "").strip()
        if mode == "update" and not subscription_id:
            raise ServiceError("invalid_input", "subscription_id is required for update preview.")
        if subscription_id:
            payload["subscription_id"] = subscription_id
        username = str(username or "").strip()
        if username:
            payload["username"] = username
        normalized_emails = self._emails(emails)
        if normalized_emails is not None:
            payload["emails"] = normalized_emails
        organization = str(organization or "").strip()
        if organization:
            payload["organization"] = organization
        payload["local_subscription"] = bool(local_subscription)
        if self._profile(newsletter_profile, "newsletter_profile") is not None:
            payload["newsletter_profile"] = newsletter_profile
        if self._profile(report_profile, "report_profile") is not None:
            payload["report_profile"] = report_profile
        return await self._request("POST", "/api/subscriptions/preview", json=payload)

    async def create_subscription(
        self,
        username: str,
        emails: list[str],
        organization: str = "",
        local_subscription: bool = False,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        username = str(username or "").strip()
        if not username:
            raise ServiceError("invalid_input", "username is required.")
        normalized_emails = self._emails(emails, required=True)
        payload: dict[str, Any] = {
            "username": username,
            "emails": normalized_emails,
            "local_subscription": bool(local_subscription),
        }
        organization = str(organization or "").strip()
        if organization:
            payload["organization"] = organization
        if self._profile(newsletter_profile, "newsletter_profile") is not None:
            payload["newsletter_profile"] = newsletter_profile
        if self._profile(report_profile, "report_profile") is not None:
            payload["report_profile"] = report_profile
        return await self._request("POST", "/api/subscriptions", json=payload)

    async def update_subscription(
        self,
        subscription_id: str,
        username: str | None = None,
        emails: list[str] | None = None,
        organization: str | None = None,
        newsletter_profile: dict[str, Any] | None = None,
        report_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        subscription_id = str(subscription_id or "").strip()
        if not subscription_id:
            raise ServiceError("invalid_input", "subscription_id is required.")
        if username is None and emails is None and organization is None and newsletter_profile is None and report_profile is None:
            raise ServiceError("invalid_input", "At least one subscription field is required.")
        payload: dict[str, Any] = {}
        if username is not None:
            username = str(username).strip()
            if not username:
                raise ServiceError("invalid_input", "username cannot be empty.")
            payload["username"] = username
        normalized_emails = self._emails(emails)
        if normalized_emails is not None:
            payload["emails"] = normalized_emails
        if organization is not None:
            payload["organization"] = str(organization).strip()
        if self._profile(newsletter_profile, "newsletter_profile") is not None:
            payload["newsletter_profile"] = newsletter_profile
        if self._profile(report_profile, "report_profile") is not None:
            payload["report_profile"] = report_profile
        return await self._request("PUT", self._subscription_path(subscription_id), json=payload)

    async def delete_subscription(self, subscription_id: str) -> dict[str, Any]:
        subscription_id = str(subscription_id or "").strip()
        if not subscription_id:
            raise ServiceError("invalid_input", "subscription_id is required.")
        return await self._request("DELETE", self._subscription_path(subscription_id))
