import html
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone


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


def _local_name(tag):
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _as_bool(value, default=True):
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _connection_options(cfg):
    return {
        "verify_ssl": _as_bool(cfg.get("verify_ssl"), True),
        "timeout": int(cfg.get("timeout", 60)),
    }


def _zimbra_url(host, path):
    base = str(host or "").strip().rstrip("/")
    if not base.startswith(("https://", "http://")):
        base = f"https://{base}"
    return f"{base}{path}"


def _ssl_context(verify_ssl):
    return None if verify_ssl else ssl._create_unverified_context()


def soap_request(host, body_xml, auth_token="", *, verify_ssl=True, timeout=60):
    header = f"<authToken>{html.escape(auth_token)}</authToken>" if auth_token else ""
    envelope = f"""<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header><context xmlns="urn:zimbra">{header}</context></soap:Header>
  <soap:Body>{body_xml}</soap:Body>
</soap:Envelope>
"""
    request = urllib.request.Request(
        _zimbra_url(host, "/service/soap"),
        data=envelope.encode("utf-8"),
        headers={"Content-Type": "application/soap+xml; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(
            request,
            timeout=timeout,
            context=_ssl_context(verify_ssl),
        ) as response:
            root = ET.fromstring(response.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"Zimbra SOAP request failed ({exc.code}): {detail or exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Zimbra connection failed: {exc.reason}") from exc

    fault = next((elem for elem in root.iter() if _local_name(elem.tag) == "Fault"), None)
    if fault is not None:
        reason = " ".join(text.strip() for text in fault.itertext() if text.strip())
        raise RuntimeError(f"Zimbra SOAP fault: {reason or 'unknown fault'}")
    return root


def zimbra_login(cfg):
    host = zimbra_host(cfg)
    account = html.escape(zimbra_username(cfg) or zimbra_email(cfg))
    password = html.escape(zimbra_password(cfg))
    root = soap_request(
        host,
        f"""<AuthRequest xmlns="urn:zimbraAccount">
  <account by="name">{account}</account>
  <password>{password}</password>
</AuthRequest>""",
        **_connection_options(cfg),
    )
    token = next((elem.text for elem in root.iter() if _local_name(elem.tag) == "authToken"), "")
    if not token:
        raise RuntimeError("Zimbra login failed: auth token not found")
    return token


def upload_attachment(
    host,
    token,
    filename,
    data,
    content_type="application/octet-stream",
    *,
    verify_ssl=True,
    timeout=120,
):
    boundary = "----codex-zimbra-upload"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8") + data + f"\r\n--{boundary}--\r\n".encode("utf-8")
    request = urllib.request.Request(
        _zimbra_url(host, "/service/upload?fmt=raw"),
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Cookie": f"ZM_AUTH_TOKEN={token}",
        },
    )
    with urllib.request.urlopen(
        request,
        timeout=timeout,
        context=_ssl_context(verify_ssl),
    ) as response:
        text = response.read().decode("utf-8", errors="replace")
    match = re.search(r'["\']?aid["\']?\s*[:=]\s*["\']([^"\']+)["\']', text)
    if match:
        return match.group(1)
    quoted = re.findall(r"'([^']+)'", text)
    if len(quoted) >= 2:
        return quoted[-1]
    raise RuntimeError(f"Zimbra upload failed: attachment id not found in response {text[:300]}")


def zimbra_move_message(host, token, message_id, folder_id, *, verify_ssl=True, timeout=60):
    soap_request(
        host,
        (
            f'<MsgActionRequest xmlns="urn:zimbraMail">'
            f'<action id="{html.escape(message_id)}" op="move" l="{html.escape(str(folder_id))}"/>'
            f"</MsgActionRequest>"
        ),
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
    )


