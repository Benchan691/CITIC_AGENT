import json

import pytest

from unified_mcp_server.config import ServerSettings
from unified_mcp_server.env_loader import server_root, workspace_root


def test_workspace_root_fallback_matches_self_contained_repository(monkeypatch):
    monkeypatch.delenv("MCP_SERVER_ROOT", raising=False)
    monkeypatch.delenv("MCP_SEVER_ROOT", raising=False)

    assert workspace_root() == server_root().parents[2]


def test_defaults_are_safe_and_services_can_be_unconfigured():
    settings = ServerSettings.from_env({})

    assert settings.transport == "stdio"
    assert settings.splunk.verify_ssl is True
    assert settings.splunk.sanitize_output is True
    assert settings.zimbra.verify_ssl is False
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
    assert settings.splunk.detection_approval_ttl_seconds == 600
    assert settings.splunk.query_policy.normal_search_seconds == 604_800
    assert settings.splunk.query_policy.wildcard_index_decision == "require_approval"
    assert settings.splunk.search_resource.global_concurrency == 8
    assert settings.splunk.search_resource.per_principal_concurrency == 2
    assert settings.splunk.search_resource.max_lookback_high == 2_592_000
    assert settings.splunk.search_resource.restricted_decision == "deny"
    assert settings.splunk.security_queue.max_backend_pages_per_request == 10
    assert settings.splunk.security_queue.max_backend_records_per_request == 1_000
    assert settings.splunk.security_queue.standard_concurrency == 5
    assert settings.zimbra.max_attachment_bytes == 10_000_000
    assert settings.zimbra.max_attachment_text_chars == 200_000
    assert settings.markitdown.llm_enabled is False
    assert settings.markitdown.llm_timeout == 60
    assert settings.email_server.url == "http://100.114.50.103:9100"
    assert settings.email_server.configured is False


def test_search_resource_settings_are_centralized_and_validated():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_SEARCH_GLOBAL_CONCURRENCY": "4",
            "SPLUNK_SEARCH_PER_PRINCIPAL_CONCURRENCY": "1",
            "SPLUNK_SEARCH_QUEUE_TIMEOUT_SECONDS": "7",
            "SPLUNK_SEARCH_MAX_RUNTIME_LOW": "10",
            "SPLUNK_SEARCH_MAX_RUNTIME_MEDIUM": "20",
            "SPLUNK_SEARCH_MAX_RUNTIME_HIGH": "40",
            "SPLUNK_SEARCH_RESTRICTED_DECISION": "require_approval",
        }
    )
    resource = settings.splunk.search_resource
    assert resource.global_concurrency == 4
    assert resource.per_principal_concurrency == 1
    assert resource.queue_timeout_seconds == 7
    assert resource.max_runtime_high == 40
    assert resource.restricted_decision == "require_approval"
    assert settings.public_status()["splunk"]["search_resource"] == resource.to_dict()

    with pytest.raises(ValueError):
        ServerSettings.from_env({"SPLUNK_SEARCH_RESTRICTED_DECISION": "allow"})


def test_splunk_json_config_overrides_non_secret_values_and_loads_nested_settings(tmp_path):
    config_path = tmp_path / "spl_config.json"
    config_path.write_text(
        json.dumps(
            {
                "host": "json-splunk.example.com",
                "port": 18089,
                "scheme": "http",
                "token": "json-token-must-be-ignored",
                "username": "json-user-must-be-ignored",
                "password": "json-password-must-be-ignored",
                "verify_ssl": False,
                "job_timeout": 45,
                "max_events": 321,
                "allow_detection_write": True,
                "query_policy": {
                    "short_search_seconds": 3600,
                    "trusted_macros": ["company_auth_base", "trusted_scope"],
                },
                "search_resource": {
                    "global_concurrency": 3,
                    "queue_timeout_seconds": 9,
                },
                "security_queue": {
                    "standard_concurrency": 2,
                },
            }
        ),
        encoding="utf-8",
    )

    settings = ServerSettings.from_env(
        {
            "SPL_CONFIG_FILE": str(config_path),
            "SPLUNK_HOST": "legacy.example.com",
            "SPLUNK_TOKEN": "legacy-token",
            "SPLUNK_USERNAME": "env-user",
            "SPLUNK_PASSWORD": "env-password",
            "SPLUNK_MAX_EVENTS": "9",
        }
    )

    assert settings.splunk.host == "json-splunk.example.com"
    assert settings.splunk.port == 18089
    assert settings.splunk.url == "http://json-splunk.example.com:18089"
    assert settings.splunk.token == "legacy-token"
    assert settings.splunk.username == "env-user"
    assert settings.splunk.password == "env-password"
    assert settings.splunk.verify_ssl is False
    assert settings.splunk.job_timeout == 45
    assert settings.splunk.max_events == 321
    assert settings.splunk.detection_write_enabled is True
    assert settings.splunk.query_policy.short_search_seconds == 3600
    assert settings.splunk.query_policy.trusted_macros == (
        "company_auth_base",
        "trusted_scope",
    )
    assert settings.splunk.search_resource.global_concurrency == 3
    assert settings.splunk.search_resource.queue_timeout_seconds == 9
    assert settings.splunk.security_queue.standard_concurrency == 2


