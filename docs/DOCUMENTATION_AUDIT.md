# Documentation audit

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T23:35:35+08:00 = 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.
> This page records what was actually done, what could not be done, and what remains uncertain. Nothing here is claimed as passed unless its output confirmed it.

**Who this is for:** maintainers trusting (or challenging) the rest of `docs/`, and the next person who has to re-verify this set after a change.

---

## 1. Baseline

- Repository root: the CITIC_AGENT Git checkout containing this `docs/` tree (the working directory of the verification session; no absolute paths are recorded here on purpose).
- Commit: `b26d55d274cf298a456d84edfbcb42b8dc90134b`; branch `splunk-offical-mcp` (in sync with `origin/splunk-offical-mcp` at verification time).
- Working tree at start: clean except this documentation set (see §9).
- Instruction sources read first: root `AGENTS.md` (the only first-party `AGENTS.md`), plus the execution brief `docs/GLM_5_3_REPOSITORY_DOCUMENTATION_INSTRUCTIONS.md`.

## 2. Inspection and validation commands actually run

| Command / method | Purpose | Result |
|---|---|---|
| `git log -1 --format=…`, `git status`, `git ls-files` (+ per-path variants) | Baseline, census (Git-aware discovery) | Done; counts in [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md) |
| `git log --follow -- hi.txt`; `git log --all -- 'integrations*'` | Classify stray root file; confirm removed `integrations/` directory | Done — see §6 |
| Read-through of first-party sources (`apps/soc-agent/*.js`, `packages/soc-agent-client/src/**`, server modules, `skills/*.md`, `setup.sh`, `update.sh`, root docs, `.env.example`, `.gitignore`, `cordis.patch.yml`, `patches/*.patch`, vendored integration surfaces) | Primary evidence for every page | Done (vendored read breadth-first, integration surface only) |
| Test-source review: all 9 Node test files, 4 client test files, 21 Python test files + fixtures (test names, fixtures, skip markers) | Coverage matrix | Done — 27 + 9 + 75 tests; **no skips, no live services** |
| Grep-based cross-checks: tool names, env var names, allowlists, `mcp/request-meta` fields, `window.confirm`, `sent === true`, `EmptyAccountStore` | Contract consistency | Done |
| Python validator (`/tmp/validate-docs.py`, disposable): Markdown links, HTML parse (tag balance), HTML/CSS asset refs, fragment anchors, remote-reference ban, secrets/absolute-path/customer-identifier scan, verified-header presence, required-file presence, Markdown↔HTML parity | Phase 6 automated checks | Run three times (see §7): first run found 11 links to the not-yet-written audit + 4 pages missing the literal Evidence heading (fixed); second run found an absolute home path in this audit (fixed); **final run: 0 errors, 0 warnings** |
| `npm test` in `apps/soc-agent` (Node `--test`) | Execute the host suite | **21/24 passed; 3 file-level failures, one environmental root cause** (§7a) |
| `npm test` in `packages/soc-agent-client` | Execute the client suite | **9/9 passed** |
| `uv run pytest` in `apps/soc-agent/server` | Execute the Python suite | **Could not run** — 13 collection errors, incomplete virtualenv (§7a); completing it requires dependency installation, which the governing rules reserve for separate authorization |
| `git status`/`git diff --stat` review | Change-scope check | Only `docs/**` modified/added (§9) |

## 3. Paths intentionally excluded (and why)

| Path | Reason |
|---|---|
| `vendor/deepseek-harness/**` internals (6,970 files) | Unmodified upstream; only integration surfaces read (loader, mcp-client, tools/approval registry, webserver/modules, presets, patch targets). Grouped in [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md) §7 |
| `**/node_modules/`, `.venv/`, `__pycache__/`, `*.egg-info/`, build `dist/` | Dependency/cache/build artifacts (gitignored) |
| `apps/soc-agent/server/.env`, `spl_config.local.json`, any `~/.dsh` contents, `.data/`, `.state/`, browser storage | Secrets/runtime data — never read; documented structurally only |
| `benchmarks/__pycache__`, `packages/soc-agent-scheduler/node_modules` | Local-only, no tracked content; classified as "no tracked role" |
| `docs/site/` opened in a browser | No browser available in this environment; static checks performed instead (§7) |

## 4. First-party coverage summary

