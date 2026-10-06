"""Validate user-owned report profiles; runtime endpoints and secrets stay server-owned."""

from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, timedelta
from typing import Any, Mapping
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from ..errors import ServiceError

_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_SECRET = re.compile(r"password|secret|token|api.?key|credential|binary|executable|output.?dir|file.?path|runtime.?path", re.I)


def _bad(message: str) -> None:
    raise ServiceError("report_configuration_invalid", message)


def _object(value: Any, name: str, allowed: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        _bad(f"{name} must be an object.")
    unknown = set(value) - allowed
    if unknown:
        _bad(f"{name} has unsupported fields: {', '.join(sorted(unknown))}.")
    return value


def _text(value: Any, name: str, maximum: int = 255) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum or re.search(r"[\x00-\x1f\x7f]", value):
        _bad(f"{name} must be non-empty text of at most {maximum} characters.")
    return value.strip()


def validate_scope(value: Mapping[str, Any], name: str) -> dict[str, Any]:
    kind = value.get("scope_type", "folder")
    if kind not in {"folder", "label"}:
        _bad(f"{name}.scope_type must be folder or label.")
    scope = _text(value.get("scope"), f"{name}.scope")
    if kind == "folder" and not scope.startswith("/"):
        _bad(f"{name}.scope must be the full folder path beginning with /.")
    include = value.get("include_subfolders", False)
    if not isinstance(include, bool):
        _bad(f"{name}.include_subfolders must be a boolean.")
    if kind == "label" and include:
        _bad(f"{name}.include_subfolders only applies to folders.")
    return {"scope_type": kind, "scope": scope, "include_subfolders": include}


def _extensions(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        _bad("extensions must be an object.")
    def visit(item, depth=0):
        if depth > 5:
            _bad("extensions may contain at most five nested levels.")
        if isinstance(item, dict):
            for key, nested in item.items():
                if not isinstance(key, str) or _SECRET.search(key):
                    _bad("extensions cannot contain credentials or runtime paths.")
                visit(nested, depth + 1)
        elif isinstance(item, list):
            for nested in item:
                visit(nested, depth + 1)
        elif not isinstance(item, (str, int, float, bool, type(None))):
            _bad("extensions must contain JSON-compatible data.")
    visit(value)
    try:
        encoded = json.dumps(value, allow_nan=False)
    except (ValueError, TypeError):
        _bad("extensions must contain finite JSON values.")
    if len(encoded) > 20_000:
        _bad("extensions exceed the 20,000-character limit.")
    return value


def validate_profiles(value: Any, account: str) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) > 50:
        _bad("customers must be a list of at most 50 customer profiles.")
    profiles: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(value):
        name = f"customers[{index}]"
        item = _object(item, name, {"customer_id", "display_name", "report_id", "company_name", "email", "customer_senders", "report", "news", "extensions"})
        profile = {field: _text(item.get(field), f"{name}.{field}") for field in ("customer_id", "display_name", "report_id", "company_name")}
        for field in ("customer_id", "report_id"):
            if not _ID.fullmatch(profile[field]):
                _bad(f"{name}.{field} must contain only letters, digits, underscores, or hyphens.")
        if profile["customer_id"].casefold() in seen:
            _bad(f"Duplicate customer_id: {profile['customer_id']}.")
        seen.add(profile["customer_id"].casefold())
        email = _object(item.get("email"), f"{name}.email", {"account", "scope_type", "scope", "include_subfolders"})
        configured_account = _text(email.get("account"), f"{name}.email.account").casefold()
        if configured_account != account.strip().casefold():
            raise ServiceError("report_account_mismatch", "The report email account must match your authenticated Zimbra account.")
        profile["email"] = {"account": configured_account, **validate_scope(email, f"{name}.email")}
        senders = item.get("customer_senders", [])
        if not isinstance(senders, list) or len(senders) > 100 or any(not isinstance(sender, str) or not re.fullmatch(r"[^\s<>@]+@[^\s<>@]+", sender) for sender in senders):
            _bad(f"{name}.customer_senders must be a list of customer email addresses.")
        profile["customer_senders"] = list(dict.fromkeys(sender.casefold() for sender in senders))
        report = _object(item.get("report"), f"{name}.report", {"template", "output_stem", "executive_summary_html", "security_analysis_html"})
        template = _object(report.get("template"), f"{name}.report.template", {"owner", "app", "view"})
        report_config: dict[str, Any] = {"template": {field: _text(template.get(field), f"{name}.report.template.{field}") for field in ("owner", "app", "view")}}
        stem = report.get("output_stem") or f"G{profile['report_id']} TrustCSI MSS Monthly Report {{month}} {{year}}"
        stem = _text(stem, f"{name}.report.output_stem")
        if "/" in stem or "\\" in stem:
            _bad(f"{name}.report.output_stem must be a filename without directory separators.")
        report_config["output_stem"] = stem
        for field in ("executive_summary_html", "security_analysis_html"):
            if field in report:
                content = report[field]
                if not isinstance(content, str) or not content.strip() or len(content) > 500_000:
                    _bad(f"{name}.report.{field} must contain non-empty HTML of at most 500,000 characters.")
                report_config[field] = content
        profile["report"] = report_config
        news = _object(item.get("news"), f"{name}.news", {"scope_type", "scope", "include_subfolders", "source_labels", "source_terms", "scan_limit"})
        profile["news"] = validate_scope(news, f"{name}.news")
        for field, default in (("source_labels", ["Source collection", "来源集合"]), ("source_terms", ["hkcert"])):
            values = news.get(field, default)
            if not isinstance(values, list) or not 1 <= len(values) <= 20:
                _bad(f"{name}.news.{field} must contain 1 to 20 entries.")
            profile["news"][field] = [_text(entry, f"{name}.news.{field}", 100) for entry in values]
        limit = news.get("scan_limit", 500)
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 2000:
            _bad(f"{name}.news.scan_limit must be between 1 and 2000.")
        profile["news"]["scan_limit"] = limit
        profile["extensions"] = _extensions(item.get("extensions", {}))
        profiles.append(profile)
    return profiles


def report_period(start: str | None, end: str | None) -> tuple[str, str]:
    if start is None and end is None:
        final = datetime.now(ZoneInfo("Asia/Hong_Kong")).date().replace(day=1) - timedelta(days=1)
        return final.replace(day=1).isoformat(), final.isoformat()
    if start is None or end is None:
        raise ServiceError("report_input_invalid", "period_start and period_end must both be supplied.")
    try:
        if not all(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) for value in (start, end)):
            raise ValueError
        first, last = date.fromisoformat(start), date.fromisoformat(end)
        if first > last or (last - first).days > 366:
            raise ValueError
    except ValueError as exc:
        raise ServiceError("report_input_invalid", "Report dates must be valid YYYY-MM-DD values in order, spanning at most 367 days.") from exc
    return first.isoformat(), last.isoformat()


