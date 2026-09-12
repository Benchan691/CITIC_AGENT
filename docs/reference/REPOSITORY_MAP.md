# Repository map and census

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.

**Who this is for:** developers and reviewers who need to know what every tracked path *is* — canonical source, test, generated output, vendor, integration artifact, or unclassified leftover.

**What you will understand:** a complete classification of every tracked first-party path, plus the local-only directories that exist on disk but are not tracked.

**Method:** `git ls-files` at the verified commit (Git-aware discovery; `.gitignore` excludes `node_modules/`, `__pycache__/`, `*.egg-info/`, `.data/`, `.state/`, `.env`). Totals at this commit: **166 tracked first-party files** — `apps/soc-agent` 111 (17 host-side + 94 server-side), `packages/soc-agent-client` 40, `skills` 4, `patches` 1, root 9 (`AGENTS.md`, `README.md`, `BACKGROUND.md`, `setup.sh`, `update.sh`, `requirements.txt`, `lefthook.yml`, `hi.txt`, `.gitignore`), `docs/` 1 (the execution brief) — and 6,970 tracked files under `vendor/deepseek-harness` (grouped, not itemized).

Related: [COMPONENT_CATALOG.md](COMPONENT_CATALOG.md) (what each group *does*), [SOURCE_INDEX.md](SOURCE_INDEX.md) (per-file purposes and symbols).

---

## 1. Root

| Path | Class | Purpose | Runtime status |
|---|---|---|---|
| `AGENTS.md` | documentation/governance | Mandatory operating policy for the agent (identity, isolation, evidence, email, Splunk rules). Loaded at session start via the `citic-soc` preset (`instructionFileCandidates`). | Active (model context) |
| `README.md` | documentation/governance | Human overview: layout, setup, update, Splunk MCP, access modes. | Documentation |
| `BACKGROUND.md` | documentation/governance | Splunk reference context (rule-naming convention from a read-only `Ruleset.csv` review; contains one retained customer naming example). Injected as background context by `host.js` `installBackgroundRefresh`. | Active (model context) |
| `setup.sh` | setup/administrative script | "SOC Agent setup doctor": bootstrap clone, `--check`, `--plugins`, `--rebuild` modes; writes `server/.env`, harness `.env`, profile patch/plugin wiring. | Active (operator-run) |
| `update.sh` | setup/administrative script | Refuses arguments and dirty trees, `git pull --ff-only`, then re-runs `setup.sh --plugins`. | Active (operator-run) |
| `requirements.txt` | configuration/deployment wiring | Exactly two external pnpm plugin specs (`@linxin666/dsh-client-ui-skin-center@^0.2.5`, `github:a179-sanae/dsh-auto-collapse#cd21c04…`); count-validated against `PLUGIN_NAMES` in `setup.sh`. | Active (setup input) |
| `lefthook.yml` | configuration (inert) | Entirely commented-out example jobs; no active Git hooks. | Inactive |
| `.gitignore` | configuration | Ignores `node_modules/`, `__pycache__/`, `*.egg-info/`, `/.data/`, `**/.state/`, `.cursor/`, `*.tsbuildinfo`, `coverage/`. Note: `packages/soc-agent-client/lib/` is **not** ignored (tracked generated output). | Active |
| `hi.txt` | obsolete/unclassified | Single tracked file containing a Splunk alert-action token template (`$result.Fix_Ticketnumber$`-style). Last touched by commit `401ae23` ("Enhance Splunk detection configuration"). No source file references it. | Unknown — flagged for maintainers |
| `docs/` | documentation | This documentation set plus the execution brief. | Documentation |

## 2. `apps/soc-agent/` — the SOC application host (Node)

