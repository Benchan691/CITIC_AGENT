# Source index

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](../zh/reference/SOURCE_INDEX.md)

**Who this is for:** developers locating code and identifying the symbols that cross boundaries.

**What you will understand:** every tracked first-party source file with a one-line purpose and its important exports. Classification lives in [REPOSITORY_MAP.md](REPOSITORY_MAP.md); responsibilities in [COMPONENT_CATALOG.md](COMPONENT_CATALOG.md). Vendored files are covered as surfaces only ([REPOSITORY_MAP.md](REPOSITORY_MAP.md) §7). Files removed in this round (the Python Splunk stack, two client status cards, `hi.txt`) are listed in [REPOSITORY_MAP.md](REPOSITORY_MAP.md) "What changed".

---

## Root

| File | Purpose | Key symbols / facts |
|---|---|---|
| `setup.sh` | Setup doctor: bootstrap, `--check`, `--plugins`, `--rebuild` | `run_prereq_checks`, `collect_parameters`, `write_files`, `ensure_python_server`, `ensure_harness_ready`, `ensure_soc_workspace_ready`, `ensure_soc_bundle`, `SOC_PACKAGE_MATRIX` (37 packages / 26 browser faces) |
| `update.sh` | Clean-tree ff-only update + `setup.sh --plugins` | refuses arguments; never stashes |
| `package.json` | Root workspace and build policy | pins `pnpm@11.7.0`, Node engines, declaration/build/typecheck/test/verification scripts |
| `pnpm-workspace.yaml` | Independent SOC workspace definition | root workspace packages; no vendor-relative links |
| `vendor/deepseek-harness.upstream.json` | Immutable Harness provenance | repository, tag `dsh-v0.1.5-rc.2`, commit `fb2c4b9e…`, file inventory SHA-256 |
| `tooling/session-migration.mjs` | Session validation/migration/rollback CLI | `--validate`, `--migrate`, `--rollback`; fail-closed v0/v1/v2 audit and immutable v3 successor publication |
| `AGENTS.md` | Mandatory agent operating policy | identity, isolation, untrusted content, evidence, email, Splunk, skills list |
| `BACKGROUND.md` | Splunk reference background (naming convention; retained customer example) | injected by `host.js` background refresh |
| `README.md` | Human overview | — |
| `lefthook.yml` | All-commented example; no active hooks | — |
| `hi.txt` | Unclassified Splunk alert-action token template | unreferenced; flagged in audit |

## `apps/soc-agent/`

| File | Purpose | Key exports / symbols |
|---|---|---|
| `tool-inventory.js` | **Single runtime-independent tool inventory** ("Draft preparation never delivers mail.") | `OFFICIAL_SPLUNK_TOOL_NAMES` (13 raw), `TOOL_CATALOG` (26 entries: 13 Zimbra reads incl. `zimbra_forward_email`, 12 mutations, 1 `ui-confirmed`), `SUBSCRIPTION_READ_TOOLS` (3) |
| `policy.js` | Derived policy sets (imports the inventory) | `OFFICIAL_SPLUNK_READ_TOOLS` (13 qualified), `READ_ONLY_TOOLS` (30), `ZIMBRA_READ_TOOLS` (13, derived), `ACTION_CATALOG` (12, derived), `ACTION_TOOLS`, `TOOL_CATALOG` (re-export), `MANAGED_TOOL_NAMES` (25), `ALWAYS_ASK_ACTION_TOOLS` (empty), `DOMAIN_TOOLS` (42), `APPROVAL_TOOLS` |
| `host.js` | Host plugin: policy gate + RPC + background + admin page | `name 'soc-agent-host'`, `inject`, `apply(ctx)`, `CHANNEL '/soc-agent-config'`, `handleEndpoint`, `requireUser/requireAdmin`, `savedActionPolicy`, `normalizedActionPolicy`, `defaultActionState`, `policyValue`, `installBackgroundRefresh`, `readBackgroundMessage`, `runAdmin` (→ `runPythonCommand`), `testOfficialSplunkConnection` for `test-splunk`, `validateAttachmentPayload`, `CONTROL_TOOLS` (`ask_user_question`, `exit_plan_mode`) |
| `auth-host.js` | Auth plugin wiring | `name 'soc-agent-auth-host'`, `apply(ctx)`, `mcp/request-meta` hook (adds `soc_session_id`, `soc_investigation_id`, `soc_customer_id: ''`, `soc_correlation_id`, `soc_deadline_ms`), `ctx.provide('socAuth')`, `connectionAuthorization.authorizePrivilegedRequest` |
| `ownership.js` | Auth/ownership boundary | `SocAuthService` (`handleAuthRoute`, `handleAdminAuthRoute`, `registerRoutes`, `installTransport`, `mcpRequestMeta`, `actionMode/setActionMode`, `revokeApplicationSession`, `stopUserChatSessions`, `principalForRequest`, `authorizePrivilegedRequest`, `adminPasswordMatches` via `timingSafeEqual`), `SocStateStore` (`ensureSchema` → Python `schema migrate` with URI on stdin, `session`, `claimWorkspace/Session/Folder`, `consumeSessionRevocation`, `userSessionIds`), `createScopedApiProxy` (9 domains; `authorize`, `postprocess`, `respond` guard), `runAuthCommand`, `startControlChannel`, `closeAuthControlChannel`, `resolveAdminCredentials`, `resolveApplicationStorageUri`, `sameSiteRequest`, `readJson` (32 KiB), `isWithinPath`, `userWorkspaceRoot` |
| `python-command.js` | Shared one-shot Python runner | `pythonEnvironment()` (strips `SOC_ADMIN_*`; `MCP_SERVER_ROOT`/`MCP_SEVER_ROOT` fallback), `runPythonCommand({module, command, arg, payload, timeoutMs, signal, mapError})` — timeout/abort/exit/parse mapping, stdin JSON payload |
| `splunk-bridge.js` | External Splunk MCP client bridge | imports `OFFICIAL_SPLUNK_TOOL_NAMES` from `tool-inventory.js`; `resolveOfficialSplunkConfig` (env → `server/.env`; endpoint URL validation — no credentials/query/fragment, plain HTTP needs `SPLUNK_ALLOW_INSECURE_HTTP`; `serverName: 'splunk_mcp'`; timeout 185 s; `failOnStartupError`), `testOfficialSplunkConnection` (live `splunk_get_info` probe, token redaction), `apply(ctx)` |
| `investigation.js` | Splunk output projection | `projectOfficialSplunkResult` (prefix `mcp__splunk_mcp__splunk_`; 50 000-byte cap; `utf8Prefix`), `sanitizeSplunkText` (CARD/SSN masks; `SPLUNK_SANITIZE_OUTPUT` opt-out), `installInvestigationProjection` (`tools/post-execute`, global) |
| `cordis.patch.yml` | Product patch manifest | disables every mapped official implementation, inserts the SOC replacement roster, keeps session folders/directory picker/Open In/subagent extras disabled, configures MCP/approval/skills, and enables six optional client rows |
| `package.json` | Bundle manifest | `dsh-soc-agent`; exports `./host`, `./splunk-bridge`, `./auth-host`, `./ownership`, `./policy` |

