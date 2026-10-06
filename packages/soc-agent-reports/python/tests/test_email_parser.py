from datetime import date

import pytest

from soc_agent_reports.email_parser import EmailParsingError, clean_reply_text, parse_report_emails


def notification(ticket="50238202609011200", **changes):
    item = {"id": "1", "subject": f"[HIGH] TrustCSI Security Incident Notification (Case Number: {ticket})", "from": "soc@example.com", "body": f"Correlation event summary\nCase Number\n{ticket}\nCase Name\nExample Rule\nTime of Incidence\n2026-09-01 12:00:00\nSeverity\nHIGH\nCase Status\nOpen\nDescription\nA detection triggered.\n", "body_type": "text/plain"}
    item.update(changes)
    return item


def parse(items):
    return parse_report_emails(items, report_id="50238", company_name="Client", customer_senders=["customer@example.com"], period_start="2026-09-01", period_end="2026-09-30")


def reply(body, **changes):
    return notification(subject="Re: Incident (Case Number: 50238202609011200)", body=body, **changes)


def test_deduplication_and_canonical_fields():
    result = parse([notification(), notification(id="2")])
    assert len(result.payload["cases"]) == 1
    case = result.payload["cases"][0]
    assert case["RuleName_EN"] == "[Client] Example Rule"
    assert case["Status"] == "Open"
    assert case["Reason"].startswith("Pending customer confirmation.")


@pytest.mark.parametrize("category", ["False Positive", "True Positive"])
def test_only_configured_customer_new_reply_text_supplies_verdict(category):
    customer = reply(f"Hi team, {category}. We confirmed the activity was performed by our approved administrator during the planned maintenance window.\nFrom: SOC\nTrue Positive.", **{"from": "customer@example.com"})
    soc = reply("False Positive. An analyst inferred it was harmless.")
    case = parse([notification(), soc, customer]).payload["cases"][0]
    assert case["Reason"].startswith(category + ". Customer stated:")
    assert "SOC" not in case["Reason"]


def test_quoted_html_and_negated_or_conflicting_verdicts_stay_pending():
    for body, body_type in [("<p>We are checking.</p><blockquote><p>False Positive</p></blockquote>", "text/html"), ("Not a false positive; investigation continues.", "text/plain"), ("Could be true positive or false positive.", "text/plain")]:
        result = parse([notification(), reply(body, **{"from": "customer@example.com", "body_type": body_type})])
        assert result.payload["cases"][0]["Reason"].startswith("Pending")


def test_latest_customer_verdict_and_period_boundaries():
    first = reply("False Positive. This was an approved test.", **{"from": "customer@example.com", "date": "2026-09-01T01:00:00+00:00"})
    latest = reply("True Positive. We confirmed an unauthorized execution.", **{"from": "customer@example.com", "date": "2026-09-02T01:00:00+00:00"})
    assert parse([notification(), latest, first]).payload["cases"][0]["Reason"].startswith("True Positive")
    outside = notification(body=notification()["body"].replace("2026-09-01", "2026-08-31"))
    assert not parse([outside]).payload["cases"]


def test_malformed_expected_alert_and_cross_customer_fail():
    with pytest.raises(EmailParsingError, match="missing TicketTime"):
        parse([notification(body="Case Name\nRule\nSeverity\nHIGH")])
    with pytest.raises(EmailParsingError, match="different report customer"):
        parse([notification(ticket="46760202609011200")])


def test_quote_and_caution_cleanup_preserves_new_text_only():
    assert clean_reply_text("CAUTION: external email\n\nFalse Positive. Approved activity.\nFrom: SOC\nTrue Positive") == "False Positive. Approved activity."


def test_empty_required_text_field_does_not_consume_next_heading():
    body = notification()["body"].replace("Case Name\nExample Rule\n", "Case Name\n\n")
    with pytest.raises(EmailParsingError, match="missing RuleName_EN"):
        parse([notification(body=body)])
