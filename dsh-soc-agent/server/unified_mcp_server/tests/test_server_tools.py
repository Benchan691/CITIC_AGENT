from unified_mcp_server.config import ServerSettings
from unified_mcp_server.server import create_server


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
        "zimbra_send_email",
        "zimbra_list_email_filters",
        "zimbra_get_email_filter",
        "zimbra_validate_email_filter",
        "zimbra_preview_email_filter_update",
        "zimbra_create_email_filter",
        "zimbra_update_email_filter",
        "zimbra_set_email_filter_enabled",
        "zimbra_reorder_email_filter",
    }
    for tool in tools:
        assert "ctx" not in tool.parameters.get("properties", {})
        assert "ctx" not in tool.parameters.get("required", [])

    saved_searches = next(tool for tool in tools if tool.name == "splunk_list_saved_searches")
    assert set(saved_searches.parameters["properties"]) == {"name", "app"}
    assert saved_searches.parameters.get("required", []) == []
    assert "splunk_list_data_sources" not in {tool.name for tool in tools}
    assert "splunk_list_indexes" not in {tool.name for tool in tools}
