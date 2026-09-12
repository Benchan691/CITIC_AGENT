# Source index

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.

**Who this is for:** developers locating code and identifying the symbols that cross boundaries.

**What you will understand:** every tracked first-party source file with a one-line purpose and its important exports. Classification lives in [REPOSITORY_MAP.md](REPOSITORY_MAP.md); responsibilities in [COMPONENT_CATALOG.md](COMPONENT_CATALOG.md). Vendored files are covered as surfaces only ([REPOSITORY_MAP.md](REPOSITORY_MAP.md) §7).

---

## Root

| File | Purpose | Key symbols / facts |
|---|---|---|
| `setup.sh` | Setup doctor: bootstrap, `--check`, `--plugins`, `--rebuild` | `run_prereq_checks`, `collect_parameters`, `write_files`, `ensure_python_server`, `ensure_harness_ready` (fingerprint-gated; SOC client drift repair), `ensure_external_plugins`, `ensure_soc_bundle`, `PLUGIN_NAMES` (hardcoded 2) |
| `update.sh` | Clean-tree ff-only update + `setup.sh --plugins` | refuses arguments; never stashes |
| `requirements.txt` | External plugin specs (2, count-validated) | `@linxin666/dsh-client-ui-skin-center@^0.2.5`, `github:a179-sanae/dsh-auto-collapse#cd21c04…` |
| `AGENTS.md` | Mandatory agent operating policy | identity, isolation, untrusted content, evidence, email, Splunk, skills list |
| `BACKGROUND.md` | Splunk reference background (naming convention; retained customer example) | injected by `host.js` background refresh |
| `README.md` | Human overview | — |
| `lefthook.yml` | All-commented example; no active hooks | — |
| `hi.txt` | Unclassified Splunk alert-action token template | unreferenced; flagged in audit |

## `apps/soc-agent/`

| File | Purpose | Key exports / symbols |
|---|---|---|
| `policy.js` | Single tool catalog | `OFFICIAL_SPLUNK_READ_TOOLS` (13), `READ_ONLY_TOOLS` (29), `ZIMBRA_READ_TOOLS`, `ACTION_CATALOG` (12), `ACTION_TOOLS`, `TOOL_CATALOG` (34, incl. `ui__soc_agent__send_email` kind `ui-confirmed`), `MANAGED_TOOL_NAMES`, `ALWAYS_ASK_ACTION_TOOLS` (empty), `DOMAIN_TOOLS`, `APPROVAL_TOOLS` |
| `host.js` | Host plugin: policy gate + RPC + background + admin page | `name 'soc-agent-host'`, `inject`, `apply(ctx)`, `CHANNEL '/soc-agent-config'`, `handleEndpoint`, `requireUser/requireAdmin`, `savedActionPolicy`, `normalizedActionPolicy`, `defaultActionState`, `policyValue`, `installBackgroundRefresh`, `readBackgroundMessage`, `runAdmin`, `runAuthCommand` passthroughs, `validateAttachmentPayload`, `CONTROL_TOOLS` (`ask_user_question`, `exit_plan_mode`) |
| `auth-host.js` | Auth plugin wiring | `name 'soc-agent-auth-host'`, `apply(ctx)`, `mcp/request-meta` hook (adds `soc_session_id`, `soc_investigation_id`, `soc_customer_id: ''`, `soc_correlation_id`, `soc_deadline_ms`), `ctx.provide('socAuth')`, `connectionAuthorization.authorizePrivilegedRequest` |
| `ownership.js` | Auth/ownership boundary | `SocAuthService` (`handleAuthRoute`, `handleAdminAuthRoute`, `registerRoutes`, `installTransport`, `mcpRequestMeta`, `actionMode/setActionMode`, `revokeApplicationSession`, `stopUserChatSessions`, `principalForRequest`, `authorizePrivilegedRequest`, `adminPasswordMatches` via `timingSafeEqual`), `SocStateStore` (`ensureSchema`, `session`, `claimWorkspace/Session/Folder`, `consumeSessionRevocation`, `userSessionIds`), `createScopedApiProxy` (9 domains; `authorize`, `postprocess`, `respond` guard), `runAuthCommand`, `startControlChannel`, `closeAuthControlChannel`, `resolveAdminCredentials`, `resolveApplicationStorageUri`, `sameSiteRequest`, `readJson` (32 KiB), `isWithinPath`, `userWorkspaceRoot` |
| `splunk-bridge.js` | External Splunk MCP client bridge | `name 'soc-agent-splunk-official-bridge'`, `OFFICIAL_SPLUNK_TOOL_NAMES` (13), `resolveOfficialSplunkConfig` (env → `server/.env`; `SPLUNK_MCP_ENDPOINT`, `SPLUNK_TOKEN`, `SPLUNK_VERIFY_SSL`; `serverName: 'splunk_mcp'`; timeout 185 s; `failOnStartupError`), `apply(ctx)` |
| `investigation.js` | Splunk output projection | `projectOfficialSplunkResult` (prefix `mcp__splunk_mcp__splunk_`; 50 000-byte cap; `utf8Prefix`), `sanitizeSplunkText` (CARD/SSN masks; `SPLUNK_SANITIZE_OUTPUT` opt-out), `installInvestigationProjection` (`tools/post-execute`, global) |
| `cordis.patch.yml` | Product patch manifest | plugin enable/disable roster; `soc-agent-mcp` (27-name raw allowlist, `toolCallTimeoutMs: 185000`), `splunk-official-mcp`, `approval policy: ask`, coding-tool disable block, `skill-filesystem.customSkillDirs`, inserts `soc-agent-auth-host`/`soc-agent-admin-host`/`soc-agent-admin-ui`/`time-context`/`connection` |
| `package.json` | Bundle manifest | `dsh-soc-agent`; exports `./host`, `./splunk-bridge`, `./auth-host`, `./ownership`, `./policy` |

