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
    assert len(tools) == 27
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
        "mode", "subscription_id", "username", "emails", "organization",
        "local_subscription", "newsletter_profile", "report_profile",
    }
    assert preview_tool.parameters.get("required", []) == []

    create_tool = next(tool for tool in tools if tool.name == "create_subscription")
    assert set(create_tool.parameters["properties"]) == {
        "username", "emails", "organization", "local_subscription",
        "newsletter_profile", "report_profile",
    }
    assert set(create_tool.parameters["required"]) == {"username", "emails"}
    update_tool = next(tool for tool in tools if tool.name == "update_subscription")
    assert set(update_tool.parameters["properties"]) == {
        "subscription_id", "username", "emails", "organization",
        "newsletter_profile", "report_profile",
    }
    assert update_tool.parameters["required"] == ["subscription_id"]
    delete_tool = next(tool for tool in tools if tool.name == "delete_subscription")
    assert set(delete_tool.parameters["properties"]) == {"subscription_id"}
    assert delete_tool.parameters["required"] == ["subscription_id"]

    draft_tool = next(tool for tool in tools if tool.name == "zimbra_send_email")
    assert set(draft_tool.parameters["properties"]) == {
        "action", "message_id", "to", "cc", "bcc", "subject", "body", "body_format", "reply_all",
    }
    assert draft_tool.parameters.get("required", []) == []
    assert draft_tool.parameters["properties"]["action"]["enum"] == ["send", "reply", "forward"]
    assert "html" in str(draft_tool.parameters["properties"]["body_format"])
    assert "text" not in str(draft_tool.parameters["properties"]["body_format"])
    assert draft_tool.annotations.readOnlyHint is True
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
    assert "html" in str(use_signature_tool.parameters["properties"]["body_format"])
    assert "text" not in str(use_signature_tool.parameters["properties"]["body_format"])
    for tool in (draft_tool, use_signature_tool):
        description = " ".join(tool.description.split())
        assert "color: #000; background-color: #fff;" in description
        assert "simple paragraphs, lists" in description
        assert "escape customer/splunk data" in description.lower()
        assert "without Markdown fences, scripts" in description
        assert "external stylesheets" in description
        assert "Example &amp; Co." in description
    get_email_tool = next(tool for tool in tools if tool.name == "zimbra_get_email")
    assert set(get_email_tool.parameters["properties"]) == {
        "message_id", "max_body_chars",
    }
    header_tool = next(tool for tool in tools if tool.name == "zimbra_get_email_headers")
    assert set(header_tool.parameters["properties"]) == {"message_id", "names"}
    move_tool = next(tool for tool in tools if tool.name == "zimbra_move_email")
    assert set(move_tool.parameters["required"]) == {"message_id", "folder_id"}
    search_email_tool = next(tool for tool in tools if tool.name == "zimbra_search_emails")
    assert set(search_email_tool.parameters["properties"]) == {"query", "limit", "offset"}
    assert search_email_tool.parameters["required"] == ["query"]
    assert "Dates are optional" in search_email_tool.parameters["properties"]["query"]["description"]
    assert 'in:"Inbox/SOC" date:09/30/2026' in search_email_tool.parameters["properties"]["query"]["description"]
    assert "mm/dd/yyyy" in search_email_tool.description.lower()
    assert "d:yyyymmdd" in search_email_tool.description.lower()
    assert "has:attachment" in search_email_tool.description
    assert "folder_not_found" in search_email_tool.description
    assert search_email_tool.annotations.readOnlyHint is True
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
