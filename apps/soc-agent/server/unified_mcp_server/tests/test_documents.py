import asyncio
import base64
import io
import json
import os
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject, NumberObject

from unified_mcp_server import admin_cli, documents, attachment_store
from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.documents import DocumentService, run_document_bridge
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.request_context import OperationContext, operation_context
from unified_mcp_server.spreadsheets.service import SpreadsheetService
from unified_mcp_server.zimbra.mail import service as mail


@pytest.fixture
def service(tmp_path):
    token = operation_context.set(OperationContext(principal_id="user-a", investigation_id="chat-a", customer_id="customer-a"))
    try:
        yield DocumentService(tmp_path / "documents")
    finally:
        operation_context.reset(token)


def put(service, data, name="evidence.txt", mime=""):
    scope = operation_context.get()
    return service.put(data, name, mime, user_id=scope.principal_id,
                       investigation_id=scope.investigation_id, customer_id=scope.customer_id)


def pdf_bytes(pages, encrypted=False):
    writer = PdfWriter()
    for text in pages:
        page = writer.add_blank_page(width=300, height=200)
        if text:
            font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
                                     NameObject("/Subtype"): NameObject("/Type1"),
                                     NameObject("/BaseFont"): NameObject("/Helvetica")})
            page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
            stream = DecodedStreamObject()
            stream.set_data(f"BT /F1 12 Tf 20 100 Td ({text}) Tj ET".encode())
            page[NameObject("/Contents")] = writer._add_object(stream)
    if encrypted:
        writer.encrypt("private-password")
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def docx_bytes():
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("[Content_Types].xml", '''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>''')
        archive.writestr("_rels/.rels", '''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>''')
        archive.writestr("word/document.xml", '''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>SOC 證據 café</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Host</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Count</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>server-1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>42</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>''')
    return output.getvalue()


def image_pdf_bytes():
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=200)
    image = DecodedStreamObject()
    image.set_data(b"\xff\x00\x00")
    image.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"),
                  NameObject("/Width"): NumberObject(1), NameObject("/Height"): NumberObject(1),
                  NameObject("/ColorSpace"): NameObject("/DeviceRGB"), NameObject("/BitsPerComponent"): NumberObject(8)})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/XObject"): DictionaryObject({NameObject("/Picture"): writer._add_object(image)})})
    content = DecodedStreamObject()
    content.set_data(b"q 100 0 0 100 20 20 cm /Picture Do Q")
    page[NameObject("/Contents")] = writer._add_object(content)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.asyncio
async def test_staging_never_parses_and_local_read_is_paginated(service, monkeypatch):
    async def forbidden(*args, **kwargs):
        pytest.fail("Upload attempted document extraction")
    monkeypatch.setattr(documents, "run_document_bridge", forbidden)
    text = "\n".join(f"證據 {i}" for i in range(250))
    manifest = put(service, text.encode())
    assert manifest["preferred_tool"] == "read_document"
    assert "證據" not in manifest["text"]
    assert manifest["retention"] == "chat"
    first = await service.read(manifest["file_id"], limit=2)
    assert first["lines"] == [{"number": 1, "text": "證據 0"}, {"number": 2, "text": "證據 1"}]
    assert first["next_offset"] == 3 and first["total_lines"] == 250
    restarted = DocumentService(service.store.root)
    last = await restarted.read(manifest["file_id"], offset=250)
    assert last["lines"][0]["text"] == "證據 249" and last["next_offset"] is None
    # Even malformed PDFs are only parsed when explicitly read.
    assert put(service, b"not a pdf", "malformed.pdf")["preferred_tool"] == "read_document"


