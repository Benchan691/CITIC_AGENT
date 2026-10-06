"""Render completed report data with the existing Splunk/Zimbra/Chromium pipeline."""

from __future__ import annotations

import base64
import html
import io
import json
import logging
import re
import shutil
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from . import monthly_report_editor as template_editor
from .report_config import ReportSettings, ReportSpec, previous_report_period
from .report_html import sanitize_security_news as _sanitize_news_body
from .report_model import ReportModel

WORK_DIR_NAME = ".work"
LOGGER = logging.getLogger(__name__)
REPORT_PERIOD_PATTERN = re.compile(
    r"(Reporting\s+Period\s*:\s*)"
    r"\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}",
    re.IGNORECASE,
)
NEWS_FRAGMENT_TAGS = {
    "p", "br", "b", "strong", "em", "ul", "ol", "li", "h1", "h2", "h3",
    "div", "span", "table", "thead", "tbody", "tr", "th", "td", "a",
}
NEWS_TITLE_PATTERN = re.compile(r"<(h[1-3])>(.*?)</\1>", re.IGNORECASE | re.DOTALL)
NEWS_GREETING_PATTERN = re.compile(r"\bDear\s+(?:Valued\s+)?Customer\s*,?\s*", re.IGNORECASE)
NEWS_SOURCE_BLOCK_PATTERN = re.compile(
    r"<(p|div)\b[^>]*>\s*(?:<[^>]+>\s*)*(?:source\s+collection|来源集合)\s*[:：].*?</\1>\s*",
    re.IGNORECASE | re.DOTALL,
)


class CompletionError(RuntimeError):
    """The report-completion pipeline could not safely finish."""


@dataclass(frozen=True)
class SecurityNewsArticle:
    message_id: str
    sender: str
    subject: str
    html_fragment: str


def report_period_text(
    reference_date: date | datetime | None = None,
    *,
    period_start: date | None = None,
    period_end: date | None = None,
) -> str:
    """Format the report period used on the XML cover page."""
    if period_start is None or period_end is None:
        period_start, period_end = previous_report_period(reference_date)
    return f"{period_start.day} {period_start:%B %Y} - {period_end.day} {period_end:%B %Y}"


def update_report_period(
    xml: str,
    reference_date: date | datetime | None = None,
    *,
    period_start: date | None = None,
    period_end: date | None = None,
) -> str:
    """Refresh the cover-page Reporting Period text in a dashboard XML document."""
    template_editor.validate_dashboard_xml(xml)
    updated, replacements = REPORT_PERIOD_PATTERN.subn(
        lambda match: f"{match.group(1)}{report_period_text(reference_date, period_start=period_start, period_end=period_end)}",
        xml,
    )
    if replacements != 1:
        raise CompletionError(
            f"Expected exactly one cover-page Reporting Period in dashboard XML; found {replacements}."
        )
    template_editor.validate_dashboard_xml(updated)
    return updated


def _work_path(report: ReportSpec, suffix: str, work_dir: Path) -> Path:
    return work_dir / f"{report.report_id}.monthly_report.{suffix}"


def source_xml_path(report: ReportSpec, work_dir: Path) -> Path:
    return _work_path(report, "source.xml", work_dir)


def edited_xml_path(report: ReportSpec, work_dir: Path) -> Path:
    return _work_path(report, "edited.xml", work_dir)


def atomic_write(path: Path, content: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = "wb" if isinstance(content, bytes) else "w"
    kwargs = {} if mode == "wb" else {"encoding": "utf-8"}
    with tempfile.NamedTemporaryFile(mode, dir=path.parent, delete=False, **kwargs) as stream:
        stream.write(content)
        temporary_path = Path(stream.name)
    try:
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def _splunk_auth(settings: template_editor.SplunkSettings, environment: Mapping[str, str] | None = None) -> tuple[str, str]:
    environment = environment if environment is not None else {}
    username = environment.get(settings.username_env, "")
    password = environment.get(settings.password_env, "")
    if not username or not password:
        raise CompletionError(f"Set {settings.username_env} and {settings.password_env} before using Splunk.")
    return username, password


def _splunk_request(
    settings: template_editor.SplunkSettings,
    path: str,
    method: str = "GET",
    form: dict[str, str] | None = None,
    timeout: float = 60,
    environment: Mapping[str, str] | None = None,
    opener: Callable[..., Any] | None = None,
) -> tuple[bytes, dict[str, str]]:
    opener = opener or urlopen
    username, password = _splunk_auth(settings, environment)
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    data = urlencode(form or {}).encode("utf-8") if form is not None else None
    request = Request(
        f"{settings.base_url.rstrip('/')}/{path.lstrip('/')}",
        data=data,
        headers={
            "Accept": "application/json, application/pdf, */*",
            "Authorization": f"Basic {token}",
            **({"Content-Type": "application/x-www-form-urlencoded"} if form is not None else {}),
        },
        method=method,
    )
    try:
        with opener(request, timeout=timeout, context=template_editor._ssl_context(settings.verify_tls)) as response:
            response_headers = getattr(response, "headers", {})
            return response.read(), {str(k).lower(): str(v) for k, v in response_headers.items()}
    except HTTPError as error:
        raise CompletionError(f"Splunk request failed with HTTP {error.code}.") from error
    except (URLError, TimeoutError, OSError) as error:
        raise CompletionError(f"Could not reach Splunk for {path}: {type(error).__name__}.") from error


def _clone_endpoint(report: ReportSpec, detail: bool = True) -> str:
    owner = quote(report.template.owner, safe="")
    app = quote(report.template.app, safe="")
    suffix = f"/{quote(report.clone_view, safe='')}" if detail else ""
    return f"servicesNS/{owner}/{app}/data/ui/views{suffix}"


def _dashboard_xml_from_payload(payload: bytes, view: str) -> str:
    try:
        data = json.loads(payload.decode("utf-8"))
        xml = data["entry"][0]["content"]["eai:data"]
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, IndexError, TypeError) as error:
        raise CompletionError(f"Splunk did not return dashboard XML for {view}.") from error
    if not isinstance(xml, str) or not xml.strip():
        raise CompletionError(f"Splunk returned empty dashboard XML for {view}.")
    template_editor.validate_dashboard_xml(xml)
    return xml


