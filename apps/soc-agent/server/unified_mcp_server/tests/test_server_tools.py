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
        "splunk_list_security_findings",
        "splunk_get_security_finding",
        "splunk_list_saved_searches",
        "splunk_find_lookup",
        "splunk_list_lookups",
        "splunk_get_lookup",
        "splunk_write_lookup",
        "splunk_update_lookup",
        "splunk_delete_lookup",
        "splunk_get_detection",
        "splunk_validate_detection",
        "splunk_compile_citic_detection",
        "splunk_backtest_detection",
        "splunk_write_detection",
        "splunk_update_detection",
        "splunk_run_saved_search",
        "soc_evidence_read",
        "splunk_plan_search",
        "catalog_list_rules",
        "catalog_get_rule",
        "catalog_list_customers",
        "catalog_get_customer",
        "catalog_list_fix_source_types",
        "catalog_get_fix_source_type",
        "catalog_get_record_history",
        "catalog_preview_publication",
        "catalog_write_rule",
        "catalog_update_rule",
        "catalog_write_customer",
        "catalog_update_customer",
        "catalog_write_fix_source_type",
        "catalog_update_fix_source_type",
        "catalog_archive_record",
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
    for tool in tools:
        assert "ctx" not in tool.parameters.get("properties", {})
        assert "ctx" not in tool.parameters.get("required", [])
        if tool.name.startswith("zimbra_"):
            assert "account_id" not in tool.parameters.get("properties", {})

    saved_searches = next(tool for tool in tools if tool.name == "splunk_list_saved_searches")
    assert set(saved_searches.parameters["properties"]) == {
        "name", "app", "limit", "include_spl",
    }
    assert saved_searches.parameters.get("required", []) == []
    search_tool = next(tool for tool in tools if tool.name == "splunk_search")
    assert set(search_tool.parameters["properties"]) == {
        "query", "earliest_time", "latest_time", "max_count", "fields",
    }
    assert search_tool.parameters["required"] == ["query"]
    assert "stats" in search_tool.description.lower()
    queue_list_tool = next(tool for tool in tools if tool.name == "splunk_list_security_findings")
    assert set(queue_list_tool.parameters["properties"]) == {
        "status", "urgency", "owner", "detection", "earliest_time", "latest_time", "limit", "cursor",
    }
    assert queue_list_tool.parameters.get("required", []) == []
    finding_tool = next(tool for tool in tools if tool.name == "splunk_get_security_finding")
    assert set(finding_tool.parameters["properties"]) == {"finding_id"}
    assert finding_tool.parameters["required"] == ["finding_id"]
    assert "read-only" in queue_list_tool.description.lower()
    assert "splunk_list_data_sources" not in {tool.name for tool in tools}
    assert "splunk_list_indexes" not in {tool.name for tool in tools}
    tool_names = {tool.name for tool in tools}
    assert not {
        "splunk_create_detection_draft",
        "splunk_update_detection_draft",
        "splunk_enable_detection",
        "splunk_disable_detection",
    } & tool_names

    # The ordinary status tool is intentionally limited to readiness; detailed
    # endpoint, policy, and LLM configuration is served through the admin plane.
    assert "detailed configuration" in next(tool for tool in tools if tool.name == "system_get_status").description.lower()

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
    write_tool = next(tool for tool in tools if tool.name == "splunk_write_detection")
    assert set(write_tool.parameters["properties"]) == {"detection"}
    assert write_tool.parameters["required"] == ["detection"]
    catalog_write = next(tool for tool in tools if tool.name == "catalog_write_rule")
    assert set(catalog_write.parameters["properties"]) == {"rule"}
    assert catalog_write.parameters["required"] == ["rule"]
    catalog_update = next(tool for tool in tools if tool.name == "catalog_update_rule")
    assert set(catalog_update.parameters["properties"]) == {"rule_id", "rule", "expected_revision"}
    assert set(catalog_update.parameters["required"]) == {"rule_id", "rule", "expected_revision"}
    archive_tool = next(tool for tool in tools if tool.name == "catalog_archive_record")
    assert set(archive_tool.parameters["properties"]) == {
        "catalog", "record_id", "expected_revision", "restore", "reason",
    }
    assert set(archive_tool.parameters["required"]) == {"catalog", "record_id", "expected_revision"}
    assert "publish" in next(
        tool for tool in tools if tool.name == "catalog_preview_publication"
    ).description.lower()
    update_tool = next(tool for tool in tools if tool.name == "splunk_update_detection")
    assert set(update_tool.parameters["properties"]) == {
        "name", "detection", "expected_fingerprint",
    }
    assert set(update_tool.parameters["required"]) == {
        "name", "detection", "expected_fingerprint",
    }
    get_lookup_tool = next(tool for tool in tools if tool.name == "splunk_get_lookup")
    assert set(get_lookup_tool.parameters["properties"]) == {"name"}
    assert get_lookup_tool.parameters["required"] == ["name"]
    write_lookup_tool = next(tool for tool in tools if tool.name == "splunk_write_lookup")
    assert set(write_lookup_tool.parameters["properties"]) == {"name", "content"}
    assert set(write_lookup_tool.parameters["required"]) == {"name", "content"}
    update_lookup_tool = next(tool for tool in tools if tool.name == "splunk_update_lookup")
    assert set(update_lookup_tool.parameters["properties"]) == {
        "name", "content", "expected_fingerprint",
    }
    assert set(update_lookup_tool.parameters["required"]) == {
        "name", "content", "expected_fingerprint",
    }
    delete_lookup_tool = next(tool for tool in tools if tool.name == "splunk_delete_lookup")
    assert set(delete_lookup_tool.parameters["properties"]) == {"name", "expected_fingerprint"}
    assert set(delete_lookup_tool.parameters["required"]) == {"name", "expected_fingerprint"}
    compiler_tool = next(tool for tool in tools if tool.name == "splunk_compile_citic_detection")
    assert set(compiler_tool.parameters["properties"]) == {
        "detection_logic", "rulename", "threat_name", "threat_type",
        "case_prefix", "event_field_mappings", "extra_table_fields",
    }
    assert set(compiler_tool.parameters["required"]) == {
        "detection_logic", "rulename", "threat_name", "threat_type",
        "case_prefix", "event_field_mappings",
    }
    assert "splunk_approve_detection_change" not in {tool.name for tool in tools}
    assert "splunk_apply_approved_detection_change" not in {tool.name for tool in tools}
    backtest_tool = next(tool for tool in tools if tool.name == "splunk_backtest_detection")
    assert "fields" in backtest_tool.parameters["properties"]


def test_draft_tool_action_is_awaitable(monkeypatch):
    import asyncio
    import inspect

    class FakeServer:
        def __init__(self):
            self.tools = []

        def tool(self, *args, **kwargs):
            # Accept annotation/decoration kwargs like the real FastMCP decorator.
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
    tool = next(value for value in server.tools if value.__name__ == "zimbra_send_email")
    result = asyncio.run(tool(None, ["to@example.com"], "Subject", "Body"))
    assert inspect.iscoroutinefunction(captured["action"])
    assert result["draft"]["to"] == ["to@example.com"]
