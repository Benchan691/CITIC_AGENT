"""LangChain Deep Agent client that discovers this server's MCP tools."""

import argparse
import asyncio
import os
import sys
from collections.abc import Iterable, Mapping
from typing import Any
from typing import Literal
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv

from .model_providers import MODEL_PROVIDERS as PROVIDER_CONFIG
from .settings_store import SettingsStore

load_dotenv()

EXPECTED_PREFIXES = ("system_", "splunk_", "zimbra_")
SERVER_ENV_EXACT = {
    "HOST",
    "PORT",
    "TRANSPORT",
    "VERIFY_SSL",
    "RUNNING_INSIDE_DOCKER",
    "PYTHON_DOTENV_DISABLED",
    "PATH",
    "PYTHONPATH",
    "VIRTUAL_ENV",
}
SERVER_ENV_ALLOWED = {
    "MCP_TRANSPORT",
    "MCP_HOST",
    "MCP_PORT",
    "MCP_SERVER_NAME",
    "MCP_SERVER_DESCRIPTION",
    "MCP_ALLOWED_ORIGINS",
    "APP_POSTGRES_URI",
    "LANGGRAPH_POSTGRES_URI",
    "POSTGRES_URI",
    "APP_SETTINGS_ENCRYPTION_KEY",
    "ZIMBRA_HOST",
    "ZIMBRA_VERIFY_SSL",
    "ZIMBRA_TIMEOUT",
    "ZIMBRA_ALLOW_SEND",
    "ZIMBRA_ACCOUNTS_FILE",
    "ZIMBRA_ACCOUNTS_KEY_FILE",
    "SPLUNK_ALLOW_DETECTION_WRITE",
    "SPLUNK_ALLOW_DETECTION_ENABLE",
    "SPLUNK_DETECTION_APP",
    "SPLUNK_DETECTION_OWNER",
}

ApprovalMode = Literal["ask", "smart", "full"]
APPROVAL_MODES = frozenset({"ask", "smart", "full"})
ModelProvider = Literal["deepseek", "local"]
MODEL_PROVIDERS = frozenset(PROVIDER_CONFIG)
RISKY_TOOL_NAMES = frozenset(
    {
        "zimbra_send_email",
        "splunk_create_detection_draft",
        "splunk_update_detection_draft",
        "splunk_enable_detection",
        "splunk_disable_detection",
        "write_file",
        "edit_file",
        "execute",
        "task",
    }
)
BUILT_IN_TOOL_NAMES = frozenset(
    {"ls", "read_file", "write_file", "edit_file", "glob", "grep", "execute", "task", "write_todos"}
)


def normalize_approval_mode(config: Mapping[str, Any] | None) -> ApprovalMode:
    configurable = config.get("configurable", {}) if config else {}
    mode = configurable.get("approval_mode") if isinstance(configurable, Mapping) else None
    return mode if isinstance(mode, str) and mode in APPROVAL_MODES else "ask"


def should_interrupt_tool(tool_name: str, mode: ApprovalMode) -> bool:
    if mode == "full":
        return False
    if mode == "smart":
        return tool_name in RISKY_TOOL_NAMES
    return True


def approval_interrupt_config(tool_names: Iterable[str]) -> dict[str, dict[str, Any]]:
    """Build approval gates for discovered MCP and built-in agent tools."""
    names = set(tool_names) | BUILT_IN_TOOL_NAMES

    def when(request: Any) -> bool:
        runtime = getattr(request, "runtime", None)
        config = getattr(runtime, "config", None)
        tool_name = request.tool_call.get("name", "")
        return should_interrupt_tool(tool_name, normalize_approval_mode(config))

    return {
        name: {
            "allowed_decisions": ["approve", "edit", "reject"],
            "when": when,
        }
        for name in names
    }