| Path | Class | Purpose |
|---|---|---|
| `package.json` | manifest | Plugin bundle `dsh-soc-agent`; exports `./host`, `./splunk-bridge`, `./auth-host`, `./ownership`, `./policy`; `dsh.bundle.patch: ./cordis.patch.yml`; test script `node --test tests/*.test.js`. |
| `cordis.patch.yml` | configuration/deployment wiring | The product patch over `dsh-base` + `dsh-web-app`: enables/disables upstream plugins, registers `soc_agent` (stdio, raw allowlist of 27 names) and `splunk-official-mcp` (bridge), points `skill-filesystem` at `skills/`. |
| `host.js` | canonical source | Plugin `soc-agent-host`: `/soc-agent-config` RPC endpoints, `tools/pre-execute` policy gate, action modes, BACKGROUND.md refresh, admin page serving, admin subprocesses. |
| `auth-host.js` | canonical source | Plugin `soc-agent-auth-host`: constructs `SocAuthService`, `mcp/request-meta` metadata, transport fencing, privileged-request authorization. |
| `ownership.js` | canonical source | Auth/ownership boundary: login routes, scoped API proxy (IDOR prevention), Postgres `SocStateStore`, control channel to Python. |
| `policy.js` | canonical source | The one tool catalog: `OFFICIAL_SPLUNK_READ_TOOLS` (13), `READ_ONLY_TOOLS` (29), `ACTION_CATALOG` (12 mutations), `TOOL_CATALOG` (34 incl. `ui__soc_agent__send_email`), derived `DOMAIN_TOOLS`/`APPROVAL_TOOLS`. |
| `splunk-bridge.js` | canonical source | Plugin `soc-agent-splunk-official-bridge`: resolves `SPLUNK_MCP_ENDPOINT`/`SPLUNK_TOKEN`/`SPLUNK_VERIFY_SSL`, connects as client `splunk_mcp` over streamable HTTP with 13-tool allowlist. |
| `investigation.js` | canonical source | `tools/post-execute` projection: sanitizes (card/SSN) and 50 KB-truncates `mcp__splunk_mcp__splunk_*` output only. |
| `tests/*.test.js` (9 files) | first-party test | See [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md). |

## 3. `apps/soc-agent/server/` — Python MCP server (package `soc-agent-mcp`)

| Path | Class | Purpose |
|---|---|---|
| `pyproject.toml`, `uv.lock` | manifest/lockfile | Package `soc-agent-mcp` 0.1.0, Python ≥3.12, entry point `unified-mcp-server`; deps: `cryptography`, `httpx`, `markitdown[audio-transcription,docx,outlook,pdf,pptx,xls,xlsx]==0.1.7`, `mcp`, `psycopg[pool,binary]`, `python-dotenv`, `zimbra-client`; extras `markitdown-llm`, `test`. |
| `.env.example`, `.gitignore`, `README.md` | config template / docs | Safe variable names; ignores `.env`, `spl_config.local.json`, `.venv/`. |
| `unified_mcp_server/server.py` | canonical source, active entry | FastMCP construction, `Runtime`, `execute()` envelope, identity resolution, registers exactly 27 tools from three modules. |
| `config.py` | canonical source | `ServerSettings`/`SplunkSettings`/`ZimbraSettings`/`MarkItDownSettings`/`EmailServerSettings`; env-only sourcing; `public_status()` redaction. |
| `auth.py`, `request_context.py` | canonical source | `ZimbraIdentity`, `identity_for_session`; `OperationContext`, 180 s `operation_budget`. |
| `postgres_store.py` | canonical source | Postgres store: users, app sessions (encrypted Zimbra tokens), revocations, ownership claims, encrypted `app_config`, legacy `zimbra_accounts`. |
| `account_store.py` | canonical source (legacy path) | Encrypted local JSON account store; neutered at runtime by `server.py` `EmptyAccountStore`. |
| `errors.py`, `responses.py` | canonical source | `ServiceError` taxonomy; `success`/`failure` envelopes. |
| `blocking_io.py` | canonical source | Bounded thread offload: global semaphore 8, per-principal 2, shielded tasks. |
| `env_loader.py` | canonical source | Loads `server/.env` then workspace `.env` (override); strips `SOC_ADMIN_*` from the Python process. |
| `zimbra_service.py` + `zimbra/` (11 files) | canonical source | SOAP Zimbra client (`zimbra.py`), identity-bound core (`core/service.py`), mail service/tools (12 tools), filter service/tools (9 tools, fingerprint concurrency). |
| `email/` (3 files) | canonical source | `EmailSubscriptionService` (external REST) + 6 subscription tools. |
| `attachment_converter.py` | canonical source | MarkItDown conversion with limits, archive safety, LRU cache (in-memory only). |
| `detection.py` | canonical source (active, Splunk-adjacent) | `DetectionDraft` model/validation; used by retained Splunk modules; enforces `enabled: false`. |
| `control_server.py` | canonical source | Persistent private control channel (stdio JSON lines) serving `auth_cli` dispatch. |
| `admin_cli.py` | canonical source (operational tooling) | One-shot admin commands: `get-settings`, `test-splunk`, `test-subscription-server`, `convert-attachment`, `migrate`; refuses settings writes and mail operations. |
| `auth_cli.py` | canonical source | One-shot auth commands: `login`, `logout`, `send-email`, `list-signatures`; also the control-channel dispatch table. |
| `splunk_service.py` | retained (reachable via admin `test-splunk`) | Legacy REST Splunk service used by the admin connectivity test. |
| `splunk/` (34 files) | retained implementation history | Full previous in-process Splunk implementation: `core/` client+guardrails, `search/` (planner, executor, resource manager, evidence store, schema registry, verifier, tools), `detection/` (CITIC format+compiler+tools), `security_queue/`, `official_mcp_client.py`, `query_policy.py`, `spl_risk_rules.py`. **No `register_tools` call site** — its MCP tools are not registered (asserted by `tests/test_server_tools.py`). Tests still exercise these modules. |
| `tests/` (21 test files + fixtures) | first-party test | See [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md). |

