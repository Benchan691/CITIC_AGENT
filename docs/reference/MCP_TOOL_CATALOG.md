# MCP tool catalog

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.
> Generated from authoritative registration evidence: `apps/soc-agent/cordis.patch.yml` (raw allowlists), `apps/soc-agent/policy.js` (qualified policy names), `apps/soc-agent/splunk-bridge.js` (bridge allowlist), `apps/soc-agent/server/unified_mcp_server/server.py` + tool modules (registrations). Cross-checked by `apps/soc-agent/tests/policy.test.js`, `tests/skills.test.js`, `tests/splunk-bridge.test.js`, and `unified_mcp_server/tests/test_server_tools.py`.

**Who this is for:** developers changing the tool surface, security reviewers tracing what the model can invoke, and anyone debugging "duplicate-looking" tool names.

**What you will understand:** every callable name in the system, its namespace, class, policy behavior, and the tests that pin it — plus the name shapes that are *not* MCP tools.

**Naming anatomy (see [MCP_AND_TOOL_ROUTING.md](../MCP_AND_TOOL_ROUTING.md) for prose):**
`mcp__<server>__<raw-tool>` — e.g. `mcp__splunk_mcp__splunk_run_query` (the word `splunk` appears in both portions; still one server).
Non-MCP shapes: `ui__soc_agent__send_email` (UI-confirmed catalog entry, calls the `send-email` host RPC — not an MCP tool) and `skill` (host-provided skill-loading tool, unprefixed).

Counts at this commit: **27** `soc_agent` tools (asserted exact by Python `test_server_exposes_exact_domain_tool_set` and JS `soc_agent MCP allowlist contains only Zimbra and subscription tools`), **13** `splunk_mcp` read tools, **1** `skill` host tool, plus 2 harness control tools (`ask_user_question`, `exit_plan_mode`) allowed by `host.js` `CONTROL_TOOLS`. Derived policy sets: 29 read-only, 41 domain, 12 approval tools (pinned by `policy.test.js`).

---

## 1. `soc_agent` — Zimbra mail tools (12)

