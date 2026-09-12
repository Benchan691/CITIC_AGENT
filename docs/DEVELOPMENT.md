# Development

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.

**Who this is for:** developers changing this repository.

**What you will understand:** the layout and toolchain, the workspace/dependency model, canonical-vs-generated boundaries, build/run/lint commands, the patch workflow, safe change recipes (including the full MCP-tool contract), and how vendor changes stay reproducible.

**Plain-language summary.** First-party code is small and deliberately shaped: five Node plugin files, one Python package, one client package. The vendored harness is configured — never edited — through `cordis.patch.yml`; the only file-level vendor patch is a pnpm patch with a manifest. Most change risk is *synchronization* risk: the same tool inventory lives in four places, fenced by tests.

**Prerequisites:** [GETTING_STARTED.md](GETTING_STARTED.md); file map in [reference/REPOSITORY_MAP.md](reference/REPOSITORY_MAP.md).

---

## 1. Repository layout (canonical source only)

| Area | Path | Language/tooling |
|---|---|---|
| Node host plugins | `apps/soc-agent/*.js` | Plain ESM, no framework, `node:test` |
| Python server | `apps/soc-agent/server/unified_mcp_server/` | Python ≥3.12, uv, pytest (+asyncio auto) |
| Client | `packages/soc-agent-client/src/` | TypeScript + React + CSS modules, tsdown |
| Skills | `skills/<name>/SKILL.md` | Markdown with frontmatter |
| Wiring | `apps/soc-agent/cordis.patch.yml` | YAML patch manifest |
| Vendor | `vendor/deepseek-harness/` | pnpm monorepo (do not edit; see §5) |

## 2. Toolchain and commands

| Task | Command (from repo root unless noted) |
|---|---|
| Install everything / repair wiring | `./setup.sh` (interactive) or `./setup.sh --plugins` (non-interactive) |
| Node tests (host, 35) | `cd apps/soc-agent && npm test` (= `node --test tests/*.test.js`) |
| Client tests | `cd packages/soc-agent-client && npm test` (tsx loader from vendor) |
| Python tests (39) | `cd apps/soc-agent/server && uv sync --extra test && uv run pytest` |
| Rebuild client bundle | `pnpm --filter dsh-soc-agent-client run build` (regenerates tracked `lib/`) |
| Rebuild harness (forced) | `./setup.sh --plugins --rebuild` |
| Run the app | `cd vendor/deepseek-harness && pnpm dsh web --no-open` (port 3080) |
| Audit installation | `./setup.sh --check` |

Lint/format: there is **no active formatter or hook** — `lefthook.yml` is entirely commented examples, and no lint config exists at the root. Match the surrounding style manually.

## 3. Dependency / workspace model

- The vendored harness's `pnpm-workspace.yaml` **includes this repo** (`../../apps/*`, `../../packages/*`) — SOC packages are workspace members, resolved via `workspace:*` (`dsh-soc-agent` → `dsh-soc-agent-client`, `dsh-agent-instructions`, `dsh-llm`, `schemastery`) and one `link:` (`@deepseek-ai/dsh-mcp-client`).
- Two Python dependency declarations exist **by design**: root `requirements.txt` lists *external pnpm plugins* for the harness profile (not Python!), while the server's `pyproject.toml`/`uv.lock` are the real Python dependencies. `setup.sh` count-validates the two specs against its hardcoded `PLUGIN_NAMES` — adding a plugin means editing **both** files.
- Python extras: `markitdown-llm` (optional OCR), `test` (pytest).
- Generated boundary: `packages/soc-agent-client/lib/` is **tracked** — always rebuild after client changes and commit the bundle together with the source (setup also auto-repairs drift).

## 4. Patch workflow

1. **Product patch** (`apps/soc-agent/cordis.patch.yml`): toggle/configure upstream plugin rows or insert new product plugins. Identified by plugin id; consumed via `dsh.bundle.patch`. Changes need a host restart and are pinned by `skills.test.js` (roster assertions).
2. **Vendor file patch** (`patches/dsh-auto-collapse@0.1.4.patch`): a pnpm patch against the upstream plugin's *built* bundle. Applied by setup into `~/.dsh/profiles/web/patches/` (byte-compared against the repo copy; mismatch → refuse). The `requirements.txt` pin (`#cd21c04…`) exists **because** the patch targets 0.1.4 — bump the pin and the patch together.
3. **Preset** (`vendor/.../agent-presets/citic-soc/agent.cordis.yml`): vendor-local configuration asserted by `skills.test.js`. Editing it is a vendor-tree change — see §5.

## 5. Keeping vendor changes reproducible

Do not edit `vendor/deepseek-harness` sources. Acceptable vendor-tree artifacts, all reproducible from first-party files: the `citic-soc` preset (documented, tested), pnpm `overrides` (already in the vendor root for schemastery/cosmokit), and the profile patch copy written by setup. Anything else should become (a) a `cordis.patch.yml` row, (b) a `patches/*.patch` file, or (c) an upstream contribution.

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
- **TypeScript/React:** components read the `/soc-agent-config` channel via `settings-common.rpc`; settings pages use the harness settings API with `expectedRevision`; CSS modules with `.module.css`; the bundle is a closure factory — do not add bare `require()`s outside the setup allowlist (react, react-dom, cordis, client-ui primitives/runtime) or setup will rebuild/reject.

## Evidence in the repository

- `package.json` scripts (both packages), `pyproject.toml` + pytest config, `setup.sh` stage comments (including the schemastery `lib/` prerequisite note and SOC-drift repair), `requirements.txt` header, `skills.test.js` (patch/preset pins).
