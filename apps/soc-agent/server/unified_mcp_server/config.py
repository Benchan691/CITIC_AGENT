"""Server configuration with redacted public status."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from os import environ
from pathlib import Path
from urllib.parse import urlsplit

from .env_loader import workspace_root
from .postgres_store import PostgresStore


def redact_endpoint(value: str, *, allow_bare_host: bool = False) -> str:
    """Return an endpoint suitable for public status without secret URL parts."""
    raw = str(value or "").strip()
    if not raw:
        return ""
    has_scheme = "://" in raw
    if not has_scheme and not allow_bare_host:
        return "[configured endpoint]"
    candidate = raw if has_scheme else f"//{raw}"
    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        return "[invalid endpoint]"
    if not hostname:
        return "[invalid endpoint]"
    rendered_host = f"[{hostname}]" if ":" in hostname and not hostname.startswith("[") else hostname
    netloc = rendered_host if port is None else f"{rendered_host}:{port}"
    if "://" in raw:
        # Paths can carry opaque tenant names, tokens, or credentials just as
        # readily as query strings.  Public projections only need the
        # authority to identify the configured service.
        return f"{parsed.scheme.lower()}://{netloc}"
    return netloc


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


def _validate_http_endpoint(
    value: str,
    name: str,
    *,
    allow_bare_host: bool = False,
    allow_insecure_http: bool = False,
    allow_path: bool = True,
) -> None:
    """Validate a configured service endpoint without echoing its value."""
    raw = str(value or "").strip()
    if not raw:
        return
    candidate = raw if "://" in raw else (f"https://{raw}" if allow_bare_host else raw)
    try:
        parsed = urlsplit(candidate)
        parsed.port
        hostname = parsed.hostname
    except ValueError as exc:
        raise ValueError(f"{name} must be a valid http or https endpoint") from exc
    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.netloc
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or (not allow_path and parsed.path not in {"", "/"})
    ):
        raise ValueError(f"{name} must be a valid http or https endpoint without embedded credentials")
    if parsed.scheme.lower() == "http" and not allow_insecure_http:
        raise ValueError(f"{name} must use HTTPS unless its explicit insecure HTTP setting is true")


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


def _storage_path(env: Mapping[str, str], name: str, default: str) -> str:
    value = _value(env, name, default)
    if value.startswith(".data/"):
        root = _value(env, "MCP_SERVER_ROOT", _value(env, "MCP_SEVER_ROOT"))
        base = Path(root) if root else workspace_root()
        return str(base / value)
    return value


@dataclass(frozen=True)
class SplunkSettings:
    """Status for the official MCP bridge; Python does not run Splunk tools."""

    mcp_endpoint: str
    token: str
    verify_ssl: bool = True
    allow_insecure_http: bool = False
    sanitize_output: bool = True

    def __post_init__(self) -> None:
        _validate_http_endpoint(
            self.mcp_endpoint,
            "SPLUNK_MCP_ENDPOINT",
            allow_insecure_http=self.allow_insecure_http,
        )

    @property
    def configured(self) -> bool:
        return bool(self.mcp_endpoint and self.token)

    @property
    def missing(self) -> list[str]:
        return [
            name for name, value in (
                ("SPLUNK_MCP_ENDPOINT", self.mcp_endpoint),
                ("SPLUNK_TOKEN", self.token),
            ) if not value
        ]


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
    allow_insecure_http: bool = False

    def __post_init__(self) -> None:
        _validate_http_endpoint(
            self.host,
            "ZIMBRA_HOST",
            allow_bare_host=True,
            allow_insecure_http=self.allow_insecure_http,
            allow_path=False,
        )

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
            "allow_insecure_http": self.allow_insecure_http,
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
    allow_insecure_http: bool = False

    def __post_init__(self) -> None:
        value = str(self.url or '').strip()
        if not value:
            return
        try:
            parsed = urlsplit(value)
            parsed.port
            hostname = parsed.hostname
        except ValueError as exc:
            raise ValueError('SUBSCRIPTION_SERVER_URL must be an http or https URL without embedded credentials') from exc
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError('SUBSCRIPTION_SERVER_URL must be an http or https URL without embedded credentials')
        if not hostname:
            raise ValueError('SUBSCRIPTION_SERVER_URL must include a valid host')
        if parsed.fragment:
            raise ValueError('SUBSCRIPTION_SERVER_URL must not contain a fragment')
        if parsed.scheme == 'http' and not self.allow_insecure_http:
            raise ValueError('SUBSCRIPTION_SERVER_URL must use HTTPS unless SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP is true')

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
        # Service configuration is deployment-owned.  Read it from the
        # process environment (including the server .env loaded at startup),
        # never from the database or a browser-editable document.
        env = dict(environ if values is None else values)
        transport = _value(env, "MCP_TRANSPORT", _value(env, "TRANSPORT", "stdio")).lower()
        transport = "streamable-http" if transport == "http" else transport
        if transport not in {"stdio", "sse", "streamable-http"}:
            raise ValueError("MCP_TRANSPORT must be stdio, sse, or streamable-http")

        splunk = SplunkSettings(
            mcp_endpoint=_value(env, "SPLUNK_MCP_ENDPOINT"),
            token=_value(env, "SPLUNK_TOKEN"),
            verify_ssl=_boolean(env, "SPLUNK_VERIFY_SSL", True),
            allow_insecure_http=_boolean(env, "SPLUNK_ALLOW_INSECURE_HTTP", False),
            sanitize_output=_boolean(env, "SPLUNK_SANITIZE_OUTPUT", True),
        )
        zimbra_host = _value(env, "ZIMBRA_HOST")
        zimbra_allow_insecure_http = _boolean(env, "ZIMBRA_ALLOW_INSECURE_HTTP", False)
        if zimbra_host:
            _validate_http_endpoint(
                zimbra_host,
                "ZIMBRA_HOST",
                allow_bare_host=True,
                allow_insecure_http=zimbra_allow_insecure_http,
                allow_path=False,
            )
        zimbra = ZimbraSettings(
            host=zimbra_host,
            verify_ssl=_boolean(env, "ZIMBRA_VERIFY_SSL", True),
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
            allow_insecure_http=zimbra_allow_insecure_http,
        )
        markitdown = MarkItDownSettings(
            llm_enabled=_boolean(env, "MARKITDOWN_LLM_ENABLED", False),
            llm_api_key=_value(env, "MARKITDOWN_LLM_API_KEY"),
            llm_base_url=_value(env, "MARKITDOWN_LLM_BASE_URL"),
            llm_model=_value(env, "MARKITDOWN_LLM_MODEL"),
            llm_timeout=_integer(env, "MARKITDOWN_LLM_TIMEOUT", 60, 1, 600),
        )
        email_server = EmailServerSettings(
            url=_value(env, "SUBSCRIPTION_SERVER_URL").rstrip("/"),
            username=_value(env, "SUBSCRIPTION_SERVER_USER"),
            password=_value(env, "SUBSCRIPTION_SERVER_PASSWORD"),
            timeout=_integer(env, "SUBSCRIPTION_SERVER_TIMEOUT", 30, 1, 600),
            allow_insecure_http=_boolean(env, "SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP", False),
        )
        return cls(
            name=_value(env, "MCP_SERVER_NAME", "SOC Agent MCP"),
            description=_value(env, "MCP_SERVER_DESCRIPTION", "SOC Agent tools for Zimbra and subscriptions"),
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
        """Compatibility entry point; service settings are never store-backed."""
        del store
        return cls.from_env(values)

    def public_status(self) -> dict[str, object]:
        return {
            "server": {"name": self.name, "transport": self.transport},
            "splunk": {
                "configured": self.splunk.configured,
                "verify_ssl": self.splunk.verify_ssl,
                "allow_insecure_http": self.splunk.allow_insecure_http,
                "sanitize_output": self.splunk.sanitize_output,
                "official_mcp_enabled": self.splunk.configured,
                "official_mcp_endpoint": redact_endpoint(self.splunk.mcp_endpoint),
            },
            "zimbra": {
                "configured": self.zimbra.configured,
                "host": redact_endpoint(self.zimbra.host, allow_bare_host=True),
                "verify_ssl": self.zimbra.verify_ssl,
                "allow_insecure_http": self.zimbra.allow_insecure_http,
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
                "llm_base_url": redact_endpoint(self.markitdown.llm_base_url),
                "llm_model": self.markitdown.llm_model,
                "llm_timeout": self.markitdown.llm_timeout,
            },
            "email_server": {
                "configured": self.email_server.configured,
                "url": redact_endpoint(self.email_server.url),
                "allow_insecure_http": self.email_server.allow_insecure_http,
            },
        }

    def public_readiness(self) -> dict[str, object]:
        """Return non-configuration service readiness for ordinary SOC users."""
        return {
            "server": {"name": self.name},
            "services": {
                "splunk": {"configured": self.splunk.configured},
                "zimbra": {"configured": self.zimbra.configured},
                "markitdown": {"available": True},
                "subscription_server": {"configured": self.email_server.configured},
            },
        }
