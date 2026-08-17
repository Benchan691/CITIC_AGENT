from types import SimpleNamespace

from unified_mcp_server.deep_agent import (
    approval_interrupt_config,
    normalize_approval_mode,
    should_interrupt_tool,
)


def test_missing_and_invalid_approval_modes_default_to_ask():
    assert normalize_approval_mode({}) == "ask"
    assert normalize_approval_mode({"configurable": {"approval_mode": "invalid"}}) == "ask"
    assert normalize_approval_mode({"configurable": {"approval_mode": []}}) == "ask"


def test_approval_modes_gate_read_only_and_risky_tools():
    assert should_interrupt_tool("zimbra_search_emails", "ask")
    assert should_interrupt_tool("zimbra_search_emails", "smart") is False
    assert should_interrupt_tool("zimbra_send_email", "smart")
    assert should_interrupt_tool("zimbra_send_email", "full") is False


def test_dynamic_approval_predicate_reads_runtime_config():
    gates = approval_interrupt_config(["zimbra_search_emails", "zimbra_send_email"])
    search_request = SimpleNamespace(
        tool_call={"name": "zimbra_search_emails"},
        runtime=SimpleNamespace(config={"configurable": {"approval_mode": "smart"}}),
    )
    send_request = SimpleNamespace(
        tool_call={"name": "zimbra_send_email"},
        runtime=SimpleNamespace(config={"configurable": {"approval_mode": "smart"}}),
    )
    assert gates["zimbra_search_emails"]["when"](search_request) is False
    assert gates["zimbra_send_email"]["when"](send_request) is True
