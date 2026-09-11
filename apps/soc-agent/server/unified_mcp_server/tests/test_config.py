import json

import pytest

from unified_mcp_server.config import ServerSettings
from unified_mcp_server.env_loader import server_root, workspace_root




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




def test_credential_bearing_splunk_and_zimbra_endpoints_are_rejected():
    with pytest.raises(ValueError, match="SPLUNK_URL"):
        ServerSettings.from_env({
            "SPLUNK_URL": "https://user:password@splunk.example.com:8089",
        })
    with pytest.raises(ValueError, match="ZIMBRA_HOST"):
        ServerSettings.from_env({
            "ZIMBRA_HOST": "https://user:password@mail.example.com/",
        })








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
















def test_official_splunk_mcp_endpoint_is_explicit_and_redacted():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_URL": "https://splunk.example.com:8089",
            "SPLUNK_MCP_ENDPOINT": "http://splunk.example.com:8000/en-US/splunkd/__raw/services/mcp",
            "SPLUNK_ALLOW_INSECURE_HTTP": "true",
            "SPLUNK_TOKEN": "mcp-secret",
        }
    )

    assert settings.splunk.mcp_endpoint.endswith("/services/mcp")
    assert settings.splunk.configured is True
    status = json.dumps(settings.public_status())
    assert "mcp-secret" not in status
    assert "/services/mcp" not in status
    assert status.find("official_mcp_enabled") >= 0

    with pytest.raises(ValueError, match="SPLUNK_MCP_ENDPOINT"):
        ServerSettings.from_env(
            {
                "SPLUNK_MCP_ENDPOINT": "http://splunk.example.com:8000/services/mcp",
                "SPLUNK_TOKEN": "token",
            }
        )


def test_official_splunk_mcp_requires_a_bearer_token():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_MCP_ENDPOINT": "https://splunk.example.com/services/mcp",
            "SPLUNK_USERNAME": "legacy-user",
            "SPLUNK_PASSWORD": "legacy-password",
        }
    )

    assert settings.splunk.host == ""
    assert settings.splunk.configured is False
    assert settings.splunk.missing == ["SPLUNK_TOKEN"]
    assert settings.public_status()["splunk"]["official_mcp_enabled"] is False


def test_splunk_read_scopes_and_limits_are_visible_without_write_flags():
    settings = ServerSettings.from_env(
        {
            "SPLUNK_DETECTION_APP": "security_app",
            "SPLUNK_LOOKUP_APP": "lookup_app",
            "SPLUNK_LOOKUP_OWNER": "lookup_owner",
            "SPLUNK_LOOKUP_MAX_BYTES": "12345",
            "SPLUNK_LOOKUP_MAX_ROWS": "321",
            "SPLUNK_LOOKUP_MAX_COLUMNS": "12",
        }
    )
    status = settings.public_status()
    assert "detection_write_enabled" not in status["splunk"]
    assert "lookup_write_enabled" not in status["splunk"]
    assert status["splunk"]["detection_app"] == "security_app"
    assert status["splunk"]["lookup_app"] == "lookup_app"
    assert status["splunk"]["lookup_owner"] == "lookup_owner"
    assert status["splunk"]["lookup_max_bytes"] == 12345
    assert status["splunk"]["lookup_max_rows"] == 321
    assert status["splunk"]["lookup_max_columns"] == 12














def test_invalid_environment_values_fail_fast():
    for name, value in [
        ("MCP_PORT", "0"),
        ("SPLUNK_RISK_TOLERANCE", "101"),
        ("ZIMBRA_VERIFY_SSL", "sometimes"),
    ]:
        with pytest.raises(ValueError):
            ServerSettings.from_env({name: value})
