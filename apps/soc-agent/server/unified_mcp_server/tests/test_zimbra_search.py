"""Native mail queries stay flexible and faults give safe corrective guidance."""

from types import SimpleNamespace
import xml.etree.ElementTree as ET

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.exceptions import ToolError
import pytest
from zimbra_client.errors import ZimbraHTTPError, ZimbraSOAPFault

from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.zimbra.errors import _upstream_error
import unified_mcp_server.zimbra.mail.service as mail_module
from unified_mcp_server.zimbra.mail.tools import register_tools
import unified_mcp_server.zimbra.zimbra as transport


NS = "urn:zimbraMail"


@pytest.fixture
def mailbox(monkeypatch):
    state = SimpleNamespace(requests=[], fault=None)

    def fake_soap(host, body, token, **options):
        assert host == "mail.example.test"
        request = ET.fromstring(body)
        state.requests.append((request, token, options))
        # Query-based searches must not perform implicit folder discovery.
        assert request.tag == f"{{{NS}}}SearchRequest"
        if state.fault is not None:
            raise state.fault
        return ET.fromstring(f'<SearchResponse xmlns="{NS}"><m id="100"><su>Alert</su></m></SearchResponse>')

    monkeypatch.setattr(transport, "soap_request", fake_soap)
    monkeypatch.setattr(mail_module, "zimbra_login", lambda *_: pytest.fail("must use the authenticated token"))

    def service(user="alice"):
        return mail_module.ZimbraMailService(
            ZimbraSettings(host="mail.example.test", email="legacy@example.test", password="must-not-use", verify_ssl=True, timeout=60),
            identity=ZimbraIdentity(user, f"{user}@example.test", f"token-{user}", f"session-{user}"),
        )

    state.service = service
    return state


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["Inbox/SOC", "/Inbox/SOC"])
async def test_folder_and_date_go_directly_in_the_query(mailbox, path):
    query = f'in:"{path}" date:09/30/2026 (subject:alert OR subject:warning)'
    result = await mailbox.service().search_emails(query, limit=100, offset=40)

    assert len(mailbox.requests) == 1
    request, token, options = mailbox.requests[0]
    assert token == "token-alice"
    assert request.findtext(f"{{{NS}}}query") == query
    assert request.findtext(f"{{{NS}}}locale") == "en_US"
    assert request.get("limit") == "100"
    assert request.get("offset") == "40"
    assert options["verify_ssl"] is True
    assert result["query"] == query
    assert result["offset"] == 40
    assert result["count"] == 1
    assert result["messages"][0]["id"] == "100"
    assert "body" not in result["messages"][0]
    assert "folder" not in result


@pytest.mark.asyncio
@pytest.mark.parametrize("query", [
    "subject:alert is:unread",
    "from:analyst@example.test to:team@example.test has:attachment",
    'in:"Inbox/SOC"',
    'under:"/Inbox/SOC" filename:report.pdf',
    "inid:42 OR underid:43",
    "date:09/30/2026",
    "after:09/01/2026 before:10/01/2026",
    "after:-7d -is:read",
    "mdate:>=09/01/2026 smaller:5MB tag:review",
    'subject:"d:20260930"',
    r'subject:"quoted \" d:20260930"',
    r'subject:"quoted \"example\"" is:unread',
])
async def test_native_filters_and_quoted_literals_pass_through(mailbox, query):
    result = await mailbox.service().search_emails(query)

    assert result["query"] == query
    assert mailbox.requests[0][0].findtext(f"{{{NS}}}query") == query


@pytest.mark.asyncio
@pytest.mark.parametrize(("query", "suggestion"), [
    ("d:20260829", "date:08/29/2026"),
    ('in:"Inbox/SOC" d:20260930 is:unread', 'in:"Inbox/SOC" date:09/30/2026 is:unread'),
    ('subject:"d:20260930" -d:20260228', 'subject:"d:20260930" -date:02/28/2026'),
    (r'subject:"quoted \" d:20260930" d:20260228', r'subject:"quoted \" d:20260930" date:02/28/2026'),
    ("(D:20240229 OR subject:alert)", "(date:02/29/2024 OR subject:alert)"),
])
async def test_date_alias_correction_preserves_other_filters(mailbox, query, suggestion):
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(query)

    assert caught.value.code == "query_validation_error"
    assert caught.value.retryable is False
    assert caught.value.details["suggested_query"] == suggestion
    assert caught.value.details["dates_optional"] is True
    assert "MM/DD/YYYY" in caught.value.message
    assert mailbox.requests == []


@pytest.mark.asyncio
async def test_invalid_alias_calendar_date_has_no_invented_suggestion(mailbox):
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails("d:20260230")

    assert caught.value.code == "query_validation_error"
    assert "suggested_query" not in caught.value.details
    assert mailbox.requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["", "  ", None])
async def test_empty_query_fails_before_network_with_optional_date_guidance(mailbox, query):
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(query)

    assert caught.value.code == "invalid_input"
    assert "Dates are optional" in caught.value.message
    assert mailbox.requests == []


@pytest.mark.asyncio
async def test_missing_folder_fault_explains_full_path_without_rewriting_or_retry(mailbox):
    mailbox.fault = ZimbraSOAPFault("mail.NO_SUCH_FOLDER", "private@example.test authentication 403 token=secret", status_code=500)
    query = 'in:"SOC" date:09/30/2026'

    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(query)

    error = caught.value
    assert error.code == "folder_not_found"
    assert error.retryable is False
    assert error.details["upstream_code"] == "mail.NO_SUCH_FOLDER"
    assert error.details["next_tool"] == "zimbra_list_folders"
    assert 'in:"SOC" refers to /SOC' in error.message
    assert 'in:"Inbox/SOC"' in error.message
    assert "secret" not in str(error.details) + error.message
    assert "private@example.test" not in str(error.details) + error.message
    assert len(mailbox.requests) == 1
    assert mailbox.requests[0][0].findtext(f"{{{NS}}}query") == query


