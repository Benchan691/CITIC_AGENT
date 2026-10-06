from __future__ import annotations

from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet

from unified_mcp_server.errors import ServiceError
from unified_mcp_server.request_context import OperationContext, operation_context
from unified_mcp_server.reports.config import plugin_configuration, report_period, validate_profiles
from unified_mcp_server.reports.email import _read_messages, retrieve_report_messages
from unified_mcp_server.reports.service import CustomerReportService, _publish
from unified_mcp_server.reports.store import PDF_MIME, XLSX_MIME, ReportStore


def profile():
    return {"customer_id": "client", "display_name": "Client", "report_id": "50238", "company_name": "Client", "email": {"account": "analyst@example.com", "scope_type": "folder", "scope": "/Inbox/Client", "include_subfolders": False}, "customer_senders": ["customer@example.com"], "report": {"template": {"owner": "nobody", "app": "search", "view": "customer_template"}, "output_stem": "G50238 Report {month} {year}"}, "news": {"scope_type": "folder", "scope": "/Inbox/News", "source_labels": ["Source collection"], "source_terms": ["hkcert"], "scan_limit": 500}, "extensions": {}}


ENV = {"REPORT_SPLUNK_BASE_URL": "https://splunk.example.com:8089", "REPORT_SPLUNK_WEB_BASE_URL": "https://splunk.example.com:8000", "REPORT_SPLUNK_USERNAME": "service", "REPORT_SPLUNK_PASSWORD": "test"}


def test_profile_configuration_is_user_owned_and_extensible():
    value = profile()
    value["extensions"] = {"contact": {"team": "Operations"}}
    assert validate_profiles([value], "ANALYST@example.com")[0]["extensions"] == value["extensions"]
    assert "chrome" not in plugin_configuration(value, ENV)["pdf"]
    with pytest.raises(ServiceError, match="match your authenticated"):
        validate_profiles([value], "another@example.com")
    value["extensions"] = {"password": "no"}
    with pytest.raises(ServiceError, match="credentials"):
        validate_profiles([value], "analyst@example.com")
    with pytest.raises(ServiceError) as failure:
        plugin_configuration(profile(), {})
    assert failure.value.code == "report_backend_not_configured"


def test_period_requires_both_valid_inclusive_dates():
    assert report_period("2026-09-01", "2026-09-30") == ("2026-09-01", "2026-09-30")
    for first, final in (("2026-09-01", None), ("2026-09-31", "2026-10-01"), ("2026-10-01", "2026-09-01")):
        with pytest.raises(ServiceError) as error:
            report_period(first, final)
        assert error.value.code == "report_input_invalid"


class Mail:
    def __init__(self, messages=None):
        self.messages = messages or []
        self.queries = []
        self.failure = None

    async def list_folders(self):
        return {"folders": [{"id": "101", "path": "/Inbox/Client"}, {"id": "102", "path": "/Inbox/News"}]}

    async def search_emails(self, query, limit=100, offset=0):
        self.queries.append((query, limit, offset))
        if self.failure:
            raise self.failure
        values = [item for item in self.messages if (item.get("news") is True) == ("inid:102" in query)]
        return {"messages": [{"id": item["id"]} for item in values[offset:offset + limit]]}

    async def get_email(self, message_id, max_body_chars):
        return next(item.copy() for item in self.messages if item["id"] == message_id)


@pytest.mark.asyncio
async def test_mail_retrieval_paginates_and_builds_inclusive_period():
    mail = Mail([{"id": str(index), "body": "value"} for index in range(101)])
    values = await retrieve_report_messages(mail, profile(), "2026-09-01", "2026-09-30")
    assert len(values) == 101
    assert mail.queries == [("inid:101 after:09/01/2026 before:10/01/2026", 100, 0), ("inid:101 after:09/01/2026 before:10/01/2026", 100, 100)]
    labeled = profile()
    labeled["email"] = {"scope_type": "label", "scope": 'Client "quoted"'}
    mail = Mail([{"id": "1", "body": "value"}])
    await retrieve_report_messages(mail, labeled, "2026-09-01", "2026-09-30")
    assert mail.queries[0][0].startswith('tag:"Client \\"quoted\\""')


