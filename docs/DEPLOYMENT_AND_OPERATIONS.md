# Deployment and operations

> **Verified against:** commit `56c8dd21492a5c36cb9f3eaa3da01160aba40033` (branch `splunk-offical-mcp`, committed 2026-09-12T07:22:44Z) · documentation verified 2026-09-12.
> 语言 / Language: **English** · [中文版](zh/DEPLOYMENT_AND_OPERATIONS.md)

**Who this is for:** operators deploying, updating, monitoring, and recovering the system.

**What you will understand:** the supported topology, the setup doctor's responsibilities stage by stage, the build/wiring lifecycle, startup and health checks, the update flow with its clean-tree rule, rollback/recovery options that actually exist in the source, logging/observability, and the operational safety checks worth running periodically.

**Plain-language summary.** One host on one machine, three external services, one database. `setup.sh` installs and repairs the pristine rc.2 Harness plus the independent SOC workspace reproducibly (fingerprints, profile composition, pruned plugin set); `update.sh` is a disciplined fast-forward; restart is manual and state survives it by design (Postgres sessions do; admin sessions don't).

**Prerequisites:** [GETTING_STARTED.md](GETTING_STARTED.md); [CONFIGURATION.md](CONFIGURATION.md).

---

## 1. Supported topology

Single Node host process (vendored harness web runtime) on port 3080, spawning: the Python MCP server (stdio child), the persistent control channel (stdio child), and one-shot admin CLI children. Outbound: Zimbra (SOAP), external official Splunk MCP (streamable HTTP), subscription service (HTTPS), LLM provider, PostgreSQL. Remote users typically connect via SSH tunnel (`ssh -L 3080:127.0.0.1:3080`) per the root README; reverse-proxy topologies are not configured in this repo (see unknowns).

## 2. The setup doctor, stage by stage

| Stage (`setup.sh`) | Responsibility | Repairs |
|---|---|---|
| Layout guard | Requires the pristine `vendor/deepseek-harness`, the root `packages/` workspace, `apps/soc-agent/server/`, `server/.env.example`, and the product patch | none — refuses |
| Prerequisites | Node `^22.19.0\|>=24`, pnpm, uv (PATH fix for pnpm) | Loops with install hints; `skip` records a warning |
| Parameter collection | One inventory drives prompting/checking: PostgreSQL, admin credentials, encryption key, **official Splunk MCP endpoint + token (required)**, Zimbra, subscription, MarkItDown; validates Postgres URI (regex + `psql` probe); generates the encryption key if blank. Legacy REST Splunk fields removed | Re-prompts only invalid/missing; existing values become defaults |
| `write_files` | Seeds/upserts `server/.env` (preserves comments; optional keys only when supplied) and the repository-root `.env` used by Harness launch; chmod 600; ensures `.gitignore` covers `.env` | Warns when an exported env var differs from the written value (export wins) |
| `ensure_python_server` | `uv sync --python 3.12` (+ `--extra markitdown-llm` when enabled) | Failure records a warning and continues |
| `ensure_harness_ready` | Fingerprint-gated `pnpm install --frozen-lockfile` + pristine Harness build; verifies the official framework/web artifacts and release manifest | `--rebuild` bypasses fingerprints; vendor drift fails closed |
| `ensure_soc_workspace_ready` | Fingerprint-gated root `pnpm install --frozen-lockfile` + declaration and bundle build for all 37 SOC packages and 26 browser faces; checks browser-safe externals | `--rebuild` bypasses fingerprints; missing or drifted artifacts trigger repair |
| `ensure_soc_bundle` | Removes obsolete third-party skin/auto-collapse entries, then registers the app and all mandatory/optional SOC packages into the web profile with the official `dsh plugin --profile web add` mechanism; verifies every package resolves | Re-runnable; stale profile patches are removed during migration cleanup |
| Summary | Prints masked values, files written, warnings, next steps | Starts **nothing** |

`--check` runs the read-only audit (prerequisites, every parameter with precedence, HTTP-policy checks, pristine release verification, profile registration, stale plugins, build artifacts, SOC drift, and resolution) and exits 1 with a failure count.

## 3. Build/wiring lifecycle

![Build/test/deploy diagram](site/assets/diagrams/build-test-deploy.svg) — source: [diagrams/build-test-deploy.mmd](diagrams/build-test-deploy.mmd).

Canonical sources → (root SOC workspace: declaration build + 26 browser faces via tsdown → **tracked** `lib/`; pristine Harness: pnpm build → ignored outputs) → profile wiring (`~/.dsh/profiles/web`: direct local package dependencies and bundle manifest) → runtime (Node host loads profile; browser mounts the selected feature plugins; host spawns Python children). The fingerprints make the lifecycle reproducible: identical inputs skip identical work.

## 4. Startup, restart, health

- **Start:** `vendor/deepseek-harness/node_modules/.bin/dsh web --no-open` from the repository root → open `http://127.0.0.1:3080`.
- **Health checks available:**
  - `./setup.sh --check` — full static audit (run anytime).
  - Admin console → Connections → *Check* on Splunk (a **live `splunk_get_info` call through the bridge**) / Subscription server; Zimbra/MarkItDown show environment-managed status only.
  - Browser `/auth/me` (session probe) and admin `/admin/auth/me`.
  - Startup log lines: bridge enabled/disabled, plugin registration, Python spawn (`failOnStartupError` makes a dead Python fatal at boot).
- **Restart:** stop the process and start again. Sessions, ownership, settings survive (Postgres). Admin sessions, session action-mode overrides, and in-memory caches do not — by design.
- **Generated environment files:** `server/.env`, repository-root `.env` (both 0600), `.data/*` fingerprints; profile files under `~/.dsh/profiles/web/`.

## 5. Update flow

`./update.sh`: refuses arguments → requires a Git checkout with `setup.sh` at root → **refuses a dirty working tree** (`git status --porcelain --untracked-files=all`; untracked files count; never stashes or discards) → `git pull --ff-only` on the current branch (no branch switching) → `bash setup.sh --plugins` → "restart the web app manually if it is running." Branch changes go through `./setup.sh` instead (also clean-tree only).

## 6. Rollback / recovery options found in source

| Situation | Options that exist |
|---|---|
| Bad update | `git reset`/`git checkout` to the previous commit **manually** (update.sh never manipulates history), then `./setup.sh --plugins`; restart |
| Broken profile wiring | `./setup.sh --plugins` re-adds/prunes/re-verifies the managed plugin set; `--rebuild` forces full harness rebuild |
| Drifted SOC browser bundle | Setup detects and rebuilds all affected SOC browser bundles automatically (require-allowlist check) |
| Session format cutover | Run `pnpm run sessions:validate` on a copied data root; only then use `pnpm run sessions:migrate` with an explicit backup directory and ownership manifest. The migration is fail-closed and publishes immutable v3 successors. |
| Session cutover rollback | Use `pnpm run sessions:rollback` with the verified backup and explicit `--yes`; it validates backup bytes before restoring the previous root. |
| Failed Python env | `uv sync --python 3.12` in `apps/soc-agent/server`; rerun setup |
| Bad `.env` edit | Re-run `./setup.sh` (existing values become defaults; only invalid items re-prompt) — or restore from your backup of the 0600 file |
| Encrypted rows unreadable after key rotation | Restore the previous `APP_SETTINGS_ENCRYPTION_KEY` (the runtime refuses to silently continue; error names the remediation) |
| Session cleanup | Sessions expire in 24 h; `zimbra_auth_error` self-heals by deleting the app session; revocations are one-shot and expiry-bounded |

There is **no built-in database backup/restore command** — use your PostgreSQL tooling; back up the encryption key with the data.

## 7. Logging and observability

- Python server: `LOG_LEVEL` (default INFO); per-call logs `mcp_call ok/failed` with prepare/total timings and a 12-hex correlation id (`execute()`); unexpected exceptions are logged **without** third-party text.
- Node host: harness logging; background refresh warnings (`soc-background: … read failed`); bridge lifecycle info ("official Splunk MCP bridge disabled: …").
- Admin command failures: stderr JSON parsed and surfaced through the RPC (message ≤400 chars, up to 20 `missing_environment_variables`).
- Correlation: `soc_correlation_id` per MCP call (fresh UUID), `soc_investigation_id` per agent session — use them to join logs across Node/Python.
- No metrics/OTel: `session-telemetry-otel` is explicitly disabled in the patch.

## 8. Operational safety checks (recommended cadence)

1. `./setup.sh --check` after every update and periodically.
2. Run the three test suites before deploying a changed checkout ([TESTING.md](TESTING.md)) — especially the namespace fence.
3. Verify the bridge posture: with Splunk unconfigured, confirm the log says disabled (fail-safe absence of tools).
4. Confirm admin credential env vars are set at boot (startup throws otherwise — treat that as the control working).
5. Review `~/.dsh/profiles/web` for unmanaged plugins after any manual `pnpm dsh plugin` use; `setup.sh --check` must report the full SOC package set.
6. Backup: PostgreSQL + `APP_SETTINGS_ENCRYPTION_KEY` + the two `.env` files ([DATA_AND_PERSISTENCE.md](DATA_AND_PERSISTENCE.md)).

## Evidence in the repository

- `setup.sh` (all stages, `--check` checks, header comments on fingerprints/pruning), `update.sh`, root `README.md` (run/tunnel/update), `host.js` (health endpoints via RPC, admin page serving), `admin_cli.py` (test commands), `cordis.patch.yml` (telemetry disabled, `failOnStartupError`).

## Unknowns

- Production process supervision (systemd/containers) is not configured in this repo; `RUNNING_INSIDE_DOCKER`/`SPLUNK_HOST_FOR_DOCKER` suggest a container deployment exists elsewhere — its definition is not in this checkout.
- Log aggregation and alerting are deployment concerns outside the repository.
