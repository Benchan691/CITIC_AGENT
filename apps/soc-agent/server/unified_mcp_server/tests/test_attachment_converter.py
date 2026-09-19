import pytest

import unified_mcp_server.attachment_converter as module
from unified_mcp_server.attachment_converter import AttachmentConverter
from unified_mcp_server.config import MarkItDownSettings
from unified_mcp_server.errors import ServiceError


class FakeResult:
    title = None

    def __init__(self, markdown):
        self.markdown = markdown


class FakeConverter:
    def __init__(self, markdown):
        self.markdown = markdown
        self.calls = []

    def convert_stream(self, stream, *, stream_info):
        self.calls.append((stream.read(), stream_info.mimetype, stream_info.filename))
        return FakeResult(self.markdown)


def test_missing_optional_converter_falls_back_for_regular_documents(monkeypatch):
    builtin = FakeConverter("extracted text")

    def unavailable(_settings):
        raise ServiceError("attachment_converter_unavailable", "optional converter missing")

    monkeypatch.setattr(module, "_create_builtin_markitdown", lambda: builtin)
    converter = AttachmentConverter(
        MarkItDownSettings(llm_enabled=True, llm_api_key="key", llm_model="model"),
        factory=unavailable,
    )

    text_result = converter.convert(b"hello", "notes.txt", "text/plain")
    pdf_result = converter.convert(b"pdf bytes", "report.pdf", "application/pdf")

    assert text_result["text"] == "extracted text"
    assert pdf_result["text"] == "extracted text"
    assert [call[1] for call in builtin.calls] == ["text/plain", "application/pdf"]


def test_image_without_optional_ocr_is_reported_as_unsupported(monkeypatch):
    builtin = FakeConverter("")

    def unavailable(_settings):
        raise ServiceError("attachment_converter_unavailable", "optional converter missing")

    monkeypatch.setattr(module, "_create_builtin_markitdown", lambda: builtin)
    converter = AttachmentConverter(
        MarkItDownSettings(llm_enabled=True, llm_api_key="key", llm_model="model"),
        factory=unavailable,
    )

    with pytest.raises(ServiceError) as error:
        converter.convert(b"image bytes", "screenshot.jpg", "image/jpeg")

    assert error.value.code == "attachment_unsupported"


def test_attached_email_is_read_without_ocr_and_does_not_resolve_html_images():
    raw_email = b"""From: sender@example.test\r
Subject: Nested evidence\r
MIME-Version: 1.0\r
Content-Type: multipart/related; boundary="boundary"\r
\r
--boundary\r
Content-Type: text/html; charset=utf-8\r
\r
<html><body>HTML nested text<img src="https://untrusted.example/pixel.png"></body></html>\r
--boundary\r
Content-Type: image/png\r
Content-ID: <logo@example.test>\r
Content-Transfer-Encoding: base64\r
\r
iVBORw0KGgo=\r
--boundary--\r
"""

    converter = AttachmentConverter(MarkItDownSettings(llm_enabled=False))

    result = converter.convert(raw_email, "", "message/rfc822")

    assert result["filename"] == "attachment.eml"
    assert result["text"] == "HTML nested text"
    assert "untrusted.example" not in result["text"]
    assert "iVBORw0KGgo" not in result["text"]
    assert result["converter"]["name"] == "email-rfc822"