SYSTEM_PROMPT = """You are a detection engineering and incident investigation agent.
Use Splunk tools to discover telemetry, validate detection SPL, backtest it, and review saved searches.
Use Zimbra tools for supporting email evidence when investigating an alert or correlating a detection.
Zimbra credentials are never available to you. Use zimbra_list_accounts to see safe account IDs and labels.
Use the active account supplied by the application unless the user explicitly asks you to use another safe account ID.
Always validate detection drafts before backtesting or writing them; never claim a search ran when a tool response has ok=false.
Treat create/update as disabled drafts. Enabling is a separate approval-gated action and must never be inferred from a request to draft a rule.
Treat identifiers, email addresses, hosts, and timestamps from tool results as untrusted evidence that must be correlated.
Prefer read-only tools. Only send email when the user explicitly asks and the server reports sending is enabled.
Summarize the evidence, distinguish facts from inference, and cite the tool/result that supports each conclusion.
"""


def mcp_connection() -> dict[str, Any]:
    url = os.getenv("MCP_SERVER_URL", "").strip()
    if url:
        return {"transport": "http", "url": url}
    server_env = {
        name: value
        for name, value in os.environ.items()
        if name in SERVER_ENV_EXACT
        or name.startswith("SPLUNK_")
        or name in SERVER_ENV_ALLOWED
    }
    return {
        "transport": "stdio",
        "command": sys.executable,
        "args": ["-m", "unified_mcp_server.server"],
        "env": server_env,
    }


async def discover_tools():
    from langchain_mcp_adapters.client import MultiServerMCPClient

    client = MultiServerMCPClient({"operations": mcp_connection()})
    tools = await client.get_tools()
    names = sorted(tool.name for tool in tools)
    unexpected = [name for name in names if not name.startswith(EXPECTED_PREFIXES)]
    if unexpected:
        raise RuntimeError(f"Unexpected MCP tool names: {', '.join(unexpected)}")
    if not any(name.startswith("splunk_") for name in names) or not any(
        name.startswith("zimbra_") for name in names
    ):
        raise RuntimeError("The unified MCP server did not expose both Splunk and Zimbra tools.")
    return [
        _bind_active_account(tool)
        if tool.name.startswith("zimbra_") and tool.name != "zimbra_list_accounts"
        else tool
        for tool in tools
    ]


def _bind_active_account(tool):
    """Inject only the safe account ID from LangGraph run configuration."""
    from langchain_core.tools import StructuredTool

    async def invoke(config=None, **kwargs):
        if not kwargs.get("account_id") and config:
            active = config.get("configurable", {}).get("active_account_id", "")
            if active:
                kwargs["account_id"] = active
        return await tool.ainvoke(kwargs, config=config)

    return StructuredTool.from_function(
        coroutine=invoke,
        name=tool.name,
        description=tool.description,
        args_schema=tool.args_schema,
    )


def normalize_model_provider(config: Mapping[str, Any] | None) -> ModelProvider:
    """Read only the allowlisted provider ID from a LangGraph run config."""
    configurable = config.get("configurable", {}) if config else {}
    value = configurable.get("model_provider") if isinstance(configurable, Mapping) else None
    if isinstance(value, str) and value.strip().lower() in MODEL_PROVIDERS:
        return value.strip().lower()  # type: ignore[return-value]
    return configured_default_model_provider()


def configured_default_model_provider() -> ModelProvider:
    stored = _stored_settings()
    stored_provider = stored.get("default_provider")
    if isinstance(stored_provider, str) and stored_provider in MODEL_PROVIDERS:
        return stored_provider  # type: ignore[return-value]
    configured = os.getenv("DEEP_AGENT_DEFAULT_PROVIDER", "").strip().lower()
    if configured == "local":
        return "local"
    has_deepseek_key = bool(_stored_provider_api_key("deepseek") or os.getenv("DEEPSEEK_API_KEY", "").strip())
    if configured == "deepseek" and has_deepseek_key:
        return configured  # type: ignore[return-value]
    if (
        os.getenv("DEEP_AGENT_PROVIDER", "").strip().lower() in MODEL_PROVIDERS
        and has_deepseek_key
    ):
        return os.getenv("DEEP_AGENT_PROVIDER", "").strip().lower()  # type: ignore[return-value]
    return "deepseek" if has_deepseek_key else "local"