def get_remote_view_xml(settings: ReportSettings, report: ReportSpec, view: str) -> str:
    template = template_editor.Template(report.template.owner, report.template.app, view)
    return template_editor.fetch_dashboard_xml(template, settings.splunk, environment=settings.environment)


def fetch_source_xml(settings: ReportSettings, report: ReportSpec) -> str:
    """Download the original dashboard XML without creating a remote clone."""
    LOGGER.debug("Source [%s]: reading %s", report.report_id, report.template.view)
    return sanitize_dashboard_xml_for_pdf(get_remote_view_xml(settings, report, report.template.view))


def create_clone(settings: ReportSettings, report: ReportSpec, xml: str) -> None:
    """Create a unique run's clone; never refresh or overwrite an existing view."""
    template_editor.validate_dashboard_xml(xml)
    _splunk_request(settings.splunk, _clone_endpoint(report, detail=False), method="POST",
                    form={"name": report.clone_view, "eai:data": xml}, timeout=60,
                    environment=settings.environment)
    if get_remote_view_xml(settings, report, report.clone_view) != xml:
        raise CompletionError("Temporary Splunk dashboard verification failed.")


def delete_clone(settings: ReportSettings, report: ReportSpec) -> None:
    try:
        _splunk_request(settings.splunk, _clone_endpoint(report), method="DELETE", timeout=60, environment=settings.environment)
    except CompletionError as error:
        if "HTTP 404" in str(error):
            LOGGER.debug("Cleanup [%s]: clone already absent", report.report_id)
            return
        raise
    LOGGER.info("Cleanup [%s]: deleted clone", report.report_id)


def _normalized_xml_text(element: ET.Element | None) -> str:
    """Return element text in a stable form for comparing dashboard searches."""
    if element is None:
        return ""
    return " ".join("".join(element.itertext()).split())


def _duplicate_table_signature(row: ET.Element) -> tuple[str, str, str, str, str] | None:
    """Return a comparable signature for a row containing one Splunk table panel."""
    panels = [child for child in row if child.tag.rsplit("}", 1)[-1] == "panel"]
    if len(panels) != 1:
        return None
    panel = panels[0]
    tables = [child for child in panel if child.tag.rsplit("}", 1)[-1] == "table"]
    if len(tables) != 1:
        return None
    table = tables[0]
    search = next(
        (child for child in table if child.tag.rsplit("}", 1)[-1] == "search"),
        None,
    )
    if search is None:
        return None
    query = next((child for child in search if child.tag.rsplit("}", 1)[-1] == "query"), None)
    earliest = next((child for child in search if child.tag.rsplit("}", 1)[-1] == "earliest"), None)
    latest = next((child for child in search if child.tag.rsplit("}", 1)[-1] == "latest"), None)
    options = {
        child.attrib.get("name", ""): _normalized_xml_text(child)
        for child in table
        if child.tag.rsplit("}", 1)[-1] == "option"
    }
    # The signature deliberately ignores titles and other presentation options:
    # identical consecutive data panels are accidental duplicates, while the
    # first panel remains authoritative and keeps its heading/description.
    return (
        _normalized_xml_text(query),
        _normalized_xml_text(earliest),
        _normalized_xml_text(latest),
        options.get("count", ""),
        options.get("rowNumbers", ""),
    )