Identity source for all: the authenticated app session (`soc_session_id` metadata → `identity_for_session` → the user's own Zimbra token; `account_id` selection is rejected with `account_selection_disabled`). External dependency: Zimbra SOAP (`ZIMBRA_HOST`).

| Raw name | Fully qualified name | Purpose | Class | Default action state | Extra gate / confirmation | Tests |
|---|---|---|---|---|---|---|
| `zimbra_list_folders` | `mcp__soc_agent__zimbra_list_folders` | List folders + counts | read | auto | — | `test_zimbra_service.py`, `policy.test.js` |
| `zimbra_search_emails` | `mcp__soc_agent__zimbra_search_emails` | One page of message metadata | read | auto | query validated pre-network | `test_zimbra_service.py` |
| `zimbra_get_email` | `mcp__soc_agent__zimbra_get_email` | One message; bounded body (default 20 k, max 100 k chars) | read | auto | — | `test_zimbra_service.py` |
| `zimbra_get_email_headers` | `mcp__soc_agent__zimbra_get_email_headers` | Selected auth/routing headers only (allowlist of 12) | read | auto | — | `test_zimbra_service.py` |
| `zimbra_get_attachment_text` | `mcp__soc_agent__zimbra_get_attachment_text` | Bounded attachment → Markdown | read | auto | size/char limits; converter codes `attachment_*` | `test_zimbra_service.py` |
| `zimbra_send_email` | `mcp__soc_agent__zimbra_send_email` | **Creates a local draft only — never sends, never persists.** UI label: "Create email draft" | read-classified (in `READ_ONLY_TOOLS`) | auto | recipients validated; draft returned in the tool result for the UI | `test_zimbra_service.py` ("local-only drafts"), `email-draft-toolview.test.ts` |
| `zimbra_forward_email` | `mcp__soc_agent__zimbra_forward_email` | Reads one message and creates an editable forward draft with a bounded source preview. `message_id` and `to` are required; `body` is an optional note; `subject`, `cc`, `bcc` are optional. Original content and attachments are included by `zimbra-client.forward_message` at send time. | read | auto | Numeric ID in the authenticated mailbox; explicit draft Send; `ZIMBRA_ALLOW_SEND` | `test_zimbra_service.py` (draft → private command → native package), `email-draft-toolview.test.ts` |
| `zimbra_use_signature_on_email` | `mcp__soc_agent__zimbra_use_signature_on_email` | Editable draft with signature merged; docstring: "it never sends" | read-classified | auto | — | `test_zimbra_service.py` |
| `zimbra_list_signatures` | `mcp__soc_agent__zimbra_list_signatures` | List signatures (text + HTML) | read | auto | — | — |
| `zimbra_create_folder` | `mcp__soc_agent__zimbra_create_folder` | Create one direct child folder | mutation | ask | `ZIMBRA_ALLOW_FOLDER_WRITE` | `ACTION_CATALOG`, `test_zimbra_service.py` |
| `zimbra_move_email` | `mcp__soc_agent__zimbra_move_email` | Move message to a validated folder | mutation | ask | `ZIMBRA_ALLOW_MOVE`; verify + rollback payload | `test_zimbra_service.py` ("gated+verified moves") |
| `zimbra_create_signature` | `mcp__soc_agent__zimbra_create_signature` | Create signature | mutation | ask | `ZIMBRA_ALLOW_SIGNATURE_WRITE` | `test_zimbra_service.py` |
| `zimbra_delete_signature` | `mcp__soc_agent__zimbra_delete_signature` | Delete signature by id | mutation | ask | `ZIMBRA_ALLOW_SIGNATURE_WRITE` | `test_zimbra_service.py` |

## 2. `soc_agent` — Zimbra filter tools (9)

All writes replace the **complete** rule set and require `expected_fingerprint` (SHA-256 of the live rules) — mismatch → `filter_rules_changed`. Write gate: `ZIMBRA_ALLOW_FILTER_WRITE`; redirect/discard semantics additionally gated by `ZIMBRA_ALLOW_FILTER_REDIRECT` / `ZIMBRA_ALLOW_FILTER_DISCARD`.

| Raw name | Fully qualified name | Purpose | Class | Default action state | Tests |
|---|---|---|---|---|---|
| `zimbra_list_email_filters` | `mcp__soc_agent__zimbra_list_email_filters` | List rules (+ fingerprint) | read | auto | `test_zimbra_filters.py` |
| `zimbra_get_email_filter` | `mcp__soc_agent__zimbra_get_email_filter` | One rule | read | auto | `test_zimbra_filters.py` |
| `zimbra_validate_email_filter` | `mcp__soc_agent__zimbra_validate_email_filter` | Validate without writing | read | auto | `test_zimbra_filters.py` |
| `zimbra_preview_email_filter_update` | `mcp__soc_agent__zimbra_preview_email_filter_update` | Merged proposed rule + changed fields, no write | read | auto | `test_zimbra_filters.py` |
| `zimbra_create_email_filter` | `mcp__soc_agent__zimbra_create_email_filter` | Create rule | mutation | ask | `test_zimbra_filters.py` |
| `zimbra_update_email_filter` | `mcp__soc_agent__zimbra_update_email_filter` | Update rule | mutation | ask | `test_zimbra_filters.py` |
| `zimbra_delete_email_filter` | `mcp__soc_agent__zimbra_delete_email_filter` | Delete rule | mutation | ask | `test_zimbra_filters.py` |
| `zimbra_set_email_filter_enabled` | `mcp__soc_agent__zimbra_set_email_filter_enabled` | Enable/disable rule | mutation | ask | `test_zimbra_filters.py` |
| `zimbra_reorder_email_filter` | `mcp__soc_agent__zimbra_reorder_email_filter` | Reorder (1-based position) | mutation | ask | `test_zimbra_filters.py` |

## 3. `soc_agent` — subscription tools (6)

External dependency: subscription web service (`SUBSCRIPTION_SERVER_URL`, form login, redirect-validated). Identity source: service credentials from environment (not per-user).

| Raw name | Fully qualified name | Purpose | Class | Default action state | Tests |
|---|---|---|---|---|---|
| `list_subscriptions` | `mcp__soc_agent__list_subscriptions` | `GET /api/subscriptions` | read | auto | `test_email_service.py` |
| `get_subscription_schema` | `mcp__soc_agent__get_subscription_schema` | Live schema/fields/limits | read | auto | `test_email_service.py` |
| `preview_subscription` | `mcp__soc_agent__preview_subscription` | Dry-run create/update validation | read | auto | `test_email_service.py` |
| `create_subscription` | `mcp__soc_agent__create_subscription` | `POST /api/subscriptions` | mutation | ask | `ACTION_CATALOG` |
| `update_subscription` | `mcp__soc_agent__update_subscription` | `PUT /api/subscriptions/{email}` | mutation | ask | `ACTION_CATALOG` |
| `delete_subscription` | `mcp__soc_agent__delete_subscription` | `DELETE /api/subscriptions/{email}` | mutation | ask | `ACTION_CATALOG` |

## 4. `splunk_mcp` — official Splunk read tools (13, bridge allowlist)

Server: `splunk_mcp`, registered by `splunk-bridge.js` only when `SPLUNK_MCP_ENDPOINT` + `SPLUNK_TOKEN` are configured (`failOnStartupError: true`, timeout 185 s, TLS verified by default). Identity source: the bridge's service token (Bearer) — not per-user. These tools are all in `OFFICIAL_SPLUNK_READ_TOOLS` ⊂ `READ_ONLY_TOOLS`, default action state `auto`. The external Splunk MCP server applies its own guardrails; local results still pass the investigation projection (card/SSN masking, 50 KB truncation).

| Raw name | Fully qualified name | Purpose |
|---|---|---|
| `splunk_run_query` | `mcp__splunk_mcp__splunk_run_query` | Execute a bounded search query |
| `splunk_get_info` | `mcp__splunk_mcp__splunk_get_info` | Instance info |
| `splunk_get_indexes` | `mcp__splunk_mcp__splunk_get_indexes` | List indexes |
| `splunk_get_index_info` | `mcp__splunk_mcp__splunk_get_index_info` | Index details |
| `splunk_get_metadata` | `mcp__splunk_mcp__splunk_get_metadata` | Metadata (sourcetypes/hosts/sources) |
| `splunk_get_knowledge_objects` | `mcp__splunk_mcp__splunk_get_knowledge_objects` | Lookup/KO discovery |
| `splunk_run_saved_search` | `mcp__splunk_mcp__splunk_run_saved_search` | Execute a saved search |
| `splunk_list_alerts` | `mcp__splunk_mcp__splunk_list_alerts` | List alert definitions |
| `splunk_get_alert_details` | `mcp__splunk_mcp__splunk_get_alert_details` | One alert definition |
| `splunk_list_fired_alerts` | `mcp__splunk_mcp__splunk_list_fired_alerts` | Triggered alert instances |
| `splunk_get_fired_alert_details` | `mcp__splunk_mcp__splunk_get_fired_alert_details` | One fired alert |
| `splunk_get_alert_throttle` | `mcp__splunk_mcp__splunk_get_alert_throttle` | Throttle config of an alert |
| `splunk_list_active_throttles` | `mcp__splunk_mcp__splunk_list_active_throttles` | Active throttles |

No `splunk_(create|update|delete|write)_*` name exists in the allowlist (asserted by `splunk-bridge.test.js` / `skills.test.js`).

## 5. Host-provided and non-MCP names

| Name | What it is | Class / policy | Notes |
|---|---|---|---|
| `skill` | Harness `tool-skill` plugin tool: load a skill's instructions | read (`READ_ONLY_TOOLS`), default auto | Unprefixed (no `mcp__`); part of `DOMAIN_TOOLS` |
| `ask_user_question`, `exit_plan_mode` | Harness interaction tools | allowed via `host.js` `CONTROL_TOOLS` in addition to `DOMAIN_TOOLS` | Deny list catches everything else |
| `ui__soc_agent__send_email` | Catalog entry (`kind: 'ui-confirmed'`) rendered in the admin checklist with an "Explicit confirmation" badge | Not a tool. Cannot be automated | Delivery path: draft view → `window.confirm` → RPC `send-email` → control channel → `ZimbraMailService.send_email` (gate `ZIMBRA_ALLOW_SEND`) |

## 6. Registered-in-code but NOT registered on the server (retained)

`unified_mcp_server/splunk/*/tools.py` define `register_tools` for ~18 more tools (e.g. `splunk_search`, `splunk_validate_query`, `splunk_get_detection`, `splunk_validate_detection`, `splunk_compile_citic_detection`, `splunk_backtest_detection`, `splunk_list_security_findings`, `soc_evidence_read`, …). **None is registered** — `server.py` calls only `register_mail_tools`, `register_filter_tools`, `register_email_tools`, and both test suites assert no `splunk_*` tool on `soc_agent`. Skills reference some of these names as *future/retained* vocabulary (e.g. `detection-engineering`); at this commit those tools exist only in the retained implementation. See [DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md) → "Skills referencing unregistered tools".