def _stored_settings() -> dict[str, Any]:
    """Read persisted settings without exposing them to graph state or prompts."""
    try:
        store = SettingsStore.from_env(os.environ)
        return store.load() if store is not None else {}
    except (OSError, RuntimeError, ValueError):
        return {}


def _stored_provider_api_key(provider: ModelProvider) -> str:
    settings = _stored_settings()
    models = settings.get("models", {})
    if not isinstance(models, dict):
        return ""
    config = models.get(provider, {})
    return str(config.get("api_key", "")).strip() if isinstance(config, dict) else ""


def _context_token_limit(provider: ModelProvider) -> int:
    raw = os.getenv(
        "LOCAL_MODEL_CONTEXT_TOKENS" if provider == "local" else "DEEPSEEK_CONTEXT_TOKENS",
        "8192" if provider == "local" else "65536",
    ).strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 8192 if provider == "local" else 65536


def _local_model_base_url() -> str:
    base_url = os.getenv("LOCAL_MODEL_BASE_URL", "http://127.0.0.1:6767/v1").strip()
    # The agent runs inside Docker during `unified-dev`; loopback there is the
    # container, while llama.cpp is running on the host Mac.
    if os.path.exists("/.dockerenv"):
        parsed = urlsplit(base_url)
        if parsed.hostname in {"127.0.0.1", "localhost"}:
            host = "host.docker.internal"
            netloc = host if parsed.port is None else f"{host}:{parsed.port}"
            base_url = urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))
    return base_url


def build_model_for_provider(provider: ModelProvider):
    """Build a server-owned model client for a safe provider ID."""
    from langchain_openai import ChatOpenAI

    if provider == "local":
        return ChatOpenAI(
            model=os.getenv(
                "LOCAL_MODEL_NAME", "/models/Qwen_Qwen3.6-35B-A3B-IQ4_XS.gguf"
            ).strip(),
            api_key=os.getenv("LOCAL_MODEL_API_KEY", "local").strip() or "local",
            base_url=_local_model_base_url(),
            use_responses_api=False,
            profile={"max_input_tokens": _context_token_limit("local")},
        )

    api_key = _stored_provider_api_key("deepseek") or os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is required when using a DeepSeek model")
    return ChatOpenAI(
        model=os.getenv("DEEPSEEK_MODEL", "").strip() or "deepseek-v4-flash",
        api_key=api_key,
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip(),
        profile={"max_input_tokens": _context_token_limit("deepseek")},
    )


def resolve_model(model: str | None = None):
    """Resolve a configured model or one of the server-owned model providers."""
    requested = (model or os.getenv("DEEP_AGENT_MODEL", "openai:gpt-5.5")).strip()
    requested_lower = requested.lower()
    configured_provider = os.getenv("DEEP_AGENT_PROVIDER", "").strip().lower()

    if requested_lower in MODEL_PROVIDERS:
        return build_model_for_provider(requested_lower)  # type: ignore[arg-type]

    if model is None and configured_default_model_provider() == "local":
        return build_model_for_provider("local")

    is_deepseek = configured_provider in {"deepseek", "deepseek-ai"} or requested_lower.startswith(
        "deepseek"
    )
    if not is_deepseek:
        return requested

    from langchain_openai import ChatOpenAI

    model_name = requested.split(":", 1)[1] if requested_lower.startswith("deepseek:") else requested
    if model_name.lower().startswith(("openai:", "anthropic:", "google:")):
        model_name = os.getenv("DEEPSEEK_MODEL", "").strip() or "deepseek-v4-flash"
    api_key = _stored_provider_api_key("deepseek") or os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is required when using a DeepSeek model")
    return ChatOpenAI(
        model=model_name,
        api_key=api_key,
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip(),
        profile={"max_input_tokens": _context_token_limit("deepseek")},
    )


from langchain.agents.middleware import AgentMiddleware, ExtendedModelResponse
from langchain_core.messages import AIMessage, RemoveMessage, SystemMessage
from langgraph.graph.message import REMOVE_ALL_MESSAGES
from langgraph.types import Command