@pytest.mark.asyncio
async def test_upstream_query_error_returns_native_syntax_guidance(mailbox):
    mailbox.fault = ZimbraSOAPFault("service.PARSE_ERROR", "private query details", status_code=500)

    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails('in:"Inbox/SOC" subject:(')

    error = caught.value
    assert error.code == "query_validation_error"
    assert error.retryable is False
    assert error.details["upstream_code"] == "service.PARSE_ERROR"
    assert error.details["date_format"] == "MM/DD/YYYY"
    assert "Dates are optional" in error.message
    assert "has:attachment" in error.message
    assert "folder_fields" not in error.details
    assert "private query details" not in error.message


@pytest.mark.parametrize(("fault_code", "expected_code", "retryable"), [
    ("mail.NO_SUCH_MOUNTPOINT", "folder_not_found", False),
    ("service.PERM_DENIED", "zimbra_permission_denied", False),
    ("service.FORBIDDEN", "zimbra_permission_denied", False),
    ("service.AUTH_REQUIRED", "zimbra_auth_error", False),
    ("service.AUTH_EXPIRED", "zimbra_auth_error", False),
    ("account.AUTH_FAILED", "zimbra_auth_error", False),
    ("account.TWO_FACTOR_AUTH_REQUIRED", "zimbra_auth_error", False),
    ("service.FAILURE", "zimbra_api_error", True),
    ("service.TEMPORARILY_UNAVAILABLE", "zimbra_api_error", True),
    ("mail.MAINTENANCE", "zimbra_api_error", True),
    ("service.INVALID_REQUEST", "zimbra_api_error", False),
    ("service.NEW_ERROR", "zimbra_api_error", False),
])
def test_fault_codes_are_authoritative_and_raw_messages_stay_private(fault_code, expected_code, retryable):
    error = _upstream_error(ZimbraSOAPFault(fault_code, "private@example.test authentication 403 TLS token=secret", status_code=500))

    assert error.code == expected_code
    assert error.retryable is retryable
    assert error.details["upstream_code"] == fault_code
    assert "private@example.test" not in error.message + str(error.details)
    assert "secret" not in error.message + str(error.details)
    assert "ZIMBRA_HOST" not in error.message


@pytest.mark.parametrize(("status", "expected_code", "retryable"), [
    (401, "zimbra_auth_error", False),
    (403, "zimbra_permission_denied", False),
    (400, "zimbra_api_error", False),
    (429, "zimbra_api_error", True),
    (503, "zimbra_api_error", True),
])
def test_http_errors_do_not_return_raw_reason(status, expected_code, retryable):
    error = _upstream_error(ZimbraHTTPError(status, "private@example.test secret"))

    assert error.code == expected_code
    assert error.retryable is retryable
    assert error.details["http_status"] == status
    assert "private@example.test" not in error.message + str(error.details)
    assert "secret" not in error.message + str(error.details)


def test_malformed_upstream_code_is_not_returned():
    error = _upstream_error(ZimbraSOAPFault("service.FAILURE\nprivate@example.test", "secret"))
    assert "upstream_code" not in error.details
    assert "private@example.test" not in error.message + str(error.details)
    assert "secret" not in error.message + str(error.details)


@pytest.mark.asyncio
async def test_search_uses_each_authenticated_token_and_rejects_account_selection(mailbox):
    await mailbox.service("alice").search_emails("subject:alert")
    await mailbox.service("bob").search_emails("subject:alert")
    assert [token for _, token, _ in mailbox.requests] == ["token-alice", "token-bob"]

    with pytest.raises(ServiceError) as caught:
        await mailbox.service("alice").search_emails("subject:alert", account_id="bob")
    assert caught.value.code == "account_selection_disabled"
    assert len(mailbox.requests) == 2


@pytest.mark.asyncio
async def test_registered_tool_accepts_query_with_folder_and_date(mailbox):
    server = FastMCP("mail-test")

    async def execute(ctx, service, operation, function):
        return await function()

    register_tools(
        server, get_runtime=lambda _: SimpleNamespace(zimbra_mail=mailbox.service()),
        fresh_runtime=None, execute=execute, success=None,
    )
    query = 'in:"Inbox/SOC" date:09/30/2026 has:attachment'
    result = await server._tool_manager.call_tool("zimbra_search_emails", {"query": query, "limit": 20})
    assert result["query"] == query
    assert len(mailbox.requests) == 1

    with pytest.raises(ToolError):
        await server._tool_manager.call_tool("zimbra_search_emails", {"limit": 20})
    assert len(mailbox.requests) == 1


def test_folder_listing_keeps_paths_and_linked_folder_ids(monkeypatch):
    monkeypatch.setattr(transport, "soap_request", lambda *_args, **_kwargs: ET.fromstring(
        f'<GetFolderResponse xmlns="{NS}"><folder id="42" name="SOC" absFolderPath="/Inbox/SOC"/>'
        '<link id="52" name="Shared SOC" absFolderPath="/Shared SOC"/></GetFolderResponse>'
    ))
    folders = transport.zimbra_list_folders("mail.example.test", "token-alice")
    assert [(folder["id"], folder["path"]) for folder in folders] == [("42", "/Inbox/SOC"), ("52", "/Shared SOC")]
