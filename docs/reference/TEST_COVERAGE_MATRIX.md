# Test coverage matrix

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](../zh/reference/TEST_COVERAGE_MATRIX.md)
> Current sources: `apps/soc-agent/tests/` (**12 files, 42 tests**) and `apps/soc-agent/server/unified_mcp_server/tests/` (**10 test files + `__init__.py`, 48 test functions**). The current worktree also carries package-local tests for the mandatory core, isolated surfaces, and six optional browser features, plus browser smoke/screenshot tests. Previous round (`b26d55d`): 27 JS / 9 TS / 75 Python — the Python reduction is the deleted Splunk stack's tests, not lost coverage of live code.

**Who this is for:** developers changing behavior (which tests must move with the change), and reviewers judging which claims have test evidence.

**What you will understand:** what each test file asserts, prerequisites (none require live services), and where coverage is thin.

**How to run:** see [TESTING.md](../TESTING.md). Every suite runs offline against in-memory doubles, fake transports, temp dirs, subprocesses, or a real schema-migration runner. No skips exist.

---

## 1. Node tests — `apps/soc-agent/tests` (`node --test tests/*.test.js`, 11 files / 42 tests)

| File | Tests | Behavior covered | Exercised source |
|---|---|---|---|
| `auth.test.js` | 10 | Admin credentials required at startup without leaking secrets; admin cookie login/expiry/logout + restart invalidation; session revocation aborts event streams and fences MCP work; admin/user cookie tier segregation; scoped API blocks cross-user mutations (IDOR); workspace name validation/traversal rejection; event-frame redaction; pending-response RPC ids cannot be hijacked; transport gating; `mcp/request-meta` metadata without token material | `ownership.js`, `auth-host.js` |
| `background.test.js` | 1 | BACKGROUND.md re-injection cadence (durable user prompts, default 5), placement, live threshold changes, `0` disables | `host.js` |
| `control-channel.test.js` | 2 | Concurrent control requests share one Python process; a lost response after transmission yields `operation_outcome_unknown` with **no** CLI fallback replay | `ownership.js runAuthCommand` + fake `uv` shim |
| `investigation.test.js` | 1 | Card/SSN sanitization applies only to `mcp__splunk_mcp__*` output; other namespaces pass through | `investigation.js` |
| `mcp-discovery.test.js` | 1 | `allowedToolNames` round-trips as undefined / `[]` / explicit list for stdio and streamable-http | vendored `dsh-mcp-client` Config |
| `policy.test.js` | 4 | Exact product tool set (**30 read-only / 42 domain / 12 approval** — pinned literally); pre-execute verdicts (delegate reads, ask mutations, deny generic); SOC-mode deployment states + RPC contracts; Full access bypasses per-tool states | `host.js`, `policy.js`, `tool-inventory.js` |
| `python-command.test.js` | 1 | New: `runPythonCommand` spawn/timeout/abort/parse contract (child env strips admin credentials) | `python-command.js` |
| `setup.test.js` | 5 | New: setup-doctor parameter inventory and validation logic (official MCP endpoint + token required; plain-HTTP opt-in rules) | `setup.sh`-driven inventory |
| `skills.test.js` | 5 | Patch enables skill/plan layers; citic-soc preset instruction candidates (BACKGROUND.md exactly once) + skill content invariants; patch disables native shell/permission tools; bridge wires only read tools; `soc_agent` allowlist equals the exact **28**-name list with no `splunk_` | `cordis.patch.yml`, `splunk-bridge.js`, `tool-inventory.js`, `BACKGROUND.md`, skills, vendor presets |
| `splunk-bridge.test.js` | 4 | Bridge reads deployment config, forwards Bearer auth, allowlists the 13 read names; TLS verified by default; **new:** configuration requires MCP credentials and explicit plain-HTTP opt-in (endpoint URL validation); **new:** admin connection check uses the live allowed tool (`splunk_get_info`) with authorization, error redaction, and cancellation preserved | `splunk-bridge.js` |
| `user-mode.test.js` | 1 | Action modes are authenticated, per-session isolated, enforced (`full` delegates, `soc` asks), and revoked on logout | `ownership.js`, `host.js` |

## 2. SOC browser-package tests — `packages/soc-agent-*/tests`

| Package | Tests | Behavior covered |
|---|---|---|
| `soc-agent-client` | 5 | Core `SocClientRuntime` contract, `/admin` route selection, RPC forwarding/error handling, mandatory action-policy schema, auth/admin fallback ownership, and no optional UI imports |
| `soc-agent-sidebar` | 27 | Expanded/collapsed layout, root ownership, standard child slots, branding/workspace/settings/footer interoperability, pinned CSS/DOM invariants |
| `soc-agent-workspace` | 149 | Workspace browser/picker, search/grouping/tree/reorder, logical workspace creation, create/delete/rename/fork/archive/session deletion, General clearing, pending/error states, and reversible folders guard |
| `soc-agent-brand` | 2 | Sidebar and conversation branding contributions |
| `soc-agent-admin` | 4 | Admin status behavior, credential guardrails, access-policy guardrails, and core-owned child-slot mounting |
| `soc-agent-action-policy` | 3 | `readActionMode` uses the exact RPC triple; malformed/failed responses reject; server-confirmed mode is adopted |
| `soc-agent-attachments` | 1 | Two-worker conversion: peak concurrency 2, order preserved, retry after failure, cache reuse, truncation note, `release()` cleanup |
| `soc-agent-email-draft` | 3 | Recipient parsing/dedupe/trim, canonical draft fields, forward-draft field mapping, send/signature view behavior |
| `soc-agent-auto-collapse` | 3 | Native Chat contract wiring, persisted `dsh-auto-collapse` settings adoption, status text, listener cleanup, and teardown-safe service lifecycle |

