"""Contracts that protect data, rendering stages, and temporary dashboard ownership."""

import copy
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from unittest.mock import patch

from soc_agent_reports import ReportGenerationError, SecurityNewsArticle, generate_report, sanitize_security_news
from soc_agent_reports import monthly_report_completion as pdf
from soc_agent_reports.report_config import build_settings
from soc_agent_reports.report_model import HEADERS, build_report_model
from soc_agent_reports.transform_excel import create_workbook

CONFIG = {"report_id": "50238", "template": {"owner": "admin", "app": "search", "view": "customer_report"},
          "output_stem": "G50238 Report {month} {year}",
          "splunk": {"base_url": "https://splunk.example:8089", "username_env": "REPORT_USER",
                     "password_env": "REPORT_PASSWORD", "verify_tls": True},
          "pdf": {"web_base_url": "https://splunk.example:8000"}}
ENV = {"REPORT_USER": "fixture", "REPORT_PASSWORD": "fixture-secret"}
NEWS = SecurityNewsArticle("n1", "news@example.com", "Security advisory", "<p>Supported security advisory.</p>")


def settings(config=None):
    return build_settings(config or CONFIG, "2026-09-01", "2026-09-30", ENV)


def payload(count=1):
    return {"report_id": "50238", "headers": list(HEADERS), "cases": [
        {"RuleName_EN": f"Rule {i}", "Severity": ("CRITICAL", "HIGH", "MEDIUM")[i % 3],
         "TicketTime": "2026-09-13 15:00:00", "Ticketnumber": f"000502382026091315{i:04}",
         "Status": "Open", "Reason": "Customer confirmed authorized maintenance."} for i in range(count)]}


def dashboard():
    return ('<dashboard><label>Report</label><row><panel><html>'
            '<p>Reporting Period: 1 July 2026 - 31 July 2026</p></html></panel></row>'
            '<row><panel><html><h1>C. Executive Summary</h1><p>Old</p></html></panel></row>'
            '<row><panel><html><h1>F. Security Analysis</h1><p>Old</p></html></panel></row>'
            '<row><panel><html><h1>H. Security News</h1><p>Old</p></html></panel></row></dashboard>')


class ConfigurationAndModelTests(unittest.TestCase):
    def test_explicit_settings_do_not_read_environment_files_and_clones_are_unique(self):
        with patch.object(Path, "read_text", side_effect=AssertionError("Unexpected file read")):
            first, second = settings(), settings()
        self.assertNotEqual(first.reports[0].clone_view, second.reports[0].clone_view)
        self.assertNotEqual(first.reports[0].clone_view, CONFIG["template"]["view"])
        self.assertIsNone(first.pdf_chrome.chrome_binary)

    def test_invalid_settings_fail_before_rendering(self):
        for change, message in [
            (lambda c: c.update(output_stem="../escape"), "safe filename"),
            (lambda c: c["splunk"].update(base_url="https://user:secret@example.com"), "embedded credentials"),
            (lambda c: c["pdf"].update(wait_seconds=float("inf")), "finite"),
            (lambda c: c["pdf"].update(chrome={}), "unsupported"),
        ]:
            config = copy.deepcopy(CONFIG)
            change(config)
            with self.subTest(config=config), self.assertRaisesRegex(ValueError, message):
                settings(config)
        with self.assertRaisesRegex(ValueError, "credentials"):
            build_settings(CONFIG, "2026-09-01", "2026-09-30", {})

    def test_canonical_validation_precedes_output_creation(self):
        data = payload()
        del data["cases"][0]["RuleName_EN"]
        with tempfile.TemporaryDirectory() as root:
            destination = Path(root) / "outputs"
            with patch("soc_agent_reports.report_service.create_workbook") as workbook:
                with self.assertRaisesRegex(ValueError, r"cases\[0\]\.RuleName_EN"):
                    generate_report(data, destination, configuration=CONFIG, period_start="2026-09-01",
                                    period_end="2026-09-30", environment=ENV, security_news=NEWS)
                workbook.assert_not_called()
            self.assertFalse(destination.exists())
        with self.assertRaisesRegex(ValueError, "JSON object"):
            build_report_model("report.json", settings())

    def test_default_templates_keep_all_incidents_in_bounded_tables_and_soc_voice(self):
        model = build_report_model(payload(49), settings())
        root = ET.fromstring(f"<root>{model.security_analysis_html}</root>")
        self.assertEqual(len(root.findall("h2")), 3)
        self.assertEqual(len(root.findall(".//tbody/tr")), 49)
        self.assertTrue(all(len(table.findall("tbody/tr")) <= 6 for table in root.findall("table")))
        summary = ET.fromstring(f"<root>{model.executive_summary_html}</root>")
        self.assertEqual(len(summary.findall("p")), 5)
        self.assertTrue(all((p.text or "").startswith(("We", "Our")) for p in summary.findall("p")))

    def test_completed_sections_are_sanitized_and_customer_remarks_preserved(self):
        data = payload()
        data.update(executive_summary_html='<p onclick="unsafe()">We reviewed these cases.</p>',
                    security_analysis_html="<p>Customer confirmed testing.</p>")
        model = build_report_model(data, settings())
        self.assertNotIn("onclick", model.executive_summary_html)
        self.assertEqual(model.cases[0].reason, data["cases"][0]["Reason"])

    def test_reused_security_news_conversion_strips_email_boilerplate_and_unsafe_markup(self):
        fragment = sanitize_security_news('<html><body><table><tr><td>CAUTION: External sender</td></tr></table>'
                                          '<h2 onclick="bad()">Advisory</h2><script>unsafe()</script><p>Safe text.</p></body></html>')
        self.assertEqual(fragment, '<h2>Advisory</h2><p>Safe text.</p>')
        self.assertEqual(sanitize_security_news('', 'Plain & readable article.'), '<p>Plain &amp; readable article.</p>')