def plugin_configuration(profile: Mapping[str, Any], environment: Mapping[str, str] | None = None) -> dict[str, Any]:
    env = os.environ if environment is None else environment
    required = [key for key in ("REPORT_SPLUNK_BASE_URL", "REPORT_SPLUNK_USERNAME", "REPORT_SPLUNK_PASSWORD") if not env.get(key)]
    if required:
        raise ServiceError("report_backend_not_configured", "Report rendering is not configured on the server.", details={"missing_environment_variables": required})
    def seconds(key, default):
        try:
            value = float(env.get(key, default))
            if not 0 < value <= 1800:
                raise ValueError
            return value
        except (ValueError, TypeError) as exc:
            raise ServiceError("report_backend_not_configured", f"{key} must be a positive duration of at most 1800 seconds.") from exc
    web_url = env.get("REPORT_SPLUNK_WEB_BASE_URL")
    if not web_url:
        endpoint = urlsplit(env["REPORT_SPLUNK_BASE_URL"])
        try:
            if endpoint.port == 8089:
                hostname = endpoint.hostname or ""
                if ":" in hostname:
                    hostname = f"[{hostname}]"
                endpoint = endpoint._replace(netloc=f"{hostname}:8000")
            web_url = urlunsplit(endpoint)
        except ValueError as exc:
            raise ServiceError("report_backend_not_configured", "REPORT_SPLUNK_BASE_URL is not a valid endpoint.") from exc
    return {
        "report_id": profile["report_id"], "template": profile["report"]["template"], "output_stem": profile["report"]["output_stem"],
        "splunk": {"base_url": env["REPORT_SPLUNK_BASE_URL"], "username_env": "REPORT_SPLUNK_USERNAME", "password_env": "REPORT_SPLUNK_PASSWORD", "verify_tls": str(env.get("REPORT_SPLUNK_VERIFY_TLS", "true")).casefold() in {"true", "1", "yes"}},
        "pdf": {"paper_size": "Letter", "web_base_url": web_url, "wait_seconds": seconds("REPORT_PDF_WAIT_SECONDS", 180), "stable_seconds": seconds("REPORT_PDF_STABLE_SECONDS", 45), "settle_seconds": seconds("REPORT_PDF_SETTLE_SECONDS", 20), **({"chrome_binary": env["REPORT_CHROME_BINARY"]} if env.get("REPORT_CHROME_BINARY") else {})},
    }
