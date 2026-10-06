"""Public, authenticated-context-independent report plugin API."""

from .monthly_report_completion import SecurityNewsArticle
from .report_service import ReportGenerationError, ReportResult, generate_report
from .report_html import sanitize_security_news

__all__ = ["ReportGenerationError", "ReportResult", "SecurityNewsArticle", "generate_report", "sanitize_security_news"]