## `apps/soc-agent/server/unified_mcp_server/` — active server

| File | Purpose | Key symbols |
|---|---|---|
| `server.py` | FastMCP server + request execution | `create_server`, `Runtime` (`create`, `for_identity`, `close`, `config_revision`), `EmptyAccountStore`, `execute`, `fresh_runtime`, `McpFailureEnvelope`, `operation_budget` wiring, `register_mail_tools`/`register_filter_tools`/`register_email_tools` call sites, `main` |
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
| `detection.py` | Detection model/validation (active, shared by retained modules) | `DetectionDraft.from_payload`, `validate_detection` (requires `enabled: false`), `without_schedule_metadata`, `canonical_alert_fields`, `is_secret_alert_field` |
| `control_server.py` | Persistent control channel | `ControlServer.serve` (ready handshake, 8 MB lines, 8 concurrent), `dispatch_command` (from `auth_cli`), `_expire_session_on_auth_error` |
| `auth_cli.py` | Auth commands (and dispatch table) | `dispatch_command`: `login` (`zimbra_login` → `create_user_session` → `public_session` + `replaced_session_ids`), `logout`, `send_email`/`send-email` (gate), `list-signatures`, `command_failure`, `command_runtime` |
| `admin_cli.py` | Admin commands | `get-settings` (`_public_settings`), `test-splunk` (`SplunkService.test_connection`), `test-subscription-server`, `convert-attachment`, `migrate` (no-op); refuses `update-settings`, account CRUD, mail ops |
| `splunk_service.py` | Legacy REST Splunk service | `SplunkService` (admin `test-splunk` reachability) |

## `…/unified_mcp_server/splunk/` — retained implementation (34 files)

| Area | Files | Note |
|---|---|---|
| Core client/guardrails | `core/{client,guardrails,service}.py`, `guardrails.py`, `spl_risk_rules.py`, `splunk_client.py`, `splunk_service.py`, `query_policy.py`, `official_mcp_client.py` | REST client, SPL risk rules, fail-closed query policy, resource policy; `official_mcp_client` = retained helper for the official endpoint (read-only surface tested) |
| Search | `search/{service,planner,executor,resource_manager,resource_policy,schema_registry,verifier,lookup,evidence,evidence_store,tools}.py` | admission, planning, evidence (SQLite `SOC_EVIDENCE_STORE`), 9 `splunk_*` tools defined but **unregistered** |
| Detection | `detection/{model,citic_format,compiler,service,tools}.py` | CITIC production/backtest SPL compiler; 4 tools defined but **unregistered**; shares `detection.py` |
| Security queue | `security_queue/{model,provider,service,standard_provider,tools}.py` | fired-findings projection; 2 tools defined but **unregistered** |

