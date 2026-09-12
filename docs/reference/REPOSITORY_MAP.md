# Repository map and census

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12 (second verification round; previous round at `b26d55d`).

**Who this is for:** developers and reviewers who need to know what every tracked path *is* — canonical source, test, generated output, vendor, integration artifact, or unclassified leftover.

**What you will understand:** a complete classification of every tracked first-party path, plus the local-only directories that exist on disk but are not tracked.

**Method:** `git ls-files` at the verified commit (Git-aware discovery; `.gitignore` excludes `node_modules/`, `__pycache__/`, `*.egg-info/`, `.data/`, `.state/`, `.env`). Totals at this commit: **182 tracked first-party files** — `apps/soc-agent` **71** (17 host-side + 54 server-side), `packages/soc-agent-client` **38**, `skills` **4**, `patches` **1**, root **8** (`AGENTS.md`, `README.md`, `BACKGROUND.md`, `setup.sh`, `update.sh`, `requirements.txt`, `lefthook.yml`, `.gitignore` — `hi.txt` was deleted), `docs/` **60** (the documentation set including `SHORTENING_PLAN_IMPLEMENTATION.md`) — plus 6,970+ tracked files under `vendor/deepseek-harness` (grouped, not itemized).

**What changed since the previous round (`b26d55d`):** the retired Python Splunk stack (34-file `splunk/` package, `splunk_service.py`, `detection.py`, and 12 related test files) was **deleted**; new `tool-inventory.js` (single tool source of truth), `python-command.js` (shared Python spawn helper), `migrations/*.sql` + `schema.py` (versioned SQL migrations), `tests/python-command.test.js`, `tests/setup.test.js`, `tests/admin-console.test.ts`; client legacy status cards (`SplunkSettings.ts`, `SubscriptionServerSettings.ts`) removed; `hi.txt` removed. The maintainer's own implementation report is `docs/SHORTENING_PLAN_IMPLEMENTATION.md` (baseline `d264ca7`).

Related: [COMPONENT_CATALOG.md](COMPONENT_CATALOG.md) (what each group *does*), [SOURCE_INDEX.md](SOURCE_INDEX.md) (per-file purposes and symbols).

---

## 1. Root

| Path | Class | Purpose | Runtime status |
|---|---|---|---|
| `AGENTS.md` | documentation/governance | Mandatory operating policy for the agent (identity, isolation, evidence, email, Splunk rules). Loaded at session start via the `citic-soc` preset (`instructionFileCandidates`). | Active (model context) |
| `README.md` | documentation/governance | Human overview: layout, setup, update, official Splunk MCP requirement, access modes; links the shortening-plan implementation report. | Documentation |
| `BACKGROUND.md` | documentation/governance | Splunk reference context (rule-naming convention from a read-only `Ruleset.csv` review; contains one retained customer naming example). Injected as background context by `host.js` `installBackgroundRefresh`. | Active (model context) |
| `setup.sh` | setup/administrative script | "SOC Agent setup doctor": bootstrap clone, `--check`, `--plugins` modes; one parameter inventory now drives prompting/checking; **the official Splunk MCP endpoint + token are required** (REST-only Splunk fields removed). | Active (operator-run) |
| `update.sh` | setup/administrative script | Refuses arguments and dirty trees, `git pull --ff-only`, then re-runs `setup.sh --plugins`. | Active (operator-run) |
| `requirements.txt` | configuration/deployment wiring | Exactly two external pnpm plugin specs (`@linxin666/dsh-client-ui-skin-center@^0.2.5`, `github:a179-sanae/dsh-auto-collapse#cd21c04…`); count-validated against `PLUGIN_NAMES` in `setup.sh`. | Active (setup input) |
| `lefthook.yml` | configuration (inert) | Entirely commented-out example jobs; no active Git hooks. | Inactive |
| `.gitignore` | configuration | Ignores `node_modules/`, `__pycache__/`, `*.egg-info/`, `/.data/`, `**/.state/`, `.cursor/`, `*.tsbuildinfo`, `coverage/`. Note: `packages/soc-agent-client/lib/` is **not** ignored (tracked generated output). | Active |
| `docs/` | documentation | This documentation set, the execution brief, and the maintainer's shortening-plan report. | Documentation |