class RuntimeModelRoutingMiddleware(AgentMiddleware):
    """Select the server-built model using only configurable.model_provider."""

    @property
    def name(self) -> str:
        return "RuntimeModelRoutingMiddleware"

    async def awrap_model_call(self, request, handler):
        from langgraph.config import get_config

        provider = normalize_model_provider(get_config())
        return await handler(request.override(model=build_model_for_provider(provider)))

    def wrap_model_call(self, request, handler):
        from langgraph.config import get_config

        provider = normalize_model_provider(get_config())
        return handler(request.override(model=build_model_for_provider(provider)))


def _agent_middleware(model, backend):
    from deepagents.middleware.summarization import SummarizationMiddleware
    from langchain.agents.middleware.summarization import get_buffer_string, internal_call_metadata

    handoff_prompt = """Create a concise handoff for an agent that must continue this work without access to the prior conversation.

Return exactly these Markdown sections:
## Objective
## Completed and verified
## Decisions and constraints
## Outstanding work
## Next action

Use only facts supported by the conversation. Keep each section short. The Next action must be one concrete, highest-priority action the agent can perform now. Do not mention this summarization request.

Conversation:
{messages}
"""

    class ConversationHandoffMiddleware(SummarizationMiddleware):
        """Replace an oversized active chat with a handoff and continue it."""

        @property
        def name(self) -> str:
            return "SummarizationMiddleware"

        @staticmethod
        def _provider_for_request(request) -> ModelProvider:
            runtime_config = getattr(getattr(request, "runtime", None), "config", None)
            if runtime_config:
                return normalize_model_provider(runtime_config)
            from langgraph.config import get_config

            return normalize_model_provider(get_config())

        @staticmethod
        def _archive_file_removals(state) -> dict[str, None]:
            files = state.get("files", {})
            if not isinstance(files, Mapping):
                return {}
            return {
                path: None
                for path in files
                if path.startswith(("/conversation_history/", "/large_tool_results/"))
            }

        async def _acreate_handoff(self, messages_to_summarize, provider: ModelProvider) -> str:
            if not messages_to_summarize:
                return "No previous conversation history."
            trimmed = self._lc_helper._trim_messages_for_summary(messages_to_summarize)
            if not trimmed:
                return "Previous conversation was too long to summarize."
            formatted = get_buffer_string(trimmed, format="xml")
            response = await build_model_for_provider(provider).with_retry().ainvoke(
                handoff_prompt.format(messages=formatted).rstrip(),
                config={"metadata": {"lc_source": "conversation_handoff", **internal_call_metadata()}},
            )
            return response.text.strip()

        def _should_handoff(self, provider: ModelProvider, total_tokens: int) -> bool:
            return total_tokens >= int(_context_token_limit(provider) * 0.8)

        async def awrap_model_call(self, request, handler):
            provider = self._provider_for_request(request)
            total_tokens = self._count_tokens(
                request.messages, request.system_message, request.tools
            )
            if not self._should_handoff(provider, total_tokens):
                return await handler(request)

            handoff = await self._acreate_handoff(request.messages, provider)
            continuation_instruction = SystemMessage(
                content=(
                    "The prior conversation was intentionally discarded. The following "
                    "assistant handoff is the only retained context. Continue immediately "
                    "with its Next action, following all existing tool approval rules."
                )
            )
            handoff_message = AIMessage(
                content=f"## Conversation handoff\n\n{handoff}",
                additional_kwargs={"lc_source": "conversation_handoff"},
            )
            response = await handler(
                request.override(messages=[continuation_instruction, handoff_message])
            )
            update: dict[str, Any] = {
                "messages": [
                    RemoveMessage(id=REMOVE_ALL_MESSAGES),
                    continuation_instruction,
                    handoff_message,
                    *response.result,
                ]
            }
            archive_removals = self._archive_file_removals(request.state)
            if archive_removals:
                update["files"] = archive_removals
            return ExtendedModelResponse(
                model_response=response,
                command=Command(update=update),
            )

    return [
        ConversationHandoffMiddleware(
            model,
            backend=backend,
            trigger=("fraction", 0.8),
        ),
        RuntimeModelRoutingMiddleware(),
    ]


