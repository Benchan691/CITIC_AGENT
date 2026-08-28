"""Server configuration with redacted public status."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from os import environ
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from .env_loader import load_splunk_config, workspace_root
from .postgres_store import PostgresStore
from .splunk.query_policy import QueryPolicyConfig
from .splunk.search.resource_policy import SearchResourceConfig
from .splunk.security_queue.model import SecurityQueueConfig


_SPLUNK_JSON_FIELDS = {
    "host": "SPLUNK_HOST",
    "host_for_docker": "SPLUNK_HOST_FOR_DOCKER",
    "port": "SPLUNK_PORT",
    "scheme": "SPLUNK_SCHEME",
    "url": "SPLUNK_URL",
    "verify_ssl": "SPLUNK_VERIFY_SSL",
    "request_timeout": "SPLUNK_REQUEST_TIMEOUT",
    "job_timeout": "SPLUNK_JOB_TIMEOUT",
    "max_events": "SPLUNK_MAX_EVENTS",
    "risk_tolerance": "SPLUNK_RISK_TOLERANCE",
    "safe_timerange": "SPLUNK_SAFE_TIMERANGE",
    "sanitize_output": "SPLUNK_SANITIZE_OUTPUT",
    "allow_detection_write": "SPLUNK_ALLOW_DETECTION_WRITE",
    "detection_write_enabled": "SPLUNK_ALLOW_DETECTION_WRITE",
    "allow_detection_enable": "SPLUNK_ALLOW_DETECTION_ENABLE",
    "detection_enable_enabled": "SPLUNK_ALLOW_DETECTION_ENABLE",
    "detection_app": "SPLUNK_DETECTION_APP",
    "detection_owner": "SPLUNK_DETECTION_OWNER",
    "detection_approval_ttl_seconds": "SPLUNK_DETECTION_APPROVAL_TTL_SECONDS",
    "search_planner_max_refinements": "SPLUNK_SEARCH_PLANNER_MAX_REFINEMENTS",
}

_SPLUNK_SECRET_FIELDS = frozenset({
    "SPLUNK_TOKEN",
    "SPLUNK_USERNAME",
    "SPLUNK_PASSWORD",
})
_SPLUNK_SECRET_JSON_NAMES = frozenset({"token", "username", "password"})

_SPLUNK_JSON_SECTIONS = {
    "query_policy": {
        "short_search_seconds": "SPLUNK_POLICY_SHORT_SEARCH_SECONDS",
        "normal_search_seconds": "SPLUNK_POLICY_NORMAL_SEARCH_SECONDS",
        "very_long_search_seconds": "SPLUNK_POLICY_VERY_LONG_SEARCH_SECONDS",
        "wildcard_index_decision": "SPLUNK_POLICY_WILDCARD_INDEX",
        "no_index_decision": "SPLUNK_POLICY_NO_INDEX",
        "long_raw_decision": "SPLUNK_POLICY_LONG_RAW",
        "very_long_decision": "SPLUNK_POLICY_VERY_LONG",
        "all_time_decision": "SPLUNK_POLICY_ALL_TIME",
        "expensive_command_decision": "SPLUNK_POLICY_EXPENSIVE_COMMAND",
        "subsearch_decision": "SPLUNK_POLICY_SUBSEARCH",
        "nested_subsearch_decision": "SPLUNK_POLICY_NESTED_SUBSEARCH",
        "unresolved_macro_decision": "SPLUNK_POLICY_UNRESOLVED_MACRO",
        "unparseable_time_decision": "SPLUNK_POLICY_UNPARSEABLE_TIME",
        "max_subsearch_depth": "SPLUNK_POLICY_MAX_SUBSEARCH_DEPTH",
        "trusted_macros": "SPLUNK_POLICY_TRUSTED_MACROS",
    },
    "search_resource": {
        "global_concurrency": "SPLUNK_SEARCH_GLOBAL_CONCURRENCY",
        "per_principal_concurrency": "SPLUNK_SEARCH_PER_PRINCIPAL_CONCURRENCY",
        "queue_timeout_seconds": "SPLUNK_SEARCH_QUEUE_TIMEOUT_SECONDS",
        "max_jobs_per_minute": "SPLUNK_SEARCH_MAX_JOBS_PER_MINUTE",
        "budget_per_minute": "SPLUNK_SEARCH_BUDGET_PER_MINUTE",
        "max_runtime_low": "SPLUNK_SEARCH_MAX_RUNTIME_LOW",
        "max_runtime_medium": "SPLUNK_SEARCH_MAX_RUNTIME_MEDIUM",
        "max_runtime_high": "SPLUNK_SEARCH_MAX_RUNTIME_HIGH",
        "max_lookback_low": "SPLUNK_SEARCH_MAX_LOOKBACK_LOW",
        "max_lookback_medium": "SPLUNK_SEARCH_MAX_LOOKBACK_MEDIUM",
        "max_lookback_high": "SPLUNK_SEARCH_MAX_LOOKBACK_HIGH",
        "max_results_low": "SPLUNK_SEARCH_MAX_RESULTS_LOW",
        "max_results_medium": "SPLUNK_SEARCH_MAX_RESULTS_MEDIUM",
        "max_results_high": "SPLUNK_SEARCH_MAX_RESULTS_HIGH",
        "backtest_concurrency": "SPLUNK_SEARCH_BACKTEST_CONCURRENCY",
        "restricted_decision": "SPLUNK_SEARCH_RESTRICTED_DECISION",
    },
    "security_queue": {
        "max_backend_pages_per_request": "SECURITY_QUEUE_MAX_BACKEND_PAGES_PER_REQUEST",
        "max_backend_records_per_request": "SECURITY_QUEUE_MAX_BACKEND_RECORDS_PER_REQUEST",
        "standard_concurrency": "SECURITY_QUEUE_STANDARD_CONCURRENCY",
    },
}

_SPLUNK_CONNECTION_FIELDS = {
    "SPLUNK_HOST",
    "SPLUNK_HOST_FOR_DOCKER",
    "SPLUNK_URL",
    "SPLUNK_TOKEN",
    "SPLUNK_USERNAME",
    "SPLUNK_PASSWORD",
}


def _json_text(name: str, value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        items: list[str] = []
        for item in value:
            if isinstance(item, (Mapping, list, tuple)):
                raise ValueError(f"Splunk configuration value {name} must contain scalar items")
            if item is not None and str(item).strip():
                items.append(str(item).strip())
        return ",".join(items)
    raise ValueError(f"Splunk configuration value {name} must be a scalar or list")


def _json_target(name: object, fields: Mapping[str, str]) -> str | None:
    key = str(name)
    if key in _SPLUNK_SECRET_FIELDS:
        return None
    if key in fields:
        return fields[key]
    if key.startswith("SPLUNK_") or key.startswith("SECURITY_QUEUE_"):
        return key
    return None


def _json_values(payload: Mapping[str, Any], *, require_connection: bool) -> dict[str, str]:
    source: dict[str, Any]
    if "splunk" in payload:
        wrapped = payload["splunk"]
        if not isinstance(wrapped, Mapping):
            raise ValueError("Splunk configuration 'splunk' section must be an object")
        source = dict(payload)
        source.pop("splunk", None)
        source.update(wrapped)
    else:
        source = dict(payload)

    enabled = source.get("enabled")
    if enabled is not None and not isinstance(enabled, bool):
        raise ValueError("Splunk configuration 'enabled' must be true or false")

    values: dict[str, str] = {}
    for name, raw_value in source.items():
        if name in {"enabled", "config_version"} or str(name).casefold() in _SPLUNK_SECRET_JSON_NAMES:
            continue
        section_fields = _SPLUNK_JSON_SECTIONS.get(str(name))
        if section_fields is not None:
            if not isinstance(raw_value, Mapping):
                raise ValueError(f"Splunk configuration section {name} must be an object")
            for nested_name, nested_value in raw_value.items():
                target = _json_target(nested_name, section_fields)
                if target is None:
                    continue
                text = _json_text(f"{name}.{nested_name}", nested_value)
                if text is not None and (text or not isinstance(nested_value, str)):
                    values[target] = text
            continue

        target = _json_target(name, _SPLUNK_JSON_FIELDS)
        if target is None:
            continue
        text = _json_text(str(name), raw_value)
        # Empty strings mean "use the existing fallback". This lets the
        # checked-in credential-free template coexist with old deployments.
        if text is not None and (text or not isinstance(raw_value, str)):
            values[target] = text

    if enabled is False:
        return {}
    if require_connection and enabled is not True:
        if not any(values.get(key, "").strip() for key in _SPLUNK_CONNECTION_FIELDS):
            return {}
    return values


def _merge_splunk_config(
    env: Mapping[str, str],
    *,
    load_default: bool,
) -> dict[str, str]:
    merged = dict(env)
    explicit_path = _value(merged, "SPL_CONFIG_FILE") or _value(merged, "SPLUNK_CONFIG_FILE")
    if not load_default and not explicit_path:
        return merged
    payload = load_splunk_config(merged if explicit_path else None)
    json_values = _json_values(payload, require_connection=not bool(explicit_path))
    if explicit_path:
        merged.update(json_values)
    else:
        # The checked-in JSON is a credential-free deployment template. Keep
        # explicitly supplied legacy environment values authoritative when it
        # is being used as a fallback, especially a host versus template URL.
        has_env_host = any(_value(merged, key) for key in ("SPLUNK_HOST", "SPLUNK_HOST_FOR_DOCKER"))
        for key, value in json_values.items():
            if _value(merged, key) or (key == "SPLUNK_URL" and has_env_host):
                continue
            merged[key] = value
    return merged


def _value(env: Mapping[str, str], name: str, default: str = "") -> str:
    return str(env.get(name, default)).strip()


def _boolean(env: Mapping[str, str], name: str, default: bool) -> bool:
    raw = _value(env, name)
    if not raw:
        return default
    if raw.lower() in {"1", "true", "yes", "on"}:
        return True
    if raw.lower() in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be true or false")


def _integer(env: Mapping[str, str], name: str, default: int, minimum: int, maximum: int) -> int:
    raw = _value(env, name, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def _preferred(env: Mapping[str, str], primary: str, legacy: str) -> str:
    return primary if _value(env, primary) else legacy


def _policy_decision(env: Mapping[str, str], name: str, default: str = "require_approval") -> str:
    value = _value(env, name, default).lower()
    if value not in {"allow", "require_approval", "deny"}:
        raise ValueError(f"{name} must be allow, require_approval, or deny")
    return value


def _restricted_decision(env: Mapping[str, str]) -> str:
    value = _value(env, "SPLUNK_SEARCH_RESTRICTED_DECISION", "deny").lower()
    if value not in {"deny", "require_approval"}:
        raise ValueError("SPLUNK_SEARCH_RESTRICTED_DECISION must be deny or require_approval")
    return value


def _policy_macros(env: Mapping[str, str]) -> tuple[str, ...]:
    raw = _value(env, "SPLUNK_POLICY_TRUSTED_MACROS")
    return tuple(item.strip() for item in raw.split(",") if item.strip())


def _storage_path(env: Mapping[str, str], name: str, default: str) -> str:
    value = _value(env, name, default)
    if value.startswith(".data/"):
        root = _value(env, "MCP_SERVER_ROOT", _value(env, "MCP_SEVER_ROOT"))
        base = Path(root) if root else workspace_root()
        return str(base / value)
    return value


@dataclass(frozen=True)
class SplunkSettings:
    host: str
    port: int
    username: str
    password: str
    token: str
    verify_ssl: bool
    request_timeout: int
    job_timeout: int
    max_events: int
    risk_tolerance: int
    safe_timerange: str
    sanitize_output: bool
    detection_write_enabled: bool = False
    detection_enable_enabled: bool = False
    detection_app: str = "search"
    detection_owner: str = "nobody"
    url: str = ""
    query_policy: QueryPolicyConfig = field(default_factory=QueryPolicyConfig)
    detection_approval_ttl_seconds: int = 600
    search_resource: SearchResourceConfig = field(default_factory=SearchResourceConfig)
    security_queue: SecurityQueueConfig = field(default_factory=SecurityQueueConfig)
    search_planner_max_refinements: int = 2

    @property
    def configured(self) -> bool:
        return bool(self.host and (self.token or (self.username and self.password)))

    @property
    def missing(self) -> list[str]:
        missing = [] if self.host else ["SPLUNK_HOST"]
        if not self.token and not (self.username and self.password):
            missing.append("SPLUNK_TOKEN or SPLUNK_USERNAME/SPLUNK_PASSWORD")
        return missing

    def client_config(self) -> dict[str, object]:
        return {
            "splunk_url": self.url,
            "splunk_host": self.host,
            "splunk_port": self.port,
            "splunk_username": self.username,
            "splunk_password": self.password,
            "splunk_token": self.token,
            "verify_ssl": self.verify_ssl,
            "request_timeout": self.request_timeout,
            "job_timeout": self.job_timeout,
        }


@dataclass(frozen=True)
class ZimbraSettings:
    host: str
    verify_ssl: bool
    timeout: int
    allow_send: bool = True
    max_attachment_bytes: int = 10_000_000
    max_attachment_text_chars: int = 200_000
    accounts_file: str = ".data/zimbra_accounts.enc"
    key_file: str = ".data/zimbra_accounts.key"
    explicit_key: str = ""
    email: str = ""
    password: str = ""
    allow_filter_write: bool = True
    allow_filter_redirect: bool = True
    allow_filter_discard: bool = True
    allow_folder_write: bool = True
    allow_move: bool = True
    allow_signature_write: bool = True

    @property
    def configured(self) -> bool:
        # Credentials are supplied only for the current login request.
        return bool(self.host)

    @property
    def missing(self) -> list[str]:
        return ["ZIMBRA_HOST"] if not self.host else []

    def client_config(self, *, email: str, username: str, password: str) -> dict[str, object]:
        return {
            "zimbra_host": self.host,
            "zimbra_email": email,
            "zimbra_username": username,
            "zimbra_password": password,
            "verify_ssl": self.verify_ssl,
            "timeout": self.timeout,
        }


@dataclass(frozen=True)
class MarkItDownSettings:
    llm_enabled: bool = False
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""
    llm_timeout: int = 60

    def __post_init__(self) -> None:
        if self.llm_enabled and not self.llm_api_key:
            raise ValueError("MARKITDOWN_LLM_API_KEY is required when MARKITDOWN_LLM_ENABLED is true")
        if self.llm_enabled and not self.llm_model:
            raise ValueError("MARKITDOWN_LLM_MODEL is required when MARKITDOWN_LLM_ENABLED is true")


@dataclass(frozen=True)
class EmailServerSettings:
    url: str
    username: str
    password: str
    timeout: int

    @property
    def configured(self) -> bool:
        return bool(self.url and self.username and self.password)

    @property
    def missing(self) -> list[str]:
        missing = []
        if not self.url:
            missing.append("SUBSCRIPTION_SERVER_URL")
        if not self.username:
            missing.append("SUBSCRIPTION_SERVER_USER")
        if not self.password:
            missing.append("SUBSCRIPTION_SERVER_PASSWORD")
        return missing


@dataclass(frozen=True)
class ServerSettings:
    name: str
    description: str
    transport: str
    host: str
    port: int
    log_level: str
    splunk: SplunkSettings
    zimbra: ZimbraSettings
    markitdown: MarkItDownSettings
    email_server: EmailServerSettings

    @classmethod
    def from_env(cls, values: Mapping[str, str] | None = None) -> "ServerSettings":
        env = _merge_splunk_config(
            dict(environ if values is None else values),
            load_default=values is None,
        )
        transport = _value(env, "MCP_TRANSPORT", _value(env, "TRANSPORT", "stdio")).lower()
        transport = "streamable-http" if transport == "http" else transport
        if transport not in {"stdio", "sse", "streamable-http"}:
            raise ValueError("MCP_TRANSPORT must be stdio, sse, or streamable-http")

        splunk_verify_name = _preferred(env, "SPLUNK_VERIFY_SSL", "VERIFY_SSL")
        splunk_max_name = _preferred(env, "SPLUNK_MAX_EVENTS", "SPL_MAX_EVENTS_COUNT")
        splunk_risk_name = _preferred(env, "SPLUNK_RISK_TOLERANCE", "SPL_RISK_TOLERANCE")
        splunk_safe_name = _preferred(env, "SPLUNK_SAFE_TIMERANGE", "SPL_SAFE_TIMERANGE")
        splunk_sanitize_name = _preferred(env, "SPLUNK_SANITIZE_OUTPUT", "SPL_SANITIZE_OUTPUT")
        query_policy = QueryPolicyConfig(
            short_search_seconds=_integer(env, "SPLUNK_POLICY_SHORT_SEARCH_SECONDS", 86_400, 1, 31_536_000),
            normal_search_seconds=_integer(env, "SPLUNK_POLICY_NORMAL_SEARCH_SECONDS", 604_800, 1, 31_536_000),
            very_long_search_seconds=_integer(env, "SPLUNK_POLICY_VERY_LONG_SEARCH_SECONDS", 2_592_000, 1, 31_536_000),
            wildcard_index_decision=_policy_decision(env, "SPLUNK_POLICY_WILDCARD_INDEX"),
            no_index_decision=_policy_decision(env, "SPLUNK_POLICY_NO_INDEX"),
            long_raw_decision=_policy_decision(env, "SPLUNK_POLICY_LONG_RAW"),
            very_long_decision=_policy_decision(env, "SPLUNK_POLICY_VERY_LONG"),
            all_time_decision=_policy_decision(env, "SPLUNK_POLICY_ALL_TIME"),
            expensive_command_decision=_policy_decision(env, "SPLUNK_POLICY_EXPENSIVE_COMMAND"),
            subsearch_decision=_policy_decision(env, "SPLUNK_POLICY_SUBSEARCH"),
            nested_subsearch_decision=_policy_decision(env, "SPLUNK_POLICY_NESTED_SUBSEARCH"),
            unresolved_macro_decision=_policy_decision(env, "SPLUNK_POLICY_UNRESOLVED_MACRO"),
            unparseable_time_decision=_policy_decision(env, "SPLUNK_POLICY_UNPARSEABLE_TIME"),
            max_subsearch_depth=_integer(env, "SPLUNK_POLICY_MAX_SUBSEARCH_DEPTH", 1, 1, 16),
            trusted_macros=_policy_macros(env),
        )
        search_resource = SearchResourceConfig(
            global_concurrency=_integer(env, "SPLUNK_SEARCH_GLOBAL_CONCURRENCY", 8, 1, 64),
            per_principal_concurrency=_integer(
                env, "SPLUNK_SEARCH_PER_PRINCIPAL_CONCURRENCY", 2, 1, 16
            ),
            queue_timeout_seconds=float(
                _integer(env, "SPLUNK_SEARCH_QUEUE_TIMEOUT_SECONDS", 5, 0, 300)
            ),
            max_jobs_per_minute=_integer(env, "SPLUNK_SEARCH_MAX_JOBS_PER_MINUTE", 20, 1, 10_000),
            budget_per_minute=_integer(env, "SPLUNK_SEARCH_BUDGET_PER_MINUTE", 20, 1, 100_000),
            max_runtime_low=_integer(env, "SPLUNK_SEARCH_MAX_RUNTIME_LOW", 30, 1, 3_600),
            max_runtime_medium=_integer(env, "SPLUNK_SEARCH_MAX_RUNTIME_MEDIUM", 60, 1, 3_600),
            max_runtime_high=_integer(env, "SPLUNK_SEARCH_MAX_RUNTIME_HIGH", 120, 1, 3_600),
            max_lookback_low=_integer(env, "SPLUNK_SEARCH_MAX_LOOKBACK_LOW", 86_400, 1, 31_536_000),
            max_lookback_medium=_integer(
                env, "SPLUNK_SEARCH_MAX_LOOKBACK_MEDIUM", 604_800, 1, 31_536_000
            ),
            max_lookback_high=_integer(
                env, "SPLUNK_SEARCH_MAX_LOOKBACK_HIGH", 2_592_000, 1, 31_536_000
            ),
            max_results_low=_integer(env, "SPLUNK_SEARCH_MAX_RESULTS_LOW", 100, 1, 100_000),
            max_results_medium=_integer(env, "SPLUNK_SEARCH_MAX_RESULTS_MEDIUM", 500, 1, 100_000),
            max_results_high=_integer(env, "SPLUNK_SEARCH_MAX_RESULTS_HIGH", 1_000, 1, 100_000),
            backtest_concurrency=_integer(env, "SPLUNK_SEARCH_BACKTEST_CONCURRENCY", 1, 1, 16),
            restricted_decision=_restricted_decision(env),
        )
        search_planner_max_refinements = _integer(
            env, "SPLUNK_SEARCH_PLANNER_MAX_REFINEMENTS", 2, 0, 5
        )
        security_queue = SecurityQueueConfig(
            max_backend_pages_per_request=_integer(
                env, "SECURITY_QUEUE_MAX_BACKEND_PAGES_PER_REQUEST", 10, 1, 100
            ),
            max_backend_records_per_request=_integer(
                env, "SECURITY_QUEUE_MAX_BACKEND_RECORDS_PER_REQUEST", 1_000, 1, 100_000
            ),
            standard_concurrency=_integer(env, "SECURITY_QUEUE_STANDARD_CONCURRENCY", 5, 1, 32),
        )
        splunk_host = (
            _value(env, "SPLUNK_HOST_FOR_DOCKER")
            if _value(env, "RUNNING_INSIDE_DOCKER") == "1"
            else _value(env, "SPLUNK_HOST")
        )
        splunk_port = _integer(env, "SPLUNK_PORT", 8089, 1, 65535)
        splunk_url = _value(env, "SPLUNK_URL")
        if splunk_url:
            parsed_splunk_url = urlsplit(splunk_url)
            splunk_host = parsed_splunk_url.hostname or splunk_host
            splunk_port = parsed_splunk_url.port or splunk_port
        elif splunk_host:
            scheme = _value(env, "SPLUNK_SCHEME", "https").lower()
            if scheme not in {"http", "https"}:
                raise ValueError("SPLUNK_SCHEME must be http or https")
            splunk_url = f"{scheme}://{splunk_host}:{splunk_port}"
        splunk = SplunkSettings(
            host=splunk_host,
            port=splunk_port,
            username=_value(env, "SPLUNK_USERNAME"),
            password=_value(env, "SPLUNK_PASSWORD"),
            token=_value(env, "SPLUNK_TOKEN"),
            verify_ssl=_boolean(env, splunk_verify_name, True),
            request_timeout=_integer(env, "SPLUNK_REQUEST_TIMEOUT", 30, 1, 600),
            job_timeout=_integer(env, "SPLUNK_JOB_TIMEOUT", 120, 1, 3600),
            max_events=_integer(env, splunk_max_name, 1000, 1, 100000),
            risk_tolerance=_integer(env, splunk_risk_name, 75, 0, 100),
            safe_timerange=_value(env, splunk_safe_name, "24h"),
            sanitize_output=_boolean(env, splunk_sanitize_name, True),
            detection_write_enabled=_boolean(env, "SPLUNK_ALLOW_DETECTION_WRITE", False),
            detection_enable_enabled=_boolean(env, "SPLUNK_ALLOW_DETECTION_ENABLE", False),
            detection_app=_value(env, "SPLUNK_DETECTION_APP", "search"),
            detection_owner=_value(env, "SPLUNK_DETECTION_OWNER", "nobody"),
            url=splunk_url,
            query_policy=query_policy,
            detection_approval_ttl_seconds=_integer(
                env, "SPLUNK_DETECTION_APPROVAL_TTL_SECONDS", 600, 60, 900
            ),
            search_resource=search_resource,
            security_queue=security_queue,
            search_planner_max_refinements=search_planner_max_refinements,
        )
        zimbra = ZimbraSettings(
            host=_value(env, "ZIMBRA_HOST"),
            verify_ssl=_boolean(env, "ZIMBRA_VERIFY_SSL", False),
            timeout=_integer(env, "ZIMBRA_TIMEOUT", 60, 1, 600),
            allow_send=_boolean(env, "ZIMBRA_ALLOW_SEND", True),
            allow_filter_write=_boolean(env, "ZIMBRA_ALLOW_FILTER_WRITE", True),
            allow_filter_redirect=_boolean(env, "ZIMBRA_ALLOW_FILTER_REDIRECT", True),
            allow_filter_discard=_boolean(env, "ZIMBRA_ALLOW_FILTER_DISCARD", True),
            allow_folder_write=_boolean(env, "ZIMBRA_ALLOW_FOLDER_WRITE", True),
            allow_move=_boolean(env, "ZIMBRA_ALLOW_MOVE", True),
            allow_signature_write=_boolean(env, "ZIMBRA_ALLOW_SIGNATURE_WRITE", True),
            max_attachment_bytes=_integer(env, "ZIMBRA_MAX_ATTACHMENT_BYTES", 10_000_000, 1, 100_000_000),
            max_attachment_text_chars=_integer(env, "ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS", 200_000, 1, 2_000_000),
            accounts_file=_storage_path(env, "ZIMBRA_ACCOUNTS_FILE", ".data/zimbra_accounts.enc"),
            key_file=_storage_path(env, "ZIMBRA_ACCOUNTS_KEY_FILE", ".data/zimbra_accounts.key"),
            explicit_key=_value(env, "ZIMBRA_ACCOUNTS_KEY"),
            # Legacy fields remain readable for compatibility-only service tests;
            # the SOC host never constructs a normal runtime from them.
            email=_value(env, "ZIMBRA_EMAIL"),
            password=_value(env, "ZIMBRA_PASSWORD"),
        )
        markitdown = MarkItDownSettings(
            llm_enabled=_boolean(env, "MARKITDOWN_LLM_ENABLED", False),
            llm_api_key=_value(env, "MARKITDOWN_LLM_API_KEY"),
            llm_base_url=_value(env, "MARKITDOWN_LLM_BASE_URL"),
            llm_model=_value(env, "MARKITDOWN_LLM_MODEL"),
            llm_timeout=_integer(env, "MARKITDOWN_LLM_TIMEOUT", 60, 1, 600),
        )
        email_server = EmailServerSettings(
            url=_value(env, "SUBSCRIPTION_SERVER_URL", "http://100.114.50.103:9100").rstrip("/"),
            username=_value(env, "SUBSCRIPTION_SERVER_USER"),
            password=_value(env, "SUBSCRIPTION_SERVER_PASSWORD"),
            timeout=_integer(env, "SUBSCRIPTION_SERVER_TIMEOUT", 30, 1, 600),
        )
        return cls(
            name=_value(env, "MCP_SERVER_NAME", "SOC Agent MCP"),
            description=_value(env, "MCP_SERVER_DESCRIPTION", "SOC Agent investigation tools for Splunk and Zimbra"),
            transport=transport,
            host=_value(env, "MCP_HOST", _value(env, "HOST", "127.0.0.1")),
            port=_integer(env, _preferred(env, "MCP_PORT", "PORT"), 8050, 1, 65535),
            log_level=_value(env, "LOG_LEVEL", "INFO").upper(),
            splunk=splunk,
            zimbra=zimbra,
            markitdown=markitdown,
            email_server=email_server,
        )

    @classmethod
    def from_store(
        cls,
        store: PostgresStore | None,
        values: Mapping[str, str] | None = None,
    ) -> "ServerSettings":
        env = dict(environ if values is None else values)
        if store is None:
            return cls.from_env(values)
        # PostgreSQL supplies the persisted baseline, while explicit
        # environment values remain the deployment override.
        persisted = store.list_config()
        persisted.update({key: value for key, value in env.items() if str(value).strip()})
        env = _merge_splunk_config(persisted, load_default=values is None)
        return cls.from_env(env)

    def public_status(self) -> dict[str, object]:
        return {
            "server": {"name": self.name, "transport": self.transport},
            "splunk": {
                "configured": self.splunk.configured,
                "host": self.splunk.host,
                "port": self.splunk.port,
                "verify_ssl": self.splunk.verify_ssl,
                "max_events": self.splunk.max_events,
                "risk_tolerance": self.splunk.risk_tolerance,
                "sanitize_output": self.splunk.sanitize_output,
                "detection_write_enabled": self.splunk.detection_write_enabled,
                "detection_enable_enabled": self.splunk.detection_enable_enabled,
                "detection_app": self.splunk.detection_app,
                "detection_approval_ttl_seconds": self.splunk.detection_approval_ttl_seconds,
                "query_policy": self.splunk.query_policy.to_dict(),
                "search_resource": self.splunk.search_resource.to_dict(),
                "security_queue": self.splunk.security_queue.to_dict(),
                "search_planner_max_refinements": self.splunk.search_planner_max_refinements,
            },
            "zimbra": {
                "configured": self.zimbra.configured,
                "host": self.zimbra.host,
                "verify_ssl": self.zimbra.verify_ssl,
                "filter_write_enabled": self.zimbra.allow_filter_write,
                "filter_redirect_enabled": self.zimbra.allow_filter_redirect,
                "filter_discard_enabled": self.zimbra.allow_filter_discard,
                "folder_write_enabled": self.zimbra.allow_folder_write,
                "move_enabled": self.zimbra.allow_move,
                "signature_write_enabled": self.zimbra.allow_signature_write,
                "send_enabled": self.zimbra.allow_send,
                "max_attachment_bytes": self.zimbra.max_attachment_bytes,
                "max_attachment_text_chars": self.zimbra.max_attachment_text_chars,
            },
            "markitdown": {
                "llm_enabled": self.markitdown.llm_enabled,
                "llm_base_url": self.markitdown.llm_base_url,
                "llm_model": self.markitdown.llm_model,
                "llm_timeout": self.markitdown.llm_timeout,
            },
            "email_server": {
                "configured": self.email_server.configured,
                "url": self.email_server.url,
            },
        }