def _collapse_consecutive_duplicate_table_rows(xml: str) -> str:
    """Remove later consecutive copies of an identical Splunk table row."""
    row_pattern = re.compile(r"<row\b[^>]*>.*?</row\s*>", flags=re.IGNORECASE | re.DOTALL)
    previous_signature: tuple[str, str, str, str, str] | None = None
    removals: list[tuple[int, int]] = []
    for match in row_pattern.finditer(xml):
        try:
            row = ET.fromstring(match.group(0))
        except ET.ParseError:
            previous_signature = None
            continue
        signature = _duplicate_table_signature(row)
        if signature is not None and signature == previous_signature:
            removals.append(match.span())
        previous_signature = signature
    for start, end in reversed(removals):
        xml = xml[:start] + xml[end:]
    if removals:
        LOGGER.info("Dashboard XML: removed %d consecutive duplicate table panel(s)", len(removals))
    return xml


def sanitize_dashboard_xml_for_pdf(xml: str) -> str:
    """Repair dashboard XML for Chromium print rendering."""
    template_editor.validate_dashboard_xml(xml)
    # Remove accidental URL text nodes jammed after the root <dashboard> tag.
    xml = re.sub(r"(<dashboard\b[^>]*>)\s*https?://[^\s<]+", r"\1", xml, count=1, flags=re.IGNORECASE)
    # Straighten curly quotes that can break embedded HTML/XML attributes.
    xml = (
        xml.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
    )
    # Escape bare ampersands that are invalid in XML text nodes.
    xml = re.sub(r"&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)", "&amp;", xml)
    # HTML comments after page-break tags can leak into browser print output.
    xml = re.sub(r"<!--.*?-->", "", xml, flags=re.DOTALL)
    # Template typo: page-break-after:alays is ignored by Chrome (computed breakAfter=auto).
    xml = re.sub(r"page-break-after\s*:\s*alays", "page-break-after:always", xml, flags=re.IGNORECASE)
    # Leading empty page-break paragraphs on the cover panel create a blank first page
    # in Chrome print. Only strip breaks immediately after the first <html> tag.
    first_html = re.search(r"<html\b[^>]*>", xml, flags=re.IGNORECASE)
    if first_html:
        head = xml[: first_html.end()]
        tail = xml[first_html.end() :]
        tail = re.sub(
            r"^(?:\s*<p\s+style=\"page-break-after\s*:\s*always\s*\"\s*/?\s*>)+",
            "",
            tail,
            count=1,
            flags=re.IGNORECASE,
        )
        xml = head + tail
    # Chromium printToPDF: an empty page-break-after paragraph can leave a blank page.
    # Put the break on the following block instead.
    def _promote_page_break(match: re.Match[str]) -> str:
        tag = match.group(1)
        if re.search(r"\bstyle\s*=", tag, flags=re.IGNORECASE):
            return re.sub(
                r'\bstyle\s*=\s*"([^"]*)"',
                lambda m: f'style="page-break-before:always;{m.group(1)}"',
                tag,
                count=1,
                flags=re.IGNORECASE,
            )
        return re.sub(r"^<(\w+)", r'<\1 style="page-break-before:always"', tag, count=1)

    xml = re.sub(
        r'<p\s+style="page-break-after\s*:\s*always\s*"\s*/?\s*>\s*(<(?:h1|h2|h3|div|p|b|center)\b[^>]*>)',
        _promote_page_break,
        xml,
        flags=re.IGNORECASE,
    )
    # Some source dashboards contain repeated copies of the same table panel.
    # Remove only later consecutive duplicates from the temporary PDF clone;
    # the first panel (including its heading/description) remains unchanged.
    xml = _collapse_consecutive_duplicate_table_rows(xml)
    template_editor.validate_dashboard_xml(xml)
    return xml