- **Tracked first-party files:** 166/166 classified ([reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md)) — root (9), `apps/soc-agent` (111 = 17 host-side + 94 server-side), `packages/soc-agent-client` (40), `skills` (4), `patches` (1), `docs/` brief (1) — plus the vendored 6,970 grouped.
- **Components documented:** 16 with the full 11-field matrix ([reference/COMPONENT_CATALOG.md](reference/COMPONENT_CATALOG.md)).
- **Runtime flows:** 15/15 traced with failure branches ([RUNTIME_FLOWS.md](RUNTIME_FLOWS.md)).
- **Tools:** 27 registered + 13 bridge reads + non-MCP name shapes + retained-only set ([reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md)).
- **Diagrams:** 10/10 as Mermaid sources + generated accessible SVGs ([diagrams/README.md](diagrams/README.md)).

## 5. Generated / vendor classification decisions

| Decision | Rationale |
|---|---|
| `packages/soc-agent-client/lib/*` = **generated but tracked** | Files are committed; tsdown regenerates them; setup detects drift via a `require`-allowlist check |
| `unified_mcp_server/splunk/**` + `splunk_service.py` = **retained** | Complete, tested, but no `register_tools` call site; asserted by `test_server_tools.py`; only indirect reachability (admin `test-splunk`) |
| `unified_mcp_server/account_store.py` + `zimbra_accounts` table = **legacy** | Runtime store neutered by `server.py EmptyAccountStore`; admin CLI refuses account management |
| `hi.txt` = **obsolete/unclassified** | Tracked Splunk alert-action token template; no references found; flagged below |
| `lefthook.yml` = **inert** | Entirely commented examples |
| Vendor = **vendored, patched via manifests** | `cordis.patch.yml` (rows) + one pnpm patch; no vendored source edits |

## 6. Contradictions found and their resolution

| Contradiction | Resolution |
|---|---|
| Brief/scope expected `integrations/` to exist | **Does not exist** at this commit (git history shows removal; replaced by the official-MCP bridge approach). Docs describe the removal; the brief's scope bullet was already corrected in the updated instruction file |
| `AGENTS.md` lists 7 skills; `skills/` has 4 | Documented as drift (`soc-incident-triage`, `email-to-splunk-investigation`, `zimbra-operations` have no files). **Maintainer question 1** |
| Detection skills reference `splunk_get_detection`, `splunk_compile_citic_detection`, `splunk_backtest_detection`, `splunk_validate_detection`, `splunk_list_saved_searches` — retained-only, not registered | Documented as known drift in [reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md) §6 and the tool-routing page. **Maintainer question 2** |
| `zimbra_send_email` name implies sending; behavior is draft-only | Resolved by evidence (docstring, tool code, policy class, UI label); documented as the canonical name-vs-behavior trap |
| `.env.example` mixes active and legacy Splunk variables | Separated in [reference/CONFIGURATION_REFERENCE.md](reference/CONFIGURATION_REFERENCE.md) §4 with a verify-before-legacy rule; `SPLUNK_SANITIZE_OUTPUT` is still live (read by `investigation.js`) |
| "Send confirmation" appears server-enforced in prose vs UI-only in code | Resolved: the `window.confirm` is a UI control; server enforces authentication + `ZIMBRA_ALLOW_SEND` + `sent:true` verification; recorded as traceability row #32 |
| Root `README.md` says packages = "SOC client package" while a second package directory exists | `packages/soc-agent-scheduler` has no tracked files; documented as local-only |
| Background injection claimed "loaded with AGENTS.md at session start" (README) vs plugin re-injection (code) | Both are true: preset instruction candidates + `host.js` refresh; documented as two mechanisms in flow 13 |

## 7. Checks that could not run (and substitutes used)

### 7a. Test-suite execution results (actual)