## `apps/soc-agent/server/unified_mcp_server/` — active server

| File | Purpose | Key symbols |
|---|---|---|
| `server.py` | FastMCP server + request execution (28 tools) | `create_server`, `Runtime` (`create`, `for_identity`, `close`, `config_revision`), `EmptyAccountStore`, `execute`, `fresh_runtime`, `McpFailureEnvelope`, `operation_budget` wiring, `register_mail_tools`/`register_filter_tools`/`register_email_tools` call sites, `main` |
| `config.py` | Settings (env-only) | `ServerSettings.from_env`, `public_status`, `public_readiness`, `SplunkSettings` (retained), `ZimbraSettings` (gates), `MarkItDownSettings`, `EmailServerSettings`, `redact_endpoint`, `_validate_http_endpoint`, `_preferred` legacy aliases |
| `auth.py` | Identity model | `ZimbraIdentity`, `identity_for_session`, `public_session`, `normalize_zimbra_email` |
| `request_context.py` | Operation budget/scope | `OperationContext` (`evidence_scope`), `operation_budget` (min 180 s / deadline), `remaining_seconds` |
| `postgres_store.py` | Postgres persistence | `PostgresStore.from_env`, `_ensure_schema` (9 tables), `create_user_session` (token encrypted; revokes others as `new_device_login`), `get_app_session` (lazy expiry), `delete_app_session`, `get/set/delete_config`, `_encrypt_text/_decrypt_text`, `_fernet_key/_derive_key`, `PostgresBootstrap` |
| `account_store.py` | Legacy local encrypted accounts | `AccountStore` (Fernet file, atomic replace, `0o600`), `StoredAccount.public_dict/agent_dict` |
| `errors.py` / `responses.py` | Error/envelope taxonomy | `ServiceError(code, message, retryable, details)`, `ConfigurationError`, `success`, `failure` |
| `blocking_io.py` | Bounded thread offload | `BlockingIO.run` (global 8 / per-principal 2, `asyncio.shield`), `run_blocking` |
| `env_loader.py` | `.env` loading + admin-var stripping | `load_server_env` (server then workspace, override; `_NODE_ONLY_ENV_NAMES`) |
| `zimbra_service.py` | Zimbra domain logic (legacy-level service) | `ZimbraService.create_email_draft` ("Build a local draft without contacting or writing to Zimbra"), `send_email` (gate `ZIMBRA_ALLOW_SEND`), `move_email/_move_email` (verify + rollback), `_upstream_error`, `_validate_search_query`, `_recipients`, `get_attachment_text` |
| `zimbra/zimbra.py` | SOAP transport | `soap_request`, `_TokenClient`, `zimbra_login` (returns token only), `_validate_zimbra_host`, `download_attachment`, `zimbra_modify_filter_rules` |
| `zimbra/core/service.py` | Identity binding | `ZimbraCore.resolve_account` (`account_selection_disabled`), `_EmptyAccountStore` |
| `zimbra/mail/service.py` / `mail/tools.py` | Mail service + 12 tools | `ZimbraMailService`, `register_mail_tools` |
| `zimbra/filters/{model,service,tools}.py` | Filters + 9 tools | `ZimbraFilterService` (`_fingerprint`, `_require_expected`, `_require_write`, `_validate` redirect/discard gates, `_lossy_metadata`), `register_filter_tools` |
| `email/service.py` / `email/tools.py` | Subscription client + 6 tools | `EmailSubscriptionService` (`_login`, `_request` re-login once, `_validate_redirect`), `register_email_tools` |
| `attachment_converter.py` | MarkItDown conversion | `AttachmentConverter.convert` (LRU 64/4 MB), `AttachmentConversionLimits` (10 MB/200 k defaults; 100 MB/2 M hard), `_validate_archive_safety`, `_validate_structured_text`, `create_markitdown` |
| `schema.py` + `migrations/*.sql` | **Versioned SQL migrations** | `apply_migrations(connection)` (advisory lock, `soc_schema_migrations` ledger, ordered `.sql` execution), standalone `main()` reading `{"uri"}` from stdin; `001_initial.sql` (all tables), `002_remove_catalog.sql` (marker-gated legacy-table drop) |
| `control_server.py` | Persistent control channel | `ControlServer.serve` (ready handshake, 8 MB lines, 8 concurrent), `dispatch_command` (from `auth_cli`), `_expire_session_on_auth_error` |
| `auth_cli.py` | Auth commands (and dispatch table) | `dispatch_command`: `login` (`zimbra_login` → `create_user_session` → `public_session` + `replaced_session_ids`), `logout`, `send_email`/`send-email` (gate), `list-signatures`, `command_failure`, `command_runtime` |
| `admin_cli.py` | Admin commands | `get-settings` (`_public_settings`), `test-splunk` (`SplunkService.test_connection`), `test-subscription-server`, `convert-attachment`, `migrate` (no-op); refuses `update-settings`, account CRUD, mail ops |

