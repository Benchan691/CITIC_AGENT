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
