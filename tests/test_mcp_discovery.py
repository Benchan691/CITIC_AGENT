import json
from dataclasses import dataclass, replace
from types import SimpleNamespace

import pytest
from deepagents._messages_reducer import _messages_delta_reducer
from langchain.agents.middleware import ExtendedModelResponse
from langchain.agents.middleware.types import ModelResponse
from langchain_core.messages import AIMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph.message import REMOVE_ALL_MESSAGES

from unified_mcp_server.deep_agent import (
    _agent_middleware,
    build_model_for_provider,
    detection_prompt,
    discover_tools,
    investigation_prompt,
    normalize_model_provider,
    resolve_model,
)


EXPECTED_TOOLS = {
    "system_get_status",
    "splunk_validate_query",
    "splunk_search",
    "splunk_list_indexes",
    "splunk_list_saved_searches",
    "splunk_run_saved_search",
    "splunk_list_data_sources",
    "splunk_get_detection",
    "splunk_validate_detection",
    "splunk_backtest_detection",
    "splunk_create_detection_draft",
    "splunk_update_detection_draft",
    "splunk_enable_detection",
    "splunk_disable_detection",
    "zimbra_list_folders",
    "zimbra_list_accounts",
    "zimbra_search_emails",
    "zimbra_get_email",
    "zimbra_send_email",
}


@pytest.fixture(autouse=True)
def isolate_backend_environment(monkeypatch):
    for name in (
        "SPLUNK_HOST",
        "SPLUNK_TOKEN",
        "SPLUNK_USERNAME",
        "SPLUNK_PASSWORD",
        "ZIMBRA_HOST",
        "ZIMBRA_ACCOUNTS_KEY",
        "ZIMBRA_ACCOUNT_API_KEY",
        "MCP_SERVER_URL",
        "DEEP_AGENT_DEFAULT_PROVIDER",
        "DEEP_AGENT_PROVIDER",
        "DEEP_AGENT_MODEL",
        "DEEPSEEK_API_KEY",
        "DEEPSEEK_BASE_URL",
        "DEEPSEEK_MODEL",
        "LOCAL_MODEL_BASE_URL",
        "LOCAL_MODEL_NAME",
        "LOCAL_MODEL_CONTEXT_TOKENS",
        "LOCAL_MODEL_API_KEY",
    ):
        # Empty values prevent the child MCP server's dotenv load from filling
        # in a developer's local credentials during this hermetic test.
        monkeypatch.setenv(name, "")
    monkeypatch.setenv("PYTHON_DOTENV_DISABLED", "true")


@pytest.mark.asyncio
async def test_deep_agent_discovers_both_tool_namespaces():
    tools = await discover_tools()
    assert {tool.name for tool in tools} == EXPECTED_TOOLS


@pytest.mark.asyncio
async def test_structured_error_crosses_the_mcp_adapter_boundary():
    tools = {tool.name: tool for tool in await discover_tools()}
    content = await tools["splunk_list_indexes"].ainvoke({})
    response = json.loads(content[0]["text"])

    assert response["ok"] is False
    assert response["service"] == "splunk"
    assert response["error"]["code"] == "not_configured"


def test_example_prompt_requires_cross_system_correlation():
    prompt = investigation_prompt("app-01")
    assert "Search Splunk" in prompt
    assert "Search Zimbra" in prompt
    assert "app-01" in prompt


def test_detection_prompt_requires_validation_backtest_and_approval():
    prompt = detection_prompt("Test rule", "index=main error", "-7d")
    assert "splunk_validate_detection" in prompt
    assert "splunk_backtest_detection" in prompt
    assert "never enable" in prompt.lower()


def test_mcp_connection_does_not_forward_mailbox_credentials(monkeypatch):
    from unified_mcp_server.deep_agent import mcp_connection

    monkeypatch.delenv("MCP_SERVER_URL", raising=False)
    monkeypatch.setenv("ZIMBRA_EMAIL", "hidden@example.com")
    monkeypatch.setenv("ZIMBRA_PASSWORD", "hidden")
    connection = mcp_connection()
    assert "ZIMBRA_EMAIL" not in connection["env"]
    assert "ZIMBRA_PASSWORD" not in connection["env"]


def test_deepseek_model_uses_openai_compatible_endpoint(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "https://api.deepseek.example")

    model = resolve_model("deepseek-v4-flash")

    assert model.model_name == "deepseek-v4-flash"
    assert str(model.openai_api_base).rstrip("/") == "https://api.deepseek.example"


