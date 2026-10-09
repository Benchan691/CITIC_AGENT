import base64
import csv
import io
import json
from types import SimpleNamespace

import pytest
from openpyxl import Workbook

import unified_mcp_server.admin_cli as admin
import unified_mcp_server.spreadsheets.service as module
import unified_mcp_server.zimbra.mail.service as mail
from unified_mcp_server.auth import ZimbraIdentity
from unified_mcp_server.config import ServerSettings, ZimbraSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.request_context import OperationContext, operation_context
from unified_mcp_server.spreadsheets.service import SpreadsheetService


def encoded_file(rows, extension):
    if extension == ".csv":
        text = io.StringIO()
        csv.writer(text).writerows(rows)
        return text.getvalue().encode("utf-8-sig")
    workbook = Workbook()
    workbook.active.title = "Events"
    for row in rows:
        workbook.active.append(row)
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


@pytest.fixture
def service(tmp_path):
    token = operation_context.set(OperationContext(principal_id="user-a", investigation_id="chat-a"))
    try:
        yield SpreadsheetService(tmp_path / "private")
    finally:
        operation_context.reset(token)


def store(service, rows, extension=".csv"):
    return service.put(encoded_file(rows, extension), "events" + extension, "",
                       user_id="user-a", investigation_id="chat-a")


def analyse(service, manifest, action, **arguments):
    if action in {"count", "aggregate", "group", "rows"}:
        arguments.setdefault("filters", [])
    return service._analyse(action, manifest["file_id"], arguments)


@pytest.mark.parametrize("extension,sheet", [(".csv", "CSV"), (".xlsx", "Events")])
def test_full_file_calculations_and_bounded_samples(service, extension, sheet):
    rows = [["ID", "Category", "Value"]]
    rows += [[f"{i:05d}", "even" if i % 2 == 0 else "odd", i] for i in range(1, 121)]
    manifest = store(service, rows, extension)
    assert "00001" not in manifest["text"]
    assert manifest["preferred_tool"] == "excel_inspect"
    assert manifest["converter"]["revision"] == module.REVISION
    assert analyse(service, manifest, "inspect")["sheet_names"] == [sheet]
    schema = analyse(service, manifest, "sheet", sheet_name=sheet, header_row=0)
    assert schema["row_count"] == 120
    assert schema["column_names"] == ["ID", "Category", "Value"]
    assert len(schema["sample_rows"]) == 3
    assert schema["sample_rows"][0]["ID"] == "00001"
    common = dict(sheet_name=sheet, header_row=0)
    filters = [{"column": "Value", "operator": ">", "value": 100}]
    assert analyse(service, manifest, "count", **common)["count"] == 120
    assert analyse(service, manifest, "count", **common, filters=filters)["count"] == 20
    total = analyse(service, manifest, "aggregate", **common, operation="sum", target_column="Value")
    assert total["value"] == 7260
    assert "sample_rows" not in total and "excel_output" not in total
    profile = analyse(service, manifest, "profile", **common, columns=["ID", "Value"], top_n=2)
    assert profile["profiles"]["Value"]["stats"]["mean"] == 60.5
    assert profile["profiles"]["ID"]["unique_count"] == 120
    grouped = analyse(service, manifest, "group", **common, group_columns=["Category"],
                      agg_column="Value", agg_operation="sum")
    assert len(grouped["groups"]) == 2
    assert sum(row["Value_sum"] for row in grouped["groups"]) == 7260
    sample = analyse(service, manifest, "rows", **common, columns=["ID"], limit=4, filters=filters)
    assert sample["total_matches"] == 20 and sample["truncated"] is True
    assert sample["rows"] == [{"ID": f"{i:05d}"} for i in range(101, 105)]
    assert len(json.dumps(sample).encode()) < module.MAX_RESPONSE_BYTES
    # Calculations cannot mutate cached IDs or cell types.
    assert analyse(service, manifest, "rows", **common, columns=["ID"], limit=1)["rows"][0]["ID"] == "00001"


def test_mixed_numeric_columns_require_explicit_filter(service):
    manifest = store(service, [["Value"], ["2"], ["4"], ["unknown"], ["NA"], [""]])
    common = dict(sheet_name="CSV", header_row=0, target_column="Value")
    assert analyse(service, manifest, "aggregate", **common, operation="count")["value"] == 4
    assert analyse(service, manifest, "count", sheet_name="CSV", header_row=0)["count"] == 5
    with pytest.raises(ServiceError, match="non-numeric") as error:
        analyse(service, manifest, "aggregate", **common, operation="sum")
    assert error.value.code == "spreadsheet_non_numeric"
    explicit = [{"column": "Value", "operator": "in", "values": ["2", "4"]}]
    assert analyse(service, manifest, "aggregate", **common, operation="sum", filters=explicit)["value"] == 6


