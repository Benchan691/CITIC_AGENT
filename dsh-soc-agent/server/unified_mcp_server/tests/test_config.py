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
    assert settings.zimbra.allow_folder_write is False
    assert settings.splunk.configured is False
    assert settings.zimbra.configured is False
    assert settings.splunk.detection_write_enabled is False
    assert settings.splunk.detection_enable_enabled is False
    assert settings.zimbra.max_attachment_bytes == 10_000_000
    assert settings.zimbra.max_attachment_text_chars == 200_000
    assert settings.email_server.url == "http://100.114.50.103:9100"
    assert settings.email_server.configured is False


def test_environment_overrides_persisted_configuration():
    class Store:
        def list_config(self):
            return {
                "ZIMBRA_HOST": "stored.example.com",
                "ZIMBRA_ALLOW_SEND": "false",
            }

    settings = ServerSettings.from_store(
        Store(),
        {
            "ZIMBRA_HOST": "env.example.com",
            "ZIMBRA_ALLOW_SEND": "true",
        },
    )

    assert settings.zimbra.host == "env.example.com"
    assert settings.zimbra.allow_send is True


def test_global_zimbra_environment_settings_load_as_connection_defaults():
    settings = ServerSettings.from_env(
        {
            "ZIMBRA_HOST": "https://zmailbox.citictel-cpc.com/",
            "ZIMBRA_VERIFY_SSL": "false",
            "ZIMBRA_TIMEOUT": "60",
            "ZIMBRA_MAX_ATTACHMENT_BYTES": "10000000",
            "ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS": "200000",
            "ZIMBRA_ALLOW_SEND": "true",
        }
    )

    assert settings.zimbra.host == "https://zmailbox.citictel-cpc.com/"
    assert settings.zimbra.verify_ssl is False
    assert settings.zimbra.timeout == 60
    assert settings.zimbra.max_attachment_bytes == 10_000_000
    assert settings.zimbra.max_attachment_text_chars == 200_000
    assert settings.public_status(account_count=2)["zimbra"] == {
        "configured": True,
        "host": "https://zmailbox.citictel-cpc.com/",
        "account_count": 2,
        "verify_ssl": False,
        "send_enabled": True,
        "filter_write_enabled": False,
        "filter_redirect_enabled": False,
        "filter_discard_enabled": False,
        "folder_write_enabled": False,
        "max_attachment_bytes": 10_000_000,
        "max_attachment_text_chars": 200_000,
    }


def test_persisted_configuration_remains_a_fallback_for_unset_environment_values():
    class Store:
        def list_config(self):
            return {
                "ZIMBRA_HOST": "stored.example.com",
                "ZIMBRA_ALLOW_SEND": "true",
            }

    settings = ServerSettings.from_store(Store(), {})

    assert settings.zimbra.host == "stored.example.com"
    assert settings.zimbra.allow_send is True


def test_status_redacts_credentials_and_does_not_include_mailbox_identity():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_HOST": "splunk.example.com",
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
    assert "account_count" in status


def test_email_server_credentials_load_without_exposing_password_in_status():
    settings = ServerSettings.from_env(
        {
            "EMAIL_SERVER_URL": "http://email.example.com/",
            "EMAIL_SEVER_USER": "operator",
            "EMAIL_SEVER_PASSWORD": "email-secret",
            "EMAIL_SERVER_TIMEOUT": "45",
        }
    )

    assert settings.email_server.url == "http://email.example.com"
    assert settings.email_server.timeout == 45
    assert settings.email_server.configured is True
    assert "email-secret" not in json.dumps(settings.public_status())


def test_zimbra_email_and_password_load_from_environment():
    settings = ServerSettings.from_env(
        {
            "ZIMBRA_HOST": "mail.example.com",
            "ZIMBRA_EMAIL": "analyst@example.com",
            "ZIMBRA_PASSWORD": "mail-secret",
        }
    )

    assert settings.zimbra.email == "analyst@example.com"
    assert settings.zimbra.password == "mail-secret"
    assert settings.zimbra.configured is True


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


def test_zimbra_filter_gates_are_explicit_and_visible_without_secrets():
    settings = ServerSettings.from_env(
        {
            "ZIMBRA_ALLOW_FILTER_WRITE": "true",
            "ZIMBRA_ALLOW_FILTER_REDIRECT": "true",
            "ZIMBRA_ALLOW_FILTER_DISCARD": "true",
        }
    )

    status = settings.public_status()
    assert settings.zimbra.allow_filter_write is True
    assert status["zimbra"]["filter_write_enabled"] is True
    assert status["zimbra"]["filter_redirect_enabled"] is True
    assert status["zimbra"]["filter_discard_enabled"] is True


def test_zimbra_folder_write_gate_is_explicit_and_visible_without_secrets():
    settings = ServerSettings.from_env({"ZIMBRA_ALLOW_FOLDER_WRITE": "true"})

    assert settings.zimbra.allow_folder_write is True
    assert settings.public_status()["zimbra"]["folder_write_enabled"] is True


@pytest.mark.parametrize(
    ("name", "value"),
    [("MCP_PORT", "0"), ("SPLUNK_RISK_TOLERANCE", "101"), ("ZIMBRA_VERIFY_SSL", "sometimes")],
)
def test_invalid_environment_values_fail_fast(name, value):
    with pytest.raises(ValueError):
        ServerSettings.from_env({name: value})
