# Documentation audit

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T15:22:44+08:00 = 2026-09-12T07:22:44Z) · documentation verified 2026-09-12 (second round).
> This page records what was actually done, what could not be done, and what remains uncertain. Nothing here is claimed as passed unless its output confirmed it.

**Verification rounds.** Round 1 verified the documentation set against `b26d55d274cf298a456d84edfbcb42b8dc90134b` (2026-09-11T15:35:35Z). Round 2 (this page) re-verified everything against `56c8dd2` after the maintainer's refactoring commits `d264ca7` (auth error handling), `576c7c9` (docs/instructions), `aac5cda` (Zimbra/subscription tool refactor), and `56c8dd2` (Zimbra email forwarding). The maintainer's own implementation report for that refactor is [SHORTENING_PLAN_IMPLEMENTATION.md](SHORTENING_PLAN_IMPLEMENTATION.md) (baseline `d264ca7`).

---

## 1. Baseline

- Repository root: the CITIC_AGENT Git checkout containing this `docs/` tree (no absolute paths recorded here by design).
- Commit: `56c8dd21492a5c36cb9f3eaa3da01160aba40033`; branch `splunk-offical-mcp`, working tree clean at verification time.
- Instruction sources: root `AGENTS.md` (the only first-party `AGENTS.md`), plus the execution brief `docs/GLM_5_3_REPOSITORY_DOCUMENTATION_INSTRUCTIONS.md`.

## 2. What changed in the code between rounds (and how the docs tracked it)

