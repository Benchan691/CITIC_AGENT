import httpx
import pytest

from unified_mcp_server.config import EmailServerSettings
from unified_mcp_server.email.service import EmailSubscriptionService
from unified_mcp_server.errors import ServiceError


def settings():
    return EmailServerSettings("http://email.example.test", "operator", "secret", 10, True)


def client_for(handler, base_url="http://email.example.test"):
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url=base_url,
        follow_redirects=False,
    )


@pytest.mark.asyncio
async def test_subscription_requests_login_once_and_uses_api_contract():
    requests = []

    async def handler(request):
        requests.append(request)
        if request.method == "POST" and request.url.path == "/login":
            return httpx.Response(302, headers={"location": "/subscriptions"})
        if request.method == "GET" and request.url.path == "/subscriptions":
            return httpx.Response(200, text="subscriptions")
        if request.method == "GET" and request.url.path == "/api/subscriptions":
            return httpx.Response(200, json={"data": [{"email": "a@example.com"}]})
        if request.method == "GET" and request.url.path == "/api/subscriptions/schema":
            return httpx.Response(200, json={"schema_version": 1})
        if request.method == "POST" and request.url.path == "/api/subscriptions/preview":
            return httpx.Response(200, json={"valid": True})
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
    assert await service.get_subscription_schema() == {"schema_version": 1}
    assert await service.preview_subscription(newsletter_profile={"enabled": True}) == {"valid": True}
    await service.create_subscription("a@example.com", "SOC", {"enabled": True})
    await service.update_subscription("a@example.com", team="IR")
    await service.delete_subscription("a@example.com")
    assert [request.url.path for request in requests] == [
        "/login", "/subscriptions", "/api/subscriptions", "/api/subscriptions/schema",
        "/api/subscriptions/preview", "/api/subscriptions",
        "/api/subscriptions/a@example.com", "/api/subscriptions/a@example.com",
    ]
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
            return httpx.Response(401) if list_count == 1 else httpx.Response(200, json={"data": []})
        return httpx.Response(404)

    service = EmailSubscriptionService(settings(), client_for(handler))
    assert await service.list_subscriptions() == {"subscriptions": []}
    assert login_count == 2
    assert list_count == 2
    await service.close()








@pytest.mark.asyncio
async def test_login_rejects_unsafe_redirects_without_following_them():
    for location in [
        "https://other.example.test/subscriptions",
        "https://email.example.test:444/subscriptions",
        "https://user:password@email.example.test/subscriptions",
        "http://email.example.test/subscriptions",
        "ftp://email.example.test/subscriptions",
        "http://",
    ]:
        requests = []

        async def handler(request):
            requests.append(request)
            return httpx.Response(302, headers={"location": location})

        service = EmailSubscriptionService(
            EmailServerSettings("https://email.example.test", "operator", "secret", 10),
            client_for(handler, "https://email.example.test"),
        )
        with pytest.raises(ServiceError, match="redirect") as error:
            await service.list_subscriptions()
        assert error.value.code == "email_server_redirect_rejected"
        assert len(requests) == 1
        assert all(request.url.host == "email.example.test" for request in requests)
        await service.close()
