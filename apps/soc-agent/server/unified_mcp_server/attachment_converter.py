"""Bounded, in-memory MarkItDown conversion shared by Zimbra and uploads."""

from __future__ import annotations

import hashlib
import io
import json
import threading
import zipfile
import xml.etree.ElementTree as ET
from collections import OrderedDict
from dataclasses import dataclass
from email import policy as email_policy
from email.errors import MessageParseError
from email.parser import BytesParser
from html import unescape
from html.parser import HTMLParser
from pathlib import PurePath
from typing import Any

from markitdown import (
    FileConversionException,
    MarkItDown,
    MissingDependencyException,
    StreamInfo,
    UnsupportedFormatException,
    __version__ as markitdown_version,
)

from .config import MarkItDownSettings
from .errors import ServiceError

MAX_ARCHIVE_MEMBERS = 1_000
MAX_ARCHIVE_EXPANDED_BYTES = 50_000_000
HARD_MAX_ATTACHMENT_BYTES = 100_000_000
HARD_MAX_MARKDOWN_CHARS = 2_000_000
ARCHIVE_EXTENSIONS = {
    ".docx", ".epub", ".odg", ".odp", ".ods", ".odt", ".pptx", ".xlsx", ".zip",
}
ARCHIVE_CONTENT_TYPES = {
    "application/epub+zip",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.presentation",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.text",
    "application/zip",
}
IMAGE_EXTENSIONS = {
    ".avif", ".bmp", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".tif", ".tiff", ".webp",
}
EMAIL_CONTENT_TYPES = {
    "application/eml",
    "message/global",
    "message/rfc822",
}
EMAIL_EXTENSIONS = {".eml", ".emlx"}


@dataclass(frozen=True)
class AttachmentConversionLimits:
    max_bytes: int = 10_000_000
    max_chars: int = 200_000


def create_markitdown(settings: MarkItDownSettings, markitdown_type: type[MarkItDown] = MarkItDown) -> MarkItDown:
    kwargs: dict[str, Any] = {
        "enable_builtins": True,
        "enable_plugins": settings.llm_enabled,
    }
    if settings.llm_enabled:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise ServiceError(
                "attachment_converter_unavailable",
                "The optional OCR/LLM converter is not installed.",
            ) from exc
        client_kwargs: dict[str, Any] = {
            "api_key": settings.llm_api_key,
            "timeout": settings.llm_timeout,
        }
        if settings.llm_base_url:
            client_kwargs["base_url"] = settings.llm_base_url
        kwargs["llm_client"] = OpenAI(**client_kwargs)
        kwargs["llm_model"] = settings.llm_model
    return markitdown_type(**kwargs)


def _create_builtin_markitdown(markitdown_type: type[MarkItDown] = MarkItDown) -> MarkItDown:
    """Create the always-available, non-LLM MarkItDown converter."""
    return markitdown_type(enable_builtins=True, enable_plugins=False)


def _is_image_attachment(filename: str, content_type: str) -> bool:
    return content_type.startswith("image/") or PurePath(filename).suffix.lower() in IMAGE_EXTENSIONS


def _is_email_attachment(filename: str, content_type: str) -> bool:
    return content_type in EMAIL_CONTENT_TYPES or PurePath(filename).suffix.lower() in EMAIL_EXTENSIONS


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
            self.parts.append(unescape(data))


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
    for part in message.walk():
        if part.is_multipart() or part.get_content_disposition() == "attachment":
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


