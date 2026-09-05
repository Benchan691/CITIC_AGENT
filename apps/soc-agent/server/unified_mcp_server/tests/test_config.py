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
    assert settings.splunk.detection_write_enabled is False
    assert settings.splunk.lookup_write_enabled is False
    assert settings.splunk.lookup_app == "search"
    assert settings.splunk.lookup_owner == "nobody"
    assert settings.splunk.lookup_max_bytes == 5_000_000
    assert settings.splunk.lookup_max_rows == 50_000
    assert settings.splunk.lookup_max_columns == 100
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
    assert settings.email_server.url == ""
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
            "SPLUNK_URL": "https://env.example.com:8089",
            "SPLUNK_TOKEN": "env-token",
            "SPLUNK_MAX_EVENTS": "9",
            "ZIMBRA_HOST": "https://mail.example.com",
        },
    )

    assert settings.splunk.host == "env.example.com"
    assert settings.splunk.token == "env-token"
    assert settings.splunk.max_events == 9
    assert settings.zimbra.host == "https://mail.example.com"


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


def test_from_store_does_not_use_persisted_configuration():
    class Store:
        def list_config(self):
            raise AssertionError("service configuration must not read persisted settings")

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
            "ZIMBRA_ALLOW_INSECURE_HTTP": "false",
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
        "host": "https://zmailbox.citictel-cpc.com",
        "verify_ssl": False,
        "allow_insecure_http": False,
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


def test_persisted_configuration_is_not_a_fallback():
    class Store:
        def list_config(self):
            raise AssertionError("service configuration must not read persisted settings")

    settings = ServerSettings.from_store(Store(), {})

    assert settings.zimbra.host == ""


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


def test_public_status_redacts_credential_bearing_endpoint_parts():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_URL": "https://splunk.example.com:8089",
            "ZIMBRA_HOST": "https://mail.example.com/",
            "MARKITDOWN_LLM_BASE_URL": "https://llm.example.com/v1?api_key=llm-query-secret",
            "SUBSCRIPTION_SERVER_URL": "https://email.example.com/api?password=email-query-secret",
            "SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP": "false",
        }
    )

    status = json.dumps(settings.public_status())
    assert "llm-query-secret" not in status
    assert "email-query-secret" not in status


def test_credential_bearing_splunk_and_zimbra_endpoints_are_rejected():
    with pytest.raises(ValueError, match="SPLUNK_URL"):
        ServerSettings.from_env({
            "SPLUNK_URL": "https://user:password@splunk.example.com:8089",
        })
    with pytest.raises(ValueError, match="ZIMBRA_HOST"):
        ServerSettings.from_env({
            "ZIMBRA_HOST": "https://user:password@mail.example.com/",
        })


def test_public_status_does_not_echo_non_url_llm_endpoint_values():
    settings = ServerSettings.from_env(
        {
            "MARKITDOWN_LLM_BASE_URL": "llm-endpoint-secret",
        }
    )

    assert "llm-endpoint-secret" not in json.dumps(settings.public_status())


def test_public_readiness_contains_no_endpoint_or_llm_configuration():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_HOST": "splunk.example.com",
            "ZIMBRA_HOST": "mail.example.com",
            "MARKITDOWN_LLM_ENABLED": "true",
            "MARKITDOWN_LLM_API_KEY": "llm-secret",
            "MARKITDOWN_LLM_MODEL": "private-model",
        }
    )

    readiness = json.dumps(settings.public_readiness())
    assert "splunk.example.com" not in readiness
    assert "mail.example.com" not in readiness
    assert "llm-secret" not in readiness
    assert "private-model" not in readiness
    assert "llm_enabled" not in readiness
    assert "configured" in readiness


def test_email_server_credentials_load_without_exposing_password_in_status():
    settings = ServerSettings.from_env(
        {
            "SUBSCRIPTION_SERVER_URL": "http://email.example.com/",
            "SUBSCRIPTION_SERVER_USER": "operator",
            "SUBSCRIPTION_SERVER_PASSWORD": "email-secret",
            "SUBSCRIPTION_SERVER_TIMEOUT": "45",
            "SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP": "true",
        }
    )

    assert settings.email_server.url == "http://email.example.com"
    assert settings.email_server.timeout == 45
    assert settings.email_server.allow_insecure_http is True
    assert settings.email_server.configured is True
    assert "email-secret" not in json.dumps(settings.public_status())


