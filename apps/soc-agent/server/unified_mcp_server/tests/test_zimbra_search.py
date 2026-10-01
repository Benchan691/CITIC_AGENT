"""Structured searches use verified mailbox folders and backend-built dates."""

from types import SimpleNamespace
import xml.etree.ElementTree as ET

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.exceptions import ToolError
import pytest

from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ServiceError
import unified_mcp_server.zimbra.mail.service as mail_module
from unified_mcp_server.zimbra.mail.tools import register_tools
import unified_mcp_server.zimbra.zimbra as transport


NS = "urn:zimbraMail"


@pytest.fixture
def mailbox(monkeypatch):
    state = SimpleNamespace(
        folders=[
            {"id": "2", "name": "Inbox", "path": "/Inbox"},
            {"id": "42", "name": "SOC", "path": "/Inbox/SOC"},
            {"id": "43", "name": "SOC", "path": "/Other/SOC"},
        ],
        folders_by_token={},
        requests=[],
    )

    def fake_soap(host, body, token, **options):
        assert host == "mail.example.test"
        request = ET.fromstring(body)
        state.requests.append((request, token, options))
        name = request.tag.rsplit("}", 1)[-1]
        if name == "GetFolderRequest":
            response = ET.Element(f"{{{NS}}}GetFolderResponse")
            for folder in state.folders_by_token.get(token, state.folders):
                ET.SubElement(response, f"{{{NS}}}{folder.get('tag', 'folder')}", {
                    "id": folder["id"], "name": folder["name"], "absFolderPath": folder["path"],
                })
            return response
        assert name == "SearchRequest"
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
async def test_nested_folder_and_date_are_verified_and_built_in_soap(mailbox):
    result = await mailbox.service().search_emails(folder_path="/Inbox/SOC", date="2026-09-30", limit=100, offset=40)

    assert [request.tag.rsplit("}", 1)[-1] for request, _, _ in mailbox.requests] == ["GetFolderRequest", "SearchRequest"]
    assert [token for _, token, _ in mailbox.requests] == ["token-alice", "token-alice"]
    request = mailbox.requests[-1][0]
    assert request.findtext(f"{{{NS}}}query") == "inid:42 date:09/30/2026"
    assert request.findtext(f"{{{NS}}}locale") == "en_US"
    assert request.get("limit") == "100"
    assert request.get("offset") == "40"
    assert result["folder"] == {"id": "42", "name": "SOC", "path": "/Inbox/SOC"}
    assert result["query"] == "inid:42 date:09/30/2026"
    assert result["offset"] == 40
    assert result["count"] == 1
    assert result["messages"][0]["id"] == "100"
    assert "body" not in result["messages"][0]


