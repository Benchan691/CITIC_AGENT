# Glossary

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](../zh/reference/GLOSSARY.md)

One consistent vocabulary for all Markdown pages, diagrams, and the HTML site. Add new terms here first.

## Product and people

| Term | Meaning |
|---|---|
| **SOC** | Security Operations Centre — the team monitoring customer security events. |
| **SOC Agent / "Sentinel"** | This product: a browser-based investigation assistant. "Sentinel" is the assistant persona (`citic-soc` preset). |
| **Analyst / SOC user** | A person authenticated with their own Zimbra identity; can use chat, tools, and the draft UI. |
| **Administrator** | A person authenticated with the static admin credentials (`SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD`); manages settings via `/admin`. Distinct cookie (`soc_admin_session`) from the analyst session (`soc_session`). |
| **Customer** | An external organisation whose security data may appear in evidence. Customer data must never cross customer boundaries (`AGENTS.md`). |

## Interfaces and transports

| Term | Meaning |
|---|---|
| **MCP** | Model Context Protocol — the standard by which the harness connects tool servers. Two transports are used here: `stdio` (local child process) and `streamable-http` (HTTP endpoint). |
| **`soc_agent`** | The local Python MCP server (package `soc-agent-mcp`, script `unified-mcp-server`), exposing exactly 28 Zimbra + subscription tools. |
| **`splunk_mcp`** | The MCP *server namespace* under which the bridge registers the external official Splunk MCP server's read tools. Not software in this repo — the bridge is the client. |
| **Raw tool name** | A tool's name inside its server, e.g. `splunk_run_query`. |
| **Fully qualified tool name** | `mcp__<server>__<raw-tool>`, e.g. `mcp__splunk_mcp__splunk_run_query`. The same word may appear in both portions; that does not imply two servers. |
| **`ui__` catalog entry** | A UI-confirmed action in `TOOL_CATALOG` (only `ui__soc_agent__send_email`). Not an MCP tool; never model-callable. |
| **`skill` tool** | The unprefixed host-provided tool that loads skill instructions (harness `tool-skill` plugin). |
| **Bridge** | `apps/soc-agent/splunk-bridge.js` — the client-side connection to the external official Splunk MCP endpoint. |
| **Control channel** | The persistent Python child (`unified_mcp_server.control_server`) the Node host uses for authenticated operations (login/logout/send-email/list-signatures) over stdio JSON lines. |
| **Admin CLI** | `unified_mcp_server.admin_cli`, spawned one-shot per admin operation (settings status, connectivity tests, attachment conversion, migrate). |
| **Cordis** | The vendored plugin framework (`vendor/cordis` + `vendor/loader`): plugins are objects with `apply(ctx)`, dependencies via `inject`, services via `ctx.provide`. |
| **Plugin id / plugin package / server namespace** | The three identifier layers. Example: `splunk-official-mcp` (patch id) → `dsh-soc-agent/splunk-bridge` (package) → `splunk_mcp` (server namespace). |

## Policy and safety

| Term | Meaning |
|---|---|
| **Allowlist** | The exact set of tool names the harness may register/execute: raw `allowedToolNames` in `cordis.patch.yml` per server, plus `DOMAIN_TOOLS ∪ CONTROL_TOOLS` at the host. |
| **Action catalog** | `policy.js ACTION_CATALOG` — the 12 user-facing mutation actions shown in the admin checklist. |
| **Action mode** | `Full access` (every permitted tool runs directly) or `SOC mode` (per-tool ask/auto-run/disabled honored). Deployment default in settings `soc-action-approval`; per-session override in memory. |
| **Action state** | Per-tool: `ask` (approval required), `auto` (run), `disabled` (deny). |
| **Approval** | The harness approval flow (`policy: ask`, fail-closed): a tool call with state `ask` runs only after the user approves in the UI. |
| **UI-confirmed** | A delivery that additionally requires an explicit confirmation in the draft interface (`window.confirm('Send this email now?')`) before the `send-email` RPC. |
| **Read-only default** | Investigations never mutate systems; every mutation is in `ACTION_CATALOG` and gated. |
| **Projection** | `investigation.js` post-processing of official Splunk output: PII masking + 50 KB truncation. |
| **Background injection** | `host.js` re-injecting `BACKGROUND.md` context into the conversation every N durable user prompts. |

## Splunk domain

