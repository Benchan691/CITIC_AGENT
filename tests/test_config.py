import json

import pytest

from unified_mcp_server.config import ServerSettings


def test_defaults_are_secure_and_services_can_be_unconfigured():
    settings = ServerSettings.from_env({})

    assert settings.transport == "stdio"
    assert settings.splunk.verify_ssl is True
    assert settings.splunk.sanitize_output is True
    assert settings.zimbra.verify_ssl is True
    assert settings.zimbra.allow_send is False
    assert settings.splunk.configured is False
    assert settings.zimbra.configured is False
    assert settings.splunk.detection_write_enabled is False
    assert settings.splunk.detection_enable_enabled is False


def test_status_redacts_credentials_and_does_not_include_mailbox_identity():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_HOST": "splunk.example.com",
            "SPLUNK_TOKEN": "splunk-secret",
            "ZIMBRA_HOST": "mail.example.com",
            "ZIMBRA_ACCOUNT_API_KEY": "mail-api-secret",
        }
    )

    status = json.dumps(settings.public_status())
    assert "splunk-secret" not in status
    assert "mail-api-secret" not in status
    assert "analyst@example.com" not in status
    assert "account_count" in status


def test_splunk_url_preserves_scheme_and_port():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_URL": "http://127.0.0.1:8089",
            "SPLUNK_USERNAME": "admin",
            "SPLUNK_PASSWORD": "secret",
        }
    )

    assert settings.splunk.host == "127.0.0.1"
    assert settings.splunk.port == 8089
    assert settings.splunk.client_config()["splunk_url"] == "http://127.0.0.1:8089"


def test_detection_write_flags_are_explicit_and_visible_without_secrets():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_ALLOW_DETECTION_WRITE": "true",
            "SPLUNK_ALLOW_DETECTION_ENABLE": "true",
            "SPLUNK_DETECTION_APP": "enterprise_security",
        }
    )
    status = settings.public_status()
    assert status["splunk"]["detection_write_enabled"] is True
    assert status["splunk"]["detection_enable_enabled"] is True
    assert status["splunk"]["detection_app"] == "enterprise_security"


@pytest.mark.parametrize(
    ("name", "value"),
    [("MCP_PORT", "0"), ("SPLUNK_RISK_TOLERANCE", "101"), ("ZIMBRA_VERIFY_SSL", "sometimes")],
)
def test_invalid_environment_values_fail_fast(name, value):
    with pytest.raises(ValueError):
        ServerSettings.from_env({name: value})