*(Previous-round leftovers resolved: `hi.txt` was removed in this range — the audit's maintainer question is closed.)*

## 2. `apps/soc-agent/` — the SOC application host (Node, 17 files)

| Path | Class | Purpose |
|---|---|---|
| `package.json` | manifest | Plugin bundle `dsh-soc-agent`; exports `./host`, `./splunk-bridge`, `./auth-host`, `./ownership`, `./policy`, `./python-command`, `./tool-inventory`; `dsh.bundle.patch: ./cordis.patch.yml`; test script `node --test tests/*.test.js`. |
| `cordis.patch.yml` | configuration/deployment wiring | The product patch over `dsh-base` + `dsh-web-app`: enables/disables upstream plugins, registers `soc_agent` (stdio, raw allowlist of **28** names) and `splunk-official-mcp` (bridge), points `skill-filesystem` at `skills/`. |
| `tool-inventory.js` | canonical source | **Single runtime-independent source of truth** for the tool surface: `OFFICIAL_SPLUNK_TOOL_NAMES` (13 raw), `TOOL_CATALOG` (26 entries: 13 Zimbra reads incl. `zimbra_forward_email`, 12 mutations, 1 UI-confirmed), `SUBSCRIPTION_READ_TOOLS` (3). Imported by both `policy.js` and `splunk-bridge.js`. Header: "Draft preparation never delivers mail." |
| `policy.js` | canonical source | Derives all policy sets from the inventory: `OFFICIAL_SPLUNK_READ_TOOLS` (13 qualified), `ZIMBRA_READ_TOOLS` (13), `READ_ONLY_TOOLS` (**30** = skill + Splunk + Zimbra reads + subscription reads), `ACTION_CATALOG` (**12** mutations), `ACTION_TOOLS`, `TOOL_CATALOG` (re-export, 26), `MANAGED_TOOL_NAMES` (25), `DOMAIN_TOOLS` (**42**), `APPROVAL_TOOLS` (= mutations). |
| `host.js` | canonical source | Plugin `soc-agent-host`: `/soc-agent-config` RPC endpoints, `tools/pre-execute` policy gate, action modes, BACKGROUND.md refresh, admin page serving. `runAdmin` now delegates to `runPythonCommand`; `test-splunk` RPC calls `testOfficialSplunkConnection` (live bridge probe). |
| `auth-host.js` | canonical source | Plugin `soc-agent-auth-host`: constructs `SocAuthService`, `mcp/request-meta` metadata, transport fencing, privileged-request authorization. |
| `ownership.js` | canonical source | Auth/ownership boundary: login routes, scoped API proxy (IDOR prevention), Postgres `SocStateStore`, control channel to Python. `ensureSchema` no longer contains DDL — it shells out to `unified_mcp_server.schema migrate`, passing the resolved URI over stdin. Child env/spawn logic shared via `python-command.js`. |
| `python-command.js` | canonical source | Shared one-shot Python runner: `pythonEnvironment()` (strips `SOC_ADMIN_*`, resolves `MCP_SERVER_ROOT`/legacy `MCP_SEVER_ROOT`), `runPythonCommand({module, command, arg, payload, timeoutMs, signal, mapError})` — timeout/abort/exit/parse mapping, stdin JSON payload. Comment: "One-shot helpers only. Persistent delivery and retry decisions stay in ownership.js." |
| `splunk-bridge.js` | canonical source | Plugin `soc-agent-splunk-official-bridge`: imports the inventory from `tool-inventory.js`; validates `SPLUNK_MCP_ENDPOINT` (HTTP(S), no credentials/query/fragment; plain HTTP requires `SPLUNK_ALLOW_INSECURE_HTTP=true`); `testOfficialSplunkConnection(ctx, signal)` executes a real `splunk_get_info` through the bridge (185 s budget, Bearer token redacted from errors). |
| `investigation.js` | canonical source | `tools/post-execute` projection: sanitizes (card/SSN) and 50 KB-truncates `mcp__splunk_mcp__splunk_*` output only. |
| `tests/*.test.js` (11 files, 35 tests) | first-party test | New: `python-command.test.js` (1), `setup.test.js` (5). Grown: `splunk-bridge.test.js` (4: config, TLS default, credential/HTTP validation, live admin probe). See [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md). |

## 3. `apps/soc-agent/server/` — Python MCP server (package `soc-agent-mcp`, 54 files)

| Path | Class | Purpose |
|---|---|---|
| `pyproject.toml`, `uv.lock` | manifest/lockfile | Package `soc-agent-mcp` 0.1.0 ("SOC Agent MCP server for Zimbra and subscriptions"), Python ≥3.12, entry point `unified-mcp-server`; deps: `cryptography`, `httpx`, `markitdown[…]==0.1.7`, `mcp`, `psycopg[pool,binary]`, `python-dotenv`, `zimbra-client`; package-data ships `migrations/*.sql`; the `splunk.*` packages are gone from the build. |
| `.env.example`, `.gitignore`, `README.md` | config template / docs | Template now lists **only** active variables (all legacy Splunk REST, lookup, queue, account-file, and `ZIMBRA_EMAIL/PASSWORD` variables removed). README states: no Splunk tools registered; admin check probes `splunk_get_info` through the bridge; retired Python Splunk APIs are not shipped. |
| `unified_mcp_server/server.py` | canonical source, active entry | FastMCP construction, `Runtime` (`zimbra: ZimbraMailService`), `execute()` envelope, identity resolution, registers **28 tools** from three modules (mail now includes `zimbra_forward_email`). Uses `_EmptyAccountStore` from `zimbra.core.service` (the inline class moved there). |
| `config.py` | canonical source | `ServerSettings` + slimmed `SplunkSettings` (**only** `mcp_endpoint`, `token`, `verify_ssl`, `allow_insecure_http`, `sanitize_output`; `configured` = endpoint+token) + `ZimbraSettings` + `MarkItDownSettings` + `EmailServerSettings`; env-only sourcing; `public_status()` reports `official_mcp_enabled` + redacted endpoint. All legacy Splunk REST/lookup/policy/queue variables removed. |
| `schema.py` | canonical source | **Versioned SQL migration runner**: `apply_migrations(connection)` takes a `pg_advisory_xact_lock(hashtext('soc-agent-schema'))`, records applied files in `soc_schema_migrations`, executes pending `migrations/*.sql` in order (package data). Standalone `main()` reads `{"uri": …}` **from stdin** (deliberately not `.env` — "could initialize a different database"), connects with `statement_timeout=15000`, prints `{"migrated": true}` or a `schema_migration_failed` error line. |
| `migrations/001_initial.sql` | schema definition | Creates `app_config`, `zimbra_accounts`, `soc_users`, `soc_app_sessions` (+ indexes), `soc_session_revocations`, `soc_workspace_owners`, `soc_session_owners` (+ indexes), `soc_folder_owners`, `soc_bootstrap` — `IF NOT EXISTS`. |
| `migrations/002_remove_catalog.sql` | schema cleanup | Marker-gated (`catalog-feature-removed-v1`) drop of the eight legacy catalog tables (`soc_catalog_*`, `soc_fix_source_type`, `soc_rule_catalog`, `soc_customer`, `soc_catalog_migrations`). |
| `auth.py`, `request_context.py` | canonical source | `ZimbraIdentity`, `identity_for_session`; `OperationContext`, 180 s `operation_budget`. |
| `postgres_store.py` | canonical source | Postgres store: calls `apply_migrations` at startup (advisory-locked, inside its transaction), then reads/writes the tables; Fernet-encrypted config; legacy `migrate_env_config` inert; account-store migration API kept inert. |
| `account_store.py` | canonical source (legacy path) | Encrypted local JSON account store (admin/compat only; not used for authenticated requests). |
| `errors.py`, `responses.py` | canonical source | `ServiceError` taxonomy; `success`/`failure` envelopes. |
| `blocking_io.py` | canonical source | Bounded thread offload: global semaphore 8, per-principal 2, shielded tasks. |
| `env_loader.py` | canonical source | Loads `server/.env` then workspace `.env` (override); strips `SOC_ADMIN_*` from the Python process. |
| `zimbra_service.py` + `zimbra/` (11 files) | canonical source | SOAP Zimbra client (`zimbra.py`, now including `zimbra_forward_message` at line 240 — server-side forward with attachments used by the send path), identity-bound core (`core/service.py`, now hosting `_EmptyAccountStore`), mail service/tools (**13 tools**, incl. `create_forward_draft`), filter service/tools (9 tools, fingerprint concurrency). |
| `email/` (3 files) | canonical source | `EmailSubscriptionService` (external REST) + 6 subscription tools. |
| `attachment_converter.py` | canonical source | MarkItDown conversion with limits, archive safety, LRU cache (in-memory only). |
| `control_server.py` | canonical source | Persistent private control channel (stdio JSON lines) serving `auth_cli` dispatch. |
| `admin_cli.py` | canonical source (operational tooling) | One-shot admin commands: `get-settings`, `test-subscription-server`, `convert-attachment`, `migrate` (now runs `migrate(store)` — schema application). **`test-splunk` removed** (the bridge probes itself from Node). Refuses settings writes and mail operations. |
| `auth_cli.py` | canonical source | One-shot auth commands: `login`, `logout`, `send-email` (now forwards `forward_message_id`), `list-signatures`; also the control-channel dispatch table. |
| `tests/` (10 test files + `__init__.py`, 39 tests) | first-party test | All retained-Splunk test files removed; new `test_schema.py` (3). See [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md). |

**Removed in this range (previously "retained"):** `unified_mcp_server/splunk/**` (34 files), `splunk_service.py`, `detection.py`, and the test files `test_citic_compiler.py`, `test_citic_format.py`, `test_official_splunk_mcp_client.py`, `test_search_evidence.py`, `test_security_queue.py`, `test_splunk_*.py` (6), plus `citic_fixtures.py`. Untracked leftovers (`splunk/`, `catalog/`, `__pycache__/` directories) may still exist on disk from earlier checkouts — they are **not** tracked and not part of the build (`pyproject.toml` no longer packages them).

## 4. `packages/soc-agent-client/` — browser/admin UI (38 files)

| Path | Class | Purpose |
|---|---|---|
| `package.json` | manifest | `dsh-soc-agent-client` 0.1.0; entry `lib/index.js`, browser entry `lib/client.js`; `dsh.client` declaration (`inject: [slots, connection, conversation, commandUi, settingsScope]`, `platform: web`). |
| `tsdown.config.ts`, `tsconfig.json` | build config | `clientBundle('dsh-soc-agent-client', ['src/index.ts'])` from the shared harness preset. |
| `src/index.ts` | canonical source | Node half: registers durable settings namespaces `soc-agent-markitdown-attachments` and `soc-action-approval`. |
| `src/action-approval-settings.ts`, `attachment-settings.ts`, `attachment-constants.ts` | canonical source | Shared schemas/types (no I/O): action mode/states schema; attachment limit schema (defaults 5 files / 10 MB / 50 MB / 200 k / 500 k chars). |
| `src/client/index.ts` | canonical source | Browser mount: `/admin` branch (AdminConsole only) vs main app (AuthGate overlay, SocActionPolicyMenu, attachment controller, email draft toolview, CiticBrand); disables harness folders (`api.folders = undefined`). Legacy card exports removed. |
| `src/client/AdminConsole.tsx` (+css) | canonical source | Standalone admin console: Connections (Splunk check = **live bridge probe**), Agent context, Access & approvals, AI providers (write-only credentials); new `useStatus`/`StatusNotice` pattern (`role=alert`/`status`, retry affordance). |
| `src/client/AuthGate.tsx` (+css) | canonical source | Full-screen Sentinel login overlay; polls `/auth/me`. |
| `src/client/EmailDraftToolview.tsx`, `emailDraft.ts` (+css) | canonical source | Draft editing UI inside tool blocks — now keyed on the **forward draft tool** too; `emailDraft.ts` adds `ZIMBRA_FORWARD_DRAFT_TOOL_NAME`, `forward_message_id`, and `forwarded_message` metadata (subject/from/date/body/attachments); `window.confirm('Send this email now?')` gate; `send-email` RPC; state machine editing/sending/sent/failed/discarded. |
| `src/client/SocActionPolicyMenu.tsx` (+css) | canonical source | Per-session Full access / SOC mode switch (`get-action-policy` / `set-action-mode`). |
| `src/client/SocActionApprovalSettings.tsx` (+css) | canonical source | Sanitizer (`validCatalog`) for the admin per-tool checklist. |
| `src/client/markitdownAttachments.ts`, `MarkItDownDocuments.tsx`, `MarkItDownAttachmentSettings.tsx` (+css) | canonical source | Attachment picker/limits UI; `convert-attachment` RPC with two workers and caching. |
| `src/client/ZimbraSettings.ts`, `settings-common.ts`, `SplunkZimbraOverlay.module.css` | canonical source | Remaining shared settings helpers (slimmed); status-only Zimbra card. |
| `src/client/CiticBrand.tsx` (+css) | canonical source | Brand mark/wordmark ("Sentinel"). |
| `src/client/actionPolicy.ts` | canonical source | `readActionMode` RPC helper (fails closed on malformed responses). |
| `lib/index.js`, `lib/client.js`, `lib/client.js.map` | **generated build output — tracked** | tsdown bundle (rebuilt this range: −441 lines, the deleted cards); closure-factory artifact (`window.__ModuleLoader__.load({id:"dsh-soc-agent-client", …})`). |
| `tests/*.test.ts` (5 files, 12 tests) | first-party test | New: `admin-console.test.ts` (1). `email-draft-toolview.test.ts` grew to 3 (forward draft fields). |

**Removed in this range:** `src/client/SplunkSettings.ts`, `src/client/SubscriptionServerSettings.ts` (legacy status cards), and their exports from `client/index.ts`.

## 5. `skills/`

| Path | Class | Purpose |
|---|---|---|
| `detection-engineering/SKILL.md` | documentation (runtime skill) | Read-only detection design/validate/backtest workflow. **Stale at this commit:** references `splunk_get_detection`, `splunk_compile_citic_detection`, `splunk_backtest_detection`, `splunk_validate_detection` — tools whose implementation was removed. |
| `false-positive-analysis/SKILL.md` | documentation (runtime skill) | Explain/classify alert firings; propose tuning without modifying rules. References `splunk_search`/`splunk_validate_query` — also removed. |
| `splunk-investigation/SKILL.md` | documentation (runtime skill) | Evidence-based investigation with the `mcp__splunk_mcp__*` read tools — still current. |
| `spl-writing/SKILL.md` | documentation (runtime skill) | CITIC production SPL via `splunk_compile_citic_detection` — **stale** (compiler removed). |

Drift note: `AGENTS.md` still names seven skills; four exist; two of the four reference removed tooling. Recorded in [DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md).

## 6. `patches/`

| Path | Class | Purpose |
|---|---|---|
| `dsh-auto-collapse@0.1.4.patch` | locally patched vendor behavior | pnpm patch over the built `lib/client.js` of the `dsh-auto-collapse` UI plugin: English localization, English duration parsing, and exclusion of rows containing `[data-dshcf-preserve]` from auto-collapse (used by the SOC draft card). |

## 7. `vendor/deepseek-harness/` — vendored upstream (grouped)

Unchanged integration surface plus one addition this range: `packages/host/apiproxy/src/api/rpc.schema.ts` and `rpc.ts` now declare the structured `authentication-required` / `admin-authentication-required` error codes (with tests) — the SOC RPC auth contract is pinned upstream too. All other surfaces as documented previously: MCP client bridge, cordis loader, base/web patch layers, tools+approval registry, skills, presets (incl. local `citic-soc`), webserver/gateway/static, browser boot. See [COMPONENT_CATALOG.md](COMPONENT_CATALOG.md) §14.

## 8. Local-only (untracked) paths observed on disk

| Path | Class | Note |
|---|---|---|
| `apps/soc-agent/server/unified_mcp_server/splunk/`, `catalog/`, `__pycache__/` | untracked leftovers | Deleted from Git in this range; stale directories may remain on disk until cleaned. Not packaged, not importable as configured. |
| `benchmarks/` (if present), `packages/soc-agent-scheduler/node_modules/` | runtime/local state | No tracked content; no role. |
| `**/node_modules/`, `.venv/` | dependency directories | Ignored. |
| `apps/soc-agent/server/.env` | runtime/local secrets | Ignored; contents never read or published by this documentation. |
| `~/.dsh/` (outside repo) | runtime state | Profile wiring and harness state. The retained SQLite evidence store default no longer has an owner in code. |
| `<root>/.data/` | runtime state | `soc-workspaces/<userId>/…`, setup fingerprints (`harness-install.sha256`, `harness-build.sha256`). Ignored. |

## 9. Census decisions worth calling out

- `packages/soc-agent-client/lib/` remains the **only tracked generated output**; rebuilt this range (−441 lines) to match the removed cards.
- The **retained Splunk stack is gone** — the previous "code presence does not prove runtime exposure" example is now "removed entirely" ([DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md) §6).
- `tool-inventory.js` is the new structural drift fence: policy, bridge, and (via tests) the Python registration all derive from or pin the same inventory.
- `hi.txt` was deleted; the previous audit question is closed.
- Database schema creation is now **single-sourced in Python migrations**; the Node tier contains no DDL.