- **Client TS suite: 9/9 passed** (tsx loader, offline).
- **Host JS suite: 21/24 passed.** The three failures (`background.test.js`, `policy.test.js`, `user-mode.test.js`) are **file-level import errors, not assertion failures**: `ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/schemastery'` when importing `host.js`. Root cause is environmental — this checkout's `apps/soc-agent/node_modules` lacks the pnpm workspace links that `setup.sh` (harness `pnpm install`) creates; the vendored `vendor/deepseek-harness/vendor/schemastery/lib/` build exists but is not linked into the app's dependency tree. Repairing it requires dependency installation (`pnpm install`), which the governing rules reserve for separate authorization — so it was left as-is and recorded. Importantly, the failures do **not** touch the naming-fence assertions that could run: `skills.test.js` (patch/bridge/allowlist pins) and `splunk-bridge.test.js` passed, as did all ten `auth.test.js` tests.
- **Python suite: blocked before execution.** 13 collection errors, all `ModuleNotFoundError` (`mcp`, `zimbra_client`, …) from an incomplete virtualenv. `uv sync --extra test` would repair it but installs dependencies — same authorization rule. No Python assertion has therefore been executed in this session; the coverage matrix describes source-verified contracts.

| Check | Why | Substitute |
|---|---|---|
| Mermaid rendering of `docs/diagrams/*.mmd` | No `mmdc`/Mermaid renderer available; adding one is forbidden | Generated simple **accessible SVGs** (scripted, `<title>`+`<desc>`) + plain-text relationship descriptions; `.mmd` syntax kept minimal (flowchart/sequenceDiagram/stateDiagram-v2) but is **not renderer-validated** — noted as a limitation |
| Opening HTML in a real browser (narrow/wide viewports, keyboard walk-through, screen reader) | No browser in this environment | Static equivalents: HTML tag-balance parse, fragment-anchor check, semantic landmarks present in every page, skip link + focus-visible + reduced-motion + print rules in CSS (reviewed), responsive grid in CSS (reviewed) |
| HTML/CSS validator binaries (tidy, stylelint) | Not installed; adding dependencies forbidden | Python `html.parser` tag-balance check + CSS reviewed against the site requirements (custom properties, one stylesheet, print block) |
| Link checking with external tools | None available | Custom link walker (all Markdown + HTML refs, fragments stripped) |
| Spelling/terminology tooling | Not available | Glossary-driven vocabulary; consistent names used verbatim (grep spot-checks for legacy terms found none) |
| Cold-read by a second person | Single-author session | The nine Mission questions were answered from the generated docs alone during drafting (README → overview → architecture → flows → tooling → security → data → config/ops → reference); reader-map paths in `docs/README.md` mirror this |

### 7b. Mission cold-read result

The brief requires a final cold-read pass answering the nine Mission questions **using only the generated documentation**. Result — each question, the page(s) that answer it, and status:

