"""Explicit render configuration; credentials are supplied by the trusted backend."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from types import MappingProxyType
from typing import Any, Mapping
from urllib.parse import urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo

from .monthly_report_editor import SplunkSettings, Template

HKT = ZoneInfo("Asia/Hong_Kong")


def report_id_key(value: str) -> str:
    return value.strip().casefold().removeprefix("g")


def previous_report_period(reference_date: date | None = None) -> tuple[date, date]:
    reference_date = reference_date or datetime.now(HKT).date()
    end = reference_date.replace(day=1) - timedelta(days=1)
    return end.replace(day=1), end


def _object(value: Any, name: str, allowed: set[str]) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{name} must be an object.")
    if set(value) - allowed:
        raise ValueError(f"{name} contains unsupported settings.")
    return value


def _text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must be a non-empty string.")
    if re.search(r"[\x00-\x1f]", value):
        raise ValueError(f"{name} contains control characters.")
    return value.strip()


def _date(value: Any, name: str) -> date:
    try:
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{name} must be a valid YYYY-MM-DD date.") from error


def _number(value: Any, name: str, *, zero: bool = False) -> float:
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or value < 0 or (not zero and value == 0)):
        raise ValueError(f"{name} must be a finite {'non-negative' if zero else 'positive'} number.")
    return float(value)


def _url(value: Any, name: str) -> str:
    value = _text(value, name)
    try:
        url = urlsplit(value)
        if (url.scheme not in {"http", "https"} or not url.hostname
                or url.username or url.password or url.query or url.fragment):
            raise ValueError
        _ = url.port
    except ValueError as error:
        raise ValueError(f"{name} must be an HTTP(S) URL without embedded credentials, query, or fragment.") from error
    return value.rstrip("/")


@dataclass(frozen=True)
class ReportSpec:
    report_id: str
    template: Template
    clone_view: str
    output_stem: str

    def pdf_filename(self, period_end: date) -> str:
        try:
            stem = self.output_stem.format(month=period_end.strftime("%B"), year=period_end.year,
                                           report_id=self.report_id)
        except (KeyError, ValueError, IndexError, AttributeError) as error:
            raise ValueError("output_stem supports only {month}, {year}, and {report_id}.") from error
        if not stem.strip() or stem in {".", ".."} or re.search(r'[/\\\x00-\x1f]', stem):
            raise ValueError("output_stem must be a safe filename.")
        return f"{stem}.pdf"


@dataclass(frozen=True)
class ChromePdfSettings:
    paper_size: str
    web_base_url: str
    wait_seconds: float
    chrome_binary: str | None = None
    stable_seconds: float = 45
    settle_seconds: float = 20


@dataclass(frozen=True)
class ReportSettings:
    splunk: SplunkSettings
    reports: tuple[ReportSpec, ...]
    pdf_chrome: ChromePdfSettings
    case_start_date: date
    case_end_date: date
    environment: Mapping[str, str] = field(repr=False, compare=False)


def build_settings(configuration: Mapping[str, Any], period_start: str, period_end: str,
                   environment: Mapping[str, str]) -> ReportSettings:
    """Validate one configured customer without reading files or process environment."""
    value = _object(configuration, "configuration", {"report_id", "template", "output_stem", "splunk", "pdf"})
    start, end = _date(period_start, "period_start"), _date(period_end, "period_end")
    if start > end:
        raise ValueError("period_start must not be later than period_end.")
    report_id = _text(value.get("report_id"), "configuration.report_id")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", report_id):
        raise ValueError("configuration.report_id must contain letters, digits, underscores, or hyphens.")
    template = _object(value.get("template"), "configuration.template", {"owner", "app", "view"})
    report = ReportSpec(report_id, Template(*(_text(template.get(k), f"configuration.template.{k}")
                                            for k in ("owner", "app", "view"))),
                        f"soc_report_{report_id}_{uuid4().hex}",
                        _text(value.get("output_stem"), "configuration.output_stem"))
    report.pdf_filename(end)
    splunk = _object(value.get("splunk"), "configuration.splunk", {"base_url", "username_env", "password_env", "verify_tls"})
    verify_tls = splunk.get("verify_tls", True)
    if not isinstance(verify_tls, bool):
        raise ValueError("configuration.splunk.verify_tls must be a boolean.")
    splunk_settings = SplunkSettings(_url(splunk.get("base_url"), "configuration.splunk.base_url"),
                                     _text(splunk.get("username_env"), "configuration.splunk.username_env"),
                                     _text(splunk.get("password_env"), "configuration.splunk.password_env"), verify_tls)
    if not isinstance(environment, Mapping) or not all(isinstance(k, str) and isinstance(v, str) for k, v in environment.items()):
        raise ValueError("environment must contain string keys and values.")
    for key in (splunk_settings.username_env, splunk_settings.password_env):
        if not environment.get(key):
            raise ValueError("The trusted backend is missing configured Splunk credentials.")
    pdf = _object(value.get("pdf", {}), "configuration.pdf", {"paper_size", "web_base_url", "wait_seconds", "stable_seconds", "settle_seconds", "chrome_binary"})
    paper = _text(pdf.get("paper_size", "letter"), "configuration.pdf.paper_size")
    if paper.casefold() not in {"a4", "letter"}:
        raise ValueError("configuration.pdf.paper_size must be A4 or letter.")
    chrome_binary = pdf.get("chrome_binary")
    if chrome_binary is not None:
        chrome_binary = _text(chrome_binary, "configuration.pdf.chrome_binary")
    chrome = ChromePdfSettings(paper, _url(pdf.get("web_base_url"), "configuration.pdf.web_base_url"),
                               _number(pdf.get("wait_seconds", 600), "configuration.pdf.wait_seconds"),
                               chrome_binary,
                               _number(pdf.get("stable_seconds", 45), "configuration.pdf.stable_seconds"),
                               _number(pdf.get("settle_seconds", 20), "configuration.pdf.settle_seconds", zero=True))
    return ReportSettings(splunk_settings, (report,), chrome, start, end, MappingProxyType(dict(environment)))
