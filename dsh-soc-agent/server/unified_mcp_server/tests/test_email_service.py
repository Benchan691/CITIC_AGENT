import httpx
import pytest

from unified_mcp_server.config import EmailServerSettings
from unified_mcp_server.email.service import EmailSubscriptionService
from unified_mcp_server.errors import ConfigurationError, ServiceError


def settings():
    return EmailServerSettings("http://email.example.test", "operator", "secret", 10)


def client_for(handler):
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="http://email.example.test",
        follow_redirects=True,
    )


@pytest.mark.asyncio
async def test_subscription_requests_login_once_and_use_expected_api_contract():
    requests = []

    async def handler(request):
        requests.append(request)
        if request.method == "POST" and request.url.path == "/login":
            return httpx.Response(302, headers={"location": "/subscriptions"})
        if request.method == "GET" and request.url.path == "/subscriptions":
            return httpx.Response(200, text="<html>subscriptions</html>")
        if request.method == "GET" and request.url.path == "/api/subscriptions":
            return httpx.Response(200, json={"data": [{"email": "a@example.com"}]})
        if request.method == "GET" and request.url.path == "/api/subscriptions/schema":
            return httpx.Response(200, json={"schema_version": 1, "review_collections": ["cve_review"]})
        if request.method == "POST" and request.url.path == "/api/subscriptions/preview":
            return httpx.Response(200, json={"valid": True, "mode": "create"})
        if request.method == "POST" and request.url.path == "/api/subscriptions":
            return httpx.Response(201, json={"success": True})
        if request.method == "PUT" and request.url.path == "/api/subscriptions/a@example.com":
            return httpx.Response(200, json={"success": True})
        if request.method == "DELETE" and request.url.path == "/api/subscriptions/a@example.com":
            return httpx.Response(200, json={"success": True})
        return httpx.Response(404, json={"error": "unexpected request"})

    client = client_for(handler)
    service = EmailSubscriptionService(settings(), client)
    assert await service.list_subscriptions() == {"subscriptions": [{"email": "a@example.com"}]}
    assert await service.get_subscription_schema() == {
        "schema_version": 1, "review_collections": ["cve_review"],
    }
    assert await service.preview_subscription(
        newsletter_profile={"enabled": True},
    ) == {"valid": True, "mode": "create"}
    await service.create_subscription("a@example.com", "SOC", {"enabled": True})
    await service.update_subscription("a@example.com", team="IR")
    await service.delete_subscription("a@example.com")

    assert [request.url.path for request in requests] == [
        "/login",
        "/subscriptions",
        "/api/subscriptions",
        "/api/subscriptions/schema",
        "/api/subscriptions/preview",
        "/api/subscriptions",
        "/api/subscriptions/a@example.com",
        "/api/subscriptions/a@example.com",
    ]
    assert requests[5].content == b'{"email":"a@example.com","team":"SOC","newsletter_profile":{"enabled":true}}'
    assert requests[6].content == b'{"team":"IR"}'
    await service.close()


@pytest.mark.asyncio
async def test_preview_requires_email_for_update_and_sends_structured_payload():
    requests = []

    async def handler(request):
        requests.append(request)
        if request.url.path == "/login":
            return httpx.Response(302, headers={"location": "/subscriptions"})
        if request.url.path == "/subscriptions":
            return httpx.Response(200, text="ok")
        return httpx.Response(200, json={"valid": True, "mode": "update"})

    service = EmailSubscriptionService(settings(), client_for(handler))
    with pytest.raises(ServiceError, match="email is required"):
        await service.preview_subscription(mode="update")
    result = await service.preview_subscription(
        mode="update",
        email="a@example.com",
        report_profile={"filters": {"severity_threshold": "High"}},
    )
    assert result["valid"] is True
    assert requests[-1].url.path == "/api/subscriptions/preview"
    assert requests[-1].content == (
        b'{"mode":"update","email":"a@example.com",'
        b'"report_profile":{"filters":{"severity_threshold":"High"}}}'
    )
    await service.close()


@pytest.mark.asyncio
async def test_expired_session_reauthenticates_once():
    login_count = 0
    list_count = 0

    async def handler(request):
        nonlocal login_count, list_count
        if request.url.path == "/login":
            login_count += 1
            return httpx.Response(302, headers={"location": "/subscriptions"})
        if request.url.path == "/subscriptions":
            return httpx.Response(200, text="ok")
        if request.url.path == "/api/subscriptions":
            list_count += 1
            if list_count == 1:
                return httpx.Response(401, json={"error": "expired"})
            return httpx.Response(200, json={"data": []})
        return httpx.Response(404)

    client = client_for(handler)
    service = EmailSubscriptionService(settings(), client)
    assert await service.list_subscriptions() == {"subscriptions": []}
    assert login_count == 2
    assert list_count == 2
    await service.close()


@pytest.mark.asyncio
async def test_authentication_failure_is_sanitized():
    async def handler(request):
        return httpx.Response(200, text="<html>Invalid username or password</html>")

    client = client_for(handler)
    service = EmailSubscriptionService(settings(), client)
    with pytest.raises(ServiceError, match="credentials were rejected"):
        await service.list_subscriptions()
    await service.close()


@pytest.mark.asyncio
async def test_missing_credentials_fail_before_network_request():
    service = EmailSubscriptionService(EmailServerSettings(settings().url, "", "", 10), client_for(lambda _: httpx.Response(500)))
    with pytest.raises(ConfigurationError) as error:
        await service.list_subscriptions()
    assert error.value.details["missing_environment_variables"] == [
        "EMAIL_SEVER_USER",
        "EMAIL_SEVER_PASSWORD",
    ]
    await service.close()


@pytest.mark.asyncio
async def test_upstream_json_error_does_not_return_html_or_credentials():
    async def handler(request):
        if request.url.path == "/login":
            return httpx.Response(302, headers={"location": "/subscriptions"})
        if request.url.path == "/subscriptions":
            return httpx.Response(200, text="ok")
        return httpx.Response(400, json={"error": "Subscription already exists for this email."})

    client = client_for(handler)
    service = EmailSubscriptionService(settings(), client)
    with pytest.raises(ServiceError, match="Subscription already exists") as error:
        await service.create_subscription("a@example.com", "SOC")
    assert "secret" not in str(error.value)
    await service.close()


@pytest.mark.asyncio
async def test_upstream_outage_is_retryable():
    async def handler(request):
        if request.url.path == "/login":
            return httpx.Response(302, headers={"location": "/subscriptions"})
        if request.url.path == "/subscriptions":
            return httpx.Response(200, text="ok")
        return httpx.Response(503, json={"error": "database unavailable"})

    client = client_for(handler)
    service = EmailSubscriptionService(settings(), client)
    with pytest.raises(ServiceError) as error:
        await service.list_subscriptions()
    assert error.value.code == "email_server_unavailable"
    assert error.value.retryable is True
    await service.close()


@pytest.mark.asyncio
async def test_connection_failure_is_retryable_and_sanitized():
    async def handler(request):
        raise httpx.ConnectError("password=secret host=email.example.test", request=request)

    client = client_for(handler)
    service = EmailSubscriptionService(settings(), client)
    with pytest.raises(ServiceError) as error:
        await service.list_subscriptions()
    assert error.value.code == "email_server_unavailable"
    assert "secret" not in str(error.value)
    await service.close()