def zimbra_send_email(cfg, to, subject, body, attachments=None, folder_id=None):
    require_zimbra_config(cfg)
    host = zimbra_host(cfg)
    token = zimbra_login(cfg)
    options = _connection_options(cfg)
    attach_ids = []
    for item in attachments or []:
        attach_ids.append(
            upload_attachment(
                host,
                token,
                item["filename"],
                item["data"],
                item.get("content_type", "application/octet-stream"),
                **options,
            )
        )

    attach_xml = "".join(f'<attach aid="{html.escape(aid)}"/>' for aid in attach_ids)
    subject_text = str(subject or "").strip()
    if isinstance(to, (list, tuple, set)):
        recipients = [str(addr).strip() for addr in to if str(addr).strip()]
    else:
        recipients = [part.strip() for part in str(to or "").split(",") if part.strip()]
    if not recipients:
        raise ValueError("Missing email recipient")
    to_xml = "".join(f'<e t="t" a="{html.escape(addr)}"/>' for addr in recipients)
    soap_request(
        host,
        f"""<SendMsgRequest xmlns="urn:zimbraMail">
  <m>
    {to_xml}
    <su>{html.escape(subject_text)}</su>
    <mp ct="text/plain"><content>{html.escape(str(body or ""))}</content></mp>
    {attach_xml}
  </m>
</SendMsgRequest>""",
        token,
        **options,
    )

    dest = str(folder_id or "").strip()
    if not dest or dest == "2":
        return

    # Self-transfer mail lands in Inbox; move it into the configured receive folder.
    for attempt in range(8):
        for message_id in zimbra_search(host, token, "2", 20, **options):
            message = zimbra_get_message(host, token, message_id, **options)
            if message and (message.get("subject") or "").strip() == subject_text:
                zimbra_move_message(host, token, message_id, dest, **options)
                return
        time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"Transfer sent but message not found in Inbox to move to folder {dest}")


def zimbra_search_query(host, token, query, limit=25, offset=0, *, verify_ssl=True, timeout=60):
    query = html.escape(str(query or "").strip() or "in:anywhere")
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
    )
    return [elem.get("id", "") for elem in root.iter() if _local_name(elem.tag) == "m" and elem.get("id")]


def zimbra_search(host, token, folder_id, limit, *, verify_ssl=True, timeout=60):
    return zimbra_search_query(
        host,
        token,
        f"inid:{folder_id}",
        limit,
        verify_ssl=verify_ssl,
        timeout=timeout,
    )


def zimbra_get_message(host, token, message_id, *, verify_ssl=True, timeout=60):
    root = soap_request(
        host,
        f'<GetMsgRequest xmlns="urn:zimbraMail"><m id="{html.escape(message_id)}" html="0" needExp="1"/></GetMsgRequest>',
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
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

    date_ms = msg.get("d")
    date = ""
    if date_ms:
        try:
            date = datetime.fromtimestamp(int(date_ms) / 1000, tz=timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            date = ""

    return {
        "id": message_id,
        "subject": (subject_elem.text if subject_elem is not None else "") or "",
        "from": next((a["email"] for a in addresses if a["type"] == "f"), ""),
        "to": [a["email"] for a in addresses if a["type"] == "t"],
        "cc": [a["email"] for a in addresses if a["type"] == "c"],
        "date": date,
        "folder_id": msg.get("l", ""),
        "flags": msg.get("f", ""),
        "size": int(msg.get("s", "0") or 0),
        "body": "\n\n".join(plain_parts) or "\n\n".join(html_parts),
        "body_type": "text/plain" if plain_parts else ("text/html" if html_parts else ""),
        "attachments": attachments,
    }


def zimbra_list_folders(host, token, *, verify_ssl=True, timeout=60):
    root = soap_request(
        host,
        '<GetFolderRequest xmlns="urn:zimbraMail" visible="1"/>',
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
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


def download_attachment(cfg, token, message_id, part):
    host = zimbra_host(cfg)
    account = urllib.parse.quote(zimbra_email(cfg), safe="")
    query = urllib.parse.urlencode({"id": message_id, "part": part})
    request = urllib.request.Request(
        _zimbra_url(host, f"/home/{account}/?{query}"),
        headers={"Cookie": f"ZM_AUTH_TOKEN={token}"},
    )
    options = _connection_options(cfg)
    with urllib.request.urlopen(
        request,
        timeout=max(120, options["timeout"]),
        context=_ssl_context(options["verify_ssl"]),
    ) as response:
        return response.read()


def zimbra_delete_message(host, token, message_id, *, verify_ssl=True, timeout=60):
    soap_request(
        host,
        f'<MsgActionRequest xmlns="urn:zimbraMail"><action id="{html.escape(message_id)}" op="delete"/></MsgActionRequest>',
        token,
        verify_ssl=verify_ssl,
        timeout=timeout,
    )
