"""Read local text and MIME email bodies without resolving external resources."""

from email import policy as email_policy
from email.errors import MessageParseError
from email.parser import BytesParser
from html.parser import HTMLParser

from .errors import ServiceError


class _EmailHTMLText(HTMLParser):
    """Extract text from an email HTML body without resolving any URLs."""

    _BLOCK_TAGS = {
        "address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt",
        "h1", "h2", "h3", "h4", "h5", "h6", "header", "li", "main", "ol", "p",
        "pre", "section", "table", "td", "th", "tr", "ul",
    }
    _SKIP_TAGS = {"script", "style", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.casefold()
        if tag in self._SKIP_TAGS:
            self._skip_depth += 1
        elif self._skip_depth == 0 and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_startendtag(self, tag: str, attrs) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in self._SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self.parts.append(data)


def _email_html_to_text(value: str) -> str:
    parser = _EmailHTMLText()
    parser.feed(value)
    parser.close()
    lines = [line.strip() for line in "".join(parser.parts).splitlines()]
    return "\n".join(line for line in lines if line).strip()


def _email_part_text(part) -> str:
    try:
        value = part.get_content()
    except (AttributeError, LookupError, UnicodeError):
        payload = part.get_payload(decode=True)
        if payload is None:
            value = part.get_payload()
        else:
            charset = part.get_content_charset() or "utf-8"
            try:
                value = payload.decode(charset, errors="replace")
            except LookupError:
                value = payload.decode("utf-8", errors="replace")
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    return str(value or "")


def _convert_rfc822(data: bytes) -> tuple[str, str]:
    """Read an attached email's text parts without processing embedded media."""
    try:
        message = BytesParser(policy=email_policy.default).parsebytes(data)
    except (MessageParseError, TypeError, ValueError) as exc:
        raise ServiceError("attachment_malformed", "The attached email could not be parsed.") from exc

    plain_parts: list[str] = []
    html_parts: list[str] = []
    pending = [message]
    while pending:
        part = pending.pop()
        if part.get_content_disposition() == "attachment":
            continue
        if part.is_multipart():
            pending.extend(reversed(list(part.iter_parts())))
            continue
        content_type = str(part.get_content_type() or "").casefold()
        if content_type == "text/plain":
            text = _email_part_text(part).strip()
            if text:
                plain_parts.append(text)
        elif content_type == "text/html":
            text = _email_html_to_text(_email_part_text(part))
            if text:
                html_parts.append(text)

    text = "\n\n".join(plain_parts) or "\n\n".join(html_parts)
    if not text.strip():
        raise ServiceError("attachment_unsupported", "No readable text was found in the attached email.")
    return text, str(message.get("Subject", "") or "").strip()


