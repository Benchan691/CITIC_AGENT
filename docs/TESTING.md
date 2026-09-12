# Testing

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.

**Who this is for:** developers running or extending the suites, and reviewers judging which claims have test evidence.

**What you will understand:** the three test layers and how to run each, what every test file asserts, the prerequisites and fixtures involved, which tests guard the naming/allowlist contracts, and where coverage is deliberately thin. The file-by-file detail lives in [reference/TEST_COVERAGE_MATRIX.md](reference/TEST_COVERAGE_MATRIX.md).

**Plain-language summary.** Three suites — Node (35 tests in 11 files), TypeScript (12 in 5), Python (39 in 10) — all runnable offline against in-memory doubles, fake transports, and local subprocesses. No live Splunk/Zimbra/Postgres is ever needed, nothing is skipped, and a specific set of tests exists purely to stop the tool inventories from drifting apart. The Python suite shrank this round because the removed Splunk stack took its tests with it.

**Prerequisites:** dependencies installed (`./setup.sh --plugins` or per-suite `uv sync`).

---

## 1. Layers and commands

| Layer | Location | Command | Runner |
|---|---|---|---|
| Host (JS) | `apps/soc-agent/tests/` | `npm test` (in `apps/soc-agent`) | `node --test` |
| Client (TS) | `packages/soc-agent-client/tests/` | `npm test` (in the package) | `node --test` via the vendored tsx loader |
| Server (Python) | `apps/soc-agent/server/unified_mcp_server/tests/` | `uv run pytest` (after `uv sync --extra test`) | pytest, `asyncio_mode = auto`, `-q` |

There is **no root test runner and no CI configuration** at the repo root — run suites manually (see [DEVELOPMENT.md](DEVELOPMENT.md) and the residual-risk note in [SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md)).

## 2. What each suite proves (highlights)

- **Host JS** — the security-critical contracts: admin credential startup requirements, cookie/session lifecycle, cookie-tier segregation, the scoped API proxy (IDOR), workspace path containment, event redaction, background refresh cadence, the exact tool-policy verdicts (30 read / 42 domain / 12 approval), Full-access bypass-of-states (not of the allowlist), control-channel no-replay semantics, Splunk projection scoping, bridge config/TLS, and the patch↔bridge↔policy naming pins.
- **Client TS** — the fail-closed RPC contract for action modes, draft field normalization, the two-worker conversion controller (order, cache, retry), and source-text guardrails that keep the admin console from regressing (mount gating, write-only credentials, no legacy cards, no direct settings RPC).
- **Python** — the exact 27-tool surface (and the absence of `splunk_*`/legacy tools), session lifecycle and redaction, config validation/redaction, Zimbra service/filter semantics (fingerprint concurrency, gates, verified moves, local-only drafts), the subscription client (single login, redirect validation, error-body withholding), attachment limits, control-server protocol (real subprocess), and the retained Splunk implementation's internal contracts (query policy, resource governance, planning, evidence, security queue, CITIC compiler).

## 3. Prerequisites, fixtures, mocks

| Concern | Reality |
|---|---|
| Live services | **None.** No test connects to Splunk/Zimbra/Postgres/subscription endpoints. No skip markers exist in any suite |
| Postgres stand-ins | In-memory SQL doubles (`SocConnection` in `test_auth.py`, `FakeConnection` in `test_postgres_store.py`) |
| HTTP stand-ins | Fake `httpx` transports (subscription, Splunk clients) |
| Python children | `test_control_server.py` spawns the real control server; `control-channel.test.js` uses a fake `uv` shim on PATH |
| Auth fixtures | Temp dirs with fixture `.env` files (`SOC_ADMIN_EMAIL=admin@example.com`, placeholder passwords); `MCP_SERVER_ROOT` set and restored |
| Splunk fixtures | `https://splunk.example.test/...` endpoints, fixture tokens |
| Shared SPL fixture | `citic_fixtures.py` (canonical CITIC detection SPL) |
| Generated output | `skills.test.js` reads tracked files (`cordis.patch.yml`, `BACKGROUND.md`, skills, vendor presets) — these tests fail if prose drifts, by design |

## 4. The namespace/allowlist regression fence

Run these before any release; they are the drift fence for the whole tool story:

1. `test_server_tools.py` (Python) ↔ `skills.test.js` "soc_agent MCP allowlist contains only Zimbra and subscription tools" (same 28 names, two languages).
2. `policy.test.js` "interactive analyst policy exposes the exact product tool set" (30/42/12 counts, derived from `tool-inventory.js`).
3. `splunk-bridge.test.js` (read-only bridge allowlist, Bearer, TLS default) ↔ `skills.test.js` bridge patch assertions.
4. `action-policy.test.ts` (client uses the exact authorized RPC triple, fails closed).
5. `sections.test.ts` (admin console cannot bypass the credential write-only contract or mount outside `/admin`).

## 5. Expected generated output in tests

- Client tests import **source** (`src/`) via tsx — they do not test `lib/`.
- `sections.test.ts` reads source files as text — reformatting can break it; that is intentional (it pins copy like "Explicit confirmation" and the Send-confirmation hint).
- `skills.test.js` reads `cordis.patch.yml`/`BACKGROUND.md`/skills as text — editing those files requires updating its regexes.

## 6. Common failures and what they mean

| Symptom | Meaning |
|---|---|
| `policy.test.js` count failures after adding a tool | Expected — update the counts/sets per [DEVELOPMENT.md](DEVELOPMENT.md) §6 recipe |
| `skills.test.js` patch assertion failure | `cordis.patch.yml` roster changed without updating the pinned expectations |
| `sections.test.ts` failure after UI edit | Guardrail copy or mount structure changed — restore or consciously update the guardrail |
| `test_control_server.py` hangs | Environment lacks a working `uv run python` (the test spawns a real subprocess) |
| Client tests fail on imports | Vendored tsx loader missing — run harness install first |
| Host JS tests fail with `ERR_MODULE_NOT_FOUND: '@deepseek-ai/schemastery'` (observed on a fresh environment) | The app's `node_modules` lacks pnpm workspace links — run `./setup.sh --plugins` (harness `pnpm install`); the vendored schemastery `lib/` build must exist first |
| Python collection errors: `No module named 'mcp'/'zimbra_client'` (observed on a fresh environment) | Virtualenv incomplete — run `uv sync --extra test` in `apps/soc-agent/server` |

## 7. Coverage gaps (gaps, not proven defects)

1. No end-to-end browser/React rendering tests (helpers + source guardrails only).
2. The draft→UI→`send-email` chain is tested in segments, not as one integration flow.
3. Real-SQL behaviors (claim races, migrations under load) untested — doubles only.
4. `setup.sh`/`update.sh` have no automated tests.
5. Admin subprocess error-mapping is only indirectly covered.
6. **Resolved this round:** the retained Splunk stack (and its 12 test files) was deleted; `test_server_tools.py` remains the gate against re-introduction.

Details per file: [reference/TEST_COVERAGE_MATRIX.md](reference/TEST_COVERAGE_MATRIX.md).

## Evidence in the repository

- Suite configs: `apps/soc-agent/package.json`, `packages/soc-agent-client/package.json`, `apps/soc-agent/server/pyproject.toml` (`[tool.pytest.ini_options]`).
- Fixture patterns: each test file's header/fixtures as described in the coverage matrix.