## `packages/soc-agent-client/`

| File | Purpose | Key symbols |
|---|---|---|
| `src/index.ts` | Node half: register settings schemas | `apply` (namespaces `soc-agent-markitdown-attachments`, `soc-action-approval`) |
| `src/action-approval-settings.ts` | Shared schema | `SOC_ACTION_APPROVAL_NAMESPACE`, `SocActionMode`, `SocActionState`, `SocActionApprovalSettingsSchema` |
| `src/attachment-settings.ts` / `attachment-constants.ts` | Attachment limit schema | defaults 5 files / 10 MB / 50 MB / 200 k / 500 k chars |
| `src/client/index.ts` | Browser mount | `apply(ctx)`; `/admin` branch; slots `shell.overlay` (AuthGate), `conversation.input.left` (SocActionPolicyMenu), `tool.call.toolview` (draft), `settings.plugin.item`; `api.folders = undefined` |
| `src/client/AuthGate.tsx` | Login overlay | `readAuth` (`GET /auth/me`), `login` (`POST /auth/login`), `logout`; 30 s + focus polling |
| `src/client/AdminConsole.tsx` | Admin console | `ADMIN_PAGES` (connections / agent-context / access-approvals / providers), `AccessApprovalsSettings` (`settings.mutate` + `get-admin-action-catalog`), `ProviderSettings` (`credentials.set/unset`, `llm.discoverModels`), `ServiceStatusPanel` |
| `src/client/SocActionPolicyMenu.tsx` | Per-session mode menu | Full access / SOC mode via `readActionMode` |
| `src/client/actionPolicy.ts` | RPC helper | `readActionMode` (`get-action-policy` / `set-action-mode`; fails closed) |
| `src/client/EmailDraftToolview.tsx` | Draft UI | `parseEnvelope`, state machine `editing|sending|sent|failed|discarded`, `window.confirm('Send this email now?')`, `send-email` RPC requiring `sent === true`, signature apply, `data-dshcf-preserve` |
| `src/client/emailDraft.ts` | Draft helpers | `ZIMBRA_DRAFT_TOOL_NAME`, `parseRecipientText`, `draftFromForm` |
| `src/client/markitdownAttachments.ts` | Attachment controller | `MarkItDownDocumentController` (`convert` two workers, cache keyed by limits, `release`) |
| `src/client/MarkItDownDocuments.tsx` / `MarkItDownAttachmentSettings.tsx` | Composer rail + limits card | `openMarkItDownPicker`, `AttachmentSettingsController` (`scope.set/unset`) |
| `src/client/SocActionApprovalSettings.tsx` | Catalog sanitizer | `validCatalog` |
| `src/client/{SplunkSettings,SubscriptionServerSettings,ZimbraSettings,settings-common}.ts` | Legacy status cards + shared RPC | `CHANNEL`, `rpc`, `TestStatus` (AdminConsole tested not to import the cards) |
| `src/client/CiticBrand.tsx` | Branding | "Sentinel" mark/wordmark |
| `tsdown.config.ts` | Build | `clientBundle('dsh-soc-agent-client', ['src/index.ts'])` → tracked `lib/` |
| `tsconfig.json` | TypeScript config | strict TS for `src/**`; consumed by tsdown and the tsx test loader |

## Skills, patches, docs

| File | Purpose |
|---|---|
| `skills/detection-engineering/SKILL.md` | Read-only detection design → compile → validate → backtest → external human deployment (12-step workflow) |
| `skills/false-positive-analysis/SKILL.md` | Alert explanation/classification + narrowest tuning proposal (10-step) |
| `skills/splunk-investigation/SKILL.md` | Evidence-based investigation with `mcp__splunk_mcp__*` reads (13-step) |
| `skills/spl-writing/SKILL.md` | CITIC production SPL + safe backtest SPL via `splunk_compile_citic_detection` (5-step) |
| `patches/dsh-auto-collapse@0.1.4.patch` | English localization + duration parsing + `data-dshcf-preserve` exclusion |
| `docs/GLM_5_3_REPOSITORY_DOCUMENTATION_INSTRUCTIONS.md` | The durable execution brief for this documentation set (do not overwrite) |
