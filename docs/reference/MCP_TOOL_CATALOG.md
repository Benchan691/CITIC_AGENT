# MCP tool catalog

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](../zh/reference/MCP_TOOL_CATALOG.md)
> Generated from authoritative registration evidence: `apps/soc-agent/tool-inventory.js` (the single runtime-independent inventory), `apps/soc-agent/cordis.patch.yml` (raw allowlists), `apps/soc-agent/policy.js` (derived policy sets), `apps/soc-agent/splunk-bridge.js` (bridge), `apps/soc-agent/server/unified_mcp_server/server.py` + tool modules (registrations). Cross-checked by `apps/soc-agent/tests/policy.test.js`, `tests/skills.test.js`, `tests/splunk-bridge.test.js`, and `unified_mcp_server/tests/test_server_tools.py`.

**Who this is for:** developers changing the tool surface, security reviewers tracing what the model can invoke, and anyone debugging "duplicate-looking" tool names.

**What you will understand:** every callable name in the system, its namespace, class, policy behavior, and the tests that pin it — plus the name shapes that are *not* MCP tools.

**Naming anatomy (see [MCP_AND_TOOL_ROUTING.md](../MCP_AND_TOOL_ROUTING.md) for prose):**
`mcp__<server>__<raw-tool>` — e.g. `mcp__splunk_mcp__splunk_run_query` (the word `splunk` appears in both portions; still one server).
Non-MCP shapes: `ui__soc_agent__send_email` (UI-confirmed catalog entry, calls the `send-email` host RPC — not an MCP tool) and `skill` (host-provided skill-loading tool, unprefixed).

**Single source of truth (new this round):** `apps/soc-agent/tool-inventory.js` exports `OFFICIAL_SPLUNK_TOOL_NAMES`, `TOOL_CATALOG`, and `SUBSCRIPTION_READ_TOOLS`; `policy.js` derives its sets from it and `splunk-bridge.js` imports the raw names from it. The Python registration count is pinned to the same inventory by tests.

Counts at this commit: **28** `soc_agent` tools registered (asserted exact by Python `test_server_tools.py` — `len(tools) == 28` — and by the JS patch-allowlist test), **13** `splunk_mcp` read tools, **1** `skill` host tool, plus 2 harness control tools (`ask_user_question`, `exit_plan_mode`). Derived policy sets: **30** read-only, **42** domain, **12** approval tools (pinned by `policy.test.js`: `READ_ONLY_TOOLS.length == 30`, `DOMAIN_TOOLS.size == 42`).

---

## 1. `soc_agent` — Zimbra mail tools (13)

