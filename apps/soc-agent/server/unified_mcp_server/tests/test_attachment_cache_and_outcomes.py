"""Tests for the bounded conversion cache and MCP failure-envelope behavior."""

from types import SimpleNamespace

import pytest
from markitdown import UnsupportedFormatException

from unified_mcp_server.attachment_converter import AttachmentConverter, AttachmentConversionLimits
from unified_mcp_server.config import MarkItDownSettings


class FakeMarkitdown:
    def __init__(self, markdown="converted text", fail_times=0):
        self.calls = 0
        self.markdown = markdown
        self.fail_times = fail_times

    def convert_stream(self, stream, stream_info=None):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise UnsupportedFormatException("transient no")
        return SimpleNamespace(markdown=self.markdown, title="T")


def make_converter(**kwargs):
    fake = FakeMarkitdown(**kwargs)
    converter = AttachmentConverter(MarkItDownSettings(), markitdown=fake)
    return converter, fake


def payload():
    return b"attachment-bytes"


def test_successful_conversion_is_cached():
    converter, fake = make_converter()
    first = converter.convert(payload(), "report.pdf", "application/pdf")
    second = converter.convert(payload(), "report.pdf", "application/pdf")
    assert fake.calls == 1
    assert first == second
    first["text"] = "caller mutation"
    assert converter.convert(payload(), "report.pdf", "application/pdf")["text"] == "converted text"


def test_different_content_converts_but_new_excerpt_limits_reuse_full_conversion():
    converter, fake = make_converter()
    converter.convert(payload(), "a.pdf", "application/pdf")
    converter.convert(b"other-bytes", "a.pdf", "application/pdf")
    excerpt = converter.convert(payload(), "a.pdf", "application/pdf", AttachmentConversionLimits(max_chars=5))
    assert fake.calls == 2
    assert excerpt["text"] == "conve"
    assert excerpt["characters"] == len("converted text")
    assert excerpt["text_truncated"] is True


def test_conversion_initialization_is_lazy_and_large_results_are_not_cached():
    created = []
    def factory(_settings):
        created.append(1)
        return FakeMarkitdown(markdown="large result")
    converter = AttachmentConverter(MarkItDownSettings(), factory=factory)
    assert created == []
    converter.CACHE_MAX_BYTES = 10
    converter.convert(payload(), "a.pdf", "application/pdf")
    assert created == [1]
    assert converter._cache_bytes == 0
    assert len(converter._cache) == 0


def test_failures_are_never_cached():
    converter, fake = make_converter(fail_times=1)
    with pytest.raises(Exception):
        converter.convert(payload(), "broken.pdf", "application/pdf")
    result = converter.convert(payload(), "broken.pdf", "application/pdf")
    assert fake.calls == 2
    assert result["text"] == "converted text"


def test_cache_is_bounded_and_evicts_oldest():
    converter, fake = make_converter()
    for index in range(converter.CACHE_MAX_ENTRIES + 4):
        converter.convert(f"bytes-{index}".encode(), f"f{index}.pdf", "application/pdf")
    assert len(converter._cache) == converter.CACHE_MAX_ENTRIES
    assert fake.calls == converter.CACHE_MAX_ENTRIES + 4
    # The oldest entry was evicted; converting it again invokes the converter.
    converter.convert(b"bytes-0", "f0.pdf", "application/pdf")
    assert fake.calls == converter.CACHE_MAX_ENTRIES + 5


def test_mcp_failure_envelope_carries_payload_and_json_text():
    from unified_mcp_server.errors import ServiceError
    from unified_mcp_server.responses import failure
    from unified_mcp_server.server import McpFailureEnvelope

    envelope = failure("splunk", "get_detection", "not_found", "missing", details={"name": "x"})
    exc = McpFailureEnvelope(envelope)
    assert exc.payload is envelope
    import json

    assert json.loads(str(exc))["ok"] is False
    with pytest.raises(ServiceError):
        raise ServiceError("code", "message") from exc
