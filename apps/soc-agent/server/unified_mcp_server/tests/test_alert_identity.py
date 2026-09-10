from datetime import datetime, timezone

import pytest

from unified_mcp_server.alert_identity import (
    AlertIdentityError,
    AlertRunPayload,
    definition_fingerprint,
    extract_static_indexes,
    format_eid,
    normalize_alert_policy,
    project_selected_rows,
    required_columns_missing,
)


def test_static_index_extraction_requires_exact_sources():
    assert extract_static_indexes(
        '| tstats count where index="CPC_security" OR index=CEC_endpoint'
    ) == (("CPC_security", "CEC_endpoint"), None)
    assert extract_static_indexes('index=CPC_security OR host=outside')[1] is not None
    assert extract_static_indexes('index=CPC_security | outputcsv [search index=other]')[1] is not None
    assert extract_static_indexes('index=CPC_security | append [search index=CEC_endpoint]') == (
        ("CPC_security", "CEC_endpoint"), None
    )
    assert extract_static_indexes('index=CPC_security | where status="ok" OR status="new"') == (
        ("CPC_security",), None
    )
    assert extract_static_indexes('| search index=$index_macro$') == (
        (),
        "saved search uses a dynamic, wildcard, or non-index source",
    )
    assert extract_static_indexes('| makeresults | eval index="CPC_security"') == (
        (),
        "saved search uses a dynamic, wildcard, or non-index source",
    )
    assert extract_static_indexes('| search index IN ("CPC_security", CEC_endpoint)') == (
        ("CPC_security", "CEC_endpoint"), None
    )
    assert extract_static_indexes('| stats count by index') == (
        (),
        "saved search contains an index field expression outside its source clause",
    )


def test_definition_fingerprint_normalizes_transport_aliases_and_metadata():
    editor_draft = {
        "saved_search_name": "Alert",
        "spl": "index=CPC_security\r\n",
        "earliest_time": "-5m",
        "latest_time": "now",
        "cron_schedule": "*/5 * * * *",
        "is_scheduled": True,
        "disabled": True,
        "severity": "high",
        "mitre_technique": "T1110",
        "risk_score": 80,
    }
    discovery_row = {
        "name": "Alert",
        "search": "index=CPC_security",
        "dispatch.earliest_time": "-5m",
        "dispatch.latest_time": "now",
        "cron_schedule": "*/5 * * * *",
        "is_scheduled": "1",
        "actions": "citic_alert_delivery",
        "action.citic_alert_delivery.registration_id": "registration-1",
        "alert.track": "1",
        "next_scheduled_time": "2026-09-10T10:00:00Z",
    }
    exact_read = {
        "content": {
            "search": "index=CPC_security",
            "dispatch.earliest_time": "-5m",
            "dispatch.latest_time": "now",
            "cron_schedule": "*/5 * * * *",
            "is_scheduled": "true",
            "disabled": "0",
        },
        "name": "Alert",
        "stable_id": "splunk-guid",
        "updated_at": "2026-09-10T09:59:00Z",
    }

    expected = definition_fingerprint(editor_draft)
    assert definition_fingerprint(discovery_row) == expected
    assert definition_fingerprint(exact_read) == expected
    assert definition_fingerprint({**editor_draft, "spl": "index=CPC_security error"}) != expected
    assert definition_fingerprint({**editor_draft, "cron_schedule": "*/10 * * * *"}) != expected


def test_eid_contains_utc_time_and_postgres_run_sequence():
    trigger = datetime(2026, 9, 9, 0, 15, 30, 123456, tzinfo=timezone.utc)
    assert format_eid("CPC001-0000", trigger, 1) == (
        "CPC001-0000-20260909T001530123456Z-000001"
    )
    assert format_eid(
        "CPC001-0000", datetime(2026, 9, 9, 8, 15, tzinfo=timezone.utc), 1000000
    ).endswith("-1000000")
    with pytest.raises(AlertIdentityError):
        format_eid("CPC001-0000", trigger, 0)


def test_projection_excludes_raw_preserves_order_and_reports_limits():
    rows = [{"device": f"host-{index}", "severity": "high", "_raw": "secret"} for index in range(3)]
    retained, total, stored, truncated, columns = project_selected_rows(
        rows,
        policy={"field_mappings": [{"source": "device", "label": "Device"}], "max_stored_rows": 2},
    )
    assert (total, stored, truncated, columns) == (3, 2, True, ("device",))
    assert retained == [{"device": "host-0"}, {"device": "host-1"}]
    assert all("_raw" not in row for row in retained)


def test_projection_applies_only_explicit_safe_row_filters():
    policy = normalize_alert_policy(
        {
            "detail_columns": ["device", "severity"],
            "row_filters": [{"field": "severity", "op": "equals", "value": "HIGH"}],
            "max_display_rows": 1,
        }
    )
    retained, total, stored, truncated, _columns = project_selected_rows(
        [
            {"device": "host-1", "severity": "high"},
            {"device": "host-2", "severity": "low"},
        ],
        policy=policy,
    )
    assert (total, stored, truncated) == (1, 1, False)
    assert retained == [{"device": "host-1", "severity": "high"}]


def test_empty_policy_counts_results_without_retaining_empty_detail_rows():
    retained, total, stored, truncated, columns = project_selected_rows(
        [{"device": "host-1"}, {"device": "host-2"}],
        policy={"detail_columns": []},
    )

    assert (retained, total, stored, truncated, columns) == ([], 2, 0, False, ())


def test_policy_rejects_raw_and_executable_filter_values():
    with pytest.raises(AlertIdentityError):
        normalize_alert_policy({"detail_columns": ["_raw"]})
    with pytest.raises(AlertIdentityError):
        normalize_alert_policy({"row_filters": [{"field": "severity", "op": "equals", "value": {"$gt": "high"}}]})


def test_required_columns_are_checked_against_original_source_rows():
    policy = {
        "required_columns": ["device"],
        "field_mappings": [{"source": "event_id", "required": True}],
    }
    assert required_columns_missing(
        [{"device": "host-1", "event_id": "evt-1"}], policy
    ) == ()
    assert required_columns_missing([{"device": "host-1"}], policy) == ("event_id",)


def test_alert_run_payload_normalizes_aliases_and_rejects_malformed_rows():
    payload = AlertRunPayload.from_mapping(
        {
            "deployment_id": "splunk-prod",
            "version": 1,
            "search_id": "sid-1",
            "saved_search_name": "CPC suspicious login",
            "triggerTime": "2026-09-09T08:15:30.123Z",
            "results": [{"device": "host-1"}],
            "urgency": "HIGH",
            "result_count": "1",
            "definition_revision": 1,
            "policy_id": "policy-1",
            "policy_revision": 1,
            "matching_count": 1,
            "retained_count": 1,
            "truncated": False,
        }
    )
    assert payload.sid == "sid-1"
    assert payload.alert_name == "CPC suspicious login"
    assert payload.trigger_time == datetime(2026, 9, 9, 8, 15, 30, 123000, tzinfo=timezone.utc)
    assert payload.severity == "high"
    assert payload.result_count == 1

    with pytest.raises(AlertIdentityError, match="result rows"):
        AlertRunPayload.from_mapping({
            "version": 1,
            "deployment": "splunk-prod",
            "sid": "sid-1",
            "alert_name": "bad",
            "trigger_time": "2026-09-09T08:15:30Z",
            "rows": ["not-an-object"],
            "definition_revision": 1,
            "policy_id": "policy-1",
            "policy_revision": 1,
        })
