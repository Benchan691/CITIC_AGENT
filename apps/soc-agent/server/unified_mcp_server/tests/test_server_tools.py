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
        "zimbra_list_folders",
        "zimbra_list_signatures",
        "zimbra_create_signature",
        "zimbra_delete_signature",
        "zimbra_create_folder",
        "zimbra_search_emails",
        "zimbra_get_email",
        "zimbra_get_email_headers",
        "zimbra_get_attachment_text",
        "zimbra_send_email",
        "zimbra_forward_email",
        "zimbra_use_signature_on_email",
        "zimbra_move_email",
        "zimbra_list_email_filters",
        "zimbra_get_email_filter",
        "zimbra_validate_email_filter",
        "zimbra_preview_email_filter_update",
        "zimbra_create_email_filter",
        "zimbra_update_email_filter",
        "zimbra_delete_email_filter",
        "zimbra_set_email_filter_enabled",
        "zimbra_reorder_email_filter",
        "list_subscriptions",
        "get_subscription_schema",
        "preview_subscription",
        "create_subscription",
        "update_subscription",
        "delete_subscription",
    }
    assert len(tools) == 28
    assert not {tool.name for tool in tools if tool.name.startswith("splunk_")}
    assert "system_get_status" not in {tool.name for tool in tools}
    assert not {tool.name for tool in tools if tool.name.startswith("catalog_")}
    assert not {tool.name for tool in tools if tool.name.startswith("scheduled_task_")}
    for tool in tools:
        assert "ctx" not in tool.parameters.get("properties", {})
        assert "ctx" not in tool.parameters.get("required", [])
        if tool.name.startswith("zimbra_"):
            assert "account_id" not in tool.parameters.get("properties", {})

    schema_tool = next(tool for tool in tools if tool.name == "get_subscription_schema")
    assert schema_tool.parameters.get("required", []) == []
    preview_tool = next(tool for tool in tools if tool.name == "preview_subscription")
    assert set(preview_tool.parameters["properties"]) == {
        "mode", "email", "newsletter_profile", "report_profile",
    }
    assert preview_tool.parameters.get("required", []) == []

    draft_tool = next(tool for tool in tools if tool.name == "zimbra_send_email")
    assert set(draft_tool.parameters["properties"]) == {"to", "cc", "bcc", "subject", "body"}
    assert set(draft_tool.parameters["required"]) == {"to", "subject", "body"}
    forward_tool = next(tool for tool in tools if tool.name == "zimbra_forward_email")
    assert set(forward_tool.parameters["properties"]) == {"message_id", "to", "cc", "bcc", "subject", "body"}
    assert set(forward_tool.parameters["required"]) == {"message_id", "to"}
    assert forward_tool.annotations.readOnlyHint is True
    assert "zimbra_create_email_draft" not in {tool.name for tool in tools}
    list_signatures_tool = next(tool for tool in tools if tool.name == "zimbra_list_signatures")
    assert set(list_signatures_tool.parameters["properties"]) == set()
    create_signature_tool = next(tool for tool in tools if tool.name == "zimbra_create_signature")
    assert set(create_signature_tool.parameters["properties"]) == {"name", "text", "html"}
    assert create_signature_tool.parameters["required"] == ["name"]
    delete_signature_tool = next(tool for tool in tools if tool.name == "zimbra_delete_signature")
    assert set(delete_signature_tool.parameters["properties"]) == {"signature_id"}
    assert delete_signature_tool.parameters["required"] == ["signature_id"]
    use_signature_tool = next(tool for tool in tools if tool.name == "zimbra_use_signature_on_email")
    assert set(use_signature_tool.parameters["properties"]) == {
        "to", "cc", "bcc", "subject", "body", "signature_id", "body_format", "placement",
    }
    assert set(use_signature_tool.parameters["required"]) == {"to", "subject", "body", "signature_id"}
    get_email_tool = next(tool for tool in tools if tool.name == "zimbra_get_email")
    assert set(get_email_tool.parameters["properties"]) == {
        "message_id", "max_body_chars",
    }
    header_tool = next(tool for tool in tools if tool.name == "zimbra_get_email_headers")
    assert set(header_tool.parameters["properties"]) == {"message_id", "names"}
    move_tool = next(tool for tool in tools if tool.name == "zimbra_move_email")
    assert set(move_tool.parameters["required"]) == {"message_id", "folder_id"}
    search_email_tool = next(tool for tool in tools if tool.name == "zimbra_search_emails")
    assert set(search_email_tool.parameters["properties"]) == {
        "query", "limit", "offset",
    }
    assert "date:mm/dd/yyyy" in search_email_tool.description.lower()
    assert "d:yyyymmdd" in search_email_tool.description.lower()
    attachment_tool = next(tool for tool in tools if tool.name == "zimbra_get_attachment_text")
    assert set(attachment_tool.parameters["properties"]) == {
        "message_id", "part", "max_chars",
    }
    filter_list_tool = next(tool for tool in tools if tool.name == "zimbra_list_email_filters")
    assert set(filter_list_tool.parameters["properties"]) == {
        "include_details",
    }
    delete_filter_tool = next(tool for tool in tools if tool.name == "zimbra_delete_email_filter")
    assert set(delete_filter_tool.parameters["properties"]) == {
        "name", "expected_fingerprint",
    }
    assert set(delete_filter_tool.parameters["required"]) == {"name", "expected_fingerprint"}
