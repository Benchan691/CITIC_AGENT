import json

import pytest

from unified_mcp_server.config import ServerSettings


def test_defaults_are_safe_and_services_can_be_unconfigured():
    settings = ServerSettings.from_env({})

    assert settings.transport == "stdio"
    assert settings.splunk.verify_ssl is True
    assert settings.splunk.allow_insecure_http is False
    assert settings.splunk.sanitize_output is True
    assert settings.zimbra.verify_ssl is True
    assert settings.zimbra.allow_insecure_http is False
    assert settings.zimbra.allow_filter_write is True
    assert settings.zimbra.allow_filter_redirect is True
    assert settings.zimbra.allow_filter_discard is True
    assert settings.zimbra.allow_folder_write is True
    assert settings.zimbra.allow_move is True
    assert settings.zimbra.allow_signature_write is True
    assert settings.zimbra.allow_send is True
    assert settings.splunk.configured is False
    assert settings.zimbra.configured is False
    assert settings.splunk.missing == ["SPLUNK_MCP_ENDPOINT", "SPLUNK_TOKEN"]
    assert settings.zimbra.max_attachment_bytes == 10_000_000
    assert settings.zimbra.max_attachment_text_chars == 200_000
    assert settings.markitdown.llm_enabled is False
    assert settings.markitdown.llm_timeout == 60
    assert settings.email_server.url == ""
    assert settings.email_server.configured is False


def test_service_configuration_comes_from_environment_only(tmp_path):
    ignored_path = tmp_path / "ignored.json"
    ignored_path.write_text("{not-json", encoding="utf-8")

    class Store:
        def list_config(self):
            raise AssertionError("service configuration must not read persisted settings")

    settings = ServerSettings.from_store(
        Store(),
        {
            "SPL_CONFIG_FILE": str(ignored_path),
            "SPLUNK_MCP_ENDPOINT": "https://env.example.com:8000/services/mcp",
            "SPLUNK_TOKEN": "env-token",
            "ZIMBRA_HOST": "https://mail.example.com",
        },
    )

    assert settings.splunk.mcp_endpoint == "https://env.example.com:8000/services/mcp"
    assert settings.splunk.token == "env-token"
    assert settings.splunk.configured is True
    assert settings.zimbra.host == "https://mail.example.com"


def test_status_redacts_credentials_and_does_not_include_mailbox_identity():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_MCP_ENDPOINT": "https://splunk.example.com:8000/private-tenant/services/mcp",
            "SPLUNK_TOKEN": "splunk-secret",
            "ZIMBRA_HOST": "mail.example.com",
            "ZIMBRA_EMAIL": "analyst@example.com",
            "ZIMBRA_PASSWORD": "mail-secret",
        }
    )

    status = json.dumps(settings.public_status())
    assert "splunk-secret" not in status
    assert "mail-secret" not in status
    assert "analyst@example.com" not in status
    assert "account_count" not in status
    assert "private-tenant" not in status
    assert settings.public_status()["splunk"]["official_mcp_endpoint"] == "https://splunk.example.com:8000"


@pytest.mark.parametrize("endpoint", [
    "https://user:password@splunk.example.com:8000/services/mcp",
    "https://splunk.example.com/services/mcp?token=secret",
    "https://splunk.example.com/services/mcp#secret",
    "http://splunk.example.com/services/mcp",
    "splunk.example.com/services/mcp",
])
def test_unsafe_official_mcp_endpoints_are_rejected(endpoint):
    with pytest.raises(ValueError, match="SPLUNK_MCP_ENDPOINT"):
        ServerSettings.from_env({
            "SPLUNK_MCP_ENDPOINT": endpoint,
            "SPLUNK_TOKEN": "token",
        })


def test_credential_bearing_zimbra_endpoint_is_rejected():
    with pytest.raises(ValueError, match="ZIMBRA_HOST"):
        ServerSettings.from_env({
            "ZIMBRA_HOST": "https://user:password@mail.example.com/",
        })


@pytest.mark.parametrize("official,missing", [
    ({}, ["SPLUNK_MCP_ENDPOINT", "SPLUNK_TOKEN"]),
    ({"SPLUNK_TOKEN": "token"}, ["SPLUNK_MCP_ENDPOINT"]),
    ({"SPLUNK_MCP_ENDPOINT": "https://splunk.example.com/mcp"}, ["SPLUNK_TOKEN"]),
    ({"SPLUNK_MCP_ENDPOINT": "https://splunk.example.com/mcp", "SPLUNK_TOKEN": "token"}, []),
])
def test_readiness_requires_the_connection_used_by_the_agent(official, missing):
    settings = ServerSettings.from_env({
        "SPLUNK_URL": "https://legacy.example.com:8089",
        "SPLUNK_USERNAME": "legacy-user",
        "SPLUNK_PASSWORD": "legacy-password",
        "SPLUNK_SEARCH_GLOBAL_CONCURRENCY": "retired-invalid-setting",
        **official,
    })
    assert settings.splunk.missing == missing
    assert settings.splunk.configured is (not missing)
    assert settings.public_status()["splunk"]["configured"] is (not missing)
    assert settings.public_readiness()["services"]["splunk"]["configured"] is (not missing)


def test_explicit_connection_security_settings_are_preserved():
    settings = ServerSettings.from_env({
        "SPLUNK_MCP_ENDPOINT": "http://splunk.example.com/mcp",
        "SPLUNK_TOKEN": "token",
        "SPLUNK_ALLOW_INSECURE_HTTP": "true",
        "SPLUNK_VERIFY_SSL": "false",
        "SPLUNK_SANITIZE_OUTPUT": "false",
    })
    assert settings.splunk.configured is True
    assert settings.public_status()["splunk"] == {
        "configured": True,
        "verify_ssl": False,
        "allow_insecure_http": True,
        "sanitize_output": False,
        "official_mcp_enabled": True,
        "official_mcp_endpoint": "http://splunk.example.com",
    }
