"""Server configuration with redacted public status."""

from __future__ import annotations

from dataclasses import dataclass
from os import environ
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit

from .env_loader import workspace_root
from .postgres_store import PostgresStore


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
    allow_send: bool
    max_attachment_bytes: int = 10_000_000
    max_attachment_text_chars: int = 200_000
    accounts_file: str = ".data/zimbra_accounts.enc"
    key_file: str = ".data/zimbra_accounts.key"
    explicit_key: str = ""
    email: str = ""
    password: str = ""
    allow_filter_write: bool = False
    allow_filter_redirect: bool = False
    allow_filter_discard: bool = False
    allow_folder_write: bool = False
    allow_move: bool = False

    @property
    def configured(self) -> bool:
        return bool(self.host and self.email and self.password)

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
    email_server: EmailServerSettings

    @classmethod
    def from_env(cls, values: Mapping[str, str] | None = None) -> "ServerSettings":
        env = environ if values is None else values
        transport = _value(env, "MCP_TRANSPORT", _value(env, "TRANSPORT", "stdio")).lower()
        transport = "streamable-http" if transport == "http" else transport
        if transport not in {"stdio", "sse", "streamable-http"}:
            raise ValueError("MCP_TRANSPORT must be stdio, sse, or streamable-http")

        splunk_verify_name = _preferred(env, "SPLUNK_VERIFY_SSL", "VERIFY_SSL")
        splunk_max_name = _preferred(env, "SPLUNK_MAX_EVENTS", "SPL_MAX_EVENTS_COUNT")
        splunk_risk_name = _preferred(env, "SPLUNK_RISK_TOLERANCE", "SPL_RISK_TOLERANCE")
        splunk_safe_name = _preferred(env, "SPLUNK_SAFE_TIMERANGE", "SPL_SAFE_TIMERANGE")
        splunk_sanitize_name = _preferred(env, "SPLUNK_SANITIZE_OUTPUT", "SPL_SANITIZE_OUTPUT")
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
        )
        zimbra = ZimbraSettings(
            host=_value(env, "ZIMBRA_HOST"),
            verify_ssl=_boolean(env, "ZIMBRA_VERIFY_SSL", True),
            timeout=_integer(env, "ZIMBRA_TIMEOUT", 60, 1, 600),
            allow_send=_boolean(env, "ZIMBRA_ALLOW_SEND", False),
            allow_filter_write=_boolean(env, "ZIMBRA_ALLOW_FILTER_WRITE", False),
            allow_filter_redirect=_boolean(env, "ZIMBRA_ALLOW_FILTER_REDIRECT", False),
            allow_filter_discard=_boolean(env, "ZIMBRA_ALLOW_FILTER_DISCARD", False),
            allow_folder_write=_boolean(env, "ZIMBRA_ALLOW_FOLDER_WRITE", False),
            allow_move=_boolean(env, "ZIMBRA_ALLOW_MOVE", False),
            max_attachment_bytes=_integer(env, "ZIMBRA_MAX_ATTACHMENT_BYTES", 10_000_000, 1, 100_000_000),
            max_attachment_text_chars=_integer(env, "ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS", 200_000, 1, 2_000_000),
            accounts_file=_storage_path(env, "ZIMBRA_ACCOUNTS_FILE", ".data/zimbra_accounts.enc"),
            key_file=_storage_path(env, "ZIMBRA_ACCOUNTS_KEY_FILE", ".data/zimbra_accounts.key"),
            explicit_key=_value(env, "ZIMBRA_ACCOUNTS_KEY"),
            email=_value(env, "ZIMBRA_EMAIL"),
            password=_value(env, "ZIMBRA_PASSWORD"),
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
            return cls.from_env(env)
        # PostgreSQL supplies the persisted baseline, while explicit
        # environment values remain the deployment override.
        persisted = store.list_config()
        persisted.update({key: value for key, value in env.items() if str(value).strip()})
        env = persisted
        return cls.from_env(env)

    def public_status(self, account_count: int = 0) -> dict[str, object]:
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
            },
            "zimbra": {
                "configured": bool(self.zimbra.host and account_count),
                "host": self.zimbra.host,
                "account_count": account_count,
                "verify_ssl": self.zimbra.verify_ssl,
                "send_enabled": self.zimbra.allow_send,
                "filter_write_enabled": self.zimbra.allow_filter_write,
                "filter_redirect_enabled": self.zimbra.allow_filter_redirect,
                "filter_discard_enabled": self.zimbra.allow_filter_discard,
                "folder_write_enabled": self.zimbra.allow_folder_write,
                "move_enabled": self.zimbra.allow_move,
                "max_attachment_bytes": self.zimbra.max_attachment_bytes,
                "max_attachment_text_chars": self.zimbra.max_attachment_text_chars,
            },
            "email_server": {
                "configured": self.email_server.configured,
                "url": self.email_server.url,
            },
        }
