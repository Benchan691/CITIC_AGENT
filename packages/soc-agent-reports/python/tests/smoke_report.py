"""Real browser/workbook smoke using only a controlled local dashboard fixture.

Run explicitly with the installed plugin and its Playwright Chromium browser.
No production backend, mailbox, account, or persistent dashboard is accessed.
"""

from __future__ import annotations

import json
import tempfile
import threading
import xml.etree.ElementTree as ET
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from pypdf import PdfReader

from soc_agent_reports import ReportGenerationError, SecurityNewsArticle, generate_report
from soc_agent_reports.report_model import HEADERS


def source_dashboard():
    sections = [
        ('Report Pipeline Smoke Fixture', '<p>Reporting Period: 1 July 2026 - 31 July 2026</p>'),
        ('Table of Contents', ''.join(f'<p>{title} ........ 1</p>' for title in (
            'A. Customer Information', 'C. Executive Summary', 'D. Security Overview',
            'E. Reported Security Incidents', 'F. Security Analysis', 'H. Security News'))),
        ('A. Customer Information', '<p>Controlled local fixture. No customer data is used.</p>'),
        ('C. Executive Summary', '<p>Original summary.</p>'),
        ('D. Security Overview', '<p>Controlled fixture dashboard overview.</p>'),
        ('E. Reported Security Incidents', '<p>Reported Security Incidents: 18</p>'),
        ('F. Security Analysis', '<p>Original analysis.</p>'),
        ('H. Security News', '<p>Original news.</p>'),
    ]
    return '<dashboard><label>Controlled Fixture Report</label>' + ''.join(
        f'<row><panel><html><h1>{heading}</h1>{body}</html></panel></row>' for heading, body in sections
    ) + '</dashboard>'


class FixtureServer(ThreadingHTTPServer):
    def __init__(self):
        super().__init__(("127.0.0.1", 0), FixtureHandler)
        self.clones = {}
        self.created = []
        self.deleted = []
        self.force_timeout = False


class FixtureHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def respond(self, status, data, *, kind="application/json", cookie=None):
        content = data.encode() if isinstance(data, str) else data
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Content-Security-Policy", "default-src 'none';style-src 'unsafe-inline'")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/en-US/account/login":
            return self.respond(200, "Fixture login", kind="text/html", cookie="cval=fixture; Path=/")
        if path.startswith("/servicesNS/admin/search/data/ui/views/"):
            name = path.rsplit("/", 1)[1]
            xml = source_dashboard() if name == "source_report" else self.server.clones.get(name)
            return self.respond(200, json.dumps({"entry": [{"content": {"eai:data": xml}}]})) if xml else self.respond(404, "{}")
        if path.startswith("/en-US/app/search/"):
            name = path.rsplit("/", 1)[1]
            xml = self.server.clones.get(name)
            if not xml:
                return self.respond(404, "Missing local clone", kind="text/html")
            panels = []
            for node in ET.fromstring(xml).findall("row/panel/html"):
                inner = (node.text or "") + ''.join(ET.tostring(child, encoding="unicode") for child in node)
                panels.append(f'<div class="dashboard-panel"><div class="dashboard-element-html"><div class="panel-body html">{inner}</div></div></div>')
            html = '<!doctype html><html><head><title>Controlled Fixture Report</title><style>body {font-family:Arial,sans-serif;font-size:11pt;line-height:1.4;color:#202020} h1 {font-size:20pt} .panel-body {padding:14px} table {width:100%}</style></head><body>' + ''.join(panels) + '</body></html>'
            if self.server.force_timeout:
                html = "<!doctype html><html><head><title>Fixture</title></head><body>Waiting for data</body></html>"
            return self.respond(200, html, kind="text/html")
        return self.respond(404, "{}")

    def do_POST(self):
        path = urlsplit(self.path).path
        fields = parse_qs(self.rfile.read(int(self.headers.get("Content-Length", "0"))).decode())
        if path == "/en-US/account/login":
            return self.respond(200, "Fixture signed in", kind="text/html", cookie="splunkd_fixture=fixture; Path=/; HttpOnly")
        if path == "/servicesNS/admin/search/data/ui/views":
            name, xml = fields["name"][0], fields["eai:data"][0]
            if name in self.server.clones:
                return self.respond(409, "{}")
            self.server.clones[name] = xml
            self.server.created.append(name)
            return self.respond(201, "{}")
        return self.respond(404, "{}")

    def do_DELETE(self):
        name = unquote(urlsplit(self.path).path.rsplit("/", 1)[1])
        if name not in self.server.clones:
            return self.respond(404, "{}")
        del self.server.clones[name]
        self.server.deleted.append(name)
        return self.respond(200, "{}")


