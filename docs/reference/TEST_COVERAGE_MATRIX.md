# Test coverage matrix

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.
> Sources: `apps/soc-agent/tests/` (9 files, 27 tests), `packages/soc-agent-client/tests/` (4 files, 9 tests), `apps/soc-agent/server/unified_mcp_server/tests/` (21 test files + 2 fixture files, 75 test functions). Counts derived by enumeration at this commit.

**Who this is for:** developers changing behavior (which tests must move with the change), and reviewers judging which claims have test evidence.

**What you will understand:** what each test file asserts, prerequisites (none require live services), and where coverage is thin.

**How to run:** see [TESTING.md](../TESTING.md). Every suite runs offline against in-memory doubles, fake transports, temp dirs, or real subprocesses of local code. No skips exist.

---

## 1. Node tests — `apps/soc-agent/tests` (`node --test tests/*.test.js`)

| File | Tests | Behavior covered | Exercised source |
|---|---|---|---|
| `auth.test.js` | 10 | Admin credentials required at startup without leaking secrets; admin cookie login/expiry/logout + restart invalidation; session revocation aborts event streams and fences MCP work; admin cookies cannot authorize chat APIs and user cookies cannot authorize settings APIs; scoped API blocks 11 cross-user mutations (IDOR); workspace name validation/traversal rejection; event-frame redaction (foreign snapshots, credential refs → generic `llm/adapters-updated`); pending-response RPC ids cannot be hijacked; transport gating; `mcp/request-meta` metadata without token material | `ownership.js`, `auth-host.js` |
| `background.test.js` | 1 | BACKGROUND.md re-injection cadence (durable user prompts, default 5), placement after last user message, live threshold changes, `0` disables | `host.js` |
| `control-channel.test.js` | 2 | Concurrent control requests share one Python process; a lost response after transmission yields `operation_outcome_unknown` with **no** CLI fallback replay | `ownership.js runAuthCommand` + fake `uv` shim |
| `investigation.test.js` | 1 | Card/SSN sanitization applies only to `mcp__splunk_mcp__*` output; other namespaces pass through | `investigation.js` |
| `mcp-discovery.test.js` | 1 | `allowedToolNames` round-trips as undefined / `[]` / explicit list for stdio and streamable-http | vendored `dsh-mcp-client` Config |
| `policy.test.js` | 4 | Exact product tool set (29 read-only / 41 domain / 12 approval; no legacy names); pre-execute verdicts (delegate reads, ask mutations, deny generic); SOC-mode deployment states + RPC contracts; Full access bypasses per-tool states | `host.js`, `policy.js` |
| `skills.test.js` | 5 | Patch enables skill/plan layers; citic-soc preset instruction candidates (BACKGROUND.md exactly once) + skill content invariants; patch disables native shell/permission tools; bridge wires only read tools; `soc_agent` allowlist equals the exact 27-name list with no `splunk_` | `cordis.patch.yml`, `splunk-bridge.js`, `BACKGROUND.md`, skills, vendor presets |
| `splunk-bridge.test.js` | 2 | Bridge reads deployment config, forwards Bearer auth, allowlists the 13 read names (no write names); TLS verified by default | `splunk-bridge.js` |
| `user-mode.test.js` | 1 | Action modes are authenticated, per-session isolated, enforced (`full` delegates, `soc` asks), and revoked on logout | `ownership.js`, `host.js` |

## 2. TypeScript tests — `packages/soc-agent-client/tests` (tsx loader)

| File | Tests | Behavior covered |
|---|---|---|
| `action-policy.test.ts` | 3 | `readActionMode` uses the exact RPC triple; malformed/failed responses reject (never invent a mode); `set-action-mode` sends only `{mode}` and adopts the server-confirmed value |
| `email-draft-toolview.test.ts` | 1 | Recipient parsing (separators, dedupe, trim), canonical draft fields |
| `markitdownAttachments.test.ts` | 1 | Two-worker conversion: peak concurrency 2, order preserved, retry after failure, cache reuse, truncation note, `release()` cleanup |
| `sections.test.ts` | 4 | Source-text guardrails: no scheduled-task UI; admin console uses provider listbox + write-only credentials and never legacy cards/direct settings RPC; access-approvals page keeps required copy and forbids `autoApproveActions`; admin mounted only via the `/admin` path branch |

## 3. Python tests — `unified_mcp_server/tests` (`uv run pytest`; `asyncio_mode=auto`)

