from unified_mcp_server.config import ServerSettings
from unified_mcp_server.server import create_server
from unified_mcp_server.zimbra.mail.tools import register_tools as register_mail_tools


def test_server_exposes_exact_domain_tool_set(monkeypatch, tmp_path):
    monkeypatch.delenv("APP_POSTGRES_URI", raising=False)
    server = create_server(ServerSettings.from_env({
        "ZIMBRA_ACCOUNTS_FILE": str(tmp_path / "accounts.enc"),
        "ZIMBRA_ACCOUNTS_KEY_FILE": str(tmp_path / "accounts.key"),
    }))

    tools = server._tool_manager.list_tools()
    assert {tool.name for tool in tools} == {
        "system_get_status",
        "splunk_validate_query",
        "splunk_search",
        "splunk_list_saved_searches",
        "splunk_find_lookup",
        "splunk_list_lookups",
        "splunk_get_detection",
        "splunk_validate_detection",
        "splunk_backtest_detection",
        "splunk_create_detection_draft",
        "splunk_update_detection_draft",
        "splunk_enable_detection",
        "splunk_disable_detection",
        "splunk_run_saved_search",
        "zimbra_list_accounts",
        "zimbra_list_folders",
        "zimbra_create_folder",
        "zimbra_search_emails",
        "zimbra_get_email",
        "zimbra_get_attachment_text",
        "zimbra_create_email_draft",
        "zimbra_send_email",
        "zimbra_list_email_filters",
        "zimbra_get_email_filter",
        "zimbra_validate_email_filter",
        "zimbra_preview_email_filter_update",
        "zimbra_create_email_filter",
        "zimbra_update_email_filter",
        "zimbra_set_email_filter_enabled",
        "zimbra_reorder_email_filter",
        "list_subscriptions",
        "get_subscription_schema",
        "preview_subscription",
        "create_subscription",
        "update_subscription",
        "delete_subscription",
    }
    for tool in tools:
        assert "ctx" not in tool.parameters.get("properties", {})
        assert "ctx" not in tool.parameters.get("required", [])

    saved_searches = next(tool for tool in tools if tool.name == "splunk_list_saved_searches")
    assert set(saved_searches.parameters["properties"]) == {"name", "app"}
    assert saved_searches.parameters.get("required", []) == []
    assert "splunk_list_data_sources" not in {tool.name for tool in tools}
    assert "splunk_list_indexes" not in {tool.name for tool in tools}

    schema_tool = next(tool for tool in tools if tool.name == "get_subscription_schema")
    assert schema_tool.parameters.get("required", []) == []
    preview_tool = next(tool for tool in tools if tool.name == "preview_subscription")
    assert set(preview_tool.parameters["properties"]) == {
        "mode", "email", "newsletter_profile", "report_profile",
    }
    assert preview_tool.parameters.get("required", []) == []

    draft_tool = next(tool for tool in tools if tool.name == "zimbra_create_email_draft")
    assert set(draft_tool.parameters["properties"]) == {"to", "cc", "bcc", "subject", "body", "account_id"}
    assert set(draft_tool.parameters["required"]) == {"to", "subject", "body"}
    send_tool = next(tool for tool in tools if tool.name == "zimbra_send_email")
    assert set(send_tool.parameters["properties"]) == {"to", "cc", "bcc", "subject", "body", "account_id"}
    assert set(send_tool.parameters["required"]) == {"to", "subject", "body"}


def test_draft_tool_action_is_awaitable(monkeypatch):
    import asyncio
    import inspect

    class FakeServer:
        def __init__(self):
            self.tools = []

        def tool(self):
            def register(function):
                self.tools.append(function)
                return function

            return register

    captured = {}

    async def execute(_ctx, _service, _operation, action):
        captured["action"] = action
        return await action()

    class FakeRuntime:
        class Mail:
            def create_email_draft(self, *args):
                return {"draft": {"to": args[0]}}

        zimbra_mail = Mail()

    server = FakeServer()
    register_mail_tools(
        server,
        get_runtime=lambda _ctx: FakeRuntime(),
        fresh_runtime=lambda _ctx: None,
        execute=execute,
        success=lambda *args, **kwargs: None,
    )

    # The nested action is created by the registered tool, not by the service.
    # Calling the tool also proves a plain draft dict is never awaited directly.
    tool = next(value for value in server.tools if value.__name__ == "zimbra_create_email_draft")
    result = asyncio.run(tool(None, ["to@example.com"], "Subject", "Body"))
    assert inspect.iscoroutinefunction(captured["action"])
    assert result["draft"]["to"] == ["to@example.com"]
