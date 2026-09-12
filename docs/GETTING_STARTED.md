# Getting started

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.

**Who this page is for:** developers and operators preparing a working environment for the first time, or auditing an existing one.

**What you will understand:** prerequisites, the four setup modes, how configuration is prepared safely, how to start the app, a first non-destructive verification, and the common first-run failures.

**Plain-language summary.** One script — `setup.sh`, the "setup doctor" — checks prerequisites, collects configuration interactively (writing two `.env` files with restrictive permissions), installs dependencies, builds the vendored harness, and wires the SOC product into the harness web profile. It starts nothing: you launch the app yourself with one command. A second script, `update.sh`, fast-forwards a clean checkout and re-runs the repair/wiring pass.

**Prerequisites:** none.

---

## 1. Prerequisites

| Requirement | Version / check | Notes |
|---|---|---|
| Node.js | `^22.19.0` or `>=24` (regex-checked by `run_prereq_checks`) | The vendored workspace requires it |
| pnpm | any recent; `setup.sh` adds `~/.local/share/pnpm/bin` to PATH if missing (Corepack) | Package manager for the vendored workspace |
| uv | any recent | Runs the Python server (`uv run`, `uv sync`) |
| Python | 3.12 (managed by uv; `uv sync --python 3.12`) | Server pins `requires-python = ">=3.12"` and setup syncs 3.12 |
| Git | any recent | Bootstrap/branch handling |
| PostgreSQL | reachable server | `APP_POSTGRES_URI`; app login fails closed without it |
| openssl (or /dev/urandom) | for key generation | `APP_SETTINGS_ENCRYPTION_KEY` auto-generation |

Services you must provide (external): a Zimbra host, an optional official Splunk MCP endpoint + token, an optional subscription web service, and an LLM provider key configured through the admin console at runtime.

## 2. The five setup situations

| Situation | Command | What happens |
|---|---|---|
| **Fresh installation (no checkout)** | `bash setup.sh` from anywhere (bootstrap) | Prompts for repository URL, install path (default `~/CITIC_AGENT`), and branch; clones (or fast-forwards a reuse-safe existing checkout); re-execs the clone's own `setup.sh` to continue with the full setup |
| **Existing checkout, first setup / re-check** | `./setup.sh` (interactive) | `run_prereq_checks` → `collect_parameters` → `write_files` → `ensure_python_server` → `ensure_harness_ready` → `ensure_external_plugins` → `ensure_soc_bundle` → `summary`. Existing values become prompt defaults; only missing/invalid items re-prompt |
| **Audit only (no changes)** | `./setup.sh --check` | Report-only; exit 1 when anything is missing or drifted; never writes |
| **Non-interactive repair / re-wire** | `./setup.sh --plugins` (add `--rebuild` to force harness rebuild) | Prereq checks, Python env, harness build (fingerprint-gated unless `--rebuild`), plugin install/prune/verify, SOC bundle registration. No prompts, no env writing |
| **Update an existing deployment** | `./update.sh` | Refuses arguments and dirty trees; `git pull --ff-only` on the current branch; then `setup.sh --plugins`; you restart the app manually |

Branch switching: only via `./setup.sh`, only with a **clean working tree** (`git status --porcelain`); local changes are never stashed or discarded.

**Development vs deployment mode.** The setup stages are identical for both; what differs is where it runs and what happens after. Development mode is the checkout you edit, started manually with `pnpm dsh web`. Deployment mode is the same setup run on a server (the `RUNNING_INSIDE_DOCKER`/`SPLUNK_HOST_FOR_DOCKER` variables imply a container deployment defined outside this repository), with the same manual start unless your service manager wraps it — process supervision is not configured in this repo. Runtime state (`.env`, `.data`, PostgreSQL, `~/.dsh`) lives outside Git and survives updates in both modes.

## 3. What setup asks and writes

`collect_parameters` merges defaults with precedence `.env.example` < harness `.env` < server `.env` < **current environment** (environment wins). It prompts for:

- `APP_POSTGRES_URI` (regex-validated, best-effort `psql` probe) and `APP_SETTINGS_ENCRYPTION_KEY` (auto-generated 32-byte hex if blank) — secrets entered with `read -rs`.
- `SOC_ADMIN_EMAIL` / `SOC_ADMIN_PASSWORD` — the static admin login. These are **Node-host only**; both setup and runtime strip them from every Python child process.
- Splunk: the official MCP path (`SPLUNK_MCP_ENDPOINT` + `SPLUNK_TOKEN`) — the primary read path — plus retained legacy REST fields (`SPLUNK_URL` or `SPLUNK_HOST`/`SPLUNK_SCHEME`/`SPLUNK_PORT`, auth choice, `SPLUNK_VERIFY_SSL`, `SPLUNK_ALLOW_INSECURE_HTTP`).
- Zimbra: `ZIMBRA_HOST`, TLS options.
- Subscription service: `SUBSCRIPTION_SERVER_URL`, user, password, TLS option.
- MarkItDown LLM: `MARKITDOWN_LLM_ENABLED` (key+model required when true).