def main():
    server = FixtureServer()
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        endpoint = f"http://127.0.0.1:{server.server_port}"
        config = {"report_id": "fixture", "template": {"owner": "admin", "app": "search", "view": "source_report"},
                  "output_stem": "Controlled Report Smoke {month} {year}",
                  "splunk": {"base_url": endpoint, "username_env": "FIXTURE_USER", "password_env": "FIXTURE_PASSWORD", "verify_tls": True},
                  "pdf": {"web_base_url": endpoint, "wait_seconds": 30, "stable_seconds": 1, "settle_seconds": 0}}
        cases = [{"RuleName_EN": f"Controlled fixture rule {number}", "Severity": ("CRITICAL", "HIGH", "MEDIUM")[number % 3],
                  "TicketTime": f"2026-09-{number + 1:02} 12:30:00", "Ticketnumber": f"00050238202609{number:06}",
                  "Status": "Closed", "Reason": "False Positive. Customer confirmed authorized maintenance generated expected alerts; the reported activity was approved and matched the planned business operation."}
                 for number in range(18)]
        data = {"report_id": "fixture", "headers": list(HEADERS), "reported_security_incidents": 18, "cases": cases}
        environment = {"FIXTURE_USER": "fixture", "FIXTURE_PASSWORD": "never-return-this-fixture-secret"}
        news = SecurityNewsArticle("fixture-news", "fixture@example.com", "Controlled advisory", "<h2>Controlled security advisory</h2><p>This fixture verifies authenticated article insertion into the finished report.</p>")
        output = Path(tempfile.mkdtemp(prefix="soc-report-smoke-"))
        result = generate_report(data, output, configuration=config, period_start="2026-09-01", period_end="2026-09-30", environment=environment, security_news=news)
        reader = PdfReader(result.pdf_path)
        text = '\n'.join(page.extract_text() or '' for page in reader.pages)
        for case in cases:
            assert case["Ticketnumber"] in text, case["Ticketnumber"]
        assert "Controlled security advisory" in text
        assert "False Positive." in text
        assert "1 September 2026" in text
        assert not server.clones and server.created == server.deleted
        with zipfile.ZipFile(result.excel_path) as archive:
            shared = archive.read("xl/sharedStrings.xml").decode()
            assert all(case["Ticketnumber"] in shared for case in cases)
        server.force_timeout = True
        config["pdf"]["wait_seconds"] = 1
        try:
            generate_report(data, output / "timeout", configuration=config, period_start="2026-09-01", period_end="2026-09-30", environment=environment, security_news=news)
        except ReportGenerationError as error:
            assert error.code == "pdf_generation_failed"
            assert environment["FIXTURE_PASSWORD"] not in str(error)
        else:
            raise AssertionError("Expected dashboard render timeout")
        assert not server.clones and server.created == server.deleted
        print(json.dumps({"excel_path": str(result.excel_path), "pdf_path": str(result.pdf_path),
                          "pages": len(reader.pages), "case_count": len(cases), "clones_created_and_deleted": len(server.created),
                          "timeout_cleanup_verified": True}, indent=2))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
