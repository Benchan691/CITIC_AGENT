# @citic/soc-memory

Tenant-isolated persistent long-term memory for the CITIC SOC Agent. This package is a local SOC-focused fork based on [`haitang1/dsh-memory`](https://github.com/haitang1/dsh-memory), adapted to the CITIC host policy and deployment model.

The model-facing surface is intentionally small:

- `soc_memory_search` and `soc_memory_read` are read-only.
- `soc_memory_add`, `soc_memory_correct`, and `soc_memory_forget` are approval-gated writes.

Customer and incident identifiers are resolved by the host context registry. Tool arguments accept only the scope kind (`global`, `analyst`, `customer`, or `incident`); arbitrary tenant IDs and cross-customer searches are rejected. Memory is stored locally under separate scope directories with restrictive permissions, bounded content, provenance, confidence, verification/expiry state, duplicate reinforcement, supersession, and content-free audit events.

The CITIC host binds the resolved context in-process through `socMemoryContext`; deployment environment variables (`DSH_SOC_CUSTOMER_ID`, `DSH_SOC_ANALYST_ID`, and `DSH_SOC_INCIDENT_ID`) provide a safe default. Tenant binding is not exposed through the browser/settings RPC channel.

The default rollout is `read-only`. Manual writes can be enabled explicitly after isolation tests pass; automatic candidate extraction and consolidation are later phases. Memory is historical context, never current evidence, and raw Splunk/Zimbra content, secrets, full emails, attachments, and tool results are not captured automatically.

Administrative consumers can inspect `MemoryStore.listSummaryHistory()` and use its lock-protected `rollbackSummary()` API; history and rollback are intentionally not registered as model-facing tools.
