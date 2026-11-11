"""Local attachment validation, shared by document and spreadsheet readers."""

import io
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import PurePath

from .errors import ServiceError

MAX_ARCHIVE_MEMBERS = 1_000
MAX_ARCHIVE_EXPANDED_BYTES = 50_000_000
HARD_MAX_ATTACHMENT_BYTES = 100_000_000
ARCHIVE_EXTENSIONS = {
    ".docx", ".docm", ".epub", ".odg", ".odp", ".ods", ".odt", ".pptx", ".pptm",
    ".ppsx", ".ppsm", ".xlsx", ".xlsm", ".xlsb", ".zip",
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