async def create_agent(model: str | None = None):
    from deepagents import create_deep_agent
    from deepagents.backends import StateBackend
    from deepagents.middleware.subagents import GENERAL_PURPOSE_SUBAGENT

    tools = await discover_tools()
    base_model = resolve_model(model)
    backend = StateBackend()
    middleware = _agent_middleware(base_model, backend)
    general_purpose = {
        **GENERAL_PURPOSE_SUBAGENT,
        "model": base_model,
        "tools": tools,
        "middleware": _agent_middleware(base_model, backend),
    }
    agent = create_deep_agent(
        model=base_model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        interrupt_on=approval_interrupt_config(tool.name for tool in tools),
        middleware=middleware,
        subagents=[general_purpose],
        backend=backend,
    )
    return agent, tools


def investigation_prompt(indicator: str, earliest_time: str = "-24h") -> str:
    return f"""Investigate this indicator: {indicator}

Workflow:
1. Search Splunk from {earliest_time} to now for events containing the indicator. Keep the query scoped and read-only.
2. Extract concrete correlators from results, such as usernames, email addresses, hosts, alert names, and timestamps.
3. Search Zimbra for messages related to the strongest correlators and retrieve the most relevant message bodies.
4. Produce a concise incident timeline, evidence summary, confidence assessment, and recommended next checks.

Do not invent evidence when either system is unavailable; report the structured tool error instead.
"""


def detection_prompt(name: str, spl: str, earliest_time: str = "-7d") -> str:
    return f"""Review and develop this Splunk detection rule.

Name: {name}
Proposed SPL: {spl}

Workflow:
1. Use splunk_list_data_sources to confirm the data scope.
2. Call splunk_validate_detection with the name, SPL, schedule, severity, and any MITRE/risk metadata.
3. If validation succeeds, call splunk_backtest_detection for {earliest_time} through now and assess match volume and representative events.
4. Inspect related saved searches when useful. Only create a disabled draft if the user explicitly requests persistence.
5. Never enable the rule without an explicit approval step; report the exact validation and backtest results.
"""


async def run_investigation(indicator: str, earliest_time: str = "-24h", model: str | None = None):
    agent, _ = await create_agent(model)
    return await agent.ainvoke({"messages": investigation_prompt(indicator, earliest_time)})


def _last_message_text(result: Any) -> str:
    messages = result.get("messages", []) if isinstance(result, dict) else []
    if not messages:
        return str(result)
    content = getattr(messages[-1], "content", messages[-1])
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            str(item.get("text", item)) if isinstance(item, dict) else str(item)
            for item in content
        )
    return str(content)


async def _run_cli(args: argparse.Namespace) -> None:
    if args.list_tools:
        tools = await discover_tools()
        for tool in sorted(tools, key=lambda item: item.name):
            print(f"{tool.name}: {tool.description or ''}")
        return
    if args.detection_name:
        if not args.spl:
            raise SystemExit("--spl is required with --detection-name")
        agent, _ = await create_agent(args.model)
        result = await agent.ainvoke({"messages": detection_prompt(args.detection_name, args.spl, args.earliest_time)})
    else:
        if not args.indicator:
            raise SystemExit("--indicator or --detection-name is required unless --list-tools is used")
        result = await run_investigation(args.indicator, args.earliest_time, args.model)
    print(_last_message_text(result))


def main() -> None:
    parser = argparse.ArgumentParser(description="Investigate Splunk telemetry and related Zimbra email")
    parser.add_argument("--indicator", help="IP, host, username, email, alert, or other incident indicator")
    parser.add_argument("--detection-name", help="Review a detection rule instead of investigating an indicator")
    parser.add_argument("--spl", help="Proposed SPL used with --detection-name")
    parser.add_argument("--earliest-time", default="-24h", help="Splunk earliest_time value")
    parser.add_argument("--model", help="LangChain model identifier; defaults to DEEP_AGENT_MODEL")
    parser.add_argument("--list-tools", action="store_true", help="Discover MCP tools without calling an LLM")
    asyncio.run(_run_cli(parser.parse_args()))


if __name__ == "__main__":
    main()