@pytest.mark.asyncio
async def test_installed_dsh_document_pdf_pages_and_docx_unicode_tables(service):
    manifest = put(service, pdf_bytes(["SOC first", "SOC second", "SOC third"]), "report.pdf")
    first = await service.read(manifest["file_id"])
    assert first["pdf"]["page_count"] == 3 and first["pdf"]["pages"] == [1]
    assert "first" in json.dumps(first) and "second" not in json.dumps(first)
    selected = await service.read(manifest["file_id"], pages="2-3", limit=1)
    assert selected["pdf"]["pages"] == [2, 3]
    rest = await service.read(manifest["file_id"], pages="2-3", offset=selected["next_offset"])
    assert "SOC second" in json.dumps(rest) and "SOC third" in json.dumps(rest)
    word = put(service, docx_bytes(), "evidence.docx")
    result = await service.read(word["file_id"])
    rendered = json.dumps(result, ensure_ascii=False)
    assert "證據" in rendered and "café" in rendered and "server-1" in rendered and "42" in rendered
    assert result["converter"] == {"name": "dsh-document", "version": "0.1.3"}


@pytest.mark.asyncio
async def test_no_text_mixed_encrypted_and_malformed_documents(service):
    blank = put(service, image_pdf_bytes(), "image-only.pdf")
    with pytest.raises(ServiceError, match="No extractable text") as error:
        await service.read(blank["file_id"])
    assert error.value.code == "attachment_no_text"
    mixed = put(service, pdf_bytes(["visible text", None]), "mixed.pdf")
    result = await service.read(mixed["file_id"], pages="1-2")
    assert 2 in result["pdf"]["pages_without_text"] and result["notice"]
    protected = put(service, pdf_bytes(["secret"], encrypted=True), "encrypted.pdf")
    with pytest.raises(ServiceError) as error:
        await service.read(protected["file_id"])
    assert error.value.code == "attachment_encrypted"
    broken = put(service, b"invalid pdf", "broken.pdf")
    with pytest.raises(ServiceError) as error:
        await service.read(broken["file_id"])
    assert error.value.code == "attachment_malformed"


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", [OperationContext(principal_id="other", investigation_id="chat-a", customer_id="customer-a"),
                                     OperationContext(principal_id="user-a", investigation_id="other", customer_id="customer-a"),
                                     OperationContext(principal_id="user-a", investigation_id="chat-a", customer_id="other")])
async def test_private_file_ids_cannot_cross_scope(service, scope):
    manifest = put(service, b"private")
    token = operation_context.set(scope)
    try:
        with pytest.raises(ServiceError) as error:
            await service.read(manifest["file_id"])
        assert error.value.code == "attachment_not_found"
    finally:
        operation_context.reset(token)


@pytest.mark.asyncio
async def test_bounds_invalid_pages_and_plain_formats(service):
    text = put(service, (("證" * 3000 + "\n") * 100).encode())
    result = await service.read(text["file_id"], limit=2000)
    assert result["next_offset"] and result["lines"][0]["truncated"]
    assert all(len(line["text"]) <= 2000 for line in result["lines"])
    assert sum(len(json.dumps(line, ensure_ascii=False).encode()) for line in result["lines"]) <= 50 * 1024
    for args in [{"limit": 2001}, {"offset": 0}, {"pages": "1"}]:
        with pytest.raises(ServiceError):
            await service.read(text["file_id"], **args)
    for pages in ["", "0", "-1", "4-2", "1-1000000", "1;evil", "x"]:
        with pytest.raises(ServiceError):
            documents.parse_pages(pages)
    assert documents.parse_pages("1-3,2,7") == [1, 2, 3, 7]
    for name, content in [("data.json", b"{}"), ("data.xml", b"<evidence/>"), ("notes.log", b"SOC log")]:
        assert (await service.read(put(service, content, name)["file_id"]))["lines"]
    broken = put(service, b"{broken", "data.json")
    with pytest.raises(ServiceError):
        await service.read(broken["file_id"])
    html = put(service, b'<p>Evidence</p><img src="https://never-fetch.test/x"><script>hidden</script>', "notes.html")
    result = await service.read(html["file_id"])
    assert result["lines"] == [{"number": 1, "text": "Evidence"}]
    email = put(service, b'Subject: Evidence\r\nContent-Type: text/html\r\n\r\n<p>Nested body</p><img src="https://never-fetch.test/x">', "", "message/rfc822")
    assert (await service.read(email["file_id"]))["lines"] == [{"number": 1, "text": "Nested body"}]


