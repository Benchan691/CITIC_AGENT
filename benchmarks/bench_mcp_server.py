#!/usr/bin/env python3
"""Bench-mode entrypoint for the SOC Agent MCP server.

Boots the REAL unified MCP server (same tools, guardrails, approval flow and
Splunk target) with one bench-only difference: the Zimbra session gate is
replaced by a synthetic identity so the benchmark can run the agent headlessly
without a browser login.

Bench-only: never use this entrypoint in production. The synthetic identity is
`bench@soc-bench.local` and appears in any audit output the server produces.
"""

from unified_mcp_server import server as srv
from unified_mcp_server.auth import ZimbraIdentity

IDENTITY = ZimbraIdentity(
    user_id="bench",
    zimbra_email="bench@soc-bench.local",
    zimbra_token="bench-not-a-real-token",
    session_id="bench-session",
)

srv.identity_for_session = lambda store, session_id: IDENTITY

if __name__ == "__main__":
    srv.main()