Identity source for all: the authenticated app session (`soc_session_id` metadata → `identity_for_session` → the user's own Zimbra token; `account_id` selection is rejected with `account_selection_disabled`). External dependency: Zimbra SOAP (`ZIMBRA_HOST`).

| Raw name | Fully qualified name | Purpose | Class | Default action state | Extra gate / confirmation | Tests |
|---|---|---|---|---|---|---|
| `zimbra_list_folders` | `mcp__soc_agent__zimbra_list_folders` | List folders + counts | read | auto | — | `test_zimbra_service.py`, `policy.test.js` |
| `zimbra_search_emails` | `mcp__soc_agent__zimbra_search_emails` | One page of message metadata | read | auto | query validated pre-network | `test_zimbra_service.py` |
| `zimbra_get_email` | `mcp__soc_agent__zimbra_get_email` | One message; bounded body (default 20 k, clamped ≤100 k chars) | read | auto | — | `test_zimbra_service.py` |
| `zimbra_get_email_headers` | `mcp__soc_agent__zimbra_get_email_headers` | Selected auth/routing headers only (allowlist of 12; 1–12 per call) | read | auto | — | `test_zimbra_service.py` |
| `zimbra_get_attachment_text` | `mcp__soc_agent__zimbra_get_attachment_text` | Bounded attachment → Markdown | read | auto | size/char limits; converter codes `attachment_*` | `test_zimbra_service.py` |
| `zimbra_send_email` | `mcp__soc_agent__zimbra_send_email` | **Creates a local draft only — never sends, never persists.** UI label: "Create email draft" | read-classified (in `READ_ONLY_TOOLS`) | auto | recipients validated; draft returned in the tool result for the UI | `test_zimbra_service.py`, `email-draft-toolview.test.ts` |
| `zimbra_forward_email` | `mcp__soc_agent__zimbra_forward_email` | **New:** prepares a browser-editable **forward draft** from one message ("Forward email (draft)"); reads the source message and embeds `forward_message_id` + `forwarded_message` metadata (subject/from/date/body/attachments). **Never sends or saves to Zimbra** | read-classified (`readOnlyHint: true`) | auto | params `{message_id, to, cc, bcc, subject, body}`; required `{message_id, to}` | `test_server_tools.py` (forward schema), `test_zimbra_service.py` |
| `zimbra_use_signature_on_email` | `mcp__soc_agent__zimbra_use_signature_on_email` | Editable draft with signature merged; docstring: "it never sends" | read-classified | auto | — | `test_zimbra_service.py` |
| `zimbra_list_signatures` | `mcp__soc_agent__zimbra_list_signatures` | List signatures (text + HTML) | read | auto | — | — |
| `zimbra_create_folder` | `mcp__soc_agent__zimbra_create_folder` | Create one direct child folder | mutation | ask | `ZIMBRA_ALLOW_FOLDER_WRITE` | `ACTION_CATALOG`, `test_zimbra_service.py` |
| `zimbra_move_email` | `mcp__soc_agent__zimbra_move_email` | Move message to a validated folder | mutation | ask | `ZIMBRA_ALLOW_MOVE`; verify + rollback payload | `test_zimbra_service.py` |
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

Server: `splunk_mcp`, registered by `splunk-bridge.js` only when `SPLUNK_MCP_ENDPOINT` + `SPLUNK_TOKEN` are configured (`failOnStartupError: true`, timeout 185 s, TLS verified by default; the endpoint URL is validated — no embedded credentials/query/fragment, plain HTTP requires `SPLUNK_ALLOW_INSECURE_HTTP=true`). Identity source: the bridge's service token (Bearer) — not per-user. These tools are all in `OFFICIAL_SPLUNK_READ_TOOLS` ⊂ `READ_ONLY_TOOLS`, default action state `auto`. The external Splunk MCP server applies its own guardrails; local results still pass the investigation projection (card/SSN masking, 50 KB truncation). The raw names come from `tool-inventory.js` — the same module policy.js uses.

| Raw name | Fully qualified name | Purpose |
|---|---|---|
| `splunk_run_query` | `mcp__splunk_mcp__splunk_run_query` | Execute a bounded search query |
| `splunk_get_info` | `mcp__splunk_mcp__splunk_get_info` | Instance info (also the admin connection-check probe) |
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

No `splunk_(create|update|delete|write)_*` name exists in the inventory (asserted by `splunk-bridge.test.js` / `skills.test.js`).

## 5. Host-provided and non-MCP names

| Name | What it is | Class / policy | Notes |
|---|---|---|---|
| `skill` | Harness `tool-skill` plugin tool: load a skill's instructions | read (`READ_ONLY_TOOLS`), default auto | Unprefixed (no `mcp__`); part of `DOMAIN_TOOLS` |
| `ask_user_question`, `exit_plan_mode` | Harness interaction tools | allowed via `host.js` `CONTROL_TOOLS` in addition to `DOMAIN_TOOLS` | Deny list catches everything else |
| `ui__soc_agent__send_email` | Catalog entry (`kind: 'ui-confirmed'`) rendered in the admin checklist with an "Explicit confirmation" badge | Not a tool. Cannot be automated | Delivery path: draft view → `window.confirm` → `send-email` RPC → control channel → `ZimbraMailService.send_email` (gate `ZIMBRA_ALLOW_SEND`; now accepts `forward_message_id` for forward delivery) |

## 6. Forwarding flow (new this round)

1. Model calls `zimbra_forward_email {message_id, to, …}` → `ZimbraMailService.create_forward_draft` reads the source message, builds a **local** draft with subject `Fwd: …`, attaches `forward_message_id` and `forwarded_message` metadata. Nothing is sent or saved.
2. The draft card (keyed on the forward tool name) shows the original message metadata; the user edits and confirms Send.
3. The `send-email` RPC carries `forward_message_id`; `auth_cli send-email` passes it to `ZimbraMailService.send_email`, which delivers **with the original message and its attachments** via `zimbra_forward_message` (SOAP), still gated by `ZIMBRA_ALLOW_SEND`.

So a forward is one read-classified draft step plus the same human-confirmed send path as any other email — the model still has no send tool.

## 7. Removed implementations (previously "retained")

The entire Python Splunk stack was **deleted** this round: `splunk/**` (search, detection, security queue, core), `splunk_service.py`, `detection.py`, and their tests. The detection/SPL skills (`detection-engineering`, `spl-writing`, parts of `false-positive-analysis`) therefore reference tools that no longer exist anywhere in the repository — see [DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md) §6/§8. `test_server_tools.py` continues to assert that **no** `splunk_*` tool is registered on `soc_agent`.