def test_subscription_server_requires_https_by_default_and_allows_explicit_http_opt_out():
    with pytest.raises(ValueError, match="HTTPS"):
        ServerSettings.from_env({"SUBSCRIPTION_SERVER_URL": "http://email.example.com"})

    settings = ServerSettings.from_env(
        {
            "SUBSCRIPTION_SERVER_URL": "http://email.example.com",
            "SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP": "true",
        }
    )
    assert settings.email_server.allow_insecure_http is True


@pytest.mark.parametrize("url", [
    "ftp://email.example.com",
    "https://user:password@email.example.com",
    "https://email.example.com/path#fragment",
])
def test_subscription_server_rejects_unsafe_urls(url):
    with pytest.raises(ValueError):
        ServerSettings.from_env({"SUBSCRIPTION_SERVER_URL": url})


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
            "SPLUNK_PORT": "",
            "SPLUNK_ALLOW_INSECURE_HTTP": "true",
            "SPLUNK_USERNAME": "admin",
            "SPLUNK_PASSWORD": "secret",
        }
    )

    assert settings.splunk.host == "127.0.0.1"
    assert settings.splunk.port == 8089
    assert settings.splunk.client_config()["splunk_url"] == "http://127.0.0.1:8089"


def test_splunk_port_is_only_required_for_hostname_configuration():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_URL": "https://splunk.example.com:9443",
            "SPLUNK_PORT": "not-used",
            "SPLUNK_TOKEN": "token",
        }
    )

    assert settings.splunk.host == "splunk.example.com"
    assert settings.splunk.port == 9443

    with pytest.raises(ValueError, match="SPLUNK_PORT"):
        ServerSettings.from_env(
            {
                "SPLUNK_HOST": "splunk.example.com",
                "SPLUNK_PORT": "",
            }
        )


def test_splunk_and_zimbra_http_require_explicit_opt_out():
    with pytest.raises(ValueError, match="SPLUNK_URL"):
        ServerSettings.from_env({"SPLUNK_URL": "http://splunk.example.com:8089"})
    with pytest.raises(ValueError, match="ZIMBRA_HOST"):
        ServerSettings.from_env({"ZIMBRA_HOST": "http://mail.example.com"})

    splunk = ServerSettings.from_env({
        "SPLUNK_URL": "http://splunk.example.com:8089",
        "SPLUNK_ALLOW_INSECURE_HTTP": "true",
    })
    zimbra = ServerSettings.from_env({
        "ZIMBRA_HOST": "http://mail.example.com",
        "ZIMBRA_ALLOW_INSECURE_HTTP": "true",
    })
    assert splunk.splunk.allow_insecure_http is True
    assert zimbra.zimbra.allow_insecure_http is True


def test_detection_write_flags_are_explicit_and_visible_without_secrets():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_ALLOW_DETECTION_WRITE": "true",
            "SPLUNK_ALLOW_DETECTION_ENABLE": "true",
            "SPLUNK_DETECTION_APP": "security_app",
            "SPLUNK_ALLOW_LOOKUP_WRITE": "true",
            "SPLUNK_LOOKUP_APP": "lookup_app",
            "SPLUNK_LOOKUP_OWNER": "lookup_owner",
            "SPLUNK_LOOKUP_MAX_BYTES": "12345",
            "SPLUNK_LOOKUP_MAX_ROWS": "321",
            "SPLUNK_LOOKUP_MAX_COLUMNS": "12",
        }
    )
    status = settings.public_status()
    assert status["splunk"]["detection_write_enabled"] is True
    assert "detection_enable_enabled" not in status["splunk"]
    assert status["splunk"]["detection_app"] == "security_app"
    assert status["splunk"]["lookup_write_enabled"] is True
    assert status["splunk"]["lookup_app"] == "lookup_app"
    assert status["splunk"]["lookup_owner"] == "lookup_owner"
    assert status["splunk"]["lookup_max_bytes"] == 12345
    assert status["splunk"]["lookup_max_rows"] == 321
    assert status["splunk"]["lookup_max_columns"] == 12


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