def test_csv_utf16_delimiter_quoted_newlines_and_text_null_markers(service):
    data = 'ID;Description;Value\r\n00123;"first\nsecond";2\r\nNA;中文;4\r\n'.encode("utf-16")
    manifest = service.put(data, "unicode.csv", "text/csv", user_id="user-a", investigation_id="chat-a")
    rows = analyse(service, manifest, "rows", sheet_name="CSV", header_row=0,
                   columns=["ID", "Description"])["rows"]
    assert rows == [{"ID": "00123", "Description": "first\nsecond"}, {"ID": "NA", "Description": "中文"}]


@pytest.mark.parametrize("scope", [
    OperationContext(principal_id="user-b", investigation_id="chat-a"),
    OperationContext(principal_id="user-a", investigation_id="chat-b"),
    OperationContext(principal_id="user-a", investigation_id="chat-a", customer_id="other"),
])
def test_file_ids_do_not_cross_user_chat_or_customer(service, scope):
    manifest = store(service, [["A"], ["1"]])
    token = operation_context.set(scope)
    try:
        with pytest.raises(ServiceError) as error:
            analyse(service, manifest, "inspect")
        assert error.value.code == "spreadsheet_not_found"
    finally:
        operation_context.reset(token)


def test_refs_survive_restart_but_expire_and_cleanup_on_next_upload(service, monkeypatch):
    now = 10_000.0
    monkeypatch.setattr(module.time, "time", lambda: now)
    manifest = store(service, [["A"], ["1"]])
    restarted = SpreadsheetService(service.root)
    assert analyse(restarted, manifest, "inspect")["sheet_count"] == 1
    now += module.FILE_TTL + 1
    with pytest.raises(ServiceError) as error:
        analyse(restarted, manifest, "inspect")
    assert error.value.code == "spreadsheet_expired"
    store(restarted, [["A"], ["2"]])
    assert not list(service.root.rglob(manifest["file_id"] + ".*"))


@pytest.mark.parametrize("extension", [".csv", ".xlsx"])
def test_duplicate_headers_are_not_silently_renamed(service, extension):
    manifest = store(service, [["Value", "Value"], ["1", "2"]], extension)
    with pytest.raises(ServiceError, match="unique|duplicate"):
        analyse(service, manifest, "sheet", sheet_name="CSV" if extension == ".csv" else "Events", header_row=0)


def test_analysis_limits_errors_and_undefined_statistics(service, monkeypatch):
    manifest = store(service, [["Value"], ["1"]])
    common = dict(sheet_name="CSV", header_row=0)
    for arguments in [{"limit": 51}, {"columns": list(map(str, range(11)))}, {"filters": [{"operator": "regex"}]}]:
        with pytest.raises(ServiceError) as error:
            analyse(service, manifest, "rows", **common, **arguments)
        assert error.value.code == "spreadsheet_invalid_input"
    with pytest.raises(ServiceError) as error:
        analyse(service, manifest, "aggregate", **common, operation="invalid", target_column="Value")
    assert str(service.root) not in error.value.message
    with pytest.raises(ServiceError) as error:
        analyse(service, manifest, "aggregate", **common, operation="std", target_column="Value")
    assert error.value.code == "spreadsheet_insufficient_data"
    profile = analyse(service, manifest, "profile", **common, columns=["Value"])
    json.dumps(profile, allow_nan=False)
    with pytest.raises(ServiceError):
        analyse(service, manifest, "inspect", file_path="/tmp/another-user.xlsx")
    monkeypatch.setattr(module, "MAX_RESPONSE_BYTES", 100)
    with pytest.raises(ServiceError) as error:
        analyse(service, manifest, "sheet", **common)
    assert error.value.code == "spreadsheet_response_too_large"


def test_inspect_uses_metadata_and_large_cells_do_not_block_schema(service, monkeypatch):
    manifest = store(service, [["Description", "Value"], ["中文" * 10_000, "2"]])
    original_load = service.loader.load
    monkeypatch.setattr(service.loader, "load", lambda *args, **kwargs: pytest.fail("Overview loaded full sheet"))
    assert analyse(service, manifest, "inspect")["sheet_names"] == ["CSV"]
    monkeypatch.setattr(service.loader, "load", original_load)
    schema = analyse(service, manifest, "sheet", sheet_name="CSV", header_row=0)
    assert schema["column_names"] == ["Description", "Value"]
    assert schema["sample_rows_omitted"] is True
    with pytest.raises(ServiceError) as error:
        analyse(service, manifest, "rows", sheet_name="CSV", header_row=0, columns=["Description"], limit=1)
    assert error.value.code in {"spreadsheet_response_too_large", "spreadsheet_invalid_input"}


def test_upload_bounds_and_encoding_errors(service, monkeypatch):
    with pytest.raises(ServiceError) as error:
        service.put(b"\xff", "bad.csv", "", user_id="user-a", investigation_id="chat-a")
    assert error.value.code == "spreadsheet_encoding"
    with pytest.raises(ServiceError) as error:
        service.put(b"A,B\n1,2,3\n", "bad.csv", "", user_id="user-a", investigation_id="chat-a")
    assert error.value.code == "spreadsheet_malformed"
    with pytest.raises(ServiceError) as error:
        service.put(b"A\n1", "big.csv", "", user_id="user-a", investigation_id="chat-a", max_bytes=1)
    assert error.value.code == "attachment_too_large"
    monkeypatch.setattr(module, "MAX_ROWS", 2)
    with pytest.raises(ServiceError) as error:
        store(service, [["A"], ["1"], ["2"]])
    assert error.value.code == "spreadsheet_too_complex"