class AttachmentConverter:
    """Convert attachments to Markdown with a bounded cache of successes.

    Repeated reads of the same attachment (message re-inspection, session
    replay) previously re-ran the full conversion. Successful results are
    keyed by content hash plus converter identity and limits; failures are
    never cached so transient converter problems retry on the next request.
    """

    CACHE_MAX_ENTRIES = 64
    CACHE_MAX_BYTES = 4_000_000

    def __init__(self, settings: MarkItDownSettings, markitdown: MarkItDown | None = None, *, factory=None) -> None:
        self.settings = settings
        self.markitdown = markitdown
        self._factory = factory or create_markitdown
        self._using_builtin_fallback = False
        self._lock = threading.RLock()
        self._cache_bytes = 0
        self._cache: OrderedDict[tuple, dict[str, Any]] = OrderedDict()

    def _ensure_markitdown(self) -> None:
        if self.markitdown is not None:
            return
        try:
            self.markitdown = self._factory(self.settings)
        except ServiceError as exc:
            if exc.code != "attachment_converter_unavailable":
                raise
            self.markitdown = _create_builtin_markitdown()
            self._using_builtin_fallback = True
        except (ImportError, MissingDependencyException):
            self.markitdown = _create_builtin_markitdown()
            self._using_builtin_fallback = True

    def _convert_stream(self, data: bytes, filename: str, content_type: str, extension: str | None):
        stream_info = StreamInfo(
            filename=filename or None,
            mimetype=content_type or None,
            extension=extension,
        )
        self._ensure_markitdown()
        try:
            return self.markitdown.convert_stream(io.BytesIO(data), stream_info=stream_info)
        except MissingDependencyException:
            # An enabled optional plugin must not make ordinary text/document
            # attachments unreadable. Retry once with the built-in converter;
            # image conversion will be reported as unsupported if it produces
            # no text.
            if self._using_builtin_fallback or not self.settings.llm_enabled:
                raise
            self.markitdown = _create_builtin_markitdown()
            self._using_builtin_fallback = True
            return self.markitdown.convert_stream(io.BytesIO(data), stream_info=stream_info)

    def _cache_key(
        self,
        data: bytes,
        filename: str,
        content_type: str,
        max_bytes: int,
        max_chars: int,
    ) -> tuple:
        return (
            hashlib.sha256(data).hexdigest(),
            filename,
            content_type,
            max_bytes,
            max_chars,
            bool(self.settings.llm_enabled),
            markitdown_version,
        )

    def convert(self, data: bytes, filename: str, content_type: str, limits: AttachmentConversionLimits = AttachmentConversionLimits()) -> dict[str, Any]:
        # MarkItDown and the LRU are shared by concurrent mailbox reads. Keep
        # conversion atomic; different downloads may still run in parallel.
        with self._lock:
            result = self._convert(data, filename, content_type, AttachmentConversionLimits(
                max_bytes=limits.max_bytes, max_chars=HARD_MAX_MARKDOWN_CHARS,
            ))
            max_chars = min(max(1, limits.max_chars), HARD_MAX_MARKDOWN_CHARS)
            return {**result, "text": result["text"][:max_chars], "text_truncated": result["characters"] > max_chars}

    def _convert(
        self,
        data: bytes,
        filename: str,
        content_type: str,
        limits: AttachmentConversionLimits = AttachmentConversionLimits(),
    ) -> dict[str, Any]:
        content_type = str(content_type or "").split(";", 1)[0].strip().lower()
        raw_filename = str(filename or "").strip()
        if not raw_filename and content_type in EMAIL_CONTENT_TYPES:
            raw_filename = "attachment.eml"
        filename = _safe_filename(raw_filename)
        max_bytes = min(max(1, limits.max_bytes), HARD_MAX_ATTACHMENT_BYTES)
        max_chars = min(max(1, limits.max_chars), HARD_MAX_MARKDOWN_CHARS)
        key = self._cache_key(data, filename, content_type, max_bytes, max_chars)
        cached = self._cache.get(key)
        if cached is not None:
            self._cache.move_to_end(key)
            return cached
        if len(data) > max_bytes:
            raise ServiceError("attachment_too_large", "The attachment exceeds the configured byte limit.")
        _validate_archive_safety(data, filename, content_type)
        extension = PurePath(filename).suffix.lower() or None
        _validate_structured_text(data, filename, content_type)
        if content_type == "application/octet-stream" and extension in {None, ".bin"}:
            raise ServiceError("attachment_unsupported", "This attachment type cannot be converted to Markdown.")
        converter_name = "markitdown"
        title = None
        try:
            if _is_email_attachment(filename, content_type):
                markdown, title = _convert_rfc822(data)
                converter_name = "email-rfc822"
            else:
                result = self._convert_stream(data, filename, content_type, extension)
                markdown = str(result.markdown or "")
                title = result.title
        except UnsupportedFormatException as exc:
            raise ServiceError("attachment_unsupported", "This attachment type cannot be converted to Markdown.") from exc
        except MissingDependencyException as exc:
            raise ServiceError(
                "attachment_converter_unavailable",
                "The converter dependency for this attachment type is not installed.",
            ) from exc
        except FileConversionException as exc:
            conversion_error = str(exc).lower()
            if any(marker in conversion_error for marker in ("encrypt", "password", "pdfpassword")):
                raise ServiceError("attachment_encrypted", "Encrypted attachments are not supported.") from exc
            raise ServiceError("attachment_malformed", "The attachment could not be converted to Markdown.") from exc
        except ServiceError:
            raise
        except Exception as exc:
            raise ServiceError(
                "attachment_conversion_failed",
                "The attachment conversion failed.",
                details={"exception_type": type(exc).__name__},
            ) from exc
        if _is_image_attachment(filename, content_type) and not markdown.strip():
            raise ServiceError("attachment_unsupported", "No readable text was found in the image attachment.")
        converted = {
            "filename": filename,
            "content_type": content_type,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "characters": len(markdown),
            "text_truncated": len(markdown) > max_chars,
            "text": markdown[:max_chars],
            "title": title,
            "format": {"content_type": content_type, "extension": extension or ""},
            "converter": {"name": converter_name, "version": markitdown_version if converter_name == "markitdown" else "stdlib"},
            "llm_enabled": self.settings.llm_enabled,
        }
        size = len(json.dumps(converted, ensure_ascii=True).encode())
        if size <= self.CACHE_MAX_BYTES:
            self._cache[key] = converted
            self._cache_bytes += size
            while len(self._cache) > self.CACHE_MAX_ENTRIES or self._cache_bytes > self.CACHE_MAX_BYTES:
                _, dropped = self._cache.popitem(last=False)
                self._cache_bytes -= len(json.dumps(dropped, ensure_ascii=True).encode())
        return converted