| Change | Documentation impact |
|---|---|
| **Python Splunk stack deleted** (`splunk/**` 34 files, `splunk_service.py`, `detection.py`, 12 test files) | "Retained" reclassified as **removed** everywhere ([REPOSITORY_MAP](reference/REPOSITORY_MAP.md), [COMPONENT_CATALOG](reference/COMPONENT_CATALOG.md) §13, [MCP_TOOL_CATALOG](reference/MCP_TOOL_CATALOG.md) §7, [TRACEABILITY_MATRIX](reference/TRACEABILITY_MATRIX.md) #19); residual-risk item closed |
| **`tool-inventory.js`** — single runtime-independent tool inventory; policy derives sets from it; bridge imports raw names | Documented as the new structural drift fence ([MCP_AND_TOOL_ROUTING](MCP_AND_TOOL_ROUTING.md), [SOURCE_INDEX](reference/SOURCE_INDEX.md), traceability #2) |
| **`zimbra_forward_email`** new read-classified forward-draft tool (28 registered tools; policy 30/42/12) | Tool catalog row + forwarding flow section; UI draft-card section; product overview |
| **`python-command.js`** shared one-shot Python runner (admin env stripping, timeout/abort/parse) | Host/ownership/interface catalog updates; new `python-command.test.js` |
| **SQL schema migrations** (`migrations/*.sql`, `schema.py`, advisory lock, `soc_schema_migrations`, URI over stdin); Node DDL removed | Data-store catalog, interface catalog, configuration reference |
| **`test-splunk` moved to the bridge**: live `splunk_get_info` probe with token redaction; `admin_cli` lost the command; endpoint URL validation added | Component catalog §8/§11, interface catalog, troubleshooting, operations |
| **`SplunkSettings` slimmed** to the 5 bridge fields; all legacy Splunk REST/policy/lookup/queue env vars deleted; `.env.example` slimmed; legacy Zimbra account vars removed | Configuration reference rewritten |
| **Setup requires the official MCP connection** (REST Splunk fields removed; one parameter inventory) | Getting started, operations |
| **Client:** legacy status cards removed; `lib/` rebuilt (−441 lines); AdminConsole `StatusNotice` pattern; forward-draft card support | UI page, component catalog, source index |
| **`hi.txt` deleted** | Previous audit question closed |
| **Vendor `apiproxy`**: structured `authentication-required`/`admin-authentication-required` RPC codes pinned upstream | Interface catalog patch-seam section |

## 3. Inspection and validation commands actually run

| Command / method | Purpose | Result |
|---|---|---|
| `git log`, `git diff --stat b26d55d..HEAD`, per-path diffs, `git show HEAD:<file>` | Round-2 change study | Done; summarized in §2 |
| `git ls-files` (recount: apps 71 = 17 host + 54 server; packages 38; skills 4; patches 1; root 8; docs 60 → 182 first-party incl. docs) | Census refresh | Done — [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md) |
| Read-through of all changed first-party sources (`policy.js`, `tool-inventory.js`, `python-command.js`, `host.js`, `ownership.js`, `splunk-bridge.js`, `server.py`, `config.py`, `schema.py`, `migrations/*.sql`, `postgres_store.py`, `admin_cli.py`, `auth_cli.py`, `zimbra/mail/{service,tools}.py`, `zimbra.py`, client diffs, `setup.sh`, READMEs, `.env.example`) | Primary evidence | Done |
| Constant spot-checks (session TTLs, pool sizes, body clamp ≤100 000, header allowlist 12 + "between 1 and 12" message, archive/LRU limits, background constants, `MAX_REDIRECTS=5`, preset values) | Load-bearing numbers | All confirmed against source |
| Test-source review + **execution**: `npm test` (host), `npm test` (client), `uv run pytest` attempt | Live evidence | Host: **25/29 counted pass**, 4 file-level failures — one environmental root cause (§7a). Client: **12/12 passed**. Python: **blocked** by incomplete virtualenv (§7a) |
| Python validator (`/tmp/validate-docs.py`): Markdown/HTML links + fragment anchors, HTML tag balance (incl. inline SVG), remote-ref ban, script wiring, verified-header presence, required-file presence, forbidden-content scan, parity | Automated checks | **Final run: 0 errors, 0 warnings** |
| `git status` / `git diff --stat` review | Change scope | Only `docs/**` tracked changes (§12) |

## 4. Paths intentionally excluded (and why)

| Path | Reason |
|---|---|
| `vendor/deepseek-harness/**` internals | Unmodified upstream; only the integration surface plus the one changed file (`apiproxy` RPC schema) were read |
| `**/node_modules/`, `.venv/`, `__pycache__/`, build `dist/` | Dependency/cache/build artifacts |
| `.env` files, `~/.dsh/` contents, `.data/`, `.state/` | Secrets/runtime data — never read; documented structurally |
| Untracked leftovers `unified_mcp_server/splunk/`, `catalog/`, `__pycache__/` | Deleted from Git; stale on-disk directories — classified, not inspected |
| `benchmarks/` (removed earlier), `packages/soc-agent-scheduler/node_modules/` | No tracked content; no role |

## 5. First-party coverage summary

- **182/182 tracked first-party files classified** ([reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md)) — root 8, `apps/soc-agent` 71 (17 host + 54 server), `packages/soc-agent-client` 38, `skills` 4, `patches` 1, `docs` 60 (this set + the brief + the maintainer's shortening-plan report) — plus the vendored tree grouped.
- 16 components in the 11-field matrix; 28 tools + 13 bridge reads + non-MCP names cataloged; 15 runtime flows with failure branches; 10 diagram sources + 10 interactive SVGs.

## 6. Contradictions found and their resolution (cumulative)

| Contradiction | Resolution |
|---|---|
| Brief/scope expected `integrations/` to exist | Removed from Git history; replaced by the bridge approach. Documented; brief corrected |
| `AGENTS.md` lists 7 skills; `skills/` has 4 | Still open — **maintainer question 1** |
| Detection/SPL skills referenced retained-only tools | **Worsened this round:** the implementation was deleted, so `detection-engineering`, `spl-writing`, and parts of `false-positive-analysis` now reference tools that exist nowhere. **Maintainer question 2** |
| `zimbra_send_email` name implies sending | Documented as the canonical name-vs-behavior trap; draft-only confirmed by docstring/tests |
| `zimbra_forward_email` follows the same pattern | Documented proactively: read-classified draft preparation; delivery only via the confirmed send path |
| `.env.example` mixed active and legacy variables | **Resolved this round:** the legacy families were deleted upstream; the reference now lists only active variables |
| Send confirmation: UI-only vs server-enforced | Resolved by evidence: UI `window.confirm` is a UI control; server enforces session auth + `ZIMBRA_ALLOW_SEND` + Zimbra `sent:true`; no confirmation token (traceability #34) |
| Retained Splunk code "present but not registered" | **Resolved this round:** deleted entirely; `test_server_tools.py` remains the re-introduction gate |
| `hi.txt` unclassified | **Resolved:** deleted upstream |
| `packages/soc-agent-scheduler` local dir with no manifest | **Still open — maintainer question** |
| README layout prose vs reality | Now consistent (README updated upstream to link the shortening report and the MCP requirement) |

## 7. Checks that could not run (and substitutes used)

### 7a. Test-suite execution results (actual, this round)

- **Client TS suite: 12/12 passed** (tsx loader, offline) — includes the new `admin-console` and forward-draft tests.
- **Host JS suite: 25/29 counted passed.** Four file-level failures (`background`, `policy`, `splunk-bridge`, `user-mode`) are **import errors, not assertion failures**: `ERR_MODULE_NOT_FOUND: '@deepseek-ai/schemastery'` — this checkout's `apps/soc-agent/node_modules` lacks the pnpm workspace links that `./setup.sh` (harness `pnpm install`) creates. Repairing requires dependency installation, reserved for separate authorization; recorded rather than forced. The failures do not affect the fence tests that could run: `skills.test.js` (patch/allowlist pins) and `splunk-bridge.test.js` passed.
- **Python suite: blocked before execution.** Collection fails on an incomplete virtualenv (`mcp`, `zimbra_client` missing); `uv sync --extra test` would repair it — dependency installation again requires separate authorization. No Python assertion has been executed this session; the coverage matrix describes source-verified contracts.

### 7b. Checks with substitutes

| Check | Why not run | Substitute |
|---|---|---|
| Mermaid rendering of `docs/diagrams/*.mmd` | No renderer; adding one forbidden | Accessible SVGs regenerated from the same data (with `<title>`/`<desc>` and per-node links); `.mmd` syntax not renderer-validated (recorded limitation) |
| Real-browser pass (viewports, keyboard, screen reader) | No browser | Semantic HTML, landmarks, skip link, focus-visible, reduced-motion, print rules; inline SVGs expose focusable links; static tag-balance + anchor validation |
| HTML/CSS validator binaries | Not installed | Python `html.parser` balance check; CSS reviewed against the brief's site rules |
| Cold-read by a second person | Single-author session | Mission cold-read table (§7c) mapping all nine questions to pages |

### 7c. Mission cold-read result (nine questions, docs only)

| # | Question | Answered by | Status |
|---|---|---|---|
| 1 | Problem, users | [README.md](README.md) · [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | Answered |
| 2 | Components, locations, ownership | [reference/COMPONENT_CATALOG.md](reference/COMPONENT_CATALOG.md) · [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md) | Answered |
| 3 | Interactions across browser/host/MCP/Python/external/persistence/skills/vendor | [ARCHITECTURE.md](ARCHITECTURE.md) · [RUNTIME_FLOWS.md](RUNTIME_FLOWS.md) | Answered |
| 4 | Identity, ownership, isolation, authorization, approval, email confirmation, trust boundaries | [AUTHENTICATION_AND_OWNERSHIP.md](AUTHENTICATION_AND_OWNERSHIP.md) · [SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md) | Answered |
| 5 | Startup → request → Splunk → Zimbra → subscription → admin change | [RUNTIME_FLOWS.md](RUNTIME_FLOWS.md) flows 1–15 | Answered |
| 6 | Interfaces, tools, configuration, stores, commands, tests | [reference/INTERFACE_CATALOG.md](reference/INTERFACE_CATALOG.md) · [reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md) · [reference/CONFIGURATION_REFERENCE.md](reference/CONFIGURATION_REFERENCE.md) · [reference/DATA_STORE_CATALOG.md](reference/DATA_STORE_CATALOG.md) · [reference/TEST_COVERAGE_MATRIX.md](reference/TEST_COVERAGE_MATRIX.md) | Answered |
| 7 | Developer setup/run/test/troubleshoot/change | [GETTING_STARTED.md](GETTING_STARTED.md) · [DEVELOPMENT.md](DEVELOPMENT.md) · [TESTING.md](TESTING.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Answered |
| 8 | Active/removed/generated/vendored/legacy classification | [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md) §9 · component-catalog legend | Answered |
| 9 | Confirmed vs inference vs unknown | [reference/TRACEABILITY_MATRIX.md](reference/TRACEABILITY_MATRIX.md) · this audit §8 | Answered |

## 8. Known unknowns and questions for maintainers

1. **Skills drift** — add the three missing `SKILL.md` files (`soc-incident-triage`, `email-to-splunk-investigation`, `zimbra-operations`) or trim the `AGENTS.md` list?
2. **Detection/SPL skills** — now reference removed tooling: update the skills to the bridge-only surface, or restore the compiler as a tool? (The maintainer's shortening report chose removal.)
3. **`packages/soc-agent-scheduler`** — abandon (delete the local directory) or restore a manifest?
4. **Server-side send confirmation** — is a confirmation token required by policy, or is UI-confirm + gate + `sent:true` accepted?
5. **Retention** — deployment-level policy for workspace/conversation retention?
6. **Deployment topology** — container deployment implied by removed `RUNNING_INSIDE_DOCKER` handling (now gone from config) — document externally or ignore.
7. **Stale on-disk directories** (`unified_mcp_server/splunk/`, `catalog/`, the evidence-store SQLite file) — safe to delete; confirm.

## 9. Broken/stale documentation corrected

- Round 2 corrected every page affected by the refactor (counts 27→28 tools, 29/41/12→30/42/12, retained→removed, `test-splunk` semantics, migrations, forwarding, setup requirements) — the traceability matrix is the index of those corrections.
- Root `README.md`, `BACKGROUND.md`, `AGENTS.md`, and the server README were updated **upstream by the maintainer** and are consistent with this set; the brief's scope was corrected before round 1.

## 10. Markdown ↔ HTML parity result

- Mapping (recorded per the brief): index ← README+PRODUCT_OVERVIEW · getting-started ← GETTING_STARTED · architecture ← ARCHITECTURE · flows ← RUNTIME_FLOWS+USER_INTERFACE_AND_ACTION_MODES · mcp-tooling ← MCP_AND_TOOL_ROUTING · security ← AUTHENTICATION+SECURITY · development ← DEVELOPMENT+TESTING · operations ← DEPLOYMENT+CONFIGURATION+DATA · reference ← reference/* · troubleshooting ← TROUBLESHOOTING; `SHORTENING_PLAN_IMPLEMENTATION.md` and this audit are linked from the site rather than duplicated.
- Every main Markdown page is reachable from the site (validator-checked); every site page names its Markdown sources; **interactive layer** (inline clickable SVG diagrams, page search, scrollspy) is progressive enhancement — all content and navigation work without JavaScript, recorded here as the parity/interactivity decision.

## 11. Validation results (final run)

- Markdown/HTML links + fragment anchors: **all valid**.
- HTML: 10 pages parse with balanced tags (inline SVG included); verified-commit present on every page; no remote references; all local refs resolve.
- Forbidden-content scan: no secrets patterns, no absolute developer-home paths, no customer identifiers, no placeholder text.
- Required files: 16 main pages, 10 reference catalogs, 10 `.mmd` sources, 10 SVGs, 11 site files (10 pages + styles.css + script.js) — all present, no placeholders.
- Scope: only `docs/**` changed (§12).

## 12. Change-scope confirmation

- This round modified tracked files under `docs/` only (content updates to `56c8dd2` plus the interactive site layer: `site/script.js`, inlined SVGs, styles). The previous round's brief correction predates the code change.
- No application code, tests, manifests, lock files, patches, or vendor files were touched by the documentation work. No live service was invoked. No secret value was read or reproduced. The retained-stack removal itself was performed upstream by the maintainer (documented in `SHORTENING_PLAN_IMPLEMENTATION.md`), not by the documentation work.
