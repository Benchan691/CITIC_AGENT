import json

import pytest

from unified_mcp_server.config import ServerSettings
from unified_mcp_server.env_loader import server_root, workspace_root


def test_workspace_root_fallback_matches_self_contained_repository(monkeypatch):
    monkeypatch.delenv("MCP_SERVER_ROOT", raising=False)
    monkeypatch.delenv("MCP_SEVER_ROOT", raising=False)

    assert workspace_root() == server_root().parents[2]


def test_defaults_are_secure_and_services_can_be_unconfigured():
    settings = ServerSettings.from_env({})

    assert settings.transport == "stdio"
    assert settings.splunk.verify_ssl is True
    assert settings.splunk.sanitize_output is True
    assert settings.zimbra.verify_ssl is True
    assert settings.zimbra.allow_filter_write is True
    assert settings.zimbra.allow_filter_redirect is True
    assert settings.zimbra.allow_filter_discard is True
    assert settings.zimbra.allow_folder_write is True
    assert settings.zimbra.allow_move is True
    assert settings.zimbra.allow_signature_write is True
    assert settings.zimbra.allow_send is True
    assert settings.splunk.configured is False
    assert settings.zimbra.configured is False
    assert settings.splunk.detection_write_enabled is False
    assert settings.splunk.detection_enable_enabled is False
    assert settings.zimbra.max_attachment_bytes == 10_000_000
    assert settings.zimbra.max_attachment_text_chars == 200_000
    assert settings.markitdown.llm_enabled is False
    assert settings.markitdown.llm_timeout == 60
    assert settings.email_server.url == "http://100.114.50.103:9100"
    assert settings.email_server.configured is False


def test_environment_overrides_persisted_configuration():
    class Store:
        def list_config(self):
            return {
                "ZIMBRA_HOST": "stored.example.com",
            }

    settings = ServerSettings.from_store(
        Store(),
        {
            "ZIMBRA_HOST": "env.example.com",
        },
    )

    assert settings.zimbra.host == "env.example.com"


def test_global_zimbra_environment_settings_load_as_connection_defaults():
    settings = ServerSettings.from_env(
        {
            "ZIMBRA_HOST": "https://zmailbox.citictel-cpc.com/",
            "ZIMBRA_VERIFY_SSL": "false",
            "ZIMBRA_TIMEOUT": "60",
            "ZIMBRA_MAX_ATTACHMENT_BYTES": "10000000",
            "ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS": "200000",
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
        "filter_write_enabled": True,
        "filter_redirect_enabled": True,
        "filter_discard_enabled": True,
        "folder_write_enabled": True,
        "move_enabled": True,
        "signature_write_enabled": True,
        "send_enabled": True,
        "max_attachment_bytes": 10_000_000,
        "max_attachment_text_chars": 200_000,
    }


def test_persisted_configuration_remains_a_fallback_for_unset_environment_values():
    class Store:
        def list_config(self):
            return {
                "ZIMBRA_HOST": "stored.example.com",
            }

    settings = ServerSettings.from_store(Store(), {})

    assert settings.zimbra.host == "stored.example.com"


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
            "SUBSCRIPTION_SERVER_URL": "http://email.example.com/",
            "SUBSCRIPTION_SERVER_USER": "operator",
            "SUBSCRIPTION_SERVER_PASSWORD": "email-secret",
            "SUBSCRIPTION_SERVER_TIMEOUT": "45",
        }
    )

    assert settings.email_server.url == "http://email.example.com"
    assert settings.email_server.timeout == 45
    assert settings.email_server.configured is True
    assert "email-secret" not in json.dumps(settings.public_status())


def test_markitdown_llm_settings_are_opt_in_and_redacted_from_status():
    settings = ServerSettings.from_env(
        {
            "MARKITDOWN_LLM_ENABLED": "true",
            "MARKITDOWN_LLM_API_KEY": "llm-secret",
            "MARKITDOWN_LLM_BASE_URL": "https://llm.example.com/v1",
            "MARKITDOWN_LLM_MODEL": "vision-model",
            "MARKITDOWN_LLM_TIMEOUT": "90",
        }
    )

    assert settings.markitdown.llm_enabled is True
    assert settings.markitdown.llm_base_url == "https://llm.example.com/v1"
    assert settings.markitdown.llm_model == "vision-model"
    assert settings.markitdown.llm_timeout == 90
    status = json.dumps(settings.public_status())
    assert "llm-secret" not in status
    assert "vision-model" in status


@pytest.mark.parametrize("name", ["MARKITDOWN_LLM_API_KEY", "MARKITDOWN_LLM_MODEL"])
def test_markitdown_llm_requires_credentials_and_model(name):
    values = {"MARKITDOWN_LLM_ENABLED": "true", "MARKITDOWN_LLM_API_KEY": "secret", "MARKITDOWN_LLM_MODEL": "model"}
    values.pop(name)

    with pytest.raises(ValueError):
        ServerSettings.from_env(values)


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


def test_zimbra_move_gate_is_explicit_and_visible_without_secrets():
    settings = ServerSettings.from_env({"ZIMBRA_ALLOW_MOVE": "true"})

    assert settings.zimbra.allow_move is True
    assert settings.public_status()["zimbra"]["move_enabled"] is True


def test_zimbra_signature_write_gate_is_explicit_and_visible_without_secrets():
    settings = ServerSettings.from_env({"ZIMBRA_ALLOW_SIGNATURE_WRITE": "true"})

    assert settings.zimbra.allow_signature_write is True
    assert settings.public_status()["zimbra"]["signature_write_enabled"] is True


def test_zimbra_send_gate_is_explicit_and_visible_without_secrets():
    settings = ServerSettings.from_env({"ZIMBRA_ALLOW_SEND": "true"})

    assert settings.zimbra.allow_send is True
    assert settings.public_status()["zimbra"]["send_enabled"] is True


@pytest.mark.parametrize(
    ("name", "value"),
    [("MCP_PORT", "0"), ("SPLUNK_RISK_TOLERANCE", "101"), ("ZIMBRA_VERIFY_SSL", "sometimes")],
)
def test_invalid_environment_values_fail_fast(name, value):
    with pytest.raises(ValueError):
        ServerSettings.from_env({name: value})