## 4. `packages/soc-agent-client/` — browser/admin UI

| Path | Class | Purpose |
|---|---|---|
| `package.json` | manifest | `dsh-soc-agent-client` 0.1.0; entry `lib/index.js`, browser entry `lib/client.js`; `dsh.client` declaration (`inject: [slots, connection, conversation, commandUi, settingsScope]`, `platform: web`). |
| `tsdown.config.ts`, `tsconfig.json` | build config | `clientBundle('dsh-soc-agent-client', ['src/index.ts'])` from the shared harness preset. |
| `src/index.ts` | canonical source | Node half: registers durable settings namespaces `soc-agent-markitdown-attachments` and `soc-action-approval`. |
| `src/action-approval-settings.ts`, `attachment-settings.ts`, `attachment-constants.ts` | canonical source | Shared schemas/types (no I/O): action mode/states schema; attachment limit schema (defaults 5 files / 10 MB / 50 MB / 200 k / 500 k chars). |
| `src/client/index.ts` | canonical source | Browser mount: `/admin` branch (AdminConsole only) vs main app (AuthGate overlay, SocActionPolicyMenu, attachment controller, email draft toolview, CiticBrand); disables harness folders (`api.folders = undefined`). |
| `src/client/AdminConsole.tsx` (+css) | canonical source | Standalone admin console: Connections, Agent context, Access & approvals, AI providers (write-only credential handling). |
| `src/client/AuthGate.tsx` (+css) | canonical source | Full-screen Sentinel login overlay; polls `/auth/me`. |
| `src/client/EmailDraftToolview.tsx`, `emailDraft.ts` (+css) | canonical source | Draft editing UI inside tool blocks; `window.confirm('Send this email now?')` gate; `send-email` RPC; state machine editing/sending/sent/failed/discarded. |
| `src/client/SocActionPolicyMenu.tsx` (+css) | canonical source | Per-session Full access / SOC mode switch (`get-action-policy` / `set-action-mode`). |
| `src/client/SocActionApprovalSettings.tsx` (+css) | canonical source | Sanitizer (`validCatalog`) for the admin per-tool checklist. |
| `src/client/markitdownAttachments.ts`, `MarkItDownDocuments.tsx`, `MarkItDownAttachmentSettings.tsx` (+css) | canonical source | Attachment picker/limits UI; `convert-attachment` RPC with two workers and caching. |
| `src/client/SplunkSettings.ts`, `SubscriptionServerSettings.ts`, `ZimbraSettings.ts`, `settings-common.ts`, `SplunkZimbraOverlay.module.css` | canonical source (legacy cards) | Status-only connection cards + shared RPC helpers; `AdminConsole` is tested not to import them. |
| `src/client/CiticBrand.tsx` (+css) | canonical source | Brand mark/wordmark ("Sentinel"). |
| `src/client/actionPolicy.ts` | canonical source | `readActionMode` RPC helper (fails closed on malformed responses). |
| `src/css-modules.d.ts` | type declaration | Ambient CSS-module types. |
| `lib/index.js`, `lib/client.js`, `lib/client.js.map` | **generated build output — tracked** | tsdown bundle; `client.js` is a closure-factory artifact (`window.__ModuleLoader__.load({id:"dsh-soc-agent-client", …})`). Regenerate with `pnpm --filter dsh-soc-agent-client run build`. |
| `tests/*.test.ts` (4 files) | first-party test | See [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md). |

## 5. `skills/`

| Path | Class | Purpose |
|---|---|---|
| `detection-engineering/SKILL.md` | documentation (runtime skill) | Read-only detection design/validate/backtest workflow; CITIC compile + external human deployment boundary. |
| `false-positive-analysis/SKILL.md` | documentation (runtime skill) | Explain/classify alert firings; propose tuning without modifying rules. |
| `splunk-investigation/SKILL.md` | documentation (runtime skill) | Evidence-based investigation with the `mcp__splunk_mcp__*` read tools only. |
| `spl-writing/SKILL.md` | documentation (runtime skill) | CITIC production SPL + safe backtest SPL via `splunk_compile_citic_detection`. |