Files written (names only — contents never belong in tickets or chats): `apps/soc-agent/server/.env` (seeded from `.env.example`, chmod 600), `vendor/deepseek-harness/.env` (only the Postgres URI + encryption key, chmod 600), `.gitignore` (only if `.env` patterns are absent), and `.data/harness-*.sha256` fingerprints. Outside the repo: `~/.dsh/profiles/web/` (patch copy, `pnpm-workspace.yaml`, plugin manifest). The summary prints **masked** values only.

## 4. Development startup

```bash
# from the repository root
cd vendor/deepseek-harness
pnpm dsh web --no-open
```

Open `http://127.0.0.1:3080` (the summary prints this; remote access typically via `ssh -L 3080:127.0.0.1:3080 user@host`). The Node host loads the web profile, spawns the Python `soc_agent` stdio server, and (when configured) connects the `splunk_mcp` bridge. A failed Python spawn is fatal by design (`failOnStartupError: true`); a missing Splunk endpoint/token merely disables the bridge with a log line.

Rebuilding after client changes: `pnpm --filter dsh-soc-agent-client run build` (or `./setup.sh --plugins`, which detects bundle drift and repairs it). See [DEVELOPMENT.md](DEVELOPMENT.md).

## 5. First non-destructive verification

1. `./setup.sh --check` — exits 0 only when prerequisites, configuration, builds, and profile wiring are all healthy.
2. Open the app: you should see the **Sentinel login** screen (full-screen overlay). Unauthenticated users can reach nothing else — the shell is covered by `AuthGate`.
3. Sign in with **your own Zimbra email and password** (not the admin pair). `/auth/me` should report your address; a private workspace is created under `.data/soc-workspaces/<userId>/`.
4. In the admin console (`/admin`, admin credentials) → **Connections**: run *Check* on Splunk (only meaningful when the bridge is configured) and the subscription server; Zimbra/MarkItDown show environment-managed status only.
5. As the analyst: confirm the tool set — ask the agent to list mail folders (`zimbra_list_folders`) or Splunk indexes (`splunk_get_indexes`) if the bridge is configured. Read tools run automatically in SOC mode; a mutation tool (e.g. create folder) triggers an **approval request** in the UI.
6. Without sending anything: create a draft via the agent and observe the draft card — sending stays gated behind the explicit **Send** confirmation.

Never paste real secrets into shell commands (shell history). Prefer the interactive prompts or edit the chmod-600 `.env` files.

## 6. Common first-run failures

| Symptom | Likely cause | First diagnostic |
|---|---|---|
| `setup.sh` exits listing missing prerequisites | Node/pnpm/uv absent or wrong version | Install per §1; rerun (`skip` is possible but recorded as a warning) |
| Login always fails | `APP_POSTGRES_URI` unset/wrong (store degrades fail-closed) or Zimbra rejects | Check host logs for `authentication_required`; verify Postgres reachability; try the Zimbra credentials directly |
| App boots but no Zimbra tools work | Python server failed to spawn (`failOnStartupError`) or `APP_SETTINGS_ENCRYPTION_KEY`/Postgres missing | Node log at startup; `uv sync` in `apps/soc-agent/server`; `./setup.sh --plugins` |
| No Splunk tools at all | Bridge intentionally disabled — `SPLUNK_MCP_ENDPOINT`/`SPLUNK_TOKEN` not both set | Look for "official Splunk MCP bridge disabled" in the log |
| Admin console rejects login | Wrong `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD` env at host start; admin sessions are in-memory so host restarts log you out | Restart host after fixing `.env`; re-login |
| "Stored Zimbra accounts are no longer supported" | Calling a legacy account RPC | Expected refusal; log in with Zimbra instead |
| Client UI looks stale after editing `packages/soc-agent-client/src` | Tracked `lib/` bundle not rebuilt | `pnpm --filter dsh-soc-agent-client run build` or `./setup.sh --plugins` |
| Profile has extra/stale plugins | `requirements.txt` vs profile drift | `./setup.sh --plugins` prunes to the managed set |

More: [TROUBLESHOOTING.md](TROUBLESHOOTING.md). Next steps: [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) (what you just started), [CONFIGURATION.md](CONFIGURATION.md) (every variable), [DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md) (operations lifecycle).

## Evidence in the repository

- `setup.sh` (stages, modes, written files, `PLUGIN_NAMES`), `update.sh`, `requirements.txt`
- `apps/soc-agent/cordis.patch.yml` (`failOnStartupError`, bridge env), `apps/soc-agent/splunk-bridge.js` (`resolveOfficialSplunkConfig`)
- `apps/soc-agent/ownership.js` (`resolveAdminCredentials` throwing when unset), `apps/soc-agent/host.js` (`serveAdminPage`)
- `packages/soc-agent-client/src/client/AuthGate.tsx` (Sentinel login), `apps/soc-agent/server/.env.example` (variable names)
- Root `README.md` (run command, port 3080)

## Assumptions and unknowns

- Verified from source and manifests at the pinned commit; no setup command was executed while writing this page.
- The exact behavior of your external Zimbra/Splunk/subscription endpoints is environment-specific and out of scope.
