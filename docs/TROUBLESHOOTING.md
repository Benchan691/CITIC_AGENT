# Troubleshooting

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](zh/TROUBLESHOOTING.md)

**Who this is for:** operators and developers diagnosing a misbehaving deployment.

**How to use this page:** find the symptom area, then symptom → likely causes → safe diagnostic → corrective action → verification → what to collect if you must escalate. Every diagnostic here is read-only or uses the documented approval flows. **Never** bypass authorization, disable security controls, edit generated bundles by hand, or point tools at systems you are not authorized to touch.

**Plain-language summary.** Most failures are one of six things: a missing environment variable, an unreachable external service, a stale build, a stale/rejected session, a policy denial working as intended, or a genuinely denied operation. The diagnostics below tell you which, safely.

**Prerequisites:** [DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md) (how to run the checks).

---

## 1. Setup and updates

| Symptom | Likely causes | Safe diagnostic | Corrective action | Verify |
|---|---|---|---|---|
| `setup.sh` exits listing missing prerequisites | Node/pnpm/uv missing or wrong version | Read the checker output (`run_prereq_checks` regexes: node `^22.19.0\|>=24`) | Install per [GETTING_STARTED](GETTING_STARTED.md) §1; rerun | `./setup.sh --check` exits 0 |
| `--check` exits 1 with N items | Anything from env keys to profile drift | The check output names each failing area | Fix items top-down; rerun | exit 0 |
| Update refuses: "working tree is not clean" | Local modifications (untracked files count) | `git status --porcelain --untracked-files=all` | Commit or remove changes yourself — update never stashes; then rerun `./update.sh` | Update completes |
| Bootstrap re-prompts install path / refuses target | Target is not a CITIC_AGENT checkout (missing `setup.sh` or `vendor/deepseek-harness`) | Inspect the target dir | Choose a valid path or fix the checkout | Bootstrap continues |
| Stale/unknown plugins appear in the profile | Manual `pnpm dsh plugin add` or an interrupted profile migration | Compare profile manifest to the managed set in `setup.sh` | `./setup.sh --plugins` (prunes to the managed SOC set) | Check passes; manifest matches |
| Obsolete third-party patch blocks profile repair | A previous profile still contains `dsh-auto-collapse@0.1.4` in `patchedDependencies` | Inspect the profile workspace manifest | Rerun `./setup.sh --plugins`; migration cleanup removes the stale patch before pnpm removal | Check passes; no third-party patch remains |

**Escalation evidence:** the full `./setup.sh --check` output; `git rev-parse HEAD` + `git status --porcelain`.

## 2. Authentication and ownership

| Symptom | Likely causes | Safe diagnostic | Corrective action | Verify |
|---|---|---|---|---|
| Host refuses to start complaining about admin credentials | `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD` unset at boot | Check the startup error (message does not leak values, by design) | Set both in the environment or `server/.env`; restart host | Host boots; admin login works |
| Login always fails | Postgres URI wrong/unreachable; Zimbra rejects; encryption key mismatch | `./setup.sh --check` (Postgres probe); look for `authentication_required` in logs; test the same credentials directly in Zimbra | Fix URI/key; verify Zimbra independently; restart | Login succeeds |
| "A new device logged in to this account…" | Single-device policy: another login replaced this session | Expected behavior | Sign in again | One active session per user |
| Session expires earlier than 24 h | Upstream Zimbra token died (password change, admin revocation) | Later calls return `zimbra_auth_error` | Re-login | New session works |
| User can't reach admin endpoints | Admin vs user cookie segregation (by design) | Check which console/page is in use | Use `/admin` with admin credentials | Admin console loads |
| 403 on admin RPC despite admin login | Admin session expired (8 h) or host restarted (in-memory sessions) | `/admin/auth/me` | Re-login | `expires_at` in the future |
| Workspace creation fails with `workspace-invalid-path` | Illegal name (`..`, separators, absolute) | Review the requested name | Use a single directory name | Workspace appears under `.data/soc-workspaces/<userId>/` |

**Escalation evidence:** correlation id from the UI/agent turn, `soc_correlation_id` in logs, exact error code, timestamps.

## 3. MCP discovery and duplicate-looking tool names

