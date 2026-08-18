from unified_mcp_server.config import ServerSettings
from unified_mcp_server.server import create_server


def test_server_exposes_exact_domain_tool_set(monkeypatch, tmp_path):
    monkeypatch.delenv("APP_POSTGRES_URI", raising=False)
    server = create_server(ServerSettings.from_env({
        "ZIMBRA_ACCOUNTS_FILE": str(tmp_path / "accounts.enc"),
        "ZIMBRA_ACCOUNTS_KEY_FILE": str(tmp_path / "accounts.key"),
    }))

    assert {tool.name for tool in server._tool_manager.list_tools()} == {
        "system_get_status",
        "splunk_validate_query",
        "splunk_search",
        "splunk_list_indexes",
        "splunk_list_saved_searches",
        "splunk_list_data_sources",
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
        "zimbra_search_emails",
        "zimbra_get_email",
        "zimbra_get_attachment_text",
        "zimbra_send_email",
    }