## Removed in this round

`unified_mcp_server/splunk/**` (34 files), `splunk_service.py`, `detection.py`, and 12 Splunk-related test files were deleted (see [REPOSITORY_MAP.md](REPOSITORY_MAP.md) "What changed"). Their symbols are intentionally absent from this index.

## `packages/soc-agent-*/` — modular browser packages

| File | Purpose | Key symbols |
|---|---|---|
| `soc-agent-client/src/index.ts` | Mandatory Node half | `apply` registers `soc-action-approval`; no optional feature imports |
| `soc-agent-client/src/client/contract.ts` | Core browser contract | `SocClientRuntime`, `socClient`, `socSurface`, `SOC_CONFIG_CHANNEL`, `soc.admin.content` declaration |
| `soc-agent-client/src/client/core/AuthGate.tsx` / `AdminUnavailable.tsx` | Mandatory browser surfaces | auth overlay; core-owned `/admin` root and safe feature-disabled fallback |
| `soc-agent-sidebar/src/client/` | Isolated sidebar | standard `sidebar` owner, branding/workspace/settings/footer child slots, pinned layout/styles |
| `soc-agent-workspace/src/client/` | Isolated workspace | workspace browser + conversation picker, search/group/reorder/actions, reversible folders guard |
| `soc-agent-brand/src/client/` | Optional branding | `CiticBrand` sidebar and conversation hero contributions |
| `soc-agent-admin/src/client/` | Optional admin UI | `AdminConsole`, RPC helper, `soc.admin.content` child-slot owner |
| `soc-agent-action-policy/src/client/` | Optional end-user mode selector | `SocActionPolicyMenu`, `readActionMode` / `setActionMode` helper |
| `soc-agent-attachments/src/client/` | Optional attachments | MarkItDown provider, two-worker controller, composer rail, command, settings card/schema |
| `soc-agent-email-draft/src/client/` | Optional email draft UI | editable draft/forward tool view, signature helper, `send-email` RPC |
| each `tsdown.config.ts`, `package.json`, `lib/` | Bundle/build boundary | tracked host/browser artifacts; all 37 packages are registered by `setup.sh`, and 26 browser faces are health-checked |

## Skills, patches, docs

| File | Purpose |
|---|---|
| `skills/detection-engineering/SKILL.md` | Read-only detection design → compile → validate → backtest → external human deployment (12-step workflow) |
| `skills/false-positive-analysis/SKILL.md` | Alert explanation/classification + narrowest tuning proposal (10-step) |
| `skills/splunk-investigation/SKILL.md` | Evidence-based investigation with `mcp__splunk_mcp__*` reads (13-step) |
| `skills/spl-writing/SKILL.md` | CITIC production SPL + safe backtest SPL via `splunk_compile_citic_detection` (5-step) |
| `tooling/verify-upstream.mjs` | Fresh-archive comparison for the pristine rc.2 vendor tree; generated build outputs are excluded by explicit reproducibility rules |
| `docs/GLM_5_3_REPOSITORY_DOCUMENTATION_INSTRUCTIONS.md` | The durable execution brief for this documentation set (do not overwrite) |