@pytest.mark.asyncio
@pytest.mark.parametrize("problem,code", [("empty", "report_emails_not_found"), ("folder", "report_folder_inaccessible"), ("auth", "zimbra_auth_error"), ("permission", "report_email_inaccessible"), ("truncated", "report_email_truncated")])
async def test_email_failures_are_explicit(problem, code):
    mail = Mail([{"id": "1", "body": "value"}])
    selected = profile()
    if problem == "empty":
        mail.messages = []
    if problem == "folder":
        selected["email"]["scope"] = "/Missing"
    if problem in {"auth", "permission"}:
        mail.failure = ServiceError("zimbra_auth_error" if problem == "auth" else "zimbra_permission_denied", "upstream")
    if problem == "truncated":
        mail.messages[0]["body_truncated"] = True
    with pytest.raises(ServiceError) as failure:
        await retrieve_report_messages(mail, selected, "2026-09-01", "2026-09-30")
    assert failure.value.code == code


class Database:
    def __init__(self):
        self.profiles = {}
        self.artifacts = {}
        self.owned = {("user", "chat")}
        self.cipher = Fernet(Fernet.generate_key())
        self.sessions = {}

    def get_app_session(self, value):
        return self.sessions.get(value)

    @contextmanager
    def _connect(self):
        yield self

    def _encrypt_text(self, value):
        return self.cipher.encrypt(value.encode()).decode()

    def _decrypt_text(self, value):
        return self.cipher.decrypt(value.encode()).decode()

    def execute(self, query, params):
        query = " ".join(query.split())
        row = None
        if query.startswith("SELECT profiles_encrypted"):
            row = (self.profiles[params[0]],) if params[0] in self.profiles else None
        elif query.startswith("INSERT INTO soc_report_profiles"):
            self.profiles[params[0]] = params[1]
        elif query.startswith("SELECT sessions.session_id"):
            row = (params[0],) if (params[1], params[0]) in self.owned and params[1] == params[2] else None
        elif query.startswith("INSERT INTO soc_report_artifacts"):
            self.artifacts[params[0]] = params
        elif query.startswith("SELECT id, filename"):
            item = self.artifacts.get(params[0])
            if item and item[1:3] == params[1:3]:
                row = (item[0], item[4], item[5], item[6], item[7], item[2])
        else:
            raise AssertionError(query)
        return SimpleNamespace(fetchone=lambda: row)


def test_store_encrypts_settings_and_isolates_artifacts_by_user_and_session(tmp_path):
    database = Database()
    store = ReportStore(database, tmp_path)
    store.save_profiles("user", "analyst@example.com", [profile()])
    assert "Client" not in database.profiles["user"]
    assert store.get_profiles("user", "analyst@example.com")[0]["customer_id"] == "client"
    assert store.get_profiles("other", "analyst@example.com") == []
    inputs = tmp_path / "inputs"
    inputs.mkdir()
    excel, pdf = inputs / "report.xlsx", inputs / "report.pdf"
    excel.write_bytes(b"xlsx")
    pdf.write_bytes(b"pdf")
    outputs = _publish(store, SimpleNamespace(user_id="user"), "chat", str(uuid4()), SimpleNamespace(excel_path=excel, pdf_path=pdf))
    assert len(outputs) == 2
    assert all("path" not in item and "/soc-agent-reports/download/" in item["download_url"] for item in outputs)
    assert store.get_artifact("user", "chat", outputs[0]["id"])["size_bytes"] == 4
    database.owned.add(("other", "other-chat"))
    database.owned.add(("user", "other-chat"))
    for owner, session in (("other", "other-chat"), ("user", "other-chat")):
        with pytest.raises(ServiceError) as failure:
            store.get_artifact(owner, session, outputs[0]["id"])
        assert failure.value.code == "report_artifact_not_found"


