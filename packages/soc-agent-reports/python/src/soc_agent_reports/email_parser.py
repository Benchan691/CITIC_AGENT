"""Deterministic notification parsing shared by mailbox and exported-email callers.

The labeled-field, ticket fallback, original-before-reply, and quote trimming
rules preserve the former Outlook CSV parser. Customer verdicts require an
explicit configured sender and an explicit verdict in their new reply text.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from email.utils import parseaddr
from html.parser import HTMLParser
from typing import Any, Iterable, Mapping

from .report_model import HEADERS

_REPLY = re.compile(r"\s*(?:re|fw|fwd)\s*:\s*", re.I)
_QUOTED = re.compile(r"(?im)^\s*(?:From:\s+.+|On .+wrote:|[-_]{4,}.*|>.*)$")
_CAUTION = re.compile(r"\A\s*CAUTION:.*?(?:\n\s*\n|\Z)", re.I | re.S)
_FALSE = re.compile(r"\bfalse[ -]+positive\b", re.I)
_TRUE = re.compile(r"\btrue[ -]+positive\b", re.I)
_NEGATED = re.compile(r"\b(?:not|no|isn't|is not)\s+(?:a\s+)?(?:true|false)[ -]+positive\b", re.I)
_UNCERTAIN = re.compile(r"\b(?:may|might|could|possibly|probably|suspected|uncertain|not sure)\b.{0,80}\b(?:true|false)[ -]+positive\b", re.I)
_PENDING = "Pending customer confirmation. No explicit customer verdict was found in the configured mailbox messages for this incident during the reporting period."
_FIELD_LABELS = {"case number", "案例编号", "case name", "time of incidence", "severity", "attacker address/host - port", "target address/host - port", "description", "remediation", "case status", "correlation base events"}


class EmailParsingError(ValueError):
    """An expected case notification could not be parsed completely."""


@dataclass(frozen=True)
class ParseResult:
    payload: dict[str, Any]
    warnings: tuple[str, ...]


class _EmailText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored = 0
        self.quote_depth = 0

    def handle_starttag(self, tag, attrs):
        if self.quote_depth:
            if tag not in {"br", "hr", "img", "meta", "link", "input"}:
                self.quote_depth += 1
            return
        classes = " ".join(value or "" for name, value in attrs if name in {"class", "id"}).casefold()
        if tag == "blockquote" or "gmail_quote" in classes or "zimbra_quote" in classes:
            self.quote_depth = 1
            return
        if tag in {"script", "style", "head"}:
            self.ignored += 1
        elif not self.ignored and tag in {"p", "div", "br", "tr", "li", "blockquote"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if self.quote_depth:
            self.quote_depth -= 1
            return
        if tag in {"script", "style", "head"}:
            self.ignored = max(0, self.ignored - 1)
        elif not self.ignored and tag in {"p", "div", "tr", "li", "blockquote"}:
            self.parts.append("\n")
        elif not self.ignored and tag in {"td", "th"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.ignored and not self.quote_depth:
            self.parts.append(data)


def email_text(message: Mapping[str, Any]) -> str:
    body = str(message.get("body", message.get("Body", "")) or "")
    if str(message.get("body_type", "")).casefold().startswith("text/html") or re.search(r"<(?:html|body|div|p|table)\b", body, re.I):
        parser = _EmailText()
        parser.feed(body)
        body = "".join(parser.parts)
    return body.replace("\r\n", "\n").replace("\r", "\n")


def extract_field(body: str, label: str, value_pattern: str) -> str:
    match = re.search(rf"^[ \t]*{re.escape(label)}\s*[\r\n:：]*\s*({value_pattern})", body, re.I | re.M)
    value = match.group(1).strip() if match else ""
    next_line = body[match.start(1):].splitlines()[0].strip() if match else ""
    return "" if next_line.casefold().rstrip(":：") in _FIELD_LABELS else value


def extract_ticket_number(body: str, subject: str = "") -> str:
    for label in ("Case Number", "案例编号"):
        value = extract_field(body, label, r"[A-Za-z0-9_]+")
        if value:
            return value
    match = re.search(r"(?:\bCase Number|案例编号)\s*[:：]?\s*([A-Za-z0-9_]+)", subject, re.I)
    return match.group(1) if match else ""


def clean_reply_text(body: str) -> str:
    match = _QUOTED.search(body)
    reply = body[:match.start()] if match else body
    reply = _CAUTION.sub("", reply)
    reply = re.split(r"(?im)^\s*(?:best regards|kind regards|regards|thanks and regards|sent from my)\b", reply, maxsplit=1)[0]
    return " ".join(reply.split())


def _customer_reason(text: str) -> str | None:
    false, true = bool(_FALSE.search(text)), bool(_TRUE.search(text))
    if false == true or _NEGATED.search(text) or _UNCERTAIN.search(text) or text.endswith("?"):
        return None
    label = "False Positive" if false else "True Positive"
    cleaned = (_FALSE if false else _TRUE).sub("", text)
    cleaned = re.sub(r"\A(?:hi|hello|dear)\s+(?:soc(?: team)?|team)[,:.!\s]*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\A[,:;.!\s-]+", "", cleaned)
    words = cleaned.split()[:20]
    explanation = " ".join(words).rstrip(" ,;:")
    return f"{label}. Customer stated: {explanation}" if explanation else f"{label}. Customer explicitly confirmed this classification; no further explanation was included in their reply."


def parse_report_emails(
    messages: Iterable[Mapping[str, Any]], *, report_id: str, company_name: str,
    customer_senders: Iterable[str], period_start: str, period_end: str,
    reported_security_incidents: int | None = None,
) -> ParseResult:
    start, end = date.fromisoformat(period_start), date.fromisoformat(period_end)
    senders = {parseaddr(value)[1].casefold() for value in customer_senders}
    cases: dict[str, dict[str, str]] = {}
    replies: dict[str, list[tuple[str, int, str]]] = {}
    warnings: list[str] = []
    skipped: Counter[str] = Counter()
    for index, message in enumerate(messages):
        if not isinstance(message, Mapping):
            raise EmailParsingError(f"messages[{index}] must be an object.")
        subject = str(message.get("subject", message.get("Subject", "")) or "")
        body = email_text(message)
        ticket = extract_ticket_number(body, subject)
        sender = parseaddr(str(message.get("from", message.get("From: (Address)", ""))))[1].casefold()
        is_reply = bool(_REPLY.match(subject))
        if sender in senders and ticket:
            reply = clean_reply_text(body)
            reason = _customer_reason(reply)
            if reason:
                replies.setdefault(ticket, []).append((str(message.get("date", "")), index, reason))
            elif reply and (_FALSE.search(reply) or _TRUE.search(reply)):
                warnings.append(f"Customer verdict for case {ticket} was ambiguous; confirmation remains pending.")
        if is_reply:
            skipped["reply messages handled only as customer remarks"] += 1
            continue
        expected = bool(re.search(r"security incident notification|correlation event summary", subject + "\n" + body, re.I))
        if not expected:
            skipped["unrelated messages"] += 1
            continue
        if sender in senders:
            skipped["customer messages without an original SOC notification"] += 1
            continue
        values = {
            "RuleName_EN": extract_field(body, "Case Name", r"[^\r\n]+"),
            "Severity": extract_field(body, "Severity", r"[A-Za-z]+").upper(),
            "TicketTime": extract_field(body, "Time of Incidence", r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}"),
            "Ticketnumber": ticket,
            "Status": extract_field(body, "Case Status", r"[^\r\n]+"),
            "Reason": "",
        }
        missing = [name for name in HEADERS[:4] if not values[name]]
        if missing:
            raise EmailParsingError(f"Notification {str(message.get('id', index))} is missing {', '.join(missing)}.")
        customer_number = report_id.casefold().removeprefix("g")
        if customer_number.isdigit() and not ticket.startswith(customer_number):
            raise EmailParsingError(f"Notification {str(message.get('id', index))} belongs to a different report customer. Verify the configured email scope.")
        try:
            when = datetime.strptime(values["TicketTime"], "%Y-%m-%d %H:%M:%S")
        except ValueError as exc:
            raise EmailParsingError(f"Notification {str(message.get('id', index))} has an invalid incident timestamp.") from exc
        if values["Severity"] not in {"CRITICAL", "HIGH", "MEDIUM"}:
            if values["Severity"] in {"LOW", "INFO", "INFORMATIONAL"}:
                skipped["Low or Informational notifications outside the report’s severity scope"] += 1
                continue
            raise EmailParsingError(f"Notification {str(message.get('id', index))} has unsupported Severity.")
        if not start <= when.date() <= end:
            skipped["notifications with incident dates outside the reporting period"] += 1
            continue
        prefix = f"[{company_name.strip()}]" if company_name.strip() else ""
        if prefix and not values["RuleName_EN"].startswith(prefix):
            values["RuleName_EN"] = f"{prefix} {values['RuleName_EN']}"
        if ticket in cases and any(values[field] != cases[ticket][field] for field in HEADERS[:4]):
            raise EmailParsingError(f"Conflicting notification fields for case {ticket}.")
        if ticket in cases:
            skipped["duplicate notifications"] += 1
        cases.setdefault(ticket, values)
    for ticket, case in cases.items():
        candidates = replies.get(ticket, [])
        case["Reason"] = max(candidates, key=lambda item: (item[0], item[1]))[2] if candidates else _PENDING
    payload: dict[str, Any] = {"report_id": report_id, "headers": list(HEADERS), "cases": list(cases.values())}
    if reported_security_incidents is not None:
        payload["reported_security_incidents"] = reported_security_incidents
    warnings.extend(f"Excluded {count} {description}." for description, count in skipped.items())
    return ParseResult(payload, tuple(dict.fromkeys(warnings)))
