"""One JSON boundary and a shared, immutable model for both renderers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping

from .report_config import HKT, ReportSettings, ReportSpec, report_id_key
from .report_html import sanitize_html_input
from .report_templates import SECTION_TEMPLATES, render_report_sections

HEADERS = ("RuleName_EN", "Severity", "TicketTime", "Ticketnumber", "Status", "Reason")
SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM")
TICKET_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"
INPUT_FIELDS = {"headers", "cases", "reported_security_incidents", "report_id"} | SECTION_TEMPLATES.keys()


@dataclass(frozen=True)
class CaseRecord:
    rule_name: str
    severity: str
    ticket_time: datetime
    ticket_number: str
    status: str
    reason: str

    @property
    def formatted_ticket_time(self) -> str:
        return self.ticket_time.strftime(TICKET_TIME_FORMAT)

    def excel_row(self) -> dict[str, str]:
        return dict(zip(HEADERS, (self.rule_name, self.severity,
                                 self.formatted_ticket_time,
                                 self.ticket_number, self.status, self.reason)))


@dataclass(frozen=True)
class ReportModel:
    report: ReportSpec
    cases: tuple[CaseRecord, ...]
    period_cases: tuple[CaseRecord, ...]
    reported_security_incidents: int | None
    executive_summary_html: str
    security_analysis_html: str
    pdf_filename: str


def _text(value: Any, field_name: str, *, optional: bool = False) -> str:
    if value is None and optional:
        return ""
    if not isinstance(value, str) or (not optional and not value.strip()):
        raise ValueError(f"{field_name} must be a {'string' if optional else 'non-empty string'}.")
    if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", value):
        raise ValueError(f"{field_name} contains unsupported control characters.")
    return value.strip()


def _normalize_case(value: Any, index: int) -> CaseRecord:
    field_name = f"cases[{index}]"
    if not isinstance(value, Mapping):
        raise ValueError(f"{field_name} must be a JSON object.")
    unknown = set(value) - set(HEADERS)
    if unknown:
        raise ValueError(f"{field_name} has unsupported fields: {', '.join(map(str, unknown))}.")
    rule_name = _text(value.get("RuleName_EN"), f"{field_name}.RuleName_EN")
    severity = _text(value.get("Severity"), f"{field_name}.Severity").upper()
    if severity not in SEVERITIES:
        raise ValueError(f"{field_name}.Severity must be CRITICAL, HIGH, or MEDIUM; found {severity!r}.")
    ticket_number = value.get("Ticketnumber")
    if isinstance(ticket_number, int) and not isinstance(ticket_number, bool) and ticket_number >= 0:
        ticket_number = str(ticket_number)
    ticket_number = _text(ticket_number, f"{field_name}.Ticketnumber")
    text_time = _text(value.get("TicketTime"), f"{field_name}.TicketTime")
    try:
        if not re.match(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}", text_time):
            raise ValueError
        ticket_time = datetime.fromisoformat(text_time)
    except ValueError as error:
        raise ValueError(f"{field_name}.TicketTime must be a valid timestamp, for example 2026-09-13 15:00:00.") from error
    if ticket_time.tzinfo is not None:
        ticket_time = ticket_time.astimezone(HKT).replace(tzinfo=None)
    ticket_time = ticket_time.replace(microsecond=0)
    return CaseRecord(rule_name, severity, ticket_time, ticket_number,
                      _text(value.get("Status"), f"{field_name}.Status", optional=True),
                      _text(value.get("Reason"), f"{field_name}.Reason", optional=True))


def build_report_model(
    input_data: Mapping[str, Any],
    settings: ReportSettings,
    report_id: str | None = None,
) -> ReportModel:
    """Validate complete input; normalize only representation, never dispositions."""
    payload = input_data
    if not isinstance(payload, Mapping):
        raise ValueError("Report input must contain a JSON object.")
    unknown = set(payload) - INPUT_FIELDS
    if unknown:
        raise ValueError(f"Report input has unsupported fields: {', '.join(map(str, unknown))}.")
    if "headers" in payload and payload["headers"] != list(HEADERS):
        raise ValueError(f"headers must match the six report columns: {list(HEADERS)}.")
    embedded_id = payload.get("report_id")
    if embedded_id is not None:
        embedded_id = _text(embedded_id, "report_id")
    if report_id is not None:
        report_id = _text(report_id, "report_id")
    if embedded_id and report_id and report_id_key(embedded_id) != report_id_key(report_id):
        raise ValueError("The explicit report_id conflicts with report_id in the JSON.")
    selected_id = report_id or embedded_id
    if not selected_id:
        raise ValueError("report_id is required for a JSON object; include it in the object or pass report_id=.")
    report = next((item for item in settings.reports if report_id_key(item.report_id) == report_id_key(selected_id)), None)
    if report is None:
        raise ValueError(f"No configured report matches {selected_id!r}; available IDs: "
                         + ", ".join(item.report_id for item in settings.reports) + ".")
    raw_cases = payload.get("cases")
    if not isinstance(raw_cases, list):
        raise ValueError("cases must be a JSON array.")
    cases = tuple(_normalize_case(value, index) for index, value in enumerate(raw_cases))
    seen: set[str] = set()
    for index, case in enumerate(cases):
        if case.ticket_number in seen:
            raise ValueError(f"cases[{index}].Ticketnumber duplicates ticket {case.ticket_number!r}.")
        seen.add(case.ticket_number)
    count = payload.get("reported_security_incidents")
    if "reported_security_incidents" in payload:
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise ValueError("reported_security_incidents must be a non-negative integer.")
    period_cases = tuple(case for case in cases
                         if settings.case_start_date <= case.ticket_time.date() <= settings.case_end_date)
    supplied_sections = {name: _text(payload[name], name)
                         for name in SECTION_TEMPLATES if name in payload}
    sections = render_report_sections(
        period_cases, count, (name for name in SECTION_TEMPLATES if name not in supplied_sections),
        report_id=report.report_id,
        period_start=settings.case_start_date,
        period_end=settings.case_end_date,
        severities=SEVERITIES,
    )
    sections.update(supplied_sections)
    for name, content in sections.items():
        try:
            sections[name] = sanitize_html_input(content)
        except ValueError as error:
            raise ValueError(f"{name}: {error}") from error
    return ReportModel(report, cases, period_cases, count,
                       sections["executive_summary_html"], sections["security_analysis_html"],
                       report.pdf_filename(settings.case_end_date))