class WorkbookTests(unittest.TestCase):
    def test_workbook_stores_case_ids_as_full_literal_strings_and_numeric_dates(self):
        data = payload(3)
        data["cases"][0]["RuleName_EN"] = "=HYPERLINK(\"https://example.com\")"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.xlsx"
            create_workbook(build_report_model(data, settings()), path)
            with zipfile.ZipFile(path) as archive:
                ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                shared = ET.fromstring(archive.read("xl/sharedStrings.xml"))
                strings = ["".join(node.itertext()) for node in shared.findall("s:si", ns)]
                sheets = ET.fromstring(archive.read("xl/workbook.xml"))
                self.assertEqual([s.get("name") for s in sheets.findall("s:sheets/s:sheet", ns)],
                                 ["Critical", "High", "Medium"])
                self.assertIn(data["cases"][0]["Ticketnumber"], strings)
                for i in range(1, 4):
                    sheet = ET.fromstring(archive.read(f"xl/worksheets/sheet{i}.xml"))
                    self.assertFalse(sheet.findall(".//s:f", ns))
                    case_id = sheet.find('.//s:c[@r="D2"]', ns)
                    self.assertEqual(case_id.get("t"), "s")
                    date = sheet.find('.//s:c[@r="C2"]/s:v', ns)
                    self.assertGreater(float(date.text), 40000)


class RenderingAndFailureTests(unittest.TestCase):
    def test_success_returns_only_the_completed_pair_and_accepts_plain_news_headings(self):
        def workbook(model, destination):
            destination.write_bytes(b"workbook fixture")

        def render(model, config, directory, *, security_news):
            destination = directory / model.pdf_filename
            destination.write_bytes(b"%PDF fixture")
            self.assertIn("Advisory title", security_news.html_fragment)
            return destination

        news = SecurityNewsArticle("n1", "sender", "subject", "<h2>Advisory title</h2><p>Article evidence.</p>")
        with tempfile.TemporaryDirectory() as directory:
            with patch("soc_agent_reports.report_service.create_workbook", side_effect=workbook), \
                 patch("soc_agent_reports.report_service.generate_pdf", side_effect=render):
                result = generate_report(payload(), directory, configuration=CONFIG, period_start="2026-09-01",
                                         period_end="2026-09-30", environment=ENV, security_news=news)
            self.assertEqual(set(p.suffix for p in result.excel_path.parent.iterdir()), {".xlsx", ".pdf"})
            self.assertTrue(result.pdf_path.is_file())
            self.assertFalse((result.excel_path.parent / ".work").exists())

    def test_clone_cleanup_runs_even_if_creation_or_rendering_fails(self):
        model = build_report_model(payload(), settings())
        for stage in ("create_clone", "render_dashboard_pdf"):
            with self.subTest(stage=stage), tempfile.TemporaryDirectory() as directory:
                with patch.object(pdf, "fetch_source_xml", return_value=dashboard()), \
                     patch.object(pdf, "create_clone"), patch.object(pdf, "render_dashboard_pdf"), \
                     patch.object(pdf, stage, side_effect=RuntimeError("fixture failure")), \
                     patch.object(pdf, "delete_clone") as cleanup:
                    with self.assertRaisesRegex(RuntimeError, "fixture failure"):
                        pdf.generate_pdf(model, settings(), Path(directory), security_news=NEWS)
                    cleanup.assert_called_once()

    def test_cleanup_failure_surfaces_instead_of_success(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch("soc_agent_reports.report_service.create_workbook"), \
                 patch("soc_agent_reports.report_service.generate_pdf", side_effect=pdf.CloneCleanupError("fixture-secret")):
                with self.assertRaises(ReportGenerationError) as raised:
                    generate_report(payload(), directory, configuration=CONFIG, period_start="2026-09-01",
                                    period_end="2026-09-30", environment=ENV, security_news=NEWS)
                self.assertEqual(raised.exception.code, "cleanup_failed")
                self.assertNotIn("fixture-secret", str(raised.exception))

    def test_stage_errors_are_safe_and_distinct(self):
        for method, code in (("create_workbook", "excel_generation_failed"), ("generate_pdf", "pdf_generation_failed")):
            with self.subTest(method=method), tempfile.TemporaryDirectory() as directory:
                with patch("soc_agent_reports.report_service.create_workbook"), \
                     patch(f"soc_agent_reports.report_service.{method}", side_effect=RuntimeError("fixture-secret")):
                    with self.assertRaises(ReportGenerationError) as raised:
                        generate_report(payload(), directory, configuration=CONFIG, period_start="2026-09-01",
                                        period_end="2026-09-30", environment=ENV, security_news=NEWS)
                    self.assertEqual(raised.exception.code, code)
                    self.assertNotIn("fixture-secret", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
