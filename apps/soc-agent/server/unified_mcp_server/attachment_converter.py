"""Bounded, in-memory MarkItDown conversion shared by Zimbra and uploads."""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
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


class AttachmentConverter:
    def __init__(self, settings: MarkItDownSettings, markitdown: MarkItDown | None = None) -> None:
        self.settings = settings
        self.markitdown = markitdown or create_markitdown(settings)

    def convert(
        self,
        data: bytes,
        filename: str,
        content_type: str,
        limits: AttachmentConversionLimits = AttachmentConversionLimits(),
    ) -> dict[str, Any]:
        filename = _safe_filename(filename)
        content_type = content_type.split(";", 1)[0].strip().lower()
        max_bytes = min(max(1, limits.max_bytes), HARD_MAX_ATTACHMENT_BYTES)
        max_chars = min(max(1, limits.max_chars), HARD_MAX_MARKDOWN_CHARS)
        if len(data) > max_bytes:
            raise ServiceError("attachment_too_large", "The attachment exceeds the configured byte limit.")
        _validate_archive_safety(data, filename, content_type)
        extension = PurePath(filename).suffix.lower() or None
        _validate_structured_text(data, filename, content_type)
        if content_type == "application/octet-stream" and extension in {None, ".bin"}:
            raise ServiceError("attachment_unsupported", "This attachment type cannot be converted to Markdown.")
        try:
            result = self.markitdown.convert_stream(
                io.BytesIO(data),
                stream_info=StreamInfo(
                    filename=filename or None,
                    mimetype=content_type or None,
                    extension=extension,
                ),
            )
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
        markdown = result.markdown
        return {
            "filename": filename,
            "content_type": content_type,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "characters": len(markdown),
            "text_truncated": len(markdown) > max_chars,
            "text": markdown[:max_chars],
            "title": result.title,
            "format": {"content_type": content_type, "extension": extension or ""},
            "converter": {"name": "markitdown", "version": markitdown_version},
            "llm_enabled": self.settings.llm_enabled,
        }


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