def drop_blank_pdf_pages(pdf_bytes: bytes) -> bytes:
    """Remove fully blank pages produced by Chrome/Splunk page-break quirks."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError as error:
        raise CompletionError("PDF blank-page cleanup requires pypdf; install requirements.txt.") from error
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if not reader.pages:
        return pdf_bytes

    def _page_is_blank(page: Any) -> bool:
        text = (page.extract_text() or "").strip()
        if text:
            return False
        resources = page.get("/Resources") or {}
        if hasattr(resources, "get_object"):
            resources = resources.get_object()
        xobjects = resources.get("/XObject") if isinstance(resources, dict) else None
        if xobjects:
            if hasattr(xobjects, "get_object"):
                xobjects = xobjects.get_object()
            if xobjects:
                return False
        annotations = page.get("/Annots")
        return not annotations

    kept = [page for page in reader.pages if not _page_is_blank(page)]
    dropped = len(reader.pages) - len(kept)
    if dropped == 0:
        return pdf_bytes
    if not kept:
        LOGGER.warning("Step render: all PDF pages looked blank; keeping original bytes")
        return pdf_bytes
    writer = PdfWriter()
    for page in kept:
        writer.add_page(page)
    # pypdf rewrites the byte stream during blank-page cleanup; keep the
    # provenance explicit so the finished artifact is identified as the
    # Chromium/Playwright render rather than as a ReportLab document.
    writer.add_metadata({"/Producer": "Chromium/Playwright"})
    output = io.BytesIO()
    writer.write(output)
    LOGGER.debug("Render: dropped %d blank PDF page(s)", dropped)
    return output.getvalue()


def _splunk_web_login_cookies(settings: ReportSettings) -> list[dict[str, Any]]:
    """Authenticate to Splunk Web and return cookies for browser rendering."""
    import http.cookiejar
    from urllib.request import HTTPCookieProcessor, HTTPSHandler, build_opener

    username, password = _splunk_auth(settings.splunk, settings.environment)
    jar = http.cookiejar.CookieJar()
    opener = build_opener(
        HTTPSHandler(context=template_editor._ssl_context(settings.splunk.verify_tls)),
        HTTPCookieProcessor(jar),
    )
    login_url = f"{settings.pdf_chrome.web_base_url}/en-US/account/login"
    opener.open(login_url, timeout=30)
    cval = next((cookie.value for cookie in jar if cookie.name == "cval"), str(int(time.time())))
    payload = urlencode(
        {
            "username": username,
            "password": password,
            "cval": cval,
            "set_has_logged_in": "false",
        }
    ).encode("utf-8")
    request = Request(
        login_url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": login_url,
        },
    )
    opener.open(request, timeout=30)
    cookies: list[dict[str, Any]] = []
    for cookie in jar:
        cookies.append(
            {
                "name": cookie.name,
                "value": cookie.value,
                "url": f"{settings.pdf_chrome.web_base_url}/",
            }
        )
    if not any(cookie["name"].startswith("splunkd_") for cookie in cookies):
        raise CompletionError("Splunk Web login did not return a splunkd session cookie.")
    return cookies


def _print_with_contents(page: Any, print_options: dict[str, Any]) -> bytes:
    """Print repeatedly until the dashboard contents page reflects real pagination."""
    try:
        from pypdf import PdfReader
    except ImportError as error:
        raise CompletionError("Contents pagination requires pypdf; install requirements.txt.") from error
    previous: dict[str, int] | None = None
    for _ in range(4):
        payload = drop_blank_pdf_pages(bytes(page.pdf(**print_options)))
        locations: dict[str, int] = {}
        for number, pdf_page in enumerate(PdfReader(io.BytesIO(payload)).pages, start=1):
            for line in (pdf_page.extract_text() or "").splitlines():
                title = re.fullmatch(r"[A-H]\.\s+[A-Za-z][A-Za-z /()&-]+", line.strip())
                if title:
                    locations[re.sub(r"\s+", " ", line.strip())] = number
        if not locations:
            raise CompletionError("Cannot determine report contents pagination.")
        if locations == previous:
            return payload
        previous = locations
        page.evaluate(
            """locations => {
              const heading = [...document.querySelectorAll('h1')]
                .find(h => h.textContent.trim() === 'Table of Contents');
              if (!heading) throw new Error('Missing contents page');
              const walk = document.createTreeWalker(
                heading.closest('.panel-body.html'), NodeFilter.SHOW_TEXT
              );
              while (walk.nextNode()) {
                const node = walk.currentNode;
                const normalized = node.textContent.replace(/\\s+/g, ' ').trim();
                for (const [title, number] of Object.entries(locations)) {
                  if (normalized.startsWith(title) && /\\.{3}/.test(normalized))
                    node.textContent = node.textContent.replace(/\\d+\\s*$/, String(number));
                }
              }
            }""",
            locations,
        )
    raise CompletionError("Contents pagination did not stabilize.")


def _playwright_print_dashboard_pdf(
    settings: ReportSettings,
    report: ReportSpec,
    view: str,
    *,
    update_contents: bool = False,
) -> bytes:
    """Print a temporary Splunk dashboard through Playwright Chromium."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise CompletionError("Playwright PDF rendering requires the playwright package.") from error

    chrome = Path(settings.pdf_chrome.chrome_binary) if settings.pdf_chrome.chrome_binary else None
    if chrome is not None and not chrome.is_file():
        raise CompletionError("Configured Chrome executable is unavailable.")
    cookies = [
        {"name": cookie["name"], "value": cookie["value"], "url": cookie["url"]}
        for cookie in _splunk_web_login_cookies(settings)
    ]
    dashboard_url = f"{settings.pdf_chrome.web_base_url}/en-US/app/{quote(report.template.app, safe='')}/{quote(view, safe='')}"
    paper_format = "A4" if settings.pdf_chrome.paper_size.lower().startswith("a4") else "Letter"
    scroll_expression = """(() => {
      const root = document.scrollingElement || document.documentElement || document.body;
      const height = Math.max(root.scrollHeight || 0, document.body ? document.body.scrollHeight : 0);
      const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
      let y = 0;
      while (y < height) { window.scrollTo(0, y); y += step; }
      window.scrollTo(0, height); window.scrollTo(0, 0); return height;
    })()"""
    ready_expression = """(() => {
      const title = document.title || '';
      const text = document.body ? document.body.innerText : '';
      const waiting = (text.match(/Waiting for data/g) || []).length;
      const height = Math.max(
        (document.scrollingElement && document.scrollingElement.scrollHeight) || 0,
        (document.documentElement && document.documentElement.scrollHeight) || 0,
        (document.body && document.body.scrollHeight) || 0
      );
      return {
        title, waiting,
        hasOverview: text.includes('Security Overview'),
        hasReported: text.includes('Reported Security Incidents') || text.includes('Reported:'),
        login: title.includes('Login'), chars: text.length, height
      };
    })()"""
    print_css = """
      header, .shared-global-nav, .header, .dashboard-header,
      .splunk-header, .main-section-body > .toolbar,
      .dashboard-view-controls, .splButton-primary,
      .account-bar, #header, .navbar { display:none !important; }
      body, .dashboard-body, .main-section-body { margin:0 !important; padding:0 !important; }
      .dashboard-element-html .panel-body.html h1,
      .dashboard-element-html .panel-body.html h2,
      .dashboard-element-html .panel-body.html h3,
      .dashboard-element-html .panel-body.html h4,
      .dashboard-element-html .panel-body.html h5,
      .dashboard-element-html .panel-body.html h6 {
        break-after: avoid !important; page-break-after: avoid !important;
      }
      .dashboard-element-html .panel-body.html p:has(> strong:only-child) {
        break-after: avoid !important; page-break-after: avoid !important;
      }
      .dashboard-element-html .panel-body.html h1 {
        margin: 24px 0 14px !important;
      }
      .dashboard-element-html .panel-body.html h2 {
        margin: 28px 0 12px !important;
        font-size: 14pt !important; font-weight: 700 !important; line-height: 1.2 !important;
      }
      .dashboard-element-html .panel-body.html h3 {
        margin: 18px 0 8px !important;
      }
      .dashboard-element-html .panel-body.html h4,
      .dashboard-element-html .panel-body.html h5,
      .dashboard-element-html .panel-body.html h6 {
        margin: 14px 0 6px !important;
      }
      table, .table, .shared-resultstable table, .results-table table {
        border-collapse: collapse !important; border: 1px solid #000000 !important;
      }
      table td, table th, .table td, .table th,
      .shared-resultstable td, .shared-resultstable th,
      .results-table td, .results-table th { border: 1px solid #000000 !important; }
      .dashboard-element-html .panel-body.html table.case-reasons {
        width: 100% !important; table-layout: fixed !important;
      }
      .dashboard-element-html .panel-body.html table.case-reasons th:nth-child(1),
      .dashboard-element-html .panel-body.html table.case-reasons td:nth-child(1),
      .dashboard-element-html .panel-body.html table.case-reasons th:nth-child(1) { width: 15% !important; }
      .dashboard-element-html .panel-body.html table.case-reasons th:nth-child(2),
      .dashboard-element-html .panel-body.html table.case-reasons td:nth-child(2) { width: 8% !important; }
      .dashboard-element-html .panel-body.html table.case-reasons th:nth-child(3),
      .dashboard-element-html .panel-body.html table.case-reasons td:nth-child(3) { width: 23% !important; }
      .dashboard-element-html .panel-body.html table.case-reasons th:nth-child(4),
      .dashboard-element-html .panel-body.html table.case-reasons td:nth-child(4) {
        width: 54% !important; text-align: left !important;
        overflow-wrap: break-word !important; word-break: normal !important;
      }
      .pagination, .paginator, [class*="pagination"], [class*="paginator"],
      [data-test="table-pagination"], [data-test="results-table-pagination"],
      .sort-icon, .sort-icon-asc, .sort-icon-desc, .sort-indicator,
      .icon-sorts, [data-test*="sort"] {
        display: none !important;
      }
      .dashboard-panel:has(.shared-resultstable),
      .dashboard-panel:has(.results-table),
      .dashboard-panel:has(table) {
        min-height: 0 !important; height: auto !important; border: 0 !important;
        box-shadow: none !important; overflow: visible !important;
      }
      .dashboard-panel:has(table) .dashboard-element,
      .dashboard-panel:has(table) .dashboard-element-content,
      .dashboard-panel:has(table) .panel-body,
      .dashboard-panel:has(table) .shared-resultstable,
      .dashboard-panel:has(table) .results-table {
        min-height: 0 !important; height: auto !important; border: 0 !important;
        box-shadow: none !important; overflow: visible !important;
      }
      table, .table, .shared-resultstable table, .results-table table {
        font-size: 8.5pt !important; line-height: 1.25 !important;
        break-inside: auto !important; page-break-inside: auto !important;
      }
      table td, table th, .table td, .table th,
      .shared-resultstable td, .shared-resultstable th,
      .results-table td, .results-table th {
        padding: 3px 5px !important; white-space: normal !important;
        overflow-wrap: anywhere !important; vertical-align: top !important;
      }
      table th, .table th, .shared-resultstable th, .results-table th {
        font-weight: 700 !important;
      }
      table td:last-child, table th:last-child,
      .shared-resultstable td:last-child, .shared-resultstable th:last-child,
      .results-table td:last-child, .results-table th:last-child {
        text-align: right !important;
      }
      @media print {
        .dashboard-panel { break-inside: auto !important; page-break-inside: auto !important; }
        table { break-inside: auto !important; page-break-inside: auto !important; }
        thead { display: table-header-group !important; }
        tr, img, svg { break-inside: avoid !important; page-break-inside: avoid !important; }
      }
    """
    page_break_script = """(() => {
      const markBefore = (el) => {
        if (!el) return;
        el.style.pageBreakBefore = 'always'; el.style.breakBefore = 'page';
      };
      Array.from(document.querySelectorAll('p')).forEach(p => {
        let styleAttr = p.getAttribute('style') || '';
        if (/page-break-after\\s*:\\s*alays/i.test(styleAttr)) {
          p.setAttribute('style', styleAttr.replace(/alays/ig, 'always'));
          styleAttr = p.getAttribute('style') || '';
        }
        if (!/page-break-after\\s*:\\s*always/i.test(styleAttr) || (p.textContent || '').trim()) return;
        markBefore(p.nextElementSibling); p.remove();
      });
      Array.from(document.querySelectorAll('.pagebreak, [class*="pagebreak"]')).forEach(el => {
        markBefore(el.nextElementSibling || el);
        if (!(el.textContent || '').trim()) el.remove();
      });
      const sectionTitle = /^[A-H]\\.\\s+[A-Za-z][A-Za-z0-9 /()&'-]*$/;
      Array.from(document.querySelectorAll('h1')).forEach(h => {
        const text = (h.textContent || '').replace(/\\s+/g, ' ').trim();
        if (sectionTitle.test(text)) {
          markBefore(h);
        } else {
          // Dashboard templates sometimes put page-break-before on subordinate
          // headings (for example, "Reported:"). Let them flow after the
          // preceding panel; only major A-H sections start a new page.
          h.style.pageBreakBefore = 'auto';
          h.style.breakBefore = 'auto';
        }
      });
      window.scrollTo(0, 0); return true;
    })()"""

    LOGGER.debug("Render [%s]: Playwright-printing %s", report.report_id, view)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True, **({"executable_path": str(chrome)} if chrome else {}),
                args=[] if settings.splunk.verify_tls else ["--ignore-certificate-errors"]
            )
            try:
                context = browser.new_context(
                    ignore_https_errors=not settings.splunk.verify_tls, viewport={"width": 1280, "height": 1000}
                )
                try:
                    context.add_cookies(cookies)
                    page = context.new_page()
                    page.goto(dashboard_url, wait_until="domcontentloaded", timeout=180000)
                    stable_for = 0
                    stable_needed = max(1, int(round(settings.pdf_chrome.stable_seconds)))
                    last_height = None
                    last_chars = None
                    ready: dict[str, Any] = {}
                    deadline = time.monotonic() + settings.pdf_chrome.wait_seconds
                    LOGGER.info(
                        "Render [%s]: waiting up to %ss; require %ss stable then %ss settle",
                        report.report_id,
                        int(settings.pdf_chrome.wait_seconds),
                        stable_needed,
                        int(settings.pdf_chrome.settle_seconds),
                    )
                    while time.monotonic() < deadline:
                        page.evaluate(scroll_expression)
                        ready = page.evaluate(ready_expression)
                        height = int(ready.get("height") or 0)
                        chars = int(ready.get("chars") or 0)
                        layout_stable = last_height == height and last_chars == chars
                        last_height, last_chars = height, chars
                        ready_ok = (
                            not ready.get("login") and ready.get("hasOverview") and ready.get("hasReported")
                            and int(ready.get("waiting") or 0) == 0 and chars > 5000 and layout_stable
                        )
                        stable_for = stable_for + 1 if ready_ok else 0
                        LOGGER.debug(
                            "Render [%s]: playwright wait waiting=%s chars=%s height=%s stable=%s/%s",
                            report.report_id,
                            ready.get("waiting"),
                            chars,
                            height,
                            stable_for,
                            stable_needed,
                        )
                        if stable_for >= stable_needed:
                            break
                        page.wait_for_timeout(1000)
                    if stable_for < stable_needed:
                        raise CompletionError("Splunk dashboard did not stabilize before the render timeout.")
                    page.evaluate(scroll_expression)
                    settle_ms = int(settings.pdf_chrome.settle_seconds * 1000)
                    if settle_ms:
                        LOGGER.info(
                            "Render [%s]: settling %ss before print",
                            report.report_id,
                            settings.pdf_chrome.settle_seconds,
                        )
                        page.wait_for_timeout(settle_ms)
                    ready = page.evaluate(ready_expression)
                    if ready.get("login"):
                        raise CompletionError("Splunk Web browser session returned the login page.")
                    if not ready.get("hasOverview") or not ready.get("hasReported"):
                        raise CompletionError("Splunk dashboard did not finish loading the expected sections.")
                    if int(ready.get("waiting") or 0) > 0:
                        raise CompletionError(
                            f"Splunk dashboard still has {ready.get('waiting')} panel(s) waiting for data."
                        )
                    page.add_style_tag(content=print_css)
                    page.evaluate(page_break_script)
                    print_options = dict(
                        format=paper_format,
                        print_background=True,
                        display_header_footer=False,
                        prefer_css_page_size=False,
                        margin={"top": "0.4in", "bottom": "0.4in", "left": "0.4in", "right": "0.4in"},
                    )
                    return (
                        _print_with_contents(page, print_options)
                        if update_contents
                        else bytes(page.pdf(**print_options))
                    )
                finally:
                    context.close()
            finally:
                browser.close()
    except CompletionError:
        raise
    except Exception as error:
        raise CompletionError(
            "Playwright Chromium PDF rendering failed; verify browser installation and dashboard access."
        ) from error