| Term | Meaning |
|---|---|
| **SPL** | Splunk Processing Language — the search language. |
| **CITIC SPL / wrapper** | The production detection format: metadata header (`GID`, `rulename` with 4 digits, `Fix_*`/`Event_*` fields), fixed `table` order, final dynamic `outputcsv` subsearch. Produced only by `splunk_compile_citic_detection` (retained) per `skills/spl-writing`. |
| **Backtest SPL** | The derived, bounded variant without `outputcsv`, used for safe validation runs. |
| **`outputcsv`** | A Splunk command that writes search results to a lookup file. In this system it exists only inside reviewed production definitions; the application never executes it. |
| **`Ruleset.csv`** | The detection-rule catalog lookup referenced by `BACKGROUND.md` and the detection skill; read-only evidence. |
| **Fired alert** | An instance of an alert actually triggering. |
| **Detection** | A saved Splunk alert definition. This application never creates/updates/enables/disables detections; deployment is an external human process. |

## Storage and state

| Term | Meaning |
|---|---|
| **App session** | A row in `soc_app_sessions`: the authenticated login with an encrypted Zimbra token, 24 h TTL. Cookie: `soc_session`. |
| **Ownership claim** | Rows in `soc_workspace_owners`/`soc_session_owners`/`soc_folder_owners` binding harness objects to a user; enforced by the scoped API proxy. |
| **Scoped API proxy** | `ownership.js createScopedApiProxy` — filters lists and denies cross-user mutations for 9 API domains. |
| **Workspace** | A per-user directory under `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/`. "General" is auto-created and protected from rename/delete. |
| **Settings namespace** | A durable key/value group in `app_config` (e.g. `soc-action-approval`, `soc-background`, `soc-agent-markitdown-attachments`, `time-context`, `llm-pi-ai`). |
| **Tool inventory** | `apps/soc-agent/tool-inventory.js` — the single runtime-independent source of truth for every tool name; policy sets and the bridge's allowlist are derived from it. |
| **Schema migrations** | Versioned SQL files (`unified_mcp_server/migrations/*.sql`) applied by `schema.py` under a PostgreSQL advisory lock, with an applied-version ledger (`soc_schema_migrations`). The Node tier contains no DDL. |
| **Forward draft** | A local, browser-editable draft produced by `zimbra_forward_email` from an existing message (`forward_message_id` + `forwarded_message` metadata). Delivery happens only through the confirmed send path. |
| **Evidence store** | *Removed this round* — the SQLite store (`SOC_EVIDENCE_STORE`) belonged to the deleted Splunk search implementation; stale files may remain on disk. |
| **MarkItDown** | The document→Markdown converter library used for attachments (in-memory, bounded). |

## Deployment and tooling terms

| Term | Meaning |
|---|---|
| **Setup doctor** | `setup.sh` — the interactive installer/auditor/repairer (bootstrap clone, `--check` audit, `--plugins` re-wiring, `--rebuild`). |
| **Profile (web profile)** | The harness deployment record under `~/.dsh/profiles/web/`: which plugins (bundles), patch copies, and settings the web runtime loads. |
| **pnpm patch** | A file-level patch over a built dependency package; here `patches/dsh-auto-collapse@0.1.4.patch`, copied into the profile by setup and byte-compared on every run. |
| **Closure factory / ModuleLoader** | The client bundle format: `lib/client.js` opens with `window.__ModuleLoader__.load({id, factory})`; the harness boot kernel (`window.__DSH_BOOT__`) loads this module table in the browser. |
| **Preset** | A per-session agent composition file (`agent.cordis.yml`) under the harness's `agent-presets/`; `citic-soc` defines the Sentinel persona, instruction-file candidates, and compaction thresholds. |
| **CITIC** | The organization (CITICTEL-CPC) whose SOC operates the agent; also the name of the production SPL detection format and the `citic-soc` preset. |
| **Zimbra** | The collaboration/mail server providing both the mailbox data and (via credential login) the user identity. |
| **Fingerprint** | A hash used for drift/concurrency control in three places: setup build fingerprints (`.data/harness-*.sha256`), the Zimbra filter-set SHA-256 (`expected_fingerprint`), and attachment-conversion cache keys. |

## Runtime status vocabulary (used everywhere)

**Active** · **Conditional** · **Admin-only** · **Removed** (deleted; formerly "retained") · **Test-only** · **Generated** · **Legacy** · **Operational tooling** · **Unknown**.
