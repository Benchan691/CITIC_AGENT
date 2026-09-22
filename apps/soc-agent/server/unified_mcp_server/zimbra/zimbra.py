import html
import xml.etree.ElementTree as ET
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlsplit

from zimbra_client import Attachment, ZimbraClient
from zimbra_client.errors import (
    ZimbraConnectionError,
    ZimbraHTTPError,
    ZimbraLimitError,
    ZimbraProtocolError,
    ZimbraSOAPFault,
)
from zimbra_client.mail import (
    build_send_message_request,
    ensure_recipients,
    format_forwarded_html,
    format_forwarded_text,
    format_reply_html,
    format_reply_text,
    parse_send_response,
    prepend_html,
    prepend_text,
)
from ..request_context import remaining_seconds


def zimbra_host(cfg):
    return str(cfg.get("zimbra_host") or cfg.get("host") or "").strip()


def zimbra_email(cfg):
    return str(cfg.get("zimbra_email") or cfg.get("email") or "").strip()


def zimbra_username(cfg):
    return str(cfg.get("zimbra_username") or cfg.get("username") or "").strip()


def zimbra_password(cfg):
    return str(cfg.get("zimbra_password") or cfg.get("password") or "").strip()


def require_zimbra_config(cfg):
    missing = []
    if not zimbra_host(cfg):
        missing.append("ZIMBRA_HOST")
    if not zimbra_email(cfg) and not zimbra_username(cfg):
        missing.append("ZIMBRA_EMAIL or ZIMBRA_USERNAME")
    if not zimbra_password(cfg):
        missing.append("ZIMBRA_PASSWORD")
    if missing:
        raise ValueError("Missing Zimbra config: " + ", ".join(missing))


_TOKEN_EMAIL = "authenticated@invalid"
_TOKEN_PASSWORD = "token-authenticated"


class _TokenClient(ZimbraClient):
    """Use an existing authenticated session without storing credentials."""

    def __init__(self, host, token, *, email="", verify_ssl=True, timeout=60, allow_insecure_http=False):
        self._allow_insecure_http = _as_bool(allow_insecure_http, False)
        self._host = _validate_zimbra_host(host, allow_insecure_http=self._allow_insecure_http)
        super().__init__({
            "host": self._host,
            "email": email or _TOKEN_EMAIL,
            "password": _TOKEN_PASSWORD,
            "verify_ssl": verify_ssl,
            "timeout": timeout,
        })
        self._auth_token = token

    def request(self, body, *, authenticated=True, retry_auth=False):
        return soap_request(
            self._host,
            ET.tostring(body, encoding="unicode").replace(" />", "/>")
            if isinstance(body, ET.Element) else body,
            self._auth_token if authenticated else "",
            verify_ssl=self.config.verify_ssl,
            timeout=self.config.timeout,
            allow_insecure_http=self._allow_insecure_http,
        )

    def _ensure_auth(self):
        return self._auth_token


def _local_name(tag):
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _as_bool(value, default=False):
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _validate_zimbra_host(host, *, allow_insecure_http=False):
    """Validate the Zimbra authority before any credentialed request."""
    raw = str(host or "").strip()
    if not raw:
        return raw
    candidate = raw if "://" in raw else f"https://{raw}"
    try:
        parsed = urlsplit(candidate)
        parsed.port
        hostname = parsed.hostname
    except ValueError as exc:
        raise ValueError("ZIMBRA_HOST must be a valid http or https host") from exc
    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.netloc
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
    ):
        raise ValueError("ZIMBRA_HOST must be a valid http or https host without embedded credentials")
    if parsed.scheme.lower() == "http" and not _as_bool(allow_insecure_http, False):
        raise ValueError("ZIMBRA_HOST must use HTTPS unless ZIMBRA_ALLOW_INSECURE_HTTP is true")
    return raw


def _connection_options(cfg):
    return {
        "verify_ssl": _as_bool(cfg.get("verify_ssl"), True),
        "timeout": float(cfg.get("timeout", 60)),
        "allow_insecure_http": _as_bool(cfg.get("allow_insecure_http"), False),
    }


