from __future__ import annotations

import gzip
import importlib.util
import json
from pathlib import Path

import pytest


def _action_module():
    root = Path(__file__).resolve().parents[5]
    path = root / "integrations" / "splunk_citic_alert_action" / "bin" / "citic_alert_delivery.py"
    spec = importlib.util.spec_from_file_location("citic_alert_delivery_test", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _source(**extra):
    value = {
        "version": 1,
        "deployment": "splunk-prod",
        "registration_id": "registration-1",
        "sid": "sid-1",
        "alert_name": "Example alert",
        "trigger_time": "2026-09-09T08:15:30.123456Z",
        "policy_id": "policy-1",
        "policy_revision": 2,
        "definition_revision": 4,
        "selected_columns": '["device","severity","tenant"]',
        "row_filters": '[{"source":"severity","operator":"equals","value":"high"}]',
        "max_stored_rows": 2,
    }
    value.update(extra)
    return value


def test_action_reads_nested_configuration_filters_before_retention_and_preserves_positions(tmp_path):
    action = _action_module()
    result_file = tmp_path / "results.csv.gz"
    with gzip.open(result_file, "wt", encoding="utf-8", newline="") as stream:
        stream.write("device,severity,tenant,_raw\n")
        stream.write("host-0,high,acme,secret-0\n")
        stream.write("host-1,low,acme,secret-1\n")
        stream.write("host-2,high,acme,secret-2\n")
        stream.write("host-3,high,acme,secret-3\n")

    payload = action.build_payload({
        "configuration": {
            "action.citic_alert_delivery.param.selected_columns": '["device","severity","tenant"]',
            "action.citic_alert_delivery.param.row_filters": '[{"source":"severity","operator":"equals","value":"high"}]',
            "action.citic_alert_delivery.param.max_stored_rows": "2",
            "action.citic_alert_delivery.param.policy_id": "policy-1",
            "action.citic_alert_delivery.param.policy_revision": "2",
            "action.citic_alert_delivery.param.definition_revision": "4",
            "action.citic_alert_delivery.param.registration_id": "registration-1",
        },
        "deployment": "splunk-prod",
        "search_name": "Example alert",
        "sid": "sid-1",
        "trigger_time": "2026-09-09T08:15:30.123456Z",
        "results_file": str(result_file),
    })

    assert payload["result_count"] == 4
    assert payload["source_result_count"] == 4
    assert payload["matching_count"] == 3
    assert payload["retained_count"] == 2
    assert payload["truncated"] is True
    assert payload["original_row_positions"] == [0, 2]
    assert payload["rows"] == [
        {"device": "host-0", "severity": "high", "tenant": "acme"},
        {"device": "host-2", "severity": "high", "tenant": "acme"},
    ]
    assert all("_raw" not in row for row in payload["rows"])


def test_action_defaults_to_no_detail_fields_and_rejects_invalid_policy_projection():
    action = _action_module()
    payload = action.build_payload(_source(rows=[{"device": "host-1", "severity": "high"}], selected_columns="[]"))
    assert payload["rows"] == [{}]
    assert payload["matching_count"] == 1

    with pytest.raises(ValueError, match="selected columns"):
        action.build_payload(_source(selected_columns='["_raw"]', rows=[]))


def test_action_carries_backend_owned_definition_for_trigger_before_discovery():
    action = _action_module()
    payload = action.build_payload(_source(
        configuration={
            "action.citic_alert_delivery.param.spl": '| search index="CPC_security"',
            "action.citic_alert_delivery.param.source_indexes": '["CPC_security"]',
            "action.citic_alert_delivery.param.app": "search",
            "action.citic_alert_delivery.param.owner": "soc",
        },
        rows=[],
    ))

    assert payload["definition"] == {
        "name": "Example alert",
        "app": "search",
        "owner": "soc",
        "spl": '| search index="CPC_security"',
        "source_indexes": ["CPC_security"],
    }


def test_action_refreshes_inherited_registration_and_policy_context(monkeypatch):
    action = _action_module()
    source = _source(registration_id="parent-registration", policy_id="parent-policy", policy_revision=2)
    monkeypatch.setattr(
        action,
        "fetch_action_context",
        lambda value, replay_id=None: {
            "registration_id": "copy-registration",
            "policy_id": "copy-policy",
            "policy_revision": 3,
            "definition_revision": 7,
        },
    )

    enriched = action._with_action_context(source)

    assert enriched["registration_id"] == "copy-registration"
    assert enriched["policy_id"] == "copy-policy"
    assert enriched["policy_revision"] == 3
    assert enriched["definition_revision"] == 7


def test_action_spool_retries_transient_failures_with_durable_metadata(monkeypatch, tmp_path):
    action = _action_module()
    monkeypatch.setenv("CITIC_ALERT_SPOOL_DIR", str(tmp_path))
    spool = action.DurableSpool()
    payload = _source(rows=[])
    spool.enqueue(payload, "replay-1")

    def fail(_payload, *, replay_id=None):
        raise action.DeliveryTransientError("temporary")

    monkeypatch.setattr(action, "send", fail)
    delivered, error = spool.flush()
    assert delivered == 0
    assert error == "temporary"
    envelope_path = next(tmp_path.glob("*.json"))
    envelope = json.loads(envelope_path.read_text())
    assert envelope["attempts"] == 1
    assert envelope["next_attempt_at"] > 0


def test_action_spool_persists_source_when_policy_context_is_temporarily_unavailable(monkeypatch, tmp_path):
    action = _action_module()
    monkeypatch.setenv("CITIC_ALERT_SPOOL_DIR", str(tmp_path))
    spool = action.DurableSpool()
    source = _source(rows=[{"device": "host-1", "severity": "high"}])
    spool.enqueue_source(source, "run-source-1")

    calls = {"context": 0, "sent": 0}

    def context(value, *, replay_id=None):
        calls["context"] += 1
        if calls["context"] == 1:
            raise action.DeliveryTransientError("context temporarily unavailable")
        return {
            "registration_id": "registration-1",
            "policy_id": "policy-1",
            "policy_revision": 2,
            "definition_revision": 4,
            "selected_columns": ["device", "severity"],
        }

    def sent(_payload, *, replay_id=None):
        calls["sent"] += 1
        assert replay_id == "run-source-1"

    monkeypatch.setattr(action, "fetch_action_context", context)
    monkeypatch.setattr(action, "send", sent)

    delivered, error = spool.flush()
    assert delivered == 0
    assert error == "context temporarily unavailable"
    envelope_path = next(tmp_path.glob("*.json"))
    envelope = json.loads(envelope_path.read_text())
    assert "source" in envelope
    assert "payload" not in envelope

    envelope["next_attempt_at"] = 0
    envelope_path.write_text(json.dumps(envelope), encoding="utf-8")
    delivered, error = spool.flush()
    assert delivered == 1
    assert error is None
    assert calls == {"context": 2, "sent": 1}
    assert list(tmp_path.glob("*.json")) == []


def test_action_spool_failed_entries_consume_the_bound(monkeypatch, tmp_path):
    action = _action_module()
    monkeypatch.setenv("CITIC_ALERT_SPOOL_DIR", str(tmp_path))
    monkeypatch.setenv("CITIC_ALERT_SPOOL_MAX_RUNS", "1")
    spool = action.DurableSpool()
    spool.enqueue(_source(rows=[]), "run-failed-1")

    def permanent(_payload, *, replay_id=None):
        raise action.DeliveryPermanentError("rejected")

    monkeypatch.setattr(action, "send", permanent)
    delivered, error = spool.flush()
    assert delivered == 0
    assert error == "rejected"
    assert len(list(tmp_path.glob("*.failed"))) == 1
    with pytest.raises(action.SpoolSaturatedError):
        spool.enqueue(_source(rows=[]), "run-failed-2")
