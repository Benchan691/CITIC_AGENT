"""Editable HTML layouts fed only with validated report data."""

from __future__ import annotations

from collections import Counter
from datetime import date
from pathlib import Path
from typing import TYPE_CHECKING, Iterable

from jinja2 import Environment, FileSystemLoader, StrictUndefined, TemplateError
from markupsafe import Markup

if TYPE_CHECKING:
    from .report_config import ReportSettings
    from .report_model import CaseRecord, ReportModel

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
SECTION_TEMPLATES = {
    "executive_summary_html": "executive_summary.html",
    "security_analysis_html": "security_analysis.html",
}


def _render(filename: str, **context: object) -> str:
    environment = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=True,
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    try:
        return environment.get_template(filename).render(context).strip()
    except (TemplateError, OSError, UnicodeError) as error:
        raise ValueError(f"HTML template {filename}: {error}") from error


def render_report_sections(
    cases: tuple[CaseRecord, ...],
    reported_security_incidents: int | None,
    fields: Iterable[str],
    *,
    report_id: str,
    period_start: date,
    period_end: date,
    severities: Iterable[str],
) -> dict[str, str]:
    """Fill requested section templates; completed JSON sections bypass them."""
    # Severity themes retain every incident without asserting a common cause.
    groups = []
    for severity in severities:
        rows = [case for case in cases if case.severity == severity]
        if rows:
            groups.append({"severity": severity, "cases": rows,
                           "rule_names": list(dict.fromkeys(case.rule_name for case in rows))})
    counts = Counter(case.severity for case in cases)
    context = {
        "report_id": report_id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "period_start_display": f"{period_start.day} {period_start:%B %Y}",
        "period_end_display": f"{period_end.day} {period_end:%B %Y}",
        "reported_security_incidents": reported_security_incidents,
        "case_count": len(cases),
        "severity_counts": {severity: counts[severity] for severity in severities},
        "groups": groups,
    }
    return {field: _render(SECTION_TEMPLATES[field], **context) for field in fields}


def render_report_preview(model: ReportModel, settings: ReportSettings) -> str:
    """Wrap the same sanitized report sections in a standalone HTML preview."""
    return _render(
        "report_preview.html",
        title=Path(model.pdf_filename).stem,
        report_id=model.report.report_id,
        period_start=settings.case_start_date.isoformat(),
        period_end=settings.case_end_date.isoformat(),
        executive_summary_html=Markup(model.executive_summary_html),
        security_analysis_html=Markup(model.security_analysis_html),
    )
