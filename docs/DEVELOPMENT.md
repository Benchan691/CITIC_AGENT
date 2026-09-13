# Development

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](zh/DEVELOPMENT.md)

**Who this is for:** developers changing this repository.

**What you will understand:** the layout and toolchain, the workspace/dependency model, canonical-vs-generated boundaries, build/run/lint commands, the patch workflow, safe change recipes (including the full MCP-tool contract), and how vendor changes stay reproducible.

**Plain-language summary.** First-party code is small and deliberately shaped: Node host plugins, one Python package, and an independent SOC workspace containing 37 packages (including the product bundle) and 26 browser-facing package faces. The pristine rc.2 Harness remains frozen under `vendor/deepseek-harness`; the SOC profile composes it through `apps/soc-agent/cordis.patch.yml` and SOC-owned replacement packages. Most change risk is *synchronization* risk: the same tool inventory lives in four places, fenced by tests.

**Prerequisites:** [GETTING_STARTED.md](GETTING_STARTED.md); file map in [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md).

---

## 1. Repository layout (canonical source only)

| Area | Path | Language/tooling |
|---|---|---|
| Node host plugins | `apps/soc-agent/*.js` | Plain ESM, no framework, `node:test` |
| Python server | `apps/soc-agent/server/unified_mcp_server/` | Python ≥3.12, uv, pytest (+asyncio auto) |
| SOC browser packages | `packages/soc-agent-*/src/` | TypeScript + React + CSS modules, tsdown; mandatory core/sidebar/workspace plus optional feature plugins |
| Skills | `skills/<name>/SKILL.md` | Markdown with frontmatter |
| Wiring | `apps/soc-agent/cordis.patch.yml` | YAML patch manifest |
| Vendor | `vendor/deepseek-harness/` | pnpm monorepo (do not edit; see §5) |

## 2. Toolchain and commands

| Task | Command (from repo root unless noted) |
|---|---|
| Install everything / repair wiring | `./setup.sh` (interactive) or `./setup.sh --plugins` (non-interactive) |
| Node tests (host) | `pnpm --filter dsh-soc-agent test` |
| SOC package tests | `pnpm --filter dsh-soc-agent test && pnpm --filter 'dsh-soc-agent-*' test` |
| Python tests (48) | `cd apps/soc-agent/server && uv sync --extra test && uv run pytest` |
| Rebuild SOC workspace bundles | `pnpm run build` (or `./setup.sh --plugins` for the complete install/build/profile flow) |
| Browser smoke and screenshots | `pnpm exec vitest run --config apps/soc-agent/tests/vitest.browser.config.mjs` |
| Rebuild harness (forced) | `./setup.sh --plugins --rebuild` |
| Run the app | `vendor/deepseek-harness/node_modules/.bin/dsh web --no-open` from the repository root (port 3080) |
| Audit installation | `./setup.sh --check` |

Lint/format: there is **no active formatter or hook** — `lefthook.yml` is entirely commented examples, and no lint config exists at the root. Match the surrounding style manually.

## 3. Dependency / workspace model

- The root `pnpm-workspace.yaml` owns the SOC workspace; the pristine Harness has no workspace membership or SOC source references. Runtime SOC-to-SOC dependencies use exact published-style versions in manifests, while the root lockfile resolves the local development workspace. Profile installation uses direct local package paths through the official `dsh plugin --profile web add` mechanism.
- The root `package.json` pins `pnpm@11.7.0` and Node `^22.19.0 || >=24.0.0`. The Harness release is pinned separately by `vendor/deepseek-harness.upstream.json` and verified against a fresh rc.2 archive.
- Python extras: `markitdown-llm` (optional OCR), `test` (pytest).
- Generated boundary: every `packages/soc-agent-*/lib/` artifact is **tracked** — always rebuild the owning package after a source change and commit declarations and bundles together with the source (setup also auto-repairs drift).

## 4. Patch workflow