Drift note: root `AGENTS.md` also names `soc-incident-triage`, `email-to-splunk-investigation`, and `zimbra-operations`; **no `SKILL.md` exists for those three** anywhere in the checkout. Recorded in [DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md).

## 6. `patches/`

| Path | Class | Purpose |
|---|---|---|
| `dsh-auto-collapse@0.1.4.patch` | locally patched vendor behavior | pnpm patch over the built `lib/client.js` of the `dsh-auto-collapse` UI plugin: English localization, English duration-boundary parsing, and exclusion of rows containing `[data-dshcf-preserve]` from auto-collapse (used by the SOC draft card, which sets `data-dshcf-preserve="true"`). |

## 7. `vendor/deepseek-harness/` — vendored upstream (grouped, not itemized)

`@deepseek-ai/dsh-root` `0.1.1-rc.2` (MIT), ~6,970 tracked files. The vendored pnpm workspace **includes the outer repo** (`../../apps/*`, `../../packages/*`), which is how the SOC packages resolve via `workspace:*`. Key integration surfaces (details in [COMPONENT_CATALOG.md](COMPONENT_CATALOG.md)):

| Surface | Location |
|---|---|
| MCP client bridge (spawns stdio / streamable-http servers, `allowedToolNames`, `toolCallTimeoutMs`, `mcp/request-meta` waterfall) | `packages/mcp/mcp-client/src/{index,connection,transport,tools}.ts` |
| Cordis loader (applies `cordis.patch.yml` patches: id/name/config/disabled/insert) | `vendor/loader/`, core context in `vendor/cordis/src/` |
| Base + web patch layers (master plugin roster) | `packages/bundle/base/cordis.patch.yml`, `packages/bundle/web-app/cordis.patch.yml` |
| Tools registry + approval gating (fail-closed `ask`) | `packages/core/tools/src/index.ts`; `packages/interaction/user-approval/src/index.ts` |
| Skills (filesystem provider, `customSkillDirs`) | `packages/skill/skill-filesystem/src/index.ts`, `packages/skill/tool-skill/src/index.ts` |
| Agent presets (incl. local `citic-soc/`) | `apps/cli/config/agent-presets/` |
| Web server + gateway + frontend static | `packages/host/webserver`, `packages/api/gateway`, `packages/host/frontend-static` |
| Browser boot (`window.__ModuleLoader__`, `__DSH_BOOT__`) | `packages/client/web/src/boot.ts`, `packages/client/modules` |
| Web app bundle + CLI app | `packages/bundle/web-app`, `apps/cli`, `apps/web` |

## 8. Local-only (untracked) paths observed on disk

| Path | Class | Note |
|---|---|---|
| `benchmarks/__pycache__/` | runtime/local state | Only ignored bytecode; no tracked content, no manifest. Role: none (do not invent one). |
| `packages/soc-agent-scheduler/node_modules/` | runtime/local state | Package directory with no tracked manifest or source. Abandoned-looking; state what is present, nothing more. |
| `apps/soc-agent/node_modules/`, `packages/soc-agent-client/node_modules/`, `vendor/**/node_modules/` | dependency directories | Ignored. |
| `apps/soc-agent/server/.env`, `spl_config.local.json`, `.venv/` | runtime/local secrets | Ignored by `apps/soc-agent/server/.gitignore`; contents never read or published by this documentation. |
| `~/.dsh/` (outside repo) | runtime state | Profile wiring (`profiles/web/patches/`, `pnpm-workspace.yaml`, manifest) and the SQLite evidence store default location (`$HOME/.dsh/soc-evidence.sqlite3` unless `DSH_HOME` set). |
| `<root>/.data/` | runtime state | `soc-workspaces/<userId>/…`, setup fingerprints (`harness-install.sha256`, `harness-build.sha256`). Ignored. |

## 9. Census decisions worth calling out

- `packages/soc-agent-client/lib/` is classified **generated but tracked** — the only first-party generated output committed to Git. Canonical source is `src/`; drift is detected by `setup.sh`'s `require`-allowlist check and repaired by rebuild.
- `apps/soc-agent/server/unified_mcp_server/splunk/` is classified **retained implementation history**: complete, tested, but not registered on the live MCP server. Its only live reachability is indirect (`admin_cli test-splunk` uses the legacy REST service; `detection.py` is shared by retained modules).
- `hi.txt` is classified **obsolete/unclassified** and flagged in the audit as a maintainer question.
- `skills/` vs `AGENTS.md` skill lists are a **documented drift**; the four on-disk skills are treated as the real inventory.
