# Splunk MCP Server 2.0 migration report

The CITIC_AGENT backend now selects the official Splunk MCP adapter whenever
`SPLUNK_MCP_ENDPOINT` is configured. The agent-facing SOC tools and their
response contracts are unchanged.

## Verification

The configured endpoint authenticated with `SPLUNK_TOKEN`, reported
`Splunk_MCP_Server` version `2.0.0`, exposed 22 tools, and passed a bounded
synthetic search. Live adapter checks verified:

- index discovery through `splunk_get_indexes`, including pagination;
- SPL execution through `splunk_run_query`, with `truncated` preserved in the
  existing evidence metadata;
- lookup catalog discovery through `splunk_get_knowledge_objects`;
- saved-search/detection lookup through `splunk_get_knowledge_objects`;
- fired-alert reads through `splunk_list_fired_alerts`;
- detection lookup and the security-queue empty-result path through the existing
  CITIC services.

The focused Python suite, including the official-client contract tests,
configuration tests, search service tests, lookup tests, and security-queue
tests passes under Python 3.12.

## Capability disposition

| Capability | Status | Notes |
| --- | --- | --- |
| SPL search | Verified official replacement | `splunk_run_query`; existing CITIC policy and resource admission remain in front. |
| Indexes | Verified official replacement | `splunk_get_indexes` with page normalization. |
| Hosts/sources metadata | Verified official replacement | `splunk_get_metadata`; unsupported metadata categories fail explicitly. |
| Sourcetypes | Verified official replacement | `splunk_get_sourcetypes`. |
| Alert catalog/details/throttles | Verified official replacement | Official 2.0 tools are exposed; fired-alert ingestion uses the official catalog tool. |
| Saved-search catalog/execution | Verified official replacement | Official knowledge-object and saved-search tools are used for supported reads. |
| Ruleset.csv lookup discovery | Verified official replacement | Official lookup knowledge objects are used. |
| Ruleset.csv complete contents | Retained CITIC compatibility path | MCP query responses are capped at 1,000 rows; complete reads use the existing bounded REST search fallback when available. |
| Lookup CSV writes | Unsupported official function | Existing approval-gated lookup editing remains local; MCP 2.0 exposes no equivalent mutation tool. |
| Detection writes | Unsupported official function | Existing draft/Save approval flow and REST implementation remain local. |
| Existing search-job SID result reads | Unsupported official function | Retained for alert ingestion because MCP exposes no SID result retrieval tool. |
| CITIC validation, planning, case correlation, evidence, and SOC logic | Retained CITIC logic | No UI, agent, prompt, or business-logic changes. |

The live Ruleset.csv complete-read check reached the existing CSV safety
validator, which rejected a formula-like cell. That rejection is preserved as
the current security behavior; it is not converted into a successful or
partial lookup result.

## Rollback and controls

Remove `SPLUNK_MCP_ENDPOINT` and restart the backend to select the legacy REST
client for supported reads. No custom tools were deleted. Official MCP errors,
authentication failures, and truncation are surfaced without unrestricted
fallback; the only fallback is the explicitly bounded, read-only compatibility
path needed for complete lookup reads.
