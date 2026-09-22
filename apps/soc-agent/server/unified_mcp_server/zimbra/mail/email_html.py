"""Small, dependency-free sanitizer for outbound HTML email bodies."""

from __future__ import annotations

import re
from html import escape
from html.parser import HTMLParser


_SAFE_TAGS = frozenset({
    "a", "article", "aside", "blockquote", "br", "caption", "code", "col", "colgroup",
    "div", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
    "body", "head", "header", "hr", "html", "i", "li", "main", "ol", "p", "pre", "section",
    "small", "span", "strong", "style", "table", "tbody", "td", "tfoot", "th", "thead",
    "title", "tr", "u", "ul",
})
_DROP_TAGS = frozenset({
    "applet", "audio", "base", "embed", "form", "iframe", "img", "input", "link", "math",
    "meta", "object", "script", "select", "source", "svg", "textarea", "track", "video",
})
_VOID_DROP_TAGS = frozenset({"base", "embed", "img", "input", "link", "meta", "source", "track"})
_SAFE_ATTRIBUTES = frozenset({
    "align", "aria-hidden", "aria-label", "class", "colspan", "id", "lang", "name", "role",
    "rowspan", "style", "title", "valign", "width",
})
_SAFE_CSS_PROPERTIES = frozenset({
    "background", "background-color", "border", "border-collapse", "border-radius", "border-spacing",
    "color", "display", "font-family", "font-size", "font-style", "font-weight", "height",
    "line-height", "margin", "margin-bottom", "margin-left", "margin-right", "margin-top",
    "max-width", "min-width", "padding", "padding-bottom", "padding-left", "padding-right",
    "padding-top", "text-align", "text-decoration", "vertical-align", "white-space", "width",
})
_MALICIOUS_CSS = re.compile(
    r"url\s*\(|expression\s*\(|(?:javascript|vbscript|data):|@import|-moz-binding|behavior\s*:",
    re.IGNORECASE,
)


def _safe_url(value: str) -> bool:
    candidate = value.strip().casefold()
    if not candidate or candidate.startswith(("#", "/", "./", "../")):
        return True
    return candidate.startswith(("https:", "mailto:"))


def _safe_css_declarations(value: str) -> str:
    safe: list[str] = []
    for declaration in value.split(";"):
        property_name, separator, css_value = declaration.partition(":")
        if not separator:
            continue
        property_name = property_name.strip().casefold()
        css_value = css_value.strip()
        if property_name not in _SAFE_CSS_PROPERTIES or _MALICIOUS_CSS.search(css_value):
            continue
        safe.append(f"{property_name}: {css_value}")
    return "; ".join(safe)


def _safe_css_text(value: str) -> str:
    value = re.sub(r"/\*[\s\S]*?\*/", "", value)
    value = re.sub(r"@(?:import|font-face|namespace|supports|keyframes)[\s\S]*?(?:;|\{[\s\S]*?\})", "", value, flags=re.IGNORECASE)

    def replace_block(match: re.Match[str]) -> str:
        selector, declarations = match.group(1), match.group(2)
        if _MALICIOUS_CSS.search(selector) or any(char in selector for char in "@{}"):
            return ""
        safe_declarations = _safe_css_declarations(declarations)
        return f"{selector.strip()} {{ {safe_declarations}; }}" if safe_declarations else ""

    return re.sub(r"([^{}]+)\{([^{}]*)\}", replace_block, value)


class _EmailHtmlSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.parts: list[str] = []
        self.drop_depth = 0
        self.style_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.casefold()
        if self.drop_depth:
            self.drop_depth += 1
            return
        if tag in _DROP_TAGS:
            if tag not in _VOID_DROP_TAGS:
                self.drop_depth = 1
            return
        if tag not in _SAFE_TAGS:
            return
        rendered: list[str] = []
        for name, value in attrs:
            name = name.casefold()
            value = "" if value is None else value
            if name.startswith("on") or name in {"action", "formaction", "srcdoc", "srcset", "target"}:
                continue
            if name == "href":
                if _safe_url(value):
                    rendered.append(f'href="{escape(value, quote=True)}"')
                continue
            if name == "style":
                value = _safe_css_declarations(value)
                if not value:
                    continue
            elif name not in _SAFE_ATTRIBUTES:
                continue
            rendered.append(f'{name}="{escape(value, quote=True)}"')
        self.parts.append(f"<{tag}{(' ' + ' '.join(rendered)) if rendered else ''}>")
        if tag == "style":
            self.style_depth += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized = tag.casefold()
        if self.drop_depth or normalized in _DROP_TAGS:
            return
        self.handle_starttag(normalized, attrs)
        if normalized == "style" and self.style_depth:
            self.handle_endtag(normalized)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.casefold()
        if self.drop_depth:
            self.drop_depth -= 1
            return
        if tag not in _SAFE_TAGS:
            return
        if tag == "style" and self.style_depth:
            self.style_depth -= 1
        if tag not in {"br", "col", "hr"}:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self.drop_depth:
            return
        self.parts.append(_safe_css_text(data) if self.style_depth else escape(data, quote=False))

    def handle_entityref(self, name: str) -> None:
        if not self.drop_depth:
            self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if not self.drop_depth:
            self.parts.append(f"&#{name};")

    def handle_comment(self, _data: str) -> None:
        return

    def handle_decl(self, _decl: str) -> None:
        return


def sanitize_email_html(value: str) -> str:
    """Return an HTML fragment without scripts, embeds, unsafe URLs, or CSS."""
    parser = _EmailHtmlSanitizer()
    parser.feed(str(value or ""))
    parser.close()
    return "".join(parser.parts)
