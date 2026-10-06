"""Sanitize completed report sections and news using the existing HTML rules."""

import html
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

from .monthly_report_editor import _normalise_heading

TABLE_ATTRIBUTES = {"border": "1", "cellpadding": "4", "cellspacing": "0", "width": "100%"}


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.parts)).strip()


class _NewsHTMLSanitizer(HTMLParser):
    _allowed_tags = {
        "p", "br", "b", "strong", "em", "ul", "ol", "li", "h1", "h2", "h3",
        "div", "span", "table", "thead", "tbody", "tr", "th", "td", "a",
    }
    _ignored_tags = {"head", "style", "script", "title", "meta", "link"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.casefold()
        if tag in {"meta", "link"}:
            return
        if self._ignored_depth:
            if tag in self._ignored_tags:
                self._ignored_depth += 1
            return
        if tag in self._ignored_tags:
            self._ignored_depth = 1
            return
        if tag not in self._allowed_tags or tag in {"html", "body"}:
            return
        if tag == "br":
            self.parts.append("<br/>")
            return
        if tag == "a":
            href = next((value for name, value in attrs if name.casefold() == "href"), None)
            if href and re.match(r"https?://", href.strip(), re.IGNORECASE):
                self.parts.append(f'<a href="{html.escape(href.strip(), quote=True)}">')
            else:
                self.parts.append("<a>")
            return
        self.parts.append(f"<{tag}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.casefold()
        if tag in {"meta", "link"}:
            return
        if self._ignored_depth:
            if tag in self._ignored_tags:
                self._ignored_depth -= 1
            return
        if tag in self._allowed_tags and tag not in {"br", "html", "body"}:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self.parts.append(html.escape(data, quote=False))

    def fragment(self) -> str:
        return "".join(self.parts).strip()


class _HTMLInputSanitizer(_NewsHTMLSanitizer):
    _allowed_tags = _NewsHTMLSanitizer._allowed_tags | {
        "h4", "h5", "h6", "u", "pre", "code", "blockquote", "hr",
    }
    _ignored_tags = _NewsHTMLSanitizer._ignored_tags | {
        "embed", "form", "iframe", "object", "svg", "math",
    }

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() == "hr" and not self._ignored_depth:
            self.parts.append("<hr/>")
        else:
            super().handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() != "hr":
            super().handle_endtag(tag)


def sanitize_html_input(source: str) -> str:
    """Sanitize a supplied HTML fragment or document for dashboard XML."""
    if not isinstance(source, str) or not source.strip():
        raise ValueError("HTML input is empty.")
    sanitizer = _HTMLInputSanitizer()
    sanitizer.feed(source)
    sanitizer.close()
    try:
        root = ET.fromstring(f"<root>{sanitizer.fragment()}</root>")
    except ET.ParseError as error:
        raise ValueError("HTML input contains malformed or unbalanced markup.") from error
    if not "".join(root.itertext()).strip():
        raise ValueError("HTML input has no readable content.")
    for parent in root.iter():
        for child in list(parent):
            if child.tag.casefold() != "h1":
                continue
            heading = _normalise_heading("".join(child.itertext()))
            if heading in {"executive summary", "security analysis"}:
                tail = child.tail or ""
                index = list(parent).index(child)
                if tail:
                    if index:
                        previous = list(parent)[index - 1]
                        previous.tail = (previous.tail or "") + tail
                    else:
                        parent.text = (parent.text or "") + tail
                parent.remove(child)
    for element in root.iter():
        if element.tag in {"table", "th", "td"}:
            element.attrib.update(TABLE_ATTRIBUTES if element.tag == "table" else {"border": "1"})
    return html.escape(root.text or "", quote=False) + "".join(ET.tostring(child, encoding="unicode") for child in root)


def _html_to_text(value: str) -> str:
    parser = _HTMLTextExtractor()
    parser.feed(value)
    parser.close()
    return parser.text()


def sanitize_security_news(html_body: str, plain_body: str = "") -> str:
    """Reuse the established email-to-safe-article conversion without account access."""
    source = html.unescape(html_body or "")
    body_match = re.search(r"<body(?:\s[^>]*)?>(.*?)</body>", source, re.IGNORECASE | re.DOTALL)
    if body_match:
        source = body_match.group(1)
    else:
        html_match = re.search(r"<html(?:\s[^>]*)?>(.*?)</html>", source, re.IGNORECASE | re.DOTALL)
        if html_match:
            source = html_match.group(1)
    source = re.sub(r"<table\b[^>]*>.*?CAUTION:.*?</table>", "", source, count=1, flags=re.IGNORECASE | re.DOTALL)
    sanitizer = _NewsHTMLSanitizer()
    sanitizer.feed(source)
    sanitizer.close()
    fragment = sanitizer.fragment()
    if not fragment:
        text = _html_to_text(plain_body or html_body)
        fragment = f"<p>{html.escape(text)}</p>" if text else ""
    return fragment
