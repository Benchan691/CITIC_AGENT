from datetime import datetime, timezone

import pytest

from unified_mcp_server.alert_email import (
    AlertEmailContext,
    AlertEmailDeliveryError,
    AlertEmailRule,
    AlertEmailWorker,
    EmailCycleReport,
    normalize_email_config,
    render_alert_email,
)
from unified_mcp_server.config import ServerSettings


def context(**changes):
    values = {
        "outbox_id": "outbox-1",
        "event_id": "event-1",
        "customer_id": "customer-1",
        "attempt_count": 1,
        "severity": "high",
        "alert_name": "Suspicious login",
        "trigger_time": datetime(2026, 9, 8, 1, 2, tzinfo=timezone.utc),
        "result_count": 2,
        "splunk_sid": "scheduler_sid_1",
        "customer_gid": "C-001",
        "customer_name": "Example customer",
        "ruleset_id": "ruleset-1",
        "rule_number": "0101",
        "email_config": {"recipients": ["soc@example.test"]},
    }
    values.update(changes)
    return AlertEmailContext(**values)


def test_customer_email_config_is_normalized_and_validated():
    assert normalize_email_config(["SOC@example.test", "soc@example.test"]) == {
        "recipients": ["SOC@example.test"],
        "cc": [],
        "bcc": [],
    }
    assert normalize_email_config(
        {"recipients": ["soc@example.test"], "cc": ["analyst@example.test"]}
    )["cc"] == ["analyst@example.test"]

    with pytest.raises(ValueError):
        normalize_email_config({"recipients": ["not-an-address"]})
    with pytest.raises(ValueError):
        normalize_email_config({})


def test_rule_matching_requires_customer_ruleset_and_severity_contract():
    rule = AlertEmailRule("rule-1", "high alerts", "customer-1", "ruleset-1", ("high",), True)
    assert rule.matches(context())
    assert not rule.matches(context(severity="low"))
    assert not rule.matches(context(customer_id="customer-2"))
    assert not rule.matches(context(ruleset_id="ruleset-2"))
    assert AlertEmailRule("global", "global", None, None, ("critical",), True).matches(
        context(severity="critical")
    )


def test_rendered_email_contains_bounded_identifiers_and_no_raw_event():
    subject, body = render_alert_email(context(email_config={"recipients": ["soc@example.test"]}))
    assert subject == "[SOC][HIGH] Example customer Suspicious login"
    assert "Splunk SID: scheduler_sid_1" in body
    assert "0101" in body
    assert "raw_event" not in body


class FakeStore:
    def __init__(self, rows, rules):
        self.rows = rows
        self.rules = rules
        self.actions = []

    def active_rules(self):
        return self.rules

    def claim(self, _limit, _worker_id):
        return self.rows

    def save_snapshot(self, outbox_id, snapshot):
        self.snapshot = snapshot

    def record_outcome(self, context, snapshot, outcome):
        self.actions.append(("sent", context.outbox_id, outcome['message_id']))

    def mark_disabled(self, outbox_id, reason):
        self.actions.append(("disabled", outbox_id, reason))

    def mark_failed(self, outbox_id, reason, *, retryable, attempt_count, max_backoff_seconds=300):
        self.actions.append(("failed", outbox_id, retryable, attempt_count, max_backoff_seconds, reason))

    def mark_uncertain(self, outbox_id, reason):
        self.actions.append(("uncertain", outbox_id, reason))


class FakeSender:
    def __init__(self, result="provider-1", error=None):
        self.result = result
        self.error = error
        self.calls = []

    async def send(self, recipients, subject, body, **kwargs):
        self.calls.append((recipients, subject, body))
        if self.error:
            raise self.error
        return {"accepted": recipients["recipients"], "rejected": {}, "message_id": self.result}


@pytest.mark.asyncio
async def test_worker_sends_one_matching_event_and_records_provider_id():
    settings = ServerSettings.from_env({})
    store = FakeStore(
        [context()],
        [AlertEmailRule("rule-1", "high alerts", "customer-1", None, ("high",), True)],
    )
    sender = FakeSender()
    worker = AlertEmailWorker(settings, store, sender)

    report = await worker._cycle()

    assert report == EmailCycleReport(claimed=1, sent=1)
    assert store.actions == [("sent", "outbox-1", "provider-1")]
    assert len(sender.calls) == 1


@pytest.mark.asyncio
async def test_worker_disables_unmatched_event_without_sending():
    settings = ServerSettings.from_env({})
    store = FakeStore(
        [context()],
        [AlertEmailRule("rule-1", "critical only", None, None, ("critical",), True)],
    )
    sender = FakeSender()
    report = await AlertEmailWorker(settings, store, sender)._cycle()

    assert report == EmailCycleReport(claimed=1, skipped=1)
    assert store.actions[0][0] == "disabled"
    assert sender.calls == []


@pytest.mark.asyncio
async def test_uncertain_delivery_is_not_retried_automatically():
    settings = ServerSettings.from_env({})
    store = FakeStore(
        [context()],
        [AlertEmailRule("rule-1", "all high", None, None, ("high",), True)],
    )
    sender = FakeSender(error=AlertEmailDeliveryError("uncertain", "timeout after send"))
    report = await AlertEmailWorker(settings, store, sender)._cycle()

    assert report.uncertain == 1
    assert report.failed == 0
    assert store.actions[0][0] == "uncertain"


def test_email_delivery_defaults_to_disabled():
    settings = ServerSettings.from_env({})
    assert settings.alert_email_enabled is False
    assert settings.alert_email_configured is False
    assert settings.public_status()["alert_email"]["enabled"] is False


def test_email_worker_requires_explicit_mailbox_configuration():
    settings = ServerSettings.from_env({"ALERT_EMAIL_ENABLED": "true"})
    assert settings.alert_email_enabled is True
    assert settings.alert_email_configured is False