@pytest.mark.asyncio
async def test_missing_parser_and_cancellation_clean_up_process(tmp_path):
    missing = tmp_path / "missing.mjs"
    missing.write_text((documents.workspace_root() / "apps/soc-agent/document-reader.js").read_text())
    with pytest.raises(ServiceError) as error:
        await run_document_bridge({"check": True}, bridge=missing)
    assert error.value.code == "attachment_converter_unavailable"
    pid_path = tmp_path / "pid"
    hung = tmp_path / "hung.mjs"
    hung.write_text(f"import {{writeFileSync}} from 'node:fs'; writeFileSync({json.dumps(str(pid_path))},String(process.pid)); setInterval(()=>{{}},1000)")
    task = asyncio.create_task(run_document_bridge({}, bridge=hung))
    for _ in range(100):
        if pid_path.exists():
            break
        await asyncio.sleep(.01)
    assert pid_path.exists()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    with pytest.raises(ProcessLookupError):
        os.kill(int(pid_path.read_text()), 0)


@pytest.mark.asyncio
async def test_zimbra_and_upload_staging_share_reader(service, monkeypatch):
    identity = ZimbraIdentity("user-a", "analyst@example.test", "token", "application-session")
    mailbox = mail.ZimbraMailService(ZimbraSettings(host="mail.example.test", verify_ssl=True, timeout=60),
                                    identity=identity, documents=service)
    monkeypatch.setattr(mail, "zimbra_get_message", lambda *args, **kwargs: {
        "attachments": [{"part": "2", "filename": "evidence.txt", "content_type": "text/plain", "size": 8}]})
    monkeypatch.setattr(mail, "download_attachment", lambda *args, **kwargs: b"evidence")
    staged = await mailbox.get_attachment_text("42", "2")
    uploaded = put(service, b"evidence", "evidence.txt", "text/plain")
    assert staged["file_id"] == uploaded["file_id"]
    assert "evidence" not in json.loads(staged["text"]).get("lines", [])
    assert (await service.read(staged["file_id"]))["lines"][0]["text"] == "evidence"


@pytest.mark.asyncio
async def test_mcp_read_document_authentication_scope_and_contract(service, monkeypatch):
    import unified_mcp_server.server as server_module
    manifest = put(service, b"private evidence")
    identity = ZimbraIdentity("user-a", "analyst@example.test", "token", "app-session")
    monkeypatch.setattr(server_module.PostgresStore, "from_env", lambda: None)
    monkeypatch.setattr(server_module, "identity_for_session", lambda store, session: identity if session == "app-session" else None)
    server = server_module.create_server()
    tool = server._tool_manager.get_tool("read_document")
    assert set(tool.parameters["properties"]) == {"file_id", "offset", "limit", "pages"}
    scoped = SimpleNamespace(documents=service, postgres=SimpleNamespace(
        owns_chat=lambda user, chat: user == "user-a" and chat in {"chat-a", "chat-b"}), identity=identity)
    base = SimpleNamespace(postgres=object(), config_revision="test", for_identity=lambda resolved: scoped)
    meta = {"soc_session_id": "app-session", "soc_investigation_id": "chat-a", "soc_customer_id": "customer-a"}
    context = SimpleNamespace(request_context=SimpleNamespace(meta=meta, lifespan_context=base))
    result = await tool.fn(ctx=context, file_id=manifest["file_id"])
    assert result["ok"] and result["data"]["lines"][0]["text"] == "private evidence"
    meta["soc_investigation_id"] = "chat-b"
    with pytest.raises(server_module.McpFailureEnvelope) as error:
        await tool.fn(ctx=context, file_id=manifest["file_id"])
    assert error.value.payload["error"]["code"] == "attachment_not_found"
    meta["soc_session_id"] = "expired"
    with pytest.raises(server_module.McpFailureEnvelope) as error:
        await tool.fn(ctx=context, file_id=manifest["file_id"])
    assert error.value.payload["error"]["code"] == "session_expired"


