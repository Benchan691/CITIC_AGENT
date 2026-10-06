"""Reuse authenticated Zimbra mail services for bounded report evidence retrieval."""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any, Mapping

from ..errors import ServiceError

MAX_REPORT_MESSAGES = 5000


def _quoted(value: str) -> str:
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


async def scope_query(mail, scope: Mapping[str, Any]) -> str:
    if scope["scope_type"] == "label":
        return "tag:" + _quoted(scope["scope"])
    try:
        result = await mail.list_folders()
    except ServiceError as exc:
        if exc.code == "zimbra_auth_error":
            raise
        raise ServiceError("report_email_inaccessible", "The configured report mailbox folders could not be accessed.", retryable=exc.retryable) from exc
    except Exception as exc:
        raise ServiceError("report_email_inaccessible", "The configured report mailbox folders could not be accessed.") from exc
    if not isinstance(result, Mapping) or not isinstance(result.get("folders"), list) or any(not isinstance(item, Mapping) for item in result["folders"]):
        raise ServiceError("report_email_malformed", "The email service returned invalid folder information.")
    folder = next((item for item in result.get("folders", []) if str(item.get("path", "")).rstrip("/") == scope["scope"].rstrip("/")), None)
    if folder is None or not str(folder.get("id", "")).isdigit():
        raise ServiceError("report_folder_inaccessible", "The configured email folder was not found in your authenticated mailbox.")
    return ("underid:" if scope.get("include_subfolders", False) else "inid:") + str(folder["id"])


async def _read_messages(mail, query: str, maximum: int, *, exhaust: bool = True, stop_when=None) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    seen: set[str] = set()
    offset = 0
    try:
        while True:
            limit = min(100, maximum - len(messages))
            if limit <= 0:
                if not exhaust:
                    break
                extra = await mail.search_emails(query, limit=1, offset=offset)
                if extra.get("messages"):
                    raise ServiceError("report_email_limit_exceeded", f"More than {maximum} messages matched. Select a shorter report period.")
                break
            result = await mail.search_emails(query, limit=limit, offset=offset)
            page = result.get("messages") if isinstance(result, Mapping) else None
            if not isinstance(page, list):
                raise ServiceError("report_email_malformed", "The email service returned invalid search results.")
            for item in page:
                message_id = str(item.get("id", "")) if isinstance(item, Mapping) else ""
                if not message_id or message_id in seen:
                    raise ServiceError("report_email_malformed", "The email service returned missing or repeated message IDs; the report evidence is incomplete.")
                seen.add(message_id)
                message = await mail.get_email(message_id, max_body_chars=100_000)
                if not isinstance(message, dict) or not isinstance(message.get("body"), str):
                    raise ServiceError("report_email_malformed", "The email service returned an invalid message body.")
                if message.get("body_truncated"):
                    raise ServiceError("report_email_truncated", "A matched email exceeds the supported body size. The report cannot safely parse incomplete content.", details={"message_id": message_id})
                messages.append(message)
                if stop_when is not None and stop_when(message):
                    return messages
            offset += len(page)
            if len(page) < limit:
                break
    except ServiceError as exc:
        if exc.code.startswith("report_") or exc.code == "zimbra_auth_error":
            raise
        raise ServiceError("report_email_inaccessible", "The configured report mailbox could not be read.", retryable=exc.retryable, details={"cause_code": exc.code}) from exc
    except Exception as exc:
        raise ServiceError("report_email_inaccessible", "The configured report mailbox could not be read.") from exc
    return messages


async def retrieve_report_messages(mail, profile: Mapping[str, Any], period_start: str, period_end: str) -> list[dict[str, Any]]:
    scope = await scope_query(mail, profile["email"])
    first = date.fromisoformat(period_start)
    final = date.fromisoformat(period_end) + timedelta(days=1)
    query = f"{scope} after:{first:%m/%d/%Y} before:{final:%m/%d/%Y}"
    messages = await _read_messages(mail, query, MAX_REPORT_MESSAGES)
    if not messages:
        raise ServiceError("report_emails_not_found", "No messages matched the configured customer email folder or label and reporting period.")
    return messages


async def retrieve_security_news(mail, profile: Mapping[str, Any]):
    from soc_agent_reports import SecurityNewsArticle, sanitize_security_news
    from soc_agent_reports.report_html import _html_to_text

    news = profile["news"]
    scope = await scope_query(mail, news)
    labels = "|".join(re.escape(value) for value in news["source_labels"])
    terms = "|".join(re.escape(value) for value in news["source_terms"])
    match = re.compile(rf"(?:{labels})\s*[:：]\s*(?:{terms})(?=\s|$|[<,;|])", re.I)
    def fragment_for(message):
        if not match.search(_html_to_text(str(message.get("body", "")))):
            return ""
        body = str(message.get("body", ""))
        return sanitize_security_news(body, "") if str(message.get("body_type", "")).startswith("text/html") else sanitize_security_news("", body)
    messages = await _read_messages(mail, scope, news["scan_limit"], exhaust=False, stop_when=fragment_for)
    for message in messages:
        fragment = fragment_for(message)
        if fragment:
            return SecurityNewsArticle(message_id=str(message["id"]), sender=str(message.get("from", "")), subject=str(message.get("subject", "")), html_fragment=fragment)
    raise ServiceError("report_news_not_found", "No readable Security News article matched the customer’s configured news source and folder or label.")