| # | Mission question | Answered by | Status |
|---|---|---|---|
| 1 | Problem, users | [README.md](README.md) summary · [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) §1–2 | Answered |
| 2 | Major components, locations, ownership | [reference/COMPONENT_CATALOG.md](reference/COMPONENT_CATALOG.md) · [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md) | Answered |
| 3 | How browser, host, MCP, Python, external systems, persistence, skills, vendor interact | [ARCHITECTURE.md](ARCHITECTURE.md) · [RUNTIME_FLOWS.md](RUNTIME_FLOWS.md) | Answered |
| 4 | Identity, ownership, customer isolation, authorization, approval, email confirmation, trust boundaries | [AUTHENTICATION_AND_OWNERSHIP.md](AUTHENTICATION_AND_OWNERSHIP.md) · [SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md) | Answered |
| 5 | Startup → request → Splunk → Zimbra → subscription → admin change | [RUNTIME_FLOWS.md](RUNTIME_FLOWS.md) flows 1–15 | Answered |
| 6 | Important interfaces, tool names, configuration, stores, commands, tests | [reference/INTERFACE_CATALOG.md](reference/INTERFACE_CATALOG.md) · [reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md) · [reference/CONFIGURATION_REFERENCE.md](reference/CONFIGURATION_REFERENCE.md) · [reference/DATA_STORE_CATALOG.md](reference/DATA_STORE_CATALOG.md) · [reference/TEST_COVERAGE_MATRIX.md](reference/TEST_COVERAGE_MATRIX.md) | Answered |
| 7 | Developer setup/run/test/troubleshoot/change | [GETTING_STARTED.md](GETTING_STARTED.md) · [DEVELOPMENT.md](DEVELOPMENT.md) · [TESTING.md](TESTING.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Answered |
| 8 | Active / retained / generated / vendored / test-only / legacy classification | [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md) §9 · [reference/COMPONENT_CATALOG.md](reference/COMPONENT_CATALOG.md) runtime-status legend | Answered |
| 9 | Confirmed vs inference vs unknown | [reference/TRACEABILITY_MATRIX.md](reference/TRACEABILITY_MATRIX.md) confidence column · this audit §8 | Answered |



## 8. Known unknowns and questions for maintainers

1. **Skills drift** — add the three missing `SKILL.md` files or trim the `AGENTS.md` list?
2. **Retained detection tools** — will `splunk_get_detection`/`compile`/`backtest` be registered again (the skills assume them), or should the skills be updated to the bridge-only surface?
3. **`hi.txt`** — keep (document its purpose) or delete?
4. **Server-side send confirmation** — is a confirmation token required by policy, or is UI-confirm + gate + acknowledgment accepted?
5. **Retention** — is there a deployment-level policy for workspace/conversation retention?
6. **Deployment topology** — `RUNNING_INSIDE_DOCKER`/`SPLUNK_HOST_FOR_DOCKER` imply a container deployment defined outside this repo; document it or remove the variables.
7. **`packages/soc-agent-scheduler`** — abandon (delete the local dir) or restore a manifest?

## 9. Broken/stale documentation corrected

- This documentation set *is* the correction: previously `docs/` contained only the execution brief. Root `README.md`/`BACKGROUND.md`/`AGENTS.md` were **preserved unmodified** (per the brief); their known drift points are recorded above rather than edited.
- The execution brief itself was corrected before execution (stale `integrations/` scope, missing naming traps) — that edit is part of this diff and predates the doc set.

## 10. Markdown ↔ HTML parity result

- Mapping (recorded per the brief): index ← README+PRODUCT_OVERVIEW · getting-started ← GETTING_STARTED · architecture ← ARCHITECTURE · flows ← RUNTIME_FLOWS+USER_INTERFACE_AND_ACTION_MODES · mcp-tooling ← MCP_AND_TOOL_ROUTING · security ← AUTHENTICATION+SECURITY · development ← DEVELOPMENT+TESTING · operations ← DEPLOYMENT+CONFIGURATION+DATA · reference ← reference/* · troubleshooting ← TROUBLESHOOTING. `DOCUMENTATION_AUDIT.md` (this file) is linked from index and reference pages rather than duplicated as a site page.
- Every main Markdown page is reachable from the site (validator check), every site page names the Markdown files it presents, and every site page carries the verified-commit footer. Facts were written once in Markdown and summarized — not rewritten — for the site.

## 11. Validation results (final run)

- Markdown links: **all valid** (relative links resolve at this tree).
- HTML: all 10 pages parse with balanced tags; every page has `<title>` and the verified commit; no remote references; all local `href`/`src` resolve (SVGs included).
- CSS: one shared stylesheet; no `url()` references at all (no remote/data refs).
- Forbidden-content scan: no secrets patterns, no absolute developer-home paths, no customer identifiers (the `BACKGROUND.md` customer example is referenced without reproduction), no placeholder text.
- Required files: 15 main pages + 10 reference catalogs + 10 `.mmd` sources + 10 SVGs + 10 site pages + `styles.css` — all present; no empty placeholders.
- Scope: `git status` shows only `docs/**` additions/modification — no source, test, manifest, or vendor changes (§12).

## 12. Change-scope confirmation

- Modified: `docs/GLM_5_3_REPOSITORY_DOCUMENTATION_INSTRUCTIONS.md` (brief correction, pre-execution).
- Added: `docs/README.md`, `GETTING_STARTED.md`, `PRODUCT_OVERVIEW.md`, `ARCHITECTURE.md`, `RUNTIME_FLOWS.md`, `MCP_AND_TOOL_ROUTING.md`, `AUTHENTICATION_AND_OWNERSHIP.md`, `SECURITY_AND_TRUST_BOUNDARIES.md`, `DATA_AND_PERSISTENCE.md`, `USER_INTERFACE_AND_ACTION_MODES.md`, `CONFIGURATION.md`, `DEVELOPMENT.md`, `TESTING.md`, `DEPLOYMENT_AND_OPERATIONS.md`, `TROUBLESHOOTING.md`, this file, `docs/reference/*` (10), `docs/diagrams/*` (11), `docs/site/*` (11) and `docs/site/assets/diagrams/*` (10).
- No application code, tests, manifests, lock files, patches, or vendor files were touched. No live service was invoked. No secret value was read or reproduced.