| Symptom | Likely causes | Safe diagnostic | Corrective action | Verify |
|---|---|---|---|---|
| A tool the model "should" have is missing | Not in the raw allowlist (patch) **or** not in `DOMAIN_TOOLS` (policy) or the bridge is disabled | Compare the name against [reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md); check the startup log for "official Splunk MCP bridge disabled" | Add per the six-contract recipe ([DEVELOPMENT.md](DEVELOPMENT.md) §6) — never bypass the gate | Tool appears in the catalog RPC (`get-action-catalog`) |
| Two names look like the same tool (e.g. contain `splunk` twice) | `mcp__splunk_mcp__splunk_*` — one server namespace + raw name | Read [MCP_AND_TOOL_ROUTING.md](MCP_AND_TOOL_ROUTING.md) §2 | None — expected anatomy | — |
| Model calls a tool and gets "This SOC action is disabled by the administrator." | SOC mode + per-tool state `disabled` | Admin → Access & approvals | Change the state deliberately (or switch mode) | Call proceeds through ask/auto |
| Denial "This harness exposes only approved Splunk, Zimbra, and subscription tools." | Name outside `DOMAIN_TOOLS ∪ CONTROL_TOOLS` — the gate working | Confirm the name in the catalog | Use an allowlisted tool | — |
| `splunk_get_detection` etc. unavailable despite skills referencing them | **Known drift:** retained-only Python tools, not registered at this commit | [DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md) | Track as a maintainer question; do not hand-register without the full recipe | — |

## 4. Splunk bridge

| Symptom | Likely causes | Safe diagnostic | Corrective action | Verify |
|---|---|---|---|---|
| No Splunk tools at all | `SPLUNK_MCP_ENDPOINT`/`SPLUNK_TOKEN` not both configured — bridge intentionally off | Startup log line "official Splunk MCP bridge disabled" | Set both in `server/.env`; restart | Log shows the bridge connecting; `splunk_get_info` works |
| TLS errors on bridge calls | `SPLUNK_VERIFY_SSL` false while the endpoint needs real verification (or vice versa) | Check the env value | Set `SPLUNK_VERIFY_SSL=true` (default) or fix the endpoint certificate | Calls succeed |
| Tool errors after ~185 s | Client timeout reached (external server slow) | Note the elapsed time; check the external service health | Reduce query cost; the external Splunk MCP server owns its guardrails | Bounded queries return |
| Truncated results with the marker line | Projection 50 KB cap (by design) | Look for `\n[official Splunk MCP output truncated…]` | Narrow the query; do not disable projection for production use | Full results within the cap |
| Admin → Connections → Splunk check fails | The check now executes a live `splunk_get_info` through the bridge — a failure is a real connectivity/credential problem | Error message (Bearer token redacted) | Fix endpoint/token/TLS; verify the external server is reachable | Check reports `connected` |

## 5. Zimbra

| Symptom | Likely causes | Safe diagnostic | Corrective action | Verify |
|---|---|---|---|---|
| `zimbra_auth_error` on every call | Upstream token invalidated | App session auto-deleted by design | Re-login | Tools work |
| `query_validation_error` | Search syntax (e.g. the `d:YYYYMMDD` alias is rejected; use `date:MM/DD/YYYY`) | Error message suggests the fix | Reformulate | Search returns |
| "Set ZIMBRA_ALLOW_SEND=true after review" (`operation_disabled`) | Send gate off | Check env | Deliberate deployment decision — enable only after review | Send RPC succeeds |
| Filter update rejected `filter_rules_changed` | Concurrent rule change (fingerprint mismatch) | Re-list filters, get a fresh fingerprint | Retry with the new `expected_fingerprint` | Update applies |
| Filter update rejected `operation_disabled` / redirect-discard refused | `ZIMBRA_ALLOW_FILTER_WRITE` / REDIRECT / DISCARD gates | Check env | Deliberate gates — enable per policy | — |
| Move reported `move_verification_failed` | Folder changed mid-operation (verify step caught it) | Re-list folders | Retry; the tool returned a rollback payload | Message in the expected folder |
| Attachments fail with `attachment_too_large`/`attachment_encrypted` | Limits (10 MB default / 100 MB hard) or protected file | Check the code in the envelope | Use a smaller/unprotected source; raise limits deliberately if policy allows | Conversion succeeds |

## 6. Subscription service

| Symptom | Likely causes | Safe diagnostic | Corrective action | Verify |
|---|---|---|---|---|
| `not_configured` | URL/user/password missing | `get-settings` (admin) shows subscription not configured | Set the three env vars; restart | `test-subscription-server` OK |
| `email_server_unavailable` | Timeout/5xx/429 upstream | Admin check; note the status code in details | Check the external service | Retry succeeds (code is retryable) |
| `email_server_auth_failed` | Wrong service credentials | Admin check | Fix `SUBSCRIPTION_SERVER_USER/PASSWORD`; restart | Check passes |
| Redirect rejected | Downgrade or cross-host redirect (policy) | Status/URL in the error | Fix the service's redirect or endpoint | Check passes |