def test_no_partial_artifacts_on_invalid_pair(tmp_path):
    store = ReportStore(Database(), tmp_path)
    excel = tmp_path / "report.xlsx"
    excel.write_bytes(b"xlsx")
    with pytest.raises(ServiceError, match="complete Excel and PDF pair"):
        _publish(store, SimpleNamespace(user_id="user"), "chat", str(uuid4()), SimpleNamespace(excel_path=excel, pdf_path=tmp_path / "missing.pdf"))
    assert not store.postgres.artifacts


def incident():
    return {"id": "1", "subject": "TrustCSI Security Incident Notification (Case Number: 50238202609011200)", "from": "soc@example.com", "body": "Correlation event summary\nCase Number\n50238202609011200\nCase Name\nExample Rule\nTime of Incidence\n2026-09-01 12:00:00\nSeverity\nHIGH\nCase Status\nOpen\n", "body_type": "text/plain"}


@pytest.mark.asyncio
async def test_orchestration_success_returns_two_registered_session_files(tmp_path):
    database = Database()
    store = ReportStore(database, tmp_path)
    store.save_profiles("user", "analyst@example.com", [profile()])
    news = {"id": "2", "news": True, "from": "news@example.com", "subject": "Security news", "body": "Source collection: hkcert\nA current security advisory.", "body_type": "text/plain"}
    runtime = SimpleNamespace(identity=SimpleNamespace(user_id="user", zimbra_email="analyst@example.com"), postgres=database, zimbra=Mail([incident(), news]))
    def generate(payload, output_dir, **kwargs):
        assert kwargs["security_news"].subject == "Security news"
        assert payload["cases"][0]["Reason"].startswith("Pending")
        output_dir.mkdir(parents=True)
        excel, pdf = output_dir / "report.xlsx", output_dir / "report.pdf"
        excel.write_bytes(b"xlsx")
        pdf.write_bytes(b"pdf")
        return SimpleNamespace(excel_path=excel, pdf_path=pdf)
    token = operation_context.set(OperationContext(principal_id="user", investigation_id="chat"))
    try:
        result = await CustomerReportService(runtime, store=store, generator=generate, environment=ENV).generate("client", "2026-09-01", "2026-09-30", 0)
    finally:
        operation_context.reset(token)
    assert result["case_count"] == 1 and result["matched_messages"] == 1
    assert {item["mime_type"] for item in result["artifacts"]} == {XLSX_MIME, PDF_MIME}


@pytest.mark.asyncio
@pytest.mark.parametrize("problem,code", [("profile", "report_customer_not_configured"), ("parse", "report_email_parsing_failed"), ("json", "report_input_invalid"), ("plugin", "report_plugin_failed"), ("excel", "report_excel_generation_failed"), ("pdf", "report_pdf_generation_failed"), ("news", "report_news_not_found")])
async def test_orchestration_failure_categories(tmp_path, problem, code):
    from soc_agent_reports import ReportGenerationError
    database = Database()
    store = ReportStore(database, tmp_path)
    configured = profile()
    if problem == "json":
        configured["report"]["security_analysis_html"] = "<p>unbalanced"
    store.save_profiles("user", "analyst@example.com", [] if problem == "profile" else [configured])
    message = incident()
    if problem == "parse":
        message["body"] = "malformed"
    news = {"id": "2", "news": True, "body": "Source collection: hkcert\nAdvisory", "body_type": "text/plain"}
    runtime = SimpleNamespace(identity=SimpleNamespace(user_id="user", zimbra_email="analyst@example.com"), postgres=database, zimbra=Mail([message] + ([] if problem == "news" else [news])))
    def generate(*args, **kwargs):
        if problem in {"excel", "pdf"}:
            raise ReportGenerationError(problem + "_generation_failed", "Rendering failed.")
        raise RuntimeError("private upstream details")
    token = operation_context.set(OperationContext(principal_id="user", investigation_id="chat"))
    try:
        with pytest.raises(ServiceError) as failure:
            await CustomerReportService(runtime, store=store, generator=generate, environment=ENV).generate("client", "2026-09-01", "2026-09-30")
    finally:
        operation_context.reset(token)
    assert failure.value.code == code
    assert "private upstream" not in failure.value.message
    assert not database.artifacts


