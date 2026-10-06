"""One report-generation MCP action backed by the registered DSH report plugin."""

from __future__ import annotations

from typing import Any
from mcp.server.fastmcp import Context

from .service import CustomerReportService


def register_tools(server, *, get_runtime, execute) -> None:
    @server.tool(annotations={"readOnlyHint": False, "destructiveHint": False})
    async def generate_customer_report(ctx: Context, customer_id: str,
                                       period_start: str | None = None,
                                       period_end: str | None = None,
                                       reported_security_incidents: int | None = None) -> dict[str, Any]:
        """Generate a customer’s Excel and PDF reports from their configured email folder or label.

        Use customer_id from the user’s Customer Reports settings. Optional
        period_start and period_end must both be YYYY-MM-DD; omitting both uses
        the previous completed month in Hong Kong time. The authenticated email
        account and customer settings are resolved server-side. This reads email,
        validates report JSON, and runs the report plugin, including its temporary
        Splunk dashboard render. Success returns two downloadable session files.
        Customer true/false-positive remarks require an explicit configured
        customer sender and an explicit verdict in that customer’s reply.
        """
        return await execute(ctx, "reports", "generate_customer_report", lambda: CustomerReportService(get_runtime(ctx)).generate(customer_id, period_start, period_end, reported_security_incidents))