1. **Product patch** (`apps/soc-agent/cordis.patch.yml`): toggle/configure upstream plugin rows or insert new product plugins. Identified by plugin id; consumed via `dsh.bundle.patch`. Changes need a host restart and are pinned by `skills.test.js` (roster assertions).
2. **SOC replacement package** (`packages/soc-agent-*/`): an independently built fork of a security-sensitive Harness implementation. Each fork carries `UPSTREAM_BASELINE.json` with its official source path, rc.2 commit, and source hash; do not replace it with a vendor-relative import.
3. **Preset** (`apps/soc-agent/agent-presets/citic-soc/agent.cordis.yml`): first-party SOC configuration outside the vendor snapshot. It is loaded through the product patch and may be changed without modifying the official release.

## 5. Keeping vendor changes reproducible

Do not edit `vendor/deepseek-harness` at all. `tooling/verify-upstream.mjs --fresh` compares the tracked snapshot with the official rc.2 release archive and rejects SOC files, generated outputs, and source drift. Put changes in the root SOC workspace, the product composition, or a first-party asset/configuration directory. Do not add vendor-relative links or imports; a future Harness refresh replaces the frozen snapshot independently.

## 6. Adding or changing a tool — synchronized-change recipe

An MCP tool touches **six contracts**. Miss one and either the tool silently never appears or the tests fail:

1. **Inventory** — add the name (and label/kind) to `apps/soc-agent/tool-inventory.js` — the single source of truth that policy and the bridge derive from.
2. **Python registration** — implement the tool in the matching `register_tools` module (mail/filters/email); annotate reads with `readOnlyHint`; never expose `ctx`/`account_id`.
3. **Raw allowlist** — add the raw name to `soc-agent-mcp.allowedToolNames` in `cordis.patch.yml` (the patch also env-configures the server).
4. **Qualified policy** — `policy.js` now derives everything from the inventory; add nothing there unless the classification logic itself changes.
5. **Client labels/views** — only if the tool needs special presentation (like the forward-draft card). Admin checklists render automatically from the catalogs.
6. **Tests, both tiers** — extend `test_server_tools.py` (exact tool set) and `policy.test.js`/`skills.test.js` counts (currently 30 read / 42 domain / 12 approval — they will change and that is the point).
7. **Documentation** — update [reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md), [MCP_AND_TOOL_ROUTING.md](MCP_AND_TOOL_ROUTING.md), and the traceability matrix.

For a **Splunk bridge** tool change, additionally: `OFFICIAL_SPLUNK_TOOL_NAMES` in `splunk-bridge.js` (and the external server must actually expose it), noting the projection prefix `mcp__splunk_mcp__splunk_` applies automatically.

For a **skill**: add `skills/<name>/SKILL.md` only — plus, if you want it listed as available, update `AGENTS.md` *and* file the gap in the audit (the current three-missing-skills drift shows what happens otherwise).

For **policy/UI changes**: `policy.js` + `host.js` gate behavior + `AdminConsole`/`SocActionPolicyMenu` labels + `sections.test.ts` copy guardrails + docs.

## 7. Python and TypeScript notes

- **Python:** the request pipeline is `execute()` (correlation id, budget, identity) → service call → `success()/failure()` envelope. **Schema changes** go through a new `migrations/NNN_*.sql` file (advisory-locked, ledger-tracked) — never ad-hoc DDL in Node or Python service code. Add `ServiceError` codes to the taxonomy rather than inventing shapes; never let third-party exception text reach users. Blocking work goes through `run_blocking` (bounded). Tests use in-memory doubles and fake transports — no live services.
- **TypeScript/React:** optional features use the core `SocClientRuntime` from `dsh-soc-agent-client/client` for `/soc-agent-config`; settings pages use the Harness settings API with `expectedRevision`; CSS modules use `.module.css`; each browser bundle is a closure factory — do not add bare `require()`s outside the setup allowlist (react, react-dom, cordis, client-ui primitives/runtime, client store, or the SOC gateway client entry) or setup will rebuild/reject.

## Evidence in the repository

- Root `package.json`, each SOC package manifest, `pyproject.toml` + pytest config, `setup.sh` stage comments, `vendor/deepseek-harness.upstream.json`, and `skills.test.js` (composition/preset pins).