@pytest.mark.asyncio
async def test_limits_and_malformed_mail_are_never_silently_incomplete():
    mail = Mail([{"id": str(index), "body": "value"} for index in range(3)])
    with pytest.raises(ServiceError) as failure:
        await _read_messages(mail, "inid:101", 2)
    assert failure.value.code == "report_email_limit_exceeded"
    class Malformed(Mail):
        async def search_emails(self, *args, **kwargs):
            return {"messages": "invalid"}
    with pytest.raises(ServiceError) as failure:
        await _read_messages(Malformed(), "inid:101", 100)
    assert failure.value.code == "report_email_malformed"


def test_control_api_uses_authenticated_identity_for_settings_and_download(tmp_path, monkeypatch):
    import unified_mcp_server.auth_cli as auth_cli
    import unified_mcp_server.reports.control_api as api
    from unified_mcp_server.postgres_store import AuthenticatedSession
    database = Database()
    now = datetime.now(timezone.utc)
    database.sessions["application"] = AuthenticatedSession("application", "user", "analyst@example.com", "private-token", now, now + timedelta(hours=1))
    database.sessions["attacker"] = AuthenticatedSession("attacker", "other", "other@example.com", "private-token", now, now + timedelta(hours=1))
    store = ReportStore(database, tmp_path)
    monkeypatch.setattr(auth_cli, "_store", lambda: database)
    monkeypatch.setattr(api, "ReportStore", lambda value: ReportStore(value, tmp_path))
    result = api.report_settings_save({"session_id": "application", "customers": [profile()]})
    assert result["account"] == "analyst@example.com"
    assert api.report_settings_get({"session_id": "attacker"})["customers"] == []
    with pytest.raises(ServiceError) as failure:
        api.report_settings_get({"session_id": "expired"})
    assert failure.value.code == "session_expired"
    excel, pdf = tmp_path / "input.xlsx", tmp_path / "input.pdf"
    excel.write_bytes(b"xlsx")
    pdf.write_bytes(b"pdf")
    artifacts = _publish(store, SimpleNamespace(user_id="user"), "chat", str(uuid4()), SimpleNamespace(excel_path=excel, pdf_path=pdf))
    record = api.report_artifact_get({"session_id": "application", "investigation_id": "chat", "artifact_id": artifacts[0]["id"]})
    assert record["session_id"] == "chat" and record["filename"] == "input.xlsx"
    with pytest.raises(ServiceError) as failure:
        api.report_artifact_get({"session_id": "attacker", "investigation_id": "chat", "artifact_id": artifacts[0]["id"]})
    assert failure.value.code == "report_session_forbidden"


def test_registry_failure_removes_published_pair(tmp_path, monkeypatch):
    store = ReportStore(Database(), tmp_path)
    excel, pdf = tmp_path / "input.xlsx", tmp_path / "input.pdf"
    excel.write_bytes(b"xlsx")
    pdf.write_bytes(b"pdf")
    run = str(uuid4())
    def unavailable(*args):
        raise RuntimeError("database unavailable")
    monkeypatch.setattr(store, "register_artifacts", unavailable)
    with pytest.raises(RuntimeError):
        _publish(store, SimpleNamespace(user_id="user"), "chat", run, SimpleNamespace(excel_path=excel, pdf_path=pdf))
    assert not store.run_directory("user", "chat", run).exists()
