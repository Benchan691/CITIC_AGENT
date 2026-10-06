"""MCP orchestration; parsing and report business logic remain in the DSH plugin."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import uuid4

from ..blocking_io import run_blocking
from ..errors import ServiceError
from ..request_context import operation_context
from .config import plugin_configuration, report_period
from .email import retrieve_report_messages, retrieve_security_news
from .store import PDF_MIME, XLSX_MIME, ReportStore


def _publish(store: ReportStore, identity, session_id: str, run_id: str, result) -> list[dict[str, Any]]:
    destination = store.run_directory(identity.user_id, session_id, run_id)
    staging = destination.with_name(".publish-" + run_id)
    try:
        staging.mkdir(parents=True)
        artifacts = []
        for source, mime, suffix in ((Path(result.excel_path), XLSX_MIME, ".xlsx"), (Path(result.pdf_path), PDF_MIME, ".pdf")):
            if not source.is_file() or source.suffix.casefold() != suffix or source.stat().st_size == 0:
                raise ServiceError("report_artifact_invalid", "The report plugin did not return a complete Excel and PDF pair.")
            filename = source.name
            source.replace(staging / filename)
            artifacts.append({"id": str(uuid4()), "filename": filename, "mime_type": mime, "size_bytes": (staging / filename).stat().st_size, "relative_path": str((destination / filename).relative_to(store.root))})
        staging.replace(destination)
        store.register_artifacts(identity.user_id, session_id, run_id, artifacts)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        shutil.rmtree(destination, ignore_errors=True)
        raise
    return [{key: value for key, value in artifact.items() if key != "relative_path"} | {"download_url": f"/soc-agent-reports/download/{artifact['id']}?session_id={quote(session_id, safe='')}"} for artifact in artifacts]


class CustomerReportService:
    def __init__(self, runtime, *, store=None, generator=None, environment=None):
        self.runtime = runtime
        self.store = store or ReportStore(runtime.postgres)
        self.generator = generator
        self.environment = dict(os.environ if environment is None else environment)

    async def generate(self, customer_id: str, period_start: str | None = None,
                       period_end: str | None = None, reported_security_incidents: int | None = None) -> dict[str, Any]:
        from soc_agent_reports import ReportGenerationError, generate_report
        from soc_agent_reports.email_parser import EmailParsingError, parse_report_emails
        from soc_agent_reports.report_config import build_settings
        from soc_agent_reports.report_model import build_report_model

        identity = self.runtime.identity
        if identity is None:
            raise ServiceError("authentication_required", "Log in before generating a customer report.")
        if not isinstance(customer_id, str) or not customer_id.strip():
            raise ServiceError("report_customer_required", "customer_id is required; choose a customer from your report settings.")
        if reported_security_incidents is not None and (isinstance(reported_security_incidents, bool) or not isinstance(reported_security_incidents, int) or reported_security_incidents < 0):
            raise ServiceError("report_input_invalid", "reported_security_incidents must be a non-negative integer.")
        start, end = report_period(period_start, period_end)
        session_id = operation_context.get().investigation_id
        await run_blocking(self.store.require_session_owner, identity.user_id, session_id)
        profiles = await run_blocking(self.store.get_profiles, identity.user_id, identity.zimbra_email)
        profile = next((item for item in profiles if item["customer_id"].casefold() == customer_id.strip().casefold()), None)
        if profile is None:
            raise ServiceError("report_customer_not_configured", "The customer has no saved report configuration. Add their email folder or label in Customer Reports settings.")
        configuration = plugin_configuration(profile, self.environment)
        messages = await retrieve_report_messages(self.runtime.zimbra, profile, start, end)
        try:
            parsed = parse_report_emails(messages, report_id=profile["report_id"], company_name=profile["company_name"], customer_senders=profile["customer_senders"], period_start=start, period_end=end, reported_security_incidents=reported_security_incidents)
        except EmailParsingError as exc:
            raise ServiceError("report_email_parsing_failed", str(exc)) from exc
        if not parsed.payload["cases"]:
            raise ServiceError("report_emails_not_found", "No complete Critical, High, or Medium incident notifications matched the requested report period.")
        for field in ("executive_summary_html", "security_analysis_html"):
            if field in profile["report"]:
                parsed.payload[field] = profile["report"][field]
        try:
            settings = build_settings(configuration, start, end, self.environment)
            build_report_model(parsed.payload, settings)
        except (ValueError, TypeError) as exc:
            raise ServiceError("report_input_invalid", str(exc)) from exc
        news = await retrieve_security_news(self.runtime.zimbra, profile)
        run_id = str(uuid4())
        workspace = self.store.run_directory(identity.user_id, session_id, ".work-" + run_id)
        try:
            result = await run_blocking(self.generator or generate_report, parsed.payload, workspace, configuration=configuration, period_start=start, period_end=end, environment=self.environment, security_news=news)
        except ReportGenerationError as exc:
            raise ServiceError("report_" + exc.code, str(exc)) from exc
        except (ValueError, TypeError) as exc:
            raise ServiceError("report_input_invalid", str(exc)) from exc
        except Exception as exc:
            raise ServiceError("report_plugin_failed", "The report plugin failed before publishing its Excel and PDF files.") from exc
        try:
            artifacts = await run_blocking(_publish, self.store, identity, session_id, run_id, result)
        except ServiceError:
            raise
        except Exception as exc:
            raise ServiceError("report_artifact_publication_failed", "The completed report files could not be registered for download.") from exc
        await run_blocking(shutil.rmtree, workspace, ignore_errors=True)
        return {"customer_id": profile["customer_id"], "report_id": profile["report_id"], "period_start": start, "period_end": end, "case_count": len(parsed.payload["cases"]), "matched_messages": len(messages), "artifacts": artifacts, **({"warnings": list(parsed.warnings)} if parsed.warnings else {})}