| File | # | Behavior covered |
|---|---|---|
| `test_server_tools.py` | 1 | **Exact 27-tool surface**; no `splunk_*`/`catalog_*`/`scheduled_task_*`/`system_get_status`; no `ctx`/`account_id` params; per-tool schemas |
| `test_auth.py` | 4 | Session lifecycle over Postgres: normalized user creation, no password/token exposure, 24 h expiry, logout, upstream token invalidation |
| `test_config.py` | 4 | Safe defaults; env-only sourcing; `public_status` redaction; credential-bearing endpoints rejected |
| `test_zimbra_service.py` | 9 | Metadata-vs-body split; query validation pre-network; identity-bound token + account selection rejected; gated+verified moves; local-only drafts; signature gates |
| `test_zimbra_filters.py` | 4 | Preview diff/fingerprint gate; write gates; redirect/discard gates; concurrent-modification rejection |
| `test_email_service.py` | 3 | Subscription client: single login per batch, one re-auth on 401, unsafe redirects rejected |
| `test_official_splunk_mcp_client.py` | 5 | Retained official-MCP client: read-only surface, admission bypass, row normalization/truncation, alert details, saved-search bounds |
| `test_splunk_guardrails.py` | 2 | Mutating SPL commands hard-blocked; output sanitization |
| `test_splunk_query_policy.py` | 8 | Fail-closed query policy (dynamic scope, all-time, dangerous commands at depth, untrusted macros) |
| `test_splunk_resource_governance.py` | 4 | Admission ordering, weighted capacity, per-principal slots, backtest profile |
| `test_splunk_search_planning.py` | 3 | Curated scope, alias expansion, no invented fields, quoted entity values |
| `test_splunk_jobs.py` | 4 | Job dispatch/poll/paging; saved search with actions disabled; timeout cancels remote job; error payloads withheld |
| `test_splunk_lookup.py` | 2 | Lookup metadata/ACL; read-only content endpoint |
| `test_search_evidence.py` | 3 | Evidence snapshot restart, coalescing, cancellation drain |
| `test_security_queue.py` | 4 | Finding mapping, cursor pagination, signed ids/path-injection prevention, bounded concurrency |
| `test_control_server.py` | 1 | Control-channel line protocol + real subprocess end-to-end |
| `test_postgres_store.py` | 1 | Config/account round-trip with encrypted values |
| `test_account_store.py` | 1 | Local account store encrypts at rest |
| `test_citic_compiler.py` / `test_citic_format.py` | 2+2 | CITIC detection compile/validate (production + backtest forms) |
| `citic_fixtures.py` | — | Shared canonical CITIC SPL fixture |

Note: the eight `splunk_*`/evidence/queue test files exercise the **retained** implementation (see [MCP_TOOL_CATALOG.md](MCP_TOOL_CATALOG.md) §6) — they prove the retained code's contracts, not that it is reachable at runtime.

## 4. Namespace/allowlist regression guards (the drift fence)

| Invariant | Guarding tests |
|---|---|
| Python server exposes exactly the 27 allowlisted tools | `test_server_exposes_exact_domain_tool_set` (py) ↔ `skills.test.js` "soc_agent MCP allowlist contains only Zimbra and subscription tools" (js, same 27 names) |
| Host policy sets derive exactly from the catalog (29/41/12) | `policy.test.js` "interactive analyst policy exposes the exact product tool set" |
| Bridge allowlist is read-only and matches the patch | `splunk-bridge.test.js` both tests ↔ `skills.test.js` "SOC profile exposes only allowlisted official Splunk reads when configured" |
| `allowedToolNames` semantics preserved by the vendored client | `mcp-discovery.test.js` |
| Client uses only the authorized policy RPC and fails closed | `action-policy.test.ts` |
| Admin UI cannot bypass write-only credentials or mount outside `/admin` | `sections.test.ts` |

## 5. Known coverage gaps (gaps, not proven defects)

1. **No end-to-end browser test.** The React UI (AuthGate, AdminConsole, EmailDraftToolview rendering) is tested only via pure helpers and source-text guardrails — rendering behavior itself is untested.
2. **`host.js runAdmin` subprocess behavior** is exercised only indirectly; there is no direct test of `admin_cli` invocation error mapping beyond unit-level pieces.
3. **`zimbra_send_email` draft → UI → `send-email` RPC → `ZimbraMailService.send_email`** chain is tested in segments (draft local-only; toolview helpers; `auth_cli` gating) but not as one integration flow.
4. **Postgres code paths** run against in-memory SQL doubles (`SocConnection`, `FakeConnection`); real-SQL behavior (e.g. concurrent claim races) is untested.
5. **`setup.sh`/`update.sh` have no automated tests** — verified by reading only.
6. **Retained Splunk modules** are well-tested internally but their *unreachability* is asserted only negatively (`test_server_tools.py`); nothing prevents a future `register_tools` call from re-exposing them except review.
7. **No CI configuration** exists at the repo root (`.github/` only inside vendor) — suites are run manually.