def soap_request(host, body_xml, auth_token="", *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    client = _TokenClient(
        host,
        auth_token,
        verify_ssl=verify_ssl,
        timeout=remaining_seconds(timeout),
        allow_insecure_http=allow_insecure_http,
    )
    body = ET.fromstring(body_xml) if isinstance(body_xml, str) else body_xml
    return client._request_once(body, auth_token=auth_token if auth_token else "")


ACCOUNT_NAMESPACE = "urn:zimbraAccount"
TWO_FACTOR_MAX_LIFETIME_MS = 300_000


class ZimbraAuthFlowError(RuntimeError):
    """Credential-free, stable failure categories for the login flow."""

    def __init__(self, code: str, message: str, *, retryable: bool = False):
        self.code = str(code)
        self.message = str(message)
        self.retryable = bool(retryable)
        super().__init__(self.message)


@dataclass(frozen=True)
class ZimbraLoginAttempt:
    """The result of the first AuthRequest, with no password retained."""

    token: str = ""
    temporary_token: str = ""
    lifetime_ms: int = TWO_FACTOR_MAX_LIFETIME_MS

    @property
    def two_factor_required(self) -> bool:
        return bool(self.temporary_token)


def _auth_request_body(email: str, password: str) -> ET.Element:
    request = ET.Element(f"{{{ACCOUNT_NAMESPACE}}}AuthRequest")
    account = ET.SubElement(request, f"{{{ACCOUNT_NAMESPACE}}}account")
    account.set("by", "name")
    account.text = str(email)
    secret = ET.SubElement(request, f"{{{ACCOUNT_NAMESPACE}}}password")
    secret.text = str(password)
    return request


def _two_factor_request_body(temporary_token: str, code: str) -> ET.Element:
    request = ET.Element(f"{{{ACCOUNT_NAMESPACE}}}AuthRequest")
    token = ET.SubElement(request, f"{{{ACCOUNT_NAMESPACE}}}authToken")
    token.text = str(temporary_token)
    factor = ET.SubElement(request, f"{{{ACCOUNT_NAMESPACE}}}twoFactorCode")
    factor.text = str(code)
    return request


def _response_text(root: ET.Element, name: str) -> str:
    for element in root.iter():
        if _local_name(element.tag) == name and (element.text or "").strip():
            return element.text.strip()
    return ""


def _response_bool(root: ET.Element, name: str) -> bool:
    return _response_text(root, name).casefold() in {"1", "true", "yes", "on"}


def _auth_config(cfg, *, require_password: bool) -> dict:
    if require_password:
        require_zimbra_config(cfg)
    elif not zimbra_host(cfg):
        raise ValueError("Missing Zimbra config: ZIMBRA_HOST")
    config = dict(cfg)
    config["zimbra_host"] = _validate_zimbra_host(
        zimbra_host(config),
        allow_insecure_http=_as_bool(config.get("allow_insecure_http"), False),
    )
    config["verify_ssl"] = _as_bool(config.get("verify_ssl"), True)
    config["allow_insecure_http"] = _as_bool(config.get("allow_insecure_http"), False)
    config["timeout"] = remaining_seconds(float(config.get("timeout", 60)))
    return config


def _map_auth_transport_error(exc: Exception, *, two_factor: bool) -> ZimbraAuthFlowError:
    code = str(getattr(exc, "code", "") or "").casefold()
    detail = str(getattr(exc, "message", "") or "").casefold()
    unavailable = isinstance(exc, (ZimbraConnectionError, ZimbraHTTPError))
    if unavailable or any(value in code or value in detail for value in (
        "service_unavailable",
        "temporarily_unavailable",
        "service.failure",
        "network",
        "timeout",
    )):
        return ZimbraAuthFlowError(
            "authentication_unavailable",
            "Zimbra authentication is temporarily unavailable.",
            retryable=True,
        )
    if any(value in code or value in detail for value in (
        "two_factor_setup_required",
        "twofactor_setup_required",
        "2fa_setup",
    )):
        return ZimbraAuthFlowError(
            "two_factor_setup_required",
            "Two-factor authentication setup is required.",
        )
    if two_factor and any(value in code or value in detail for value in (
        "auth_token_expired",
        "auth_token_invalid",
        "two_factor_expired",
        "token_expired",
        "service.auth_required",
        "bad auth token",
        "auth token expired",
    )):
        return ZimbraAuthFlowError("two_factor_expired", "The two-factor session expired.")
    if two_factor and any(value in code or value in detail for value in (
        "two_factor_auth_failed",
        "two_factor_code",
        "invalid_code",
        "auth_failed",
    )):
        return ZimbraAuthFlowError(
            "two_factor_invalid",
            "The authenticator code is invalid.",
            retryable=True,
        )
    return ZimbraAuthFlowError("authentication_failed", "Zimbra authentication failed.")


def zimbra_login_start(cfg) -> ZimbraLoginAttempt:
    """Run the credential AuthRequest and detect a Zimbra 2FA challenge."""
    config = _auth_config(cfg, require_password=True)
    try:
        root = soap_request(
            config["zimbra_host"],
            _auth_request_body(zimbra_email(config) or zimbra_username(config), zimbra_password(config)),
            verify_ssl=config["verify_ssl"],
            timeout=config["timeout"],
            allow_insecure_http=config["allow_insecure_http"],
        )
    except (ZimbraSOAPFault, ZimbraConnectionError, ZimbraHTTPError, ZimbraProtocolError) as exc:
        raise _map_auth_transport_error(exc, two_factor=False) from exc

    token = _response_text(root, "authToken")
    if _response_bool(root, "twoFactorAuthRequired"):
        if not token:
            raise ZimbraAuthFlowError("authentication_failed", "Zimbra authentication failed.")
        try:
            lifetime_ms = int(_response_text(root, "lifetime") or TWO_FACTOR_MAX_LIFETIME_MS)
        except ValueError:
            lifetime_ms = TWO_FACTOR_MAX_LIFETIME_MS
        return ZimbraLoginAttempt(temporary_token=token, lifetime_ms=lifetime_ms)
    if not token:
        raise ZimbraAuthFlowError("authentication_failed", "Zimbra authentication failed.")
    return ZimbraLoginAttempt(token=token)


def zimbra_complete_two_factor(cfg, temporary_token: str, code: str) -> str:
    """Exchange a temporary Zimbra token and six-digit code for the final token."""
    token = str(temporary_token or "")
    value = str(code or "")
    if not token or len(value) != 6 or any(char not in "0123456789" for char in value):
        raise ZimbraAuthFlowError(
            "two_factor_invalid",
            "The authenticator code is invalid.",
            retryable=True,
        )
    config = _auth_config(cfg, require_password=False)
    try:
        root = soap_request(
            config["zimbra_host"],
            _two_factor_request_body(token, value),
            verify_ssl=config["verify_ssl"],
            timeout=config["timeout"],
            allow_insecure_http=config["allow_insecure_http"],
        )
    except (ZimbraSOAPFault, ZimbraConnectionError, ZimbraHTTPError, ZimbraProtocolError) as exc:
        raise _map_auth_transport_error(exc, two_factor=True) from exc
    final_token = _response_text(root, "authToken")
    if _response_bool(root, "twoFactorAuthRequired"):
        raise ZimbraAuthFlowError(
            "two_factor_invalid",
            "The authenticator code is invalid.",
            retryable=True,
        )
    if not final_token:
        raise ZimbraAuthFlowError("two_factor_expired", "The two-factor session expired.")
    return final_token


def zimbra_login(cfg):
    """Backward-compatible non-interactive login used by background callers."""
    attempt = zimbra_login_start(cfg)
    if attempt.token:
        return attempt.token
    raise ZimbraAuthFlowError("two_factor_required", "Zimbra requires two-factor authentication.")


def _token_client(host, token, *, email="", verify_ssl=True, timeout=60, allow_insecure_http=False):
    return _TokenClient(
        host,
        token,
        email=email,
        verify_ssl=verify_ssl,
        timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )


def _signature_dict(signature):
    return {
        "id": signature.id,
        "name": signature.name,
        "text": signature.text_plain,
        "html": signature.text_html,
    }


def zimbra_list_signatures(host, token, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    return [
        _signature_dict(signature)
        for signature in _token_client(
            host, token, verify_ssl=verify_ssl, timeout=timeout,
            allow_insecure_http=allow_insecure_http,
        ).list_signatures()
    ]


def zimbra_create_signature(host, token, name, text=None, html_content=None, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    signature = _token_client(
        host, token, verify_ssl=verify_ssl, timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    ).create_signature(
        name,
        text=text or "",
        html=html_content or "",
    )
    return {"id": signature.id, "name": signature.name}


def zimbra_delete_signature(host, token, signature_id, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    _token_client(
        host, token, verify_ssl=verify_ssl, timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    ).delete_signature(signature_id)


def zimbra_send_message(
    host,
    token,
    recipients,
    subject,
    body,
    *,
    cc=None,
    bcc=None,
    body_format="html",
    attachments: Sequence[Attachment] | None = None,
    verify_ssl=True,
    timeout=60,
    allow_insecure_http=False,
):
    body_format = str(body_format).strip().lower()
    if body_format != "html":
        raise ValueError("Email actions must use body_format=html")
    text_body, html_body = _composer_body(body, body_format)
    result = _token_client(
        host, token, verify_ssl=verify_ssl, timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    ).send_message(
        to=recipients,
        cc=cc,
        bcc=bcc,
        subject=str(subject),
        text=text_body,
        html=html_body,
        attachments=attachments,
    )
    return {"message_id": result.message_id}


class _PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def _composer_body(body, body_format):
    body_format = "html" if body_format is None else str(body_format).strip().lower()
    if body_format != "html":
        raise ValueError("Email actions must use body_format=html")
    parser = _PlainText()
    parser.feed(str(body))
    return " ".join(parser.parts), str(body)


def _default_subject(prefix: str, subject: str) -> str:
    subject = str(subject or "").strip()
    return subject if subject.casefold().startswith(prefix.casefold()) else f"{prefix} {subject}".strip()


def _header_value(headers, name: str) -> str:
    for key, value in (headers or {}).items():
        if str(key).casefold() == name.casefold():
            return str(value or "")
    return ""


def _uploaded_action(
    client: _TokenClient,
    *,
    to,
    cc,
    bcc,
    subject: str,
    text: str,
    html_body: str,
    attachments: Sequence[Attachment],
    source_message_id: str,
    reply_type: str,
    attached_message_parts=(),
    in_reply_to: str = "",
    original_subject: str = "",
) -> dict[str, str]:
    to_recipients, cc_recipients, bcc_recipients = ensure_recipients(to=to, cc=cc, bcc=bcc)
    attachment_ids = client._upload_attachments(attachments)
    prefix = "Re:" if reply_type == "r" else "Fwd:"
    request = build_send_message_request(
        to=to_recipients,
        cc=cc_recipients,
        bcc=bcc_recipients,
        subject=subject or _default_subject(prefix, original_subject),
        text=text,
        html=html_body,
        attachment_ids=attachment_ids,
        original_id=source_message_id,
        reply_type=reply_type,
        in_reply_to=in_reply_to,
        attached_message_parts=attached_message_parts,
    )
    return {"message_id": parse_send_response(client.request(request)).message_id}


def zimbra_forward_message(
    host, token, message_id, recipients, subject, body, *, cc=None, bcc=None,
    body_format="html", attachments: Sequence[Attachment] | None = None,
    verify_ssl=True, timeout=60, allow_insecure_http=False,
):
    text_body, html_body = _composer_body(body, body_format)
    client = _token_client(
        host, token, verify_ssl=verify_ssl, timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )
    if not attachments:
        result = client.forward_message(
            message_id, to=recipients, cc=cc, bcc=bcc, subject=subject or None,
            text=text_body, html=html_body,
        )
        return {"message_id": result.message_id}
    source = client.get_message(message_id)
    attached_message_parts = []
    for attachment in source.attachments:
        if not attachment.part:
            raise ValueError("Source attachment did not include a MIME part id")
        attached_message_parts.append((message_id, attachment.part))
    return _uploaded_action(
        client,
        to=recipients,
        cc=cc,
        bcc=bcc,
        subject=subject,
        text=prepend_text(text_body, format_forwarded_text(source)),
        html_body=prepend_html(html_body, format_forwarded_html(source)),
        attachments=attachments,
        source_message_id=message_id,
        reply_type="w",
        attached_message_parts=attached_message_parts,
        original_subject=source.subject,
    )


def zimbra_reply_message(
    host, token, message_id, recipients=None, subject=None, body="", *, cc=None, bcc=None,
    body_format="html", reply_all=False, email="", attachments: Sequence[Attachment] | None = None,
    verify_ssl=True, timeout=60, allow_insecure_http=False,
):
    text_body, html_body = _composer_body(body, body_format)
    client = _token_client(
        host, token, email=email, verify_ssl=verify_ssl, timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )
    if not attachments:
        result = client.reply_message(
            message_id, to=recipients, cc=cc, bcc=bcc, subject=subject or None,
            text=text_body, html=html_body, reply_all=bool(reply_all),
        )
        return {"message_id": result.message_id}
    source = client.get_message(message_id)
    explicit_recipients = any(value is not None for value in (recipients, cc, bcc))
    if explicit_recipients:
        to_recipients, cc_recipients, bcc_recipients = ensure_recipients(to=recipients, cc=cc, bcc=bcc)
    else:
        to_recipients, cc_recipients, bcc_recipients = client._derive_reply_recipients(
            source,
            reply_all=bool(reply_all),
        )
    return _uploaded_action(
        client,
        to=to_recipients,
        cc=cc_recipients,
        bcc=bcc_recipients,
        subject=subject or "",
        text=prepend_text(text_body, format_reply_text(source)),
        html_body=prepend_html(html_body, format_reply_html(source)),
        attachments=attachments,
        source_message_id=message_id,
        reply_type="r",
        in_reply_to=_header_value(source.headers, "Message-ID"),
        original_subject=source.subject,
    )


def zimbra_move_message(host, token, message_id, folder_id, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    _token_client(
        host, token, verify_ssl=verify_ssl, timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    ).move_message(
        message_id,
        str(folder_id),
    )


def _message_date(value):
    if not value:
        return ""
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        return ""


_MAX_INLINE_IMAGES_REPORTED = 256
_EMAIL_ATTACHMENT_CONTENT_TYPES = frozenset({"application/eml", "message/global", "message/rfc822"})


def _mime_type(value):
    return str(value or "").split(";", 1)[0].strip().casefold()


def _content_disposition(value):
    return str(value or "").split(";", 1)[0].strip().casefold()


def _is_inline_image_part(element):
    """Return whether a Zimbra MIME image part is body-embedded content.

    Zimbra exposes the MIME Content-Disposition, Content-ID, and
    Content-Location values as ``cd``, ``ci``, and ``cl``.  An explicit
    ``attachment`` disposition wins over the embedded-image hints because a
    sender can attach an image while also assigning it a content ID.
    """
    if not _mime_type(element.get("ct")).startswith("image/"):
        return False
    disposition = _content_disposition(element.get("cd"))
    if disposition == "attachment":
        return False
    return disposition == "inline" or bool(str(element.get("ci", "")).strip()) or bool(
        str(element.get("cl", "")).strip()
    )


def _is_attached_email_part(element):
    return _mime_type(element.get("ct")) in _EMAIL_ATTACHMENT_CONTENT_TYPES


def _attachment_filename(element):
    filename = str(element.get("filename", "")).strip()
    if filename:
        return filename
    if _is_attached_email_part(element):
        part = str(element.get("part", "")).strip().replace(".", "-") or "part"
        return f"attachment-{part}.eml"
    return ""


def zimbra_search_messages(host, token, query, limit=25, offset=0, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    """Search once and normalize the summary metadata returned by Zimbra."""
    query = str(query or "").strip()
    # Zimbra uses is:anywhere for all mail; in:anywhere is parsed as a folder
    # path by some servers (including the configured deployment).
    if not query or query.casefold() == "in:anywhere":
        query = "is:anywhere"
    query = html.escape(query)
    limit = max(1, min(int(limit), 100))
    offset = max(0, int(offset))
    root = soap_request(
        host,
        f"""<SearchRequest xmlns="urn:zimbraMail" types="message" sortBy="dateDesc" limit="{limit}" offset="{offset}">
  <query>{query}</query>
</SearchRequest>""",
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )
    messages = []
    for msg in root.iter():
        if _local_name(msg.tag) != "m" or not msg.get("id"):
            continue
        subject = next((elem.text or "" for elem in msg if _local_name(elem.tag) == "su"), "")
        fragment = next((elem.text or "" for elem in msg if _local_name(elem.tag) == "fr"), "")
        addresses = [
            {"type": elem.get("t", ""), "email": elem.get("a", "")}
            for elem in msg if _local_name(elem.tag) == "e" and elem.get("a")
        ]
        messages.append({
            "id": msg.get("id", ""),
            "subject": subject,
            "from": next((item["email"] for item in addresses if item["type"] == "f"), ""),
            "to": [item["email"] for item in addresses if item["type"] == "t"],
            "cc": [item["email"] for item in addresses if item["type"] == "c"],
            "date": _message_date(msg.get("d")),
            "folder_id": msg.get("l", ""),
            "flags": msg.get("f", ""),
            "size": int(msg.get("s", "0") or 0),
            "fragment": fragment,
        })
    return messages


def zimbra_get_message(host, token, message_id, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    root = soap_request(
        host,
        f'<GetMsgRequest xmlns="urn:zimbraMail"><m id="{html.escape(message_id)}" html="0" needExp="1"/></GetMsgRequest>',
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )
    msg = next((elem for elem in root.iter() if _local_name(elem.tag) == "m" and elem.get("id") == message_id), None)
    if msg is None:
        return None

    subject_elem = next((elem for elem in msg.iter() if _local_name(elem.tag) == "su"), None)
    addresses = []
    attachments = []
    plain_parts = []
    html_parts = []
    inline_images_skipped = 0
    for elem in msg.iter():
        name = _local_name(elem.tag)
        if name == "e":
            addresses.append({"type": elem.get("t", ""), "email": elem.get("a", "")})
        elif name == "mp":
            if _is_inline_image_part(elem):
                inline_images_skipped = min(inline_images_skipped + 1, _MAX_INLINE_IMAGES_REPORTED)
                continue
            if (
                elem.get("filename")
                or _content_disposition(elem.get("cd")) == "attachment"
                or _is_attached_email_part(elem)
            ):
                attachments.append(
                    {
                        "filename": _attachment_filename(elem),
                        "part": elem.get("part", ""),
                        "content_type": elem.get("ct", ""),
                        "size": int(elem.get("s", "0") or 0),
                    }
                )
            content = next((child for child in elem if _local_name(child.tag) == "content"), None)
            if content is not None:
                text = "".join(content.itertext()).strip()
                if elem.get("ct") == "text/plain" and text:
                    plain_parts.append(text)
                elif elem.get("ct") == "text/html" and text:
                    html_parts.append(text)

    return {
        "id": message_id,
        "subject": (subject_elem.text if subject_elem is not None else "") or "",
        "from": next((a["email"] for a in addresses if a["type"] == "f"), ""),
        "to": [a["email"] for a in addresses if a["type"] == "t"],
        "cc": [a["email"] for a in addresses if a["type"] == "c"],
        "date": _message_date(msg.get("d")),
        "folder_id": msg.get("l", ""),
        "flags": msg.get("f", ""),
        "size": int(msg.get("s", "0") or 0),
        "body": "\n\n".join(plain_parts) or "\n\n".join(html_parts),
        "body_type": "text/plain" if plain_parts else ("text/html" if html_parts else ""),
        "attachments": attachments,
        "inline_images_skipped": inline_images_skipped,
    }


def zimbra_get_message_headers(host, token, message_id, names, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    """Retrieve selected raw message headers without returning the message body."""
    requested = [str(name).strip() for name in names if str(name).strip()]
    header_xml = "".join(f'<header n="{html.escape(name)}"/>' for name in requested)
    root = soap_request(
        host,
        (
            '<GetMsgRequest xmlns="urn:zimbraMail">'
            f'<m id="{html.escape(message_id)}" html="0" needExp="0" max="0">{header_xml}</m>'
            '</GetMsgRequest>'
        ),
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )
    msg = next((elem for elem in root.iter() if _local_name(elem.tag) == "m" and elem.get("id") == message_id), None)
    if msg is None:
        return None
    headers = {name: [] for name in requested}
    canonical = {name.casefold(): name for name in requested}
    for element in msg.iter():
        if _local_name(element.tag) != "header":
            continue
        name = canonical.get(str(element.get("n", "")).casefold())
        if name:
            headers[name].append(element.text or "")
    return {"message_id": message_id, "headers": headers}


def zimbra_list_folders(host, token, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    root = soap_request(
        host,
        '<GetFolderRequest xmlns="urn:zimbraMail" visible="1"/>',
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )
    folders = []
    for elem in root.iter():
        if _local_name(elem.tag) != "folder" or not elem.get("id"):
            continue
        folders.append(
            {
                "id": elem.get("id", ""),
                "name": elem.get("name", ""),
                "path": elem.get("absFolderPath", ""),
                "parent_id": elem.get("l", ""),
                "unread_count": int(elem.get("u", "0") or 0),
                "message_count": int(elem.get("n", "0") or 0),
            }
        )
    return folders


def zimbra_create_folder(host, token, name, parent_id, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    """Create one mailbox folder and return safe normalized folder metadata."""
    root = soap_request(
        host,
        (
            '<CreateFolderRequest xmlns="urn:zimbraMail">'
            f'<folder name="{html.escape(name)}" l="{html.escape(str(parent_id))}"/>'
            "</CreateFolderRequest>"
        ),
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )
    response = next((elem for elem in root.iter() if _local_name(elem.tag) == "CreateFolderResponse"), None)
    folder = next(
        (elem for elem in response.iter() if _local_name(elem.tag) == "folder"),
        None,
    ) if response is not None else None
    if folder is None or not folder.get("id"):
        raise ValueError("Malformed Zimbra folder response")
    return {
        "id": folder.get("id", ""),
        "name": folder.get("name", name),
        "path": folder.get("absFolderPath", ""),
        "parent_id": folder.get("l", str(parent_id)),
        "view": folder.get("view", ""),
    }


def zimbra_get_filter_rules(host, token, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    """Return the complete incoming filter-rule elements from Zimbra."""
    root = soap_request(
        host,
        '<GetFilterRulesRequest xmlns="urn:zimbraMail"/>',
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )
    response = next((elem for elem in root.iter() if _local_name(elem.tag) == "GetFilterRulesResponse"), None)
    if response is None:
        raise ValueError("Malformed Zimbra filter response")
    container = next((elem for elem in response if _local_name(elem.tag).lower() == "filterrules"), None)
    if container is None:
        raise ValueError("Malformed Zimbra filter response")
    rules = list(container)
    if any(_local_name(elem.tag).lower() != "filterrule" for elem in rules):
        raise ValueError("Malformed Zimbra filter response")
    for rule in rules:
        if not rule.get("name"):
            raise ValueError("Malformed Zimbra filter response")
        for child in rule:
            if _local_name(child.tag).lower() not in {"filtertests", "filteractions"}:
                raise ValueError("Malformed Zimbra filter response")
    return rules


def zimbra_modify_filter_rules(host, token, rules_xml, *, verify_ssl=True, timeout=60, allow_insecure_http=False):
    """Replace the complete incoming filter-rule set using typed XML from the filter service."""
    soap_request(
        host,
        f'<ModifyFilterRulesRequest xmlns="urn:zimbraMail">{rules_xml}</ModifyFilterRulesRequest>',
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    )


def download_attachment(cfg, token, message_id, part, max_bytes=None):
    options = _connection_options(cfg)
    client = _token_client(
        zimbra_host(cfg),
        token,
        email=zimbra_email(cfg) or zimbra_username(cfg),
        **options,
    )
    try:
        return client.download_attachment(message_id, part, max_bytes=max_bytes)
    except ZimbraLimitError as exc:
        raise ValueError("attachment_too_large") from exc