@pytest.mark.asyncio
async def test_folder_id_range_and_subfolders_preserve_extra_or_scope(mailbox):
    result = await mailbox.service().search_emails(
        "subject:alert OR subject:warning", folder_id="43", include_subfolders=True,
        after="2026-09-01", before="2026-10-01",
    )

    assert result["folder"]["path"] == "/Other/SOC"
    assert mailbox.requests[-1][0].findtext(f"{{{NS}}}query") == (
        "underid:43 after:09/01/2026 before:10/01/2026 (subject:alert OR subject:warning)"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("filters, expected", [
    ({"date": "2024-02-29"}, "date:02/29/2024"),
    ({"date": "0001-01-01"}, "date:01/01/0001"),
    ({"after": "2026-09-30"}, "after:09/30/2026"),
    ({"before": "2026-10-01"}, "before:10/01/2026"),
])
async def test_valid_dates_need_no_folder_lookup_and_have_explicit_locale(mailbox, filters, expected):
    result = await mailbox.service().search_emails(**filters)

    assert len(mailbox.requests) == 1
    request = mailbox.requests[0][0]
    assert request.findtext(f"{{{NS}}}query") == expected
    assert request.findtext(f"{{{NS}}}locale") == "en_US"
    assert result["query"] == expected
    assert "folder" not in result


@pytest.mark.asyncio
@pytest.mark.parametrize("query", [
    "subject:Alert", "is:anywhere", 'subject:"in:SOC date:09/30/2026"',
    r'subject:"escaped \"in:SOC\" text"',
])
async def test_extra_filters_and_quoted_literals_remain_supported(mailbox, query):
    result = await mailbox.service().search_emails(query)

    assert len(mailbox.requests) == 1
    assert result["query"] == query
    assert mailbox.requests[0][0].find(f"{{{NS}}}locale") is None


@pytest.mark.asyncio
@pytest.mark.parametrize("query", [
    'in:"SOC" date:09/30/2026', "inid:42", "under:Inbox", "underid:42",
    "date:09/30/2026", "after:09/01/2026", "before:10/01/2026",
    "-IN:Inbox", "NOT (in:Inbox)", "d:20260930",
])
async def test_raw_folder_date_filters_fail_before_any_mailbox_request(mailbox, query):
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(query)

    assert caught.value.code == "query_validation_error"
    assert caught.value.retryable is False
    assert caught.value.details["date_format"] == "YYYY-MM-DD"
    assert "folder_path" in caught.value.message
    assert mailbox.requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize("arguments", [
    {}, {"folder_path": "SOC"}, {"folder_path": "Inbox/SOC"},
    {"folder_path": "/Inbox/../SOC"}, {"folder_path": "/Inbox//SOC"},
    {"folder_path": "/Inbox/SOC\n"}, {"folder_id": "42 OR is:anywhere"},
    {"folder_id": "other-user:42"}, {"folder_id": "0"},
    {"folder_path": "/Inbox/SOC", "folder_id": "42"},
    {"date": "09/30/2026"}, {"date": "20260930"}, {"date": "2026-9-30"},
    {"date": "2026-02-29"}, {"date": "2026-09-31"}, {"date": "2026-09-30 OR is:anywhere"},
    {"after": ""}, {"before": "2026-13-01"},
    {"date": "2026-09-30", "after": "2026-09-01"},
    {"after": "2026-10-01", "before": "2026-09-01"},
    {"after": "2026-09-30", "before": "2026-09-30"},
    {"include_subfolders": True, "date": "2026-09-30"},
])
async def test_invalid_structured_filters_fail_before_network(mailbox, arguments):
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(**arguments)

    assert caught.value.code == "invalid_input"
    assert mailbox.requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize("query", [
    'subject:"unclosed', "alert) OR is:anywhere OR (other", "(alert", "alert)",
    r"\) OR is:anywhere OR \(other",
])
async def test_unbalanced_extra_query_cannot_escape_structured_scope(mailbox, query):
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(query, folder_path="/Inbox/SOC")

    assert caught.value.code == "query_validation_error"
    assert mailbox.requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize("arguments", [{"folder_path": "/SOC"}, {"folder_id": "99"}])
async def test_missing_folder_is_clear_and_never_guessed_from_basename(mailbox, arguments):
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(date="2026-09-30", **arguments)

    assert caught.value.code == "folder_not_found"
    assert caught.value.retryable is False
    assert caught.value.details["next_tool"] == "zimbra_list_folders"
    assert len(mailbox.requests) == 1
    assert mailbox.requests[0][0].tag == f"{{{NS}}}GetFolderRequest"


@pytest.mark.asyncio
async def test_untrusted_folder_metadata_cannot_inject_a_query(mailbox):
    mailbox.folders[1]["id"] = "42 OR is:anywhere"
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(folder_path="/Inbox/SOC")

    assert caught.value.code == "zimbra_malformed_response"
    assert len(mailbox.requests) == 1


@pytest.mark.asyncio
async def test_visible_linked_folder_uses_its_local_mailbox_id(mailbox):
    mailbox.folders = [{"id": "55", "name": "Shared SOC", "path": "/Shared SOC", "tag": "link"}]
    result = await mailbox.service().search_emails(folder_path="/Shared SOC")

    assert result["query"] == "inid:55"
    assert result["folder"]["path"] == "/Shared SOC"
    assert [token for _, token, _ in mailbox.requests] == ["token-alice", "token-alice"]


@pytest.mark.asyncio
async def test_folder_validation_uses_each_authenticated_mailbox(mailbox):
    mailbox.folders_by_token = {
        "token-alice": [{"id": "42", "name": "SOC", "path": "/Inbox/SOC"}],
        "token-bob": [{"id": "99", "name": "SOC", "path": "/Inbox/SOC"}],
    }
    alice = await mailbox.service("alice").search_emails(folder_path="/Inbox/SOC")
    bob = await mailbox.service("bob").search_emails(folder_path="/Inbox/SOC")
    with pytest.raises(ServiceError) as caught:
        await mailbox.service("bob").search_emails(folder_id="42")

    assert alice["query"] == "inid:42"
    assert bob["query"] == "inid:99"
    assert caught.value.code == "folder_not_found"
    assert [token for _, token, _ in mailbox.requests] == ["token-alice", "token-alice", "token-bob", "token-bob", "token-bob"]


@pytest.mark.asyncio
async def test_structured_search_still_rejects_account_selection(mailbox):
    with pytest.raises(ServiceError) as caught:
        await mailbox.service().search_emails(account_id="legacy", folder_path="/Inbox/SOC")

    assert caught.value.code == "account_selection_disabled"
    assert mailbox.requests == []


@pytest.mark.asyncio
async def test_mcp_tool_validates_and_forwards_structured_arguments(mailbox):
    server = FastMCP("structured-search-test")

    async def execute(ctx, service, operation, action):
        assert (service, operation) == ("zimbra", "search_emails")
        return await action()

    register_tools(
        server, get_runtime=lambda _: SimpleNamespace(zimbra_mail=mailbox.service()),
        fresh_runtime=lambda _: None, execute=execute, success=lambda *args: None,
    )
    result = await server._tool_manager.call_tool("zimbra_search_emails", {
        "folder_path": "/Inbox/SOC", "date": "2026-09-30", "limit": 100,
    })
    assert result["query"] == "inid:42 date:09/30/2026"
    mailbox.requests.clear()
    with pytest.raises(ToolError):
        await server._tool_manager.call_tool("zimbra_search_emails", {"date": "09/30/2026"})
    assert mailbox.requests == []