The 36 SOC packages plus the product bundle are built from the root workspace; 26 package faces emit a separate tracked browser artifact. Tests import source through the rc.2-compatible loaders. The app composition test additionally recursively scans first-party source/manifests for official implementation imports.

## 3. Python tests — `unified_mcp_server/tests` (`uv run pytest`; `asyncio_mode=auto`, 10 files / 48 tests)

| File | # | Behavior covered |
|---|---|---|
| `test_server_tools.py` | 1 | **Exact 28-tool surface** (including `zimbra_forward_email` with params `{message_id, to, cc, bcc, subject, body}`, required `{message_id, to}`, `readOnlyHint`); no `splunk_*`/`system_get_status`/`catalog_*`/`scheduled_task_*` tools; no `ctx`/`account_id` params; per-tool schemas |
| `test_schema.py` | 3 | New: migration runner — ordered application, `soc_schema_migrations` bookkeeping (no re-apply), advisory-lock serialization |
| `test_auth.py` | 4 | Session lifecycle over Postgres: normalized user creation, no password/token exposure, 24 h expiry, logout, upstream token invalidation |
| `test_config.py` | 7 | Config defaults safe when unconfigured; env-only sourcing; `public_status` redaction **including `official_mcp_enabled`**; credential-bearing endpoints rejected; slimmed Splunk settings shape |
| `test_zimbra_service.py` | 14 | Mail service: metadata-vs-body split; query validation pre-network; identity-bound token + account selection rejected; gated+verified moves; local-only drafts; **forward drafts** (`create_forward_draft` — local, metadata embedded); send path incl. `forward_message_id`; signature gates |
| `test_zimbra_filters.py` | 4 | Preview diff/fingerprint gate; write gates; redirect/discard gates; concurrent-modification rejection |
| `test_email_service.py` | 3 | Subscription client: single login per batch, one re-auth on 401, unsafe redirects rejected |
| `test_control_server.py` | 1 | Control-channel line protocol + real subprocess end-to-end |
| `test_postgres_store.py` | 1 | Config/account round-trip with encrypted values |
| `test_account_store.py` | 1 | Local account store encrypts at rest |

**Removed with the Splunk stack** (their subjects no longer exist): `test_citic_compiler.py`, `test_citic_format.py`, `test_official_splunk_mcp_client.py`, `test_search_evidence.py`, `test_security_queue.py`, `test_splunk_guardrails.py`, `test_splunk_jobs.py`, `test_splunk_lookup.py`, `test_splunk_query_policy.py`, `test_splunk_resource_governance.py`, `test_splunk_search_planning.py`, `test_splunk_service.py`, `citic_fixtures.py`.

## 4. Namespace/allowlist regression guards (the drift fence)

| Invariant | Guarding tests |
|---|---|
| Python server exposes exactly the 28 allowlisted tools | `test_server_tools.py` (`len(tools) == 28`) ↔ `skills.test.js` "soc_agent MCP allowlist…" (same 28 names) |
| Policy sets derive exactly from `tool-inventory.js` (30/42/12) | `policy.test.js` "interactive analyst policy exposes the exact product tool set" — the inventory is now the **structural** fence (policy.js and splunk-bridge.js import it) |
| Bridge allowlist is read-only and matches the inventory | `splunk-bridge.test.js` ↔ `skills.test.js` bridge pins |
| Bridge endpoint/credential configuration is validated | `splunk-bridge.test.js` "official configuration requires MCP credentials and explicit plain HTTP opt-in" |
| `allowedToolNames` semantics preserved by the vendored client | `mcp-discovery.test.js` |
| Client uses only the authorized policy RPC and fails closed | `soc-agent-action-policy/tests/action-policy.test.ts` |
| Admin console cannot bypass write-only credentials or mount outside `/admin` | `soc-agent-admin/tests/sections.test.ts` |
| Core owns the admin root and supplies a safe fallback | `soc-agent-client/tests/core-contract.test.ts`, `soc-agent-admin/tests/sections.test.ts` |
| Official sidebar/workspace are disabled and never imported by first-party code | `apps/soc-agent/tests/sidebar-workspace.test.js` |
| Browser bundles mount in fixture mode without loader/console/request errors | `apps/soc-agent/tests/browser-smoke.test.mjs` |
| Setup parameter inventory enforces the official MCP connection | `setup.test.js` |

## 5. Known coverage gaps (gaps, not proven defects)

1. **Fixture boundary.** Browser smoke and screenshots cover real bundle loading and UI mounting, but use fixture data and intercept authentication; they do not cover live Zimbra, Splunk, subscription, or PostgreSQL behavior.
2. **Forward end-to-end** (`zimbra_forward_email` → draft card → `send-email` RPC → `zimbra_forward_message` delivery) is tested in segments, not as one integration flow.
3. **Postgres code paths** run against in-memory SQL doubles; the migration runner is tested directly (`test_schema.py`) but not against a live server in CI-less environments.
4. **`setup.sh` behavior** is exercised by requested `--plugins`/`--check` validation and static parameter tests, but there is no hermetic CI fixture for every profile state.
5. **No CI configuration** at the repo root — suites run manually.
6. **Skills referencing removed tools** (`detection-engineering`, `spl-writing`, parts of `false-positive-analysis`) have content invariants asserted by `skills.test.js` but their workflows cannot currently execute their named tools.