def test_composer_routing_uses_original_files_and_authenticated_identity(service, monkeypatch):
    monkeypatch.setattr(admin, "_settings", lambda store: ServerSettings.from_env({}))
    monkeypatch.setattr(admin, "SpreadsheetService", lambda: service)
    identity = ZimbraIdentity("user-a", "analyst@example.test", "token", "app-session")
    monkeypatch.setattr(admin, "identity_for_session", lambda store, session: identity if session == "app-session" else None)
    converted = []
    monkeypatch.setattr(admin, "AttachmentConverter", lambda settings: SimpleNamespace(
        convert=lambda *args: converted.append(args) or {"text": "document excerpt"}))
    payload = dict(filename="events.csv", content_type="text/csv", session_id="app-session",
                   investigation_id="chat-a", data=base64.b64encode(b"Value\n2\n4\n").decode())
    result = admin.convert_attachment(None, payload)
    assert result["preferred_tool"] == "excel_inspect" and converted == []
    assert analyse(service, result, "aggregate", sheet_name="CSV", header_row=0,
                   operation="sum", target_column="Value")["value"] == 6
    document = admin.convert_attachment(None, {**payload, "filename": "notes.txt", "content_type": "text/plain"})
    assert document["text"] == "document excerpt" and len(converted) == 1
    with pytest.raises(ServiceError) as error:
        admin.convert_attachment(None, {**payload, "session_id": "forged"})
    assert error.value.code == "session_expired"


@pytest.mark.asyncio
@pytest.mark.parametrize("filename", ["events.csv", ""])
async def test_zimbra_spreadsheets_bypass_markitdown(service, monkeypatch, filename):
    identity = ZimbraIdentity("user-a", "analyst@example.test", "token", "app-session")
    mail_service = mail.ZimbraMailService(ZimbraSettings(host="mail.example.test", verify_ssl=True, timeout=60), identity=identity, spreadsheets=service)
    monkeypatch.setattr(mail, "zimbra_get_message", lambda *args, **kwargs: {
        "attachments": [{"part": "2.3", "filename": filename, "content_type": "text/csv", "size": 10}]})
    monkeypatch.setattr(mail, "download_attachment", lambda *args: b"Value\n2\n4\n")
    monkeypatch.setattr(mail_service._attachment_converter, "convert", lambda *args: pytest.fail("Spreadsheet entered MarkItDown"))
    result = await mail_service.get_attachment_text("42", "2.3")
    assert result["message_id"] == "42" and result["part"] == "2.3"
    assert result["preferred_tool"] == "excel_inspect"
    assert analyse(service, result, "count", sheet_name="CSV", header_row=0)["count"] == 2


@pytest.mark.asyncio
async def test_registered_mcp_tool_reauthenticates_and_uses_host_scope(service, monkeypatch):
    import unified_mcp_server.server as server_module
    from unified_mcp_server.spreadsheets.tools import ExcelFilter

    monkeypatch.setattr(server_module.PostgresStore, "from_env", lambda: None)
    server = server_module.create_server(ServerSettings.from_env({}))
    manifest = store(service, [["Value"], ["2"], ["4"]])
    identity = ZimbraIdentity("user-a", "analyst@example.test", "token", "app-session")
    live = {"app-session": identity}
    monkeypatch.setattr(server_module, "identity_for_session", lambda store, session: live.get(session))
    scoped = SimpleNamespace(spreadsheets=service, identity=identity, postgres=object())
    base = SimpleNamespace(postgres=object(), config_revision="test", for_identity=lambda current: scoped)
    meta = {"soc_session_id": "app-session", "soc_investigation_id": "chat-a"}
    ctx = SimpleNamespace(request_context=SimpleNamespace(lifespan_context=base, meta=meta))
    tool = server._tool_manager.get_tool("excel_count")
    result = await tool.fn(ctx, manifest["file_id"], "CSV",
                           filters=[ExcelFilter(column="Value", operator=">", value=2)], header_row=0)
    assert result["ok"] is True and result["data"]["count"] == 1
    meta["soc_investigation_id"] = "chat-b"
    with pytest.raises(server_module.McpFailureEnvelope) as error:
        await tool.fn(ctx, manifest["file_id"], "CSV", header_row=0)
    assert error.value.payload["error"]["code"] == "spreadsheet_not_found"
    meta["soc_investigation_id"] = "chat-a"
    live.clear()
    with pytest.raises(server_module.McpFailureEnvelope) as error:
        await tool.fn(ctx, manifest["file_id"], "CSV", header_row=0)
    assert error.value.payload["error"]["code"] == "session_expired"
