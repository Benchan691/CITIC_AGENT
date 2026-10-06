"""Validated report JSON to an Excel/PDF pair; no CLI or email account handling."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping
from uuid import uuid4

from .monthly_report_completion import CloneCleanupError, CompletionError, SecurityNewsArticle, generate_pdf, _clean_security_news_fragment, _validate_news_fragment
from .report_config import HKT, build_settings
from .report_model import build_report_model
from .transform_excel import create_workbook


@dataclass(frozen=True)
class ReportResult:
    excel_path: Path
    pdf_path: Path


class ReportGenerationError(RuntimeError):
    """Safe, stage-specific failure for the MCP orchestration boundary."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def generate_report(input_data: Mapping[str, Any], output_dir: str | Path, *,
                    configuration: Mapping[str, Any], period_start: str, period_end: str,
                    environment: Mapping[str, str], security_news: SecurityNewsArticle) -> ReportResult:
    """Validate before output/remote writes, then publish both completed artifacts."""
    settings = build_settings(configuration, period_start, period_end, environment)
    model = build_report_model(input_data, settings)
    if not isinstance(security_news, SecurityNewsArticle):
        raise ValueError("security_news must be an authenticated SecurityNewsArticle.")
    if not all(isinstance(getattr(security_news, name), str) for name in
               ("message_id", "sender", "subject", "html_fragment")):
        raise ValueError("security_news fields must be strings.")
    try:
        _validate_news_fragment(_clean_security_news_fragment(security_news.html_fragment))
    except CompletionError as error:
        raise ValueError("security_news must contain safe, readable HTML article content.") from error
    run_directory = Path(output_dir).resolve() / f"{datetime.now(HKT):%Y%m%d_%H%M%S}_{uuid4().hex}"
    work_dir = run_directory / ".work"
    try:
        work_dir.mkdir(parents=True)
    except OSError as error:
        raise ReportGenerationError("plugin_failure", "The report work folder could not be created.") from error
    staged_excel = work_dir / f"{model.report.report_id}.xlsx"
    try:
        create_workbook(model, staged_excel)
    except Exception as error:
        raise ReportGenerationError("excel_generation_failed", "Excel report generation failed.") from error
    try:
        staged_pdf = generate_pdf(model, settings, work_dir, security_news=security_news)
    except CloneCleanupError as error:
        raise ReportGenerationError("cleanup_failed", "The temporary report dashboard could not be removed.") from error
    except Exception as error:
        raise ReportGenerationError("pdf_generation_failed", "PDF report generation failed; verify dashboard access and browser dependencies.") from error
    try:
        excel_path, pdf_path = run_directory / staged_excel.name, run_directory / staged_pdf.name
        staged_excel.replace(excel_path)
        staged_pdf.replace(pdf_path)
        shutil.rmtree(work_dir)
    except OSError as error:
        raise ReportGenerationError("plugin_failure", "Completed report files could not be published.") from error
    return ReportResult(excel_path, pdf_path)