def test_credential_free_default_splunk_json_is_an_inactive_template(monkeypatch):
    monkeypatch.delenv("SPL_CONFIG_FILE", raising=False)
    monkeypatch.delenv("SPLUNK_CONFIG_FILE", raising=False)
    monkeypatch.setenv("SPLUNK_HOST", "legacy.example.com")
    monkeypatch.setenv("SPLUNK_TOKEN", "legacy-token")
    monkeypatch.setenv("SPLUNK_MAX_EVENTS", "17")

    settings = ServerSettings.from_env()

    assert settings.splunk.host == "legacy.example.com"
    assert settings.splunk.token == "legacy-token"
    assert settings.splunk.max_events == 17


def test_splunk_json_cannot_supply_credentials(tmp_path):
    config_path = tmp_path / "spl_config.json"
    config_path.write_text(
        json.dumps(
            {
                "host": "json-splunk.example.com",
                "token": "json-token",
                "username": "json-user",
                "password": "json-password",
            }
        ),
        encoding="utf-8",
    )

    settings = ServerSettings.from_env({"SPL_CONFIG_FILE": str(config_path)})

    assert settings.splunk.host == "json-splunk.example.com"
    assert settings.splunk.token == ""
    assert settings.splunk.username == ""
    assert settings.splunk.password == ""
    assert settings.splunk.configured is False


def test_splunk_json_config_rejects_malformed_or_wrongly_typed_files(tmp_path):
    malformed_path = tmp_path / "malformed.json"
    malformed_path.write_text("{not-json", encoding="utf-8")
    with pytest.raises(ValueError, match="Splunk configuration JSON"):
        ServerSettings.from_env({"SPL_CONFIG_FILE": str(malformed_path)})

    wrong_type_path = tmp_path / "wrong-type.json"
    wrong_type_path.write_text(
        json.dumps({"host": "splunk.example.com", "search_resource": []}),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="search_resource"):
        ServerSettings.from_env({"SPL_CONFIG_FILE": str(wrong_type_path)})


def test_splunk_json_config_overrides_persisted_splunk_settings(tmp_path):
    config_path = tmp_path / "spl_config.json"
    config_path.write_text(
        json.dumps({"host": "json.example.com", "token": "json-token-must-be-ignored"}),
        encoding="utf-8",
    )

    class Store:
        def list_config(self):
            return {
                "SPLUNK_HOST": "stored.example.com",
                "SPLUNK_TOKEN": "stored-token",
            }

    settings = ServerSettings.from_store(Store(), {"SPL_CONFIG_FILE": str(config_path)})

    assert settings.splunk.host == "json.example.com"
    assert settings.splunk.token == "stored-token"


def test_security_queue_limits_are_centralized_and_validated():
    settings = ServerSettings.from_env(
        {
            "SECURITY_QUEUE_MAX_BACKEND_PAGES_PER_REQUEST": "3",
            "SECURITY_QUEUE_MAX_BACKEND_RECORDS_PER_REQUEST": "250",
            "SECURITY_QUEUE_STANDARD_CONCURRENCY": "4",
        }
    )
    queue = settings.splunk.security_queue
    assert queue.max_backend_pages_per_request == 3
    assert queue.max_backend_records_per_request == 250
    assert queue.standard_concurrency == 4
    assert settings.public_status()["splunk"]["security_queue"] == queue.to_dict()

    with pytest.raises(ValueError):
        ServerSettings.from_env({"SECURITY_QUEUE_STANDARD_CONCURRENCY": "0"})


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


def test_detection_approval_ttl_is_short_and_configurable():
    settings = ServerSettings.from_env({"SPLUNK_DETECTION_APPROVAL_TTL_SECONDS": "300"})
    assert settings.splunk.detection_approval_ttl_seconds == 300
    with pytest.raises(ValueError):
        ServerSettings.from_env({"SPLUNK_DETECTION_APPROVAL_TTL_SECONDS": "30"})


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
    assert settings.public_status()["zimbra"] == {
        "configured": True,
        "host": "https://zmailbox.citictel-cpc.com/",
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
    assert "account_count" not in status


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
            "SPLUNK_DETECTION_APP": "security_app",
        }
    )
    status = settings.public_status()
    assert status["splunk"]["detection_write_enabled"] is True
    assert status["splunk"]["detection_enable_enabled"] is True
    assert status["splunk"]["detection_app"] == "security_app"


def test_splunk_query_policy_thresholds_and_decisions_are_configurable():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_POLICY_SHORT_SEARCH_SECONDS": "3600",
            "SPLUNK_POLICY_NORMAL_SEARCH_SECONDS": "7200",
            "SPLUNK_POLICY_VERY_LONG_SEARCH_SECONDS": "86400",
            "SPLUNK_POLICY_WILDCARD_INDEX": "deny",
            "SPLUNK_POLICY_MAX_SUBSEARCH_DEPTH": "2",
            "SPLUNK_POLICY_TRUSTED_MACROS": "company_auth_base,  trusted_scope",
        }
    )

    policy = settings.splunk.query_policy
    assert policy.short_search_seconds == 3600
    assert policy.normal_search_seconds == 7200
    assert policy.very_long_search_seconds == 86400
    assert policy.wildcard_index_decision == "deny"
    assert policy.max_subsearch_depth == 2
    assert policy.trusted_macros == ("company_auth_base", "trusted_scope")

    with pytest.raises(ValueError):
        ServerSettings.from_env({"SPLUNK_POLICY_WILDCARD_INDEX": "maybe"})


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