def _safe_filename(filename: str) -> str:
    value = str(filename).strip()
    if not value or len(value) > 255 or "\x00" in value or PurePath(value).name != value:
        raise ServiceError("attachment_invalid_filename", "The attachment filename is invalid.")
    return value


def _validate_archive_safety(data: bytes, filename: str, content_type: str) -> None:
    extension = PurePath(filename).suffix.lower()
    if extension not in ARCHIVE_EXTENSIONS and content_type not in ARCHIVE_CONTENT_TYPES:
        return
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise ServiceError("attachment_malformed", "The archive-based attachment could not be parsed.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = archive.infolist()
            if len(members) > MAX_ARCHIVE_MEMBERS:
                raise ServiceError("attachment_too_complex", "The attachment contains too many archive members.")
            if any(member.flag_bits & 0x1 for member in members):
                raise ServiceError("attachment_encrypted", "Encrypted archive attachments are not supported.")
            if sum(member.file_size for member in members) > MAX_ARCHIVE_EXPANDED_BYTES:
                raise ServiceError("attachment_too_complex", "The attachment exceeds the safe expansion limit.")
    except ServiceError:
        raise
    except (OSError, RuntimeError, zipfile.BadZipFile) as exc:
        raise ServiceError("attachment_malformed", "The archive-based attachment could not be parsed.") from exc


def _validate_structured_text(data: bytes, filename: str, content_type: str) -> None:
    extension = PurePath(filename).suffix.lower()
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        if content_type.startswith("text/") or extension in {".csv", ".html", ".htm", ".json", ".log", ".txt", ".xml"}:
            raise ServiceError("attachment_malformed", "The text attachment is not valid UTF-8.") from exc
        return
    if content_type == "application/json" or extension == ".json":
        try:
            json.loads(text)
        except json.JSONDecodeError as exc:
            raise ServiceError("attachment_malformed", "The JSON attachment could not be parsed.") from exc
    if content_type in {"application/xml", "text/xml"} or extension == ".xml":
        try:
            ET.fromstring(text)
        except ET.ParseError as exc:
            raise ServiceError("attachment_malformed", "The XML attachment could not be parsed.") from exc
