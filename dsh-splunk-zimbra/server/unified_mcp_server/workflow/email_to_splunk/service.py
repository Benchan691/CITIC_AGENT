"""Dependency boundary for the future email investigation workflow."""

from dataclasses import dataclass

from unified_mcp_server.splunk.search.service import SplunkSearchService
from unified_mcp_server.zimbra.mail.service import ZimbraMailService


@dataclass(frozen=True)
class EmailToSplunkWorkflow:
    """Holds the only permitted cross-domain dependencies.

    Behavior is intentionally deferred until the workflow requirements are
    specified. No MCP tool is registered for this placeholder.
    """

    zimbra: ZimbraMailService
    splunk_search: SplunkSearchService