## 7. Attachment conversion

| Symptom | Likely causes | Safe diagnostic | Corrective action |
|---|---|---|---|
| `attachment_converter_unavailable` | MarkItDown dependency or optional LLM extra missing | `uv sync` (+ `--extra markitdown-llm` if `MARKITDOWN_LLM_ENABLED`) | Sync; restart |
| `attachment_invalid_limits` | Client limits outside schema bounds | Review the settings card values | Reset to defaults (5 files / 10 MB / 50 MB / 200 k / 500 k chars) |
| Upload rejected before conversion | Client-side limit pre-checks | The composer shows the specific limit | Reduce the selection |
| "text was truncated during conversion" | `max_chars` clamp (by design) | Expected flag `text_truncated` | Raise limits deliberately if policy allows |

## 8. Database

| Symptom | Likely causes | Safe diagnostic | Corrective action | Verify |
|---|---|---|---|---|
| `authentication_required` from every tool | Python started without Postgres | Check `APP_POSTGRES_URI` chain | Fix URI; restart | Login works |
| Decrypt RuntimeError mentioning key mismatch | `APP_SETTINGS_ENCRYPTION_KEY` changed | Error names the row count/database | Restore the previous key (or accept data loss deliberately) | Errors stop |
| Slow/failing queries | Pool exhaustion or long statements | `statement_timeout=15000` is configured; look for timeouts in logs | Check DB health; the per-principal semaphore (2) throttles by design | Latency recovers |

## 9. UI / build

| Symptom | Likely causes | Safe diagnostic | Corrective action | Verify |
|---|---|---|---|---|
| UI changes don't appear | One of the tracked SOC browser bundles was not rebuilt | Check the owning `packages/soc-agent-*/lib/client.js` artifact vs its source | `./setup.sh --plugins` (or build the owning package); reload | Change visible |
| Setup reports SOC browser-bundle drift | A bundle contains a `require()` outside the allowlist | Read the setup output for the package name | Rerun setup (auto-rebuilds the 36-package / 26-face matrix) | Drift check passes |
| `/admin` returns 503 | Harness frontend index not found (build artifact missing) | `setup.sh --check` build-artifact section | `./setup.sh --plugins --rebuild` | `/admin` serves |
| App loads but everything fails | Python server dead (spawn failure is fatal — so more likely env/store issues) | Startup logs; `uv run unified-mcp-server` smoke check in `apps/soc-agent/server` | Fix env/uv; restart | Tools respond |

## 10. Patches, tests, and updates

| Symptom | Likely causes | Safe diagnostic | Corrective action |
|---|---|---|---|
| `skills.test.js` fails after editing the patch | Roster assertions drifted | Compare `cordis.patch.yml` to the pinned expectations | Update deliberately + tests together |
| Detection skills reference tools that do not exist | The Splunk stack was removed this round; skills are stale | See [DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md) §8 | Maintainer decision: update skills or restore tooling | — |
| `policy.test.js` counts fail | Tool inventory changed | See [DEVELOPMENT.md](DEVELOPMENT.md) §6 | Update both tiers + counts |
| `sections.test.ts` fails after UI edit | Guardrail copy/structure changed | Read the failing regex | Restore the copy or update the guardrail consciously |
| Tests hang in CI-less environments | `uv run python` unavailable for the control-server subprocess test | Run `uv --version` | Install uv / activate the venv |
| `./update.sh` says usage error | Arguments passed (it accepts none) | — | Run without arguments |

**Escalation evidence to collect (always):** `git rev-parse HEAD`, branch, the failing command's full output, the relevant log lines with `soc_correlation_id`, and — for policy surprises — the exact tool name and the admin Access & approvals state. Redact credentials and customer data before sharing.

## Evidence in the repository

- Commands and modes: `setup.sh` (`--check` checks), `update.sh`, package test scripts
- Error codes: `unified_mcp_server/errors.py` taxonomy + module-level codes cited in each table (`zimbra_*`, `email_server_*`, `attachment_*`, `filter_*`, `operation_*`)
- Policy denials: `apps/soc-agent/host.js` (`tools/pre-execute` messages quoted verbatim), `admin_cli.py` refusals
- Related pages: [reference/CONFIGURATION_REFERENCE.md](reference/CONFIGURATION_REFERENCE.md), [reference/TEST_COVERAGE_MATRIX.md](reference/TEST_COVERAGE_MATRIX.md)

## Assumptions and unknowns

- Exact behavior of external services under fault (Zimbra, Splunk MCP, subscription) is environment-specific and not reproducible from the checkout.
- This page was verified by reading source, not by inducing each failure in a live deployment.