def test_storage_limits_and_authenticated_cleanup(service, monkeypatch):
    with pytest.raises(ServiceError) as error:
        service.put(b"oversize", "large.txt", "", user_id="user-a", investigation_id="chat-a", max_bytes=1)
    assert error.value.code == "attachment_too_large"
    monkeypatch.setattr(attachment_store, "MAX_FILES", 1)
    first = put(service, b"first")
    assert put(service, b"first")["file_id"] == first["file_id"]
    with pytest.raises(ServiceError) as error:
        put(service, b"second", "other.txt")
    assert error.value.code == "attachment_storage_limit"
    identity = ZimbraIdentity("user-a", "analyst@example.test", "token", "app-session")
    monkeypatch.setattr(admin_cli, "identity_for_session", lambda store, session: identity if session == "app-session" else None)
    removed = []
    monkeypatch.setattr(admin_cli, "delete_chat_files", lambda user, chat: removed.append((user, chat)))
    owner = SimpleNamespace(owns_chat=lambda user, chat: user == "user-a" and chat == "chat-a")
    with pytest.raises(ServiceError):
        admin_cli.delete_attachments(owner, {"session_id": "app-session", "investigation_ids": ["chat-a", "foreign"]})
    assert removed == []
    admin_cli.delete_attachments(owner, {"session_id": "app-session", "investigation_ids": ["chat-a"]})
    assert removed == [("user-a", "chat-a")]


@pytest.mark.asyncio
async def test_reader_deadline_and_missing_real_bridge(tmp_path, monkeypatch):
    bridge = tmp_path / "reader.mjs"
    bridge.write_text("setInterval(()=>{},1000)")
    monkeypatch.setattr(documents, "remaining_seconds", lambda maximum: .02)
    with pytest.raises(ServiceError) as error:
        await run_document_bridge({}, bridge=bridge)
    assert error.value.code == "operation_timeout"


def test_document_readiness_uses_the_installed_parser(monkeypatch):
    from unified_mcp_server.config import ServerSettings
    monkeypatch.setattr(admin_cli, "_settings", lambda store: ServerSettings.from_env({}))
    status = admin_cli._public_settings(None)["services"]["documents"]
    assert status["status"] == "ready" and status["version"] == "0.1.3"
    async def unavailable(request):
        raise ServiceError("attachment_converter_unavailable", "missing")
    monkeypatch.setattr(admin_cli, "run_document_bridge", unavailable)
    assert admin_cli._public_settings(None)["services"]["documents"]["status"] == "unavailable"


def test_chat_cleanup_removes_documents_and_spreadsheets_without_crossing_users(tmp_path, monkeypatch):
    monkeypatch.setattr(attachment_store, "workspace_root", lambda: tmp_path)
    docs = DocumentService(tmp_path / ".data/documents")
    scope = operation_context.set(OperationContext(principal_id="user-a", investigation_id="chat-a"))
    try:
        manifest = put(docs, b"evidence")
        books = SpreadsheetService(tmp_path / ".data/spreadsheets")
        spreadsheet = books.put(b"A\n1\n", "evidence.csv", "text/csv", user_id="user-a", investigation_id="chat-a")
        other = docs.put(b"other", "other.txt", "", user_id="user-b", investigation_id="chat-a")
        attachment_store.delete_chat_files("user-a", "chat-a")
        assert not list((tmp_path / ".data/documents").rglob(manifest["file_id"] + ".bin"))
        assert not list((tmp_path / ".data/spreadsheets").rglob(spreadsheet["file_id"] + ".csv"))
        assert list((tmp_path / ".data/documents").rglob(other["file_id"] + ".bin"))
        with pytest.raises(ServiceError):
            put(docs, b"late upload")
        with pytest.raises(ServiceError):
            books.put(b"A\n2\n", "late.csv", "text/csv", user_id="user-a", investigation_id="chat-a")
    finally:
        operation_context.reset(scope)