def render_dashboard_pdf(
    settings: ReportSettings,
    report: ReportSpec,
    view: str,
    destination: Path,
    *,
    update_contents: bool = False,
) -> None:
    """Render a named Splunk view through Playwright Chromium."""
    LOGGER.debug("Render [%s]: Playwright-rendering %s", report.report_id, view)
    payload = _playwright_print_dashboard_pdf(settings, report, view, update_contents=update_contents)
    if not payload.startswith(b"%PDF"):
        raise CompletionError(f"Playwright PDF render returned a non-PDF response for {view}.")
    payload = drop_blank_pdf_pages(payload)
    atomic_write(destination, payload)
    LOGGER.debug("Render [%s]: downloaded %s (%d bytes)", report.report_id, destination.name, len(payload))


def _security_news_location(xml: str) -> tuple[int, int, str]:
    row_pattern = re.compile(r"<row(?:\s[^>]*)?>.*?</row>", re.IGNORECASE | re.DOTALL)
    html_pattern = re.compile(r"<html(?:\s[^>]*)?>(.*?)</html>", re.IGNORECASE | re.DOTALL)
    h1_pattern = re.compile(r"<h1(?:\s[^>]*)?>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
    locations: list[tuple[int, int, str]] = []
    for row_match in row_pattern.finditer(xml):
        row = row_match.group(0)
        for html_match in html_pattern.finditer(row):
            body = html_match.group(1)
            heading_match = h1_pattern.search(body)
            if not heading_match:
                continue
            heading = template_editor._normalise_heading(heading_match.group(1))
            if heading != "security news":
                continue
            absolute_body_start = row_match.start() + html_match.start(1)
            content_start = absolute_body_start + heading_match.end()
            content_end = row_match.start() + html_match.end(1)
            locations.append((content_start, content_end, xml[content_start:content_end]))
    if len(locations) != 1:
        raise CompletionError(f"Dashboard XML must contain exactly one Security News section; found {len(locations)}.")
    return locations[0]


def _validate_news_fragment(fragment: str) -> str:
    try:
        root = ET.fromstring(f"<root>{fragment}</root>")
    except ET.ParseError as error:
        raise CompletionError(f"Zimbra Security News HTML was not XML-compatible: {error}") from error
    for element in root.iter():
        if element is root:
            continue
        if element.tag not in NEWS_FRAGMENT_TAGS:
            raise CompletionError(f"Zimbra Security News contains unsupported HTML tag {element.tag!r}.")
        if element.tag == "a":
            href = element.attrib.get("href", "")
            if set(element.attrib) != {"href"} or not re.match(r"https?://", href, re.IGNORECASE):
                raise CompletionError("Zimbra Security News contains an unsafe or invalid link.")
        elif element.tag in {"h1", "h2", "h3"}:
            if element.attrib and (set(element.attrib) != {"style"} or element.attrib["style"].strip().casefold() != "text-align:center;"):
                raise CompletionError("Zimbra Security News contains unsupported heading attributes.")
        elif element.attrib:
            raise CompletionError(f"Zimbra Security News contains unsupported attributes on <{element.tag}>.")
    if not "".join(root.itertext()).strip():
        raise CompletionError("Zimbra Security News contains no readable article content.")
    return fragment.strip()


def _clean_security_news_fragment(fragment: str) -> str:
    """Remove email boilerplate/source metadata and center the first heading."""
    fragment = re.sub(
        r"<p>\s*(?:<[^>]+>\s*)*Dear\s+(?:Valued\s+)?Customer\s*,?\s*(?:</[^>]+>\s*)*</p>\s*",
        "",
        fragment,
        count=1,
        flags=re.IGNORECASE,
    )
    fragment = NEWS_GREETING_PATTERN.sub("", fragment, count=1)
    fragment = NEWS_SOURCE_BLOCK_PATTERN.sub("", fragment)
    fragment = re.sub(r"<p>\s*</p>\s*", "", fragment, flags=re.IGNORECASE)
    # HTML void tags must be self-closing for ElementTree / dashboard XML.
    fragment = re.sub(r"<br\s*>", "<br/>", fragment, flags=re.IGNORECASE)

    title_match = NEWS_TITLE_PATTERN.search(fragment)
    if title_match:
        tag = title_match.group(1).casefold()
        replacement = f'<{tag} style="text-align:center;">{title_match.group(2)}</{tag}>'
        fragment = fragment[:title_match.start()] + replacement + fragment[title_match.end():]
    return fragment.strip()


def replace_security_news(xml: str, article: SecurityNewsArticle) -> str:
    """Replace the static Security News body while preserving the dashboard heading."""
    template_editor.validate_dashboard_xml(xml)
    content = _validate_news_fragment(_clean_security_news_fragment(article.html_fragment))
    start, end, _old = _security_news_location(xml)
    result = xml[:start] + content + xml[end:]
    template_editor.validate_dashboard_xml(result)
    LOGGER.debug(
        "Replaced Security News with Zimbra message %s; old_chars=%d; new_chars=%d",
        article.message_id,
        end - start,
        len(content),
    )
    return result


def verify_pdf(path: Path) -> None:
    LOGGER.debug("verify_pdf: checking %s", path.name)
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        if not reader.pages:
            raise CompletionError(f"Generated PDF has no pages: {path.name}")
        LOGGER.debug("verify_pdf: %s has %d page(s)", path.name, len(reader.pages))
    except ImportError as error:
        raise CompletionError("PDF verification requires pypdf; install requirements.txt.") from error
    render_binary = shutil.which("pdftoppm")
    if render_binary:
        LOGGER.debug("verify_pdf: rendering first page with %s", render_binary)
        with tempfile.TemporaryDirectory(prefix="report-pdf-qa-") as directory:
            prefix = str(Path(directory) / "page")
            subprocess.run([render_binary, "-f", "1", "-l", "1", "-png", str(path), prefix], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        LOGGER.debug("verify_pdf: first-page render succeeded for %s", path.name)
    else:
        LOGGER.warning("pdftoppm unavailable; skipped page render check for %s", path.name)


def apply_report_sections(xml: str, model: ReportModel) -> str:
    """Replace the two finished sections, preserving all other dashboard XML."""
    template_editor.validate_dashboard_xml(xml)
    locations = template_editor._section_locations(xml)
    sections = {"Executive Summary": model.executive_summary_html,
                "Security Analysis": model.security_analysis_html}
    sections["Security Analysis"] = re.sub(
        r"<table\b", '<table class="case-reasons"', sections["Security Analysis"]
    )
    for heading, (start, end, _old) in sorted(locations.items(), key=lambda item: item[1][0], reverse=True):
        xml = xml[:start] + sections[heading] + xml[end:]
    template_editor.validate_dashboard_xml(xml)
    return xml


class CloneCleanupError(CompletionError):
    """A temporary dashboard could not be removed; execution must not report success."""


def generate_pdf(model: ReportModel, settings: ReportSettings, work_dir: Path,
                 *, security_news: SecurityNewsArticle) -> Path:
    """Reuse the dashboard renderer with authenticated news supplied by the caller."""
    report = model.report
    xml = fetch_source_xml(settings, report)
    atomic_write(source_xml_path(report, work_dir), xml)
    xml = update_report_period(xml, period_start=settings.case_start_date, period_end=settings.case_end_date)
    xml = replace_security_news(xml, security_news)
    xml = sanitize_dashboard_xml_for_pdf(apply_report_sections(xml, model))
    atomic_write(edited_xml_path(report, work_dir), xml)
    destination = work_dir / model.pdf_filename
    try:
        create_clone(settings, report, xml)
        render_dashboard_pdf(settings, report, report.clone_view, destination, update_contents=True)
        verify_pdf(destination)
        return destination
    finally:
        try:
            delete_clone(settings, report)
        except Exception as error:
            raise CloneCleanupError("Temporary report dashboard cleanup failed.") from error
