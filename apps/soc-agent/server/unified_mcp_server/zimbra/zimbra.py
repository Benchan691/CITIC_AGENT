import html
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import urlsplit

from zimbra_client import ZimbraClient
from zimbra_client.errors import ZimbraLimitError
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


def zimbra_login(cfg):
    require_zimbra_config(cfg)
    config = dict(cfg)
    config["zimbra_host"] = _validate_zimbra_host(
        zimbra_host(config),
        allow_insecure_http=_as_bool(config.get("allow_insecure_http"), False),
    )
    config["verify_ssl"] = _as_bool(config.get("verify_ssl"), True)
    config["allow_insecure_http"] = _as_bool(config.get("allow_insecure_http"), False)
    config["timeout"] = remaining_seconds(float(config.get("timeout", 60)))
    client = ZimbraClient(config).login()
    token = getattr(client, "_auth_token", "")
    if not token:
        raise RuntimeError("Zimbra login failed: auth token not found")
    return token


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
    body_format="text",
    verify_ssl=True,
    timeout=60,
    allow_insecure_http=False,
):
    body_format = str(body_format).strip().lower()
    if body_format not in {"text", "html"}:
        raise ValueError("body_format must be text or html")
    kwargs = {"text": str(body)} if body_format == "text" else {"html": str(body)}
    result = _token_client(
        host, token, verify_ssl=verify_ssl, timeout=timeout,
        allow_insecure_http=allow_insecure_http,
    ).send_message(
        to=recipients,
        cc=cc,
        bcc=bcc,
        subject=str(subject),
        **kwargs,
    )
    return {"message_id": result.message_id}


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
    for elem in msg.iter():
        name = _local_name(elem.tag)
        if name == "e":
            addresses.append({"type": elem.get("t", ""), "email": elem.get("a", "")})
        elif name == "mp" and (elem.get("filename") or elem.get("cd") == "attachment"):
            attachments.append(
                {
                    "filename": elem.get("filename", ""),
                    "part": elem.get("part", ""),
                    "content_type": elem.get("ct", ""),
                    "size": int(elem.get("s", "0") or 0),
                }
            )
        elif name == "mp":
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
