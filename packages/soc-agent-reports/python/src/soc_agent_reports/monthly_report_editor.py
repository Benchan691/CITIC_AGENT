"""Shared Splunk dashboard access and XML section helpers."""

from __future__ import annotations

import base64
import html
import json
import re
import ssl
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

SECTION_HEADINGS = ("Executive Summary", "Security Analysis")


class MonthlyReportError(RuntimeError):
    """A configured monthly-report operation could not safely complete."""


class SplunkRequestError(MonthlyReportError):
    """Splunk did not return a usable dashboard definition."""


@dataclass(frozen=True)
class Template:
    owner: str
    app: str
    view: str


@dataclass(frozen=True)
class SplunkSettings:
    base_url: str
    username_env: str
    password_env: str
    verify_tls: bool


def _ssl_context(verify_tls: bool) -> ssl.SSLContext | None:
    return None if verify_tls else ssl._create_unverified_context()


def fetch_dashboard_xml(
    template: Template,
    settings: SplunkSettings,
    environment: Mapping[str, str] | None = None,
    opener: Callable[..., Any] = urlopen,
) -> str:
    """Fetch one dashboard XML definition from Splunk's management API."""
    environment = environment if environment is not None else {}
    username = environment.get(settings.username_env, "")
    password = environment.get(settings.password_env, "")
    if not username or not password:
        raise SplunkRequestError(
            f"Set {settings.username_env} and {settings.password_env} before reading monthly report templates."
        )
    endpoint = "/".join(
        (
            settings.base_url,
            "servicesNS",
            quote(template.owner, safe=""),
            quote(template.app, safe=""),
            "data/ui/views",
            quote(template.view, safe=""),
        )
    ) + "?output_mode=json"
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    request = Request(endpoint, headers={"Accept": "application/json", "Authorization": f"Basic {token}"})
    try:
        with opener(request, timeout=30, context=_ssl_context(settings.verify_tls)) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise SplunkRequestError(f"Splunk request for {template.view} failed with HTTP {error.code}.") from error
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise SplunkRequestError(f"Could not retrieve {template.view} from Splunk: {type(error).__name__}.") from error
    try:
        xml = payload["entry"][0]["content"]["eai:data"]
    except (KeyError, IndexError, TypeError) as error:
        raise SplunkRequestError(f"Splunk did not return a dashboard XML definition for {template.view}.") from error
    if not isinstance(xml, str) or not xml.strip():
        raise SplunkRequestError(f"Splunk returned an empty dashboard XML definition for {template.view}.")
    validate_dashboard_xml(xml)
    return xml


def validate_dashboard_xml(xml: str) -> None:
    try:
        ET.fromstring(xml)
    except ET.ParseError as error:
        raise MonthlyReportError(f"Dashboard XML is not well-formed: {error}.") from error


def _normalise_heading(value: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", value))
    text = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"^[A-Z]\.\s*", "", text, flags=re.IGNORECASE).casefold()


def _section_locations(xml: str) -> dict[str, tuple[int, int, str]]:
    """Find target HTML bodies without reserializing the rest of the XML."""
    locations: dict[str, tuple[int, int, str]] = {}
    row_pattern = re.compile(r"<row(?:\s[^>]*)?>.*?</row>", re.IGNORECASE | re.DOTALL)
    html_pattern = re.compile(r"<html(?:\s[^>]*)?>(.*?)</html>", re.IGNORECASE | re.DOTALL)
    h1_pattern = re.compile(r"<h1(?:\s[^>]*)?>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
    for row_match in row_pattern.finditer(xml):
        row = row_match.group(0)
        for html_match in html_pattern.finditer(row):
            body = html_match.group(1)
            heading_match = h1_pattern.search(body)
            if not heading_match:
                continue
            heading = _normalise_heading(heading_match.group(1))
            for expected in SECTION_HEADINGS:
                if heading != expected.casefold():
                    continue
                if expected in locations:
                    raise MonthlyReportError(f"Dashboard XML contains more than one {expected!r} section row.")
                absolute_body_start = row_match.start() + html_match.start(1)
                content_start = absolute_body_start + heading_match.end()
                content_end = row_match.start() + html_match.end(1)
                locations[expected] = (content_start, content_end, xml[content_start:content_end])
    missing = [heading for heading in SECTION_HEADINGS if heading not in locations]
    if missing:
        raise MonthlyReportError("Dashboard XML is missing required section row(s): " + ", ".join(missing) + ".")
    return locations