def test_deepseek_provider_accepts_prefixed_model(monkeypatch):
    monkeypatch.setenv("DEEP_AGENT_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    model = resolve_model("deepseek:deepseek-v4-pro")

    assert model.model_name == "deepseek-v4-pro"


def test_deepseek_provider_factory_returns_model(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    model = build_model_for_provider("deepseek")

    assert model.model_name == "deepseek-v4-flash"


def test_deepseek_provider_recovers_from_openai_model_line(monkeypatch):
    monkeypatch.setenv("DEEP_AGENT_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEP_AGENT_MODEL", "openai:gpt-5.5")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    model = resolve_model()

    assert model.model_name == "deepseek-v4-flash"


def test_local_model_uses_llama_cpp_profile(monkeypatch):
    monkeypatch.setenv("LOCAL_MODEL_BASE_URL", "http://127.0.0.1:6767/v1")
    monkeypatch.setenv("LOCAL_MODEL_NAME", "/models/test.gguf")
    monkeypatch.setenv("LOCAL_MODEL_CONTEXT_TOKENS", "8192")

    model = build_model_for_provider("local")

    assert model.model_name == "/models/test.gguf"
    assert str(model.openai_api_base).rstrip("/") == "http://127.0.0.1:6767/v1"
    assert model.use_responses_api is False
    assert model.profile["max_input_tokens"] == 8192


def test_invalid_runtime_model_provider_uses_safe_default(monkeypatch):
    monkeypatch.setenv("DEEP_AGENT_DEFAULT_PROVIDER", "local")

    assert normalize_model_provider({"configurable": {"model_provider": "remote"}}) == "local"
    assert normalize_model_provider({"configurable": {}}) == "local"


@dataclass
class _ModelRequest:
    messages: list
    state: dict
    runtime: object
    system_message: object = None
    tools: list = None

    def __post_init__(self):
        if self.tools is None:
            self.tools = []

    def override(self, **changes):
        return replace(self, **changes)


def _handoff_middleware():
    return _agent_middleware(
        ChatOpenAI(model="test", api_key="test", profile={"max_input_tokens": 10}), object()
    )[0]


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["local", "deepseek"])
async def test_context_handoff_replaces_active_history_and_continues(monkeypatch, provider):
    context_var = "LOCAL_MODEL_CONTEXT_TOKENS" if provider == "local" else "DEEPSEEK_CONTEXT_TOKENS"
    monkeypatch.setenv(context_var, "10")
    middleware = _handoff_middleware()
    monkeypatch.setattr(middleware, "_count_tokens", lambda *args: 8)

    captured = {}

    async def create_handoff(messages, selected_provider):
        captured["summary_messages"] = messages
        captured["provider"] = selected_provider
        return """## Objective
Investigate the alert.
## Completed and verified
Indexes were listed.
## Decisions and constraints
Use read-only tools.
## Outstanding work
Review the saved rule.
## Next action
Call splunk_get_detection for the requested rule."""

    monkeypatch.setattr(middleware, "_acreate_handoff", create_handoff)
    old_messages = [
        HumanMessage(id="user-1", content="Investigate alert"),
        AIMessage(id="assistant-1", content="Old tool output must be removed"),
    ]
    request = _ModelRequest(
        messages=old_messages,
        state={
            "messages": old_messages,
            "files": {
                "/conversation_history/session.md": {"content": "discard"},
                "/large_tool_results/result.md": {"content": "discard"},
                "/report.md": {"content": "keep"},
            },
        },
        runtime=SimpleNamespace(config={"configurable": {"model_provider": provider}}),
    )
    continued = AIMessage(id="assistant-2", content="Continuing with the next action.")

    async def handler(overridden):
        captured["continued_messages"] = overridden.messages
        return ModelResponse(result=[continued], structured_response=None)

    result = await middleware.awrap_model_call(request, handler)

    assert isinstance(result, ExtendedModelResponse)
    assert captured["provider"] == provider
    assert captured["summary_messages"] == old_messages
    assert len(captured["continued_messages"]) == 2
    assert captured["continued_messages"][1].content.startswith("## Conversation handoff")

    update = result.command.update
    assert update["messages"][0].id == REMOVE_ALL_MESSAGES
    assert update["files"] == {
        "/conversation_history/session.md": None,
        "/large_tool_results/result.md": None,
    }
    active_messages = _messages_delta_reducer(old_messages, [update["messages"]])
    active_text = "\n".join(str(message.content) for message in active_messages)
    assert "Old tool output must be removed" not in active_text
    assert "## Conversation handoff" in active_text
    assert "Continuing with the next action." in active_text


@pytest.mark.asyncio
async def test_context_handoff_does_not_reset_a_short_conversation(monkeypatch):
    monkeypatch.setenv("LOCAL_MODEL_CONTEXT_TOKENS", "10")
    middleware = _handoff_middleware()
    monkeypatch.setattr(middleware, "_count_tokens", lambda *args: 7)
    request = _ModelRequest(
        messages=[HumanMessage(id="user-1", content="Still short")],
        state={"messages": []},
        runtime=SimpleNamespace(config={"configurable": {"model_provider": "local"}}),
    )
    response = ModelResponse(result=[AIMessage(id="assistant-1", content="Normal reply")])

    async def handler(overridden):
        assert overridden is request
        return response

    assert await middleware.awrap_model_call(request, handler) is response
