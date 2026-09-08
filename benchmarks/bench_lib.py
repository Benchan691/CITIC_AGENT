"""Isolated harness launch and run-owned reporting helpers. No production clients."""
from __future__ import annotations
import json
import os
import re
import signal
import subprocess
import time
from pathlib import Path
from urllib.parse import urlsplit

REPO = Path(__file__).resolve().parents[1]
HARNESS = REPO / "vendor/deepseek-harness"
PYTHON = REPO / "apps/soc-agent/server/.venv/bin/python"
RESULTS_DIR = REPO / "benchmarks/results"


def validate_harness():
    if not PYTHON.exists() or not (HARNESS / "node_modules/tsx/dist/loader.mjs").exists():
        raise ValueError("Install the SOC server runtime and build the harness dependencies before running agent cases.")
    home = Path(os.environ.get("DSH_HOME", str(Path.home() / ".dsh")))
    profile = home / "profiles/bench/package.json"
    try: manifest = json.loads(profile.read_text())
    except (OSError, ValueError): raise ValueError("A configured bench profile is required; see benchmarks/README.md.")
    try: bundles = manifest["dsh"]["profile"]["bundles"]
    except (KeyError, TypeError): bundles = []
    required = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless", "dsh-soc-agent"]
    if not isinstance(bundles, list) or any(not isinstance(b, str) for b in bundles) or not set(required) <= set(bundles):
        raise ValueError("The bench profile must include the base, headless and SOC bundles; see benchmarks/README.md.")
    if [bundles.index(b) for b in required] != sorted(bundles.index(b) for b in required):
        raise ValueError("The bench profile must apply base, then headless, then SOC bundles so SOC tool restrictions take precedence.")


def load_lab_config(path):
    config = json.loads(Path(path).read_text())
    required = {"dedicated_test_environment", "mcp_url", "allowed_origin", "session_env", "fixture_version", "prepared_cases"}
    if not isinstance(config, dict) or not required <= config.keys() or config["dedicated_test_environment"] is not True:
        raise ValueError("Lab configuration must explicitly identify a dedicated test environment and prepared cases.")
    if not isinstance(config["mcp_url"], str) or any(c.isspace() for c in config["mcp_url"]):
        raise ValueError("Lab MCP endpoint must be an HTTPS URL without whitespace.")
    url = urlsplit(config["mcp_url"])
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment or url.port == 0:
        raise ValueError("Lab MCP endpoint must be HTTPS without embedded credentials, query or fragment.")
    if f"{url.scheme}://{url.netloc}" != config["allowed_origin"]:
        raise ValueError("Lab MCP origin does not match the explicit allowlist.")
    if not isinstance(config["session_env"], str) or not re.fullmatch(r"BENCH_LAB_[A-Za-z0-9_]+", config["session_env"]):
        raise ValueError("Use a dedicated BENCH_LAB_* environment variable for the authenticated test session.")
    if not os.environ.get(config["session_env"]): raise ValueError("The dedicated authenticated lab session is missing.")
    from scenarios import SCENARIOS, VERSION
    if config["fixture_version"] != VERSION: raise ValueError("Lab fixture version does not match this suite.")
    cases = config["prepared_cases"]
    if not isinstance(cases, list) or any(not isinstance(c, str) for c in cases) or len(cases) != len(set(cases)) or set(cases) - {c["id"] for c in SCENARIOS}:
        raise ValueError("prepared_cases must contain unique, known provisioned case IDs.")
    lab_case({}, config)  # Validate provider IDs before creating artifacts or starting an agent.
    return config


def lab_case(item, config):
    """Operator-supplied provider IDs, never inferred from another customer's data."""
    mapping = config.get("id_map", {})
    allowed = {"mail-1", *(f"f-{n}" for n in range(1, 6))}
    if not isinstance(mapping, dict) or set(mapping) - allowed or any(not isinstance(v, str) or not v or len(v) > 4096 for v in mapping.values()):
        raise ValueError("Lab id_map may only map fixture finding/message IDs to verified test-provider IDs.")
    def replace(value):
        if isinstance(value, str):
            return re.sub(r"(?<![\w-])(?:" + "|".join(re.escape(k) for k in mapping) + r")(?![\w-])", lambda match: mapping[match[0]], value) if mapping else value
        if isinstance(value, dict): return {k: replace(v) for k, v in value.items()}
        if isinstance(value, list): return [replace(v) for v in value]
        return value
    return replace(item)


def write_overlay(path, case_id, suite, trace_path, session_id, phase=0, lab_config=None):
    # JSON strings are valid YAML scalars. No shell/JS interpolation of user data.
    args = [str(REPO / "benchmarks/bench_mcp_server.py"), "--suite", suite, "--case", case_id, "--trace", str(trace_path), "--phase", str(phase)]
    if lab_config: args += ["--lab-config", str(Path(lab_config).resolve())]
    config = {"serverName": "soc_agent", "transport": "stdio", "command": str(PYTHON), "args": args,
              "cwd": str(REPO), "env": {"BENCH_SESSION_ID": session_id, "PYTHONDONTWRITEBYTECODE": "1"},
              "toolCallTimeoutMs": 180000, "failOnStartupError": True}
    if suite == "lab":
        lab = load_lab_config(lab_config)
        # Secret comes from process env at evaluation time, never the overlay.
        env_name = lab["session_env"]
        env_yaml = "\n        " + env_name + ": !!js process.env[" + json.dumps(env_name) + "]"
    else: env_yaml = ""
    # Reuse SOC policy categories without the browser host. Synthetic cases
    # supply one scripted operator approval per authorized draft call; the
    # lab never uses this synthetic answerer.
    lines = ["- id: soc-agent-mcp", "  config:"]
    for key, value in config.items():
        if key == "env":
            lines += ["    env:"] + ["      " + k + ": " + json.dumps(v) for k, v in value.items()]
            if env_yaml: lines.append(env_yaml.replace("        ", "      ").strip("\n"))
        else: lines.append("    " + key + ": " + json.dumps(value))
    for id in ("soc-agent-auth-host", "soc-agent-admin-host", "soc-agent-scheduler", "web", "web-search-deepseek", "tool-web", "session-telemetry-otel"):
        lines += ["- id: " + id, "  disabled: true"]
    from scenarios import get_case
    from grading import READ_TOOLS
    item = get_case(case_id, phase)
    policy = {"allowedTools": sorted(READ_TOOLS | set(item["allowed_drafts"])), "syntheticDrafts": item["allowed_drafts"] if suite == "synthetic" else []}
    lines += ["- insert:", "    - id: citic-benchmark-policy", "      name: " + json.dumps(str(REPO / "benchmarks/bench_policy.mjs")), "      config: " + json.dumps(policy)]
    lines += ["- id: session-persistence-jsonl", "  config:", "    root: " + json.dumps(str(path.parent / "sessions")), "    compression: none", "    packChunks: false"]
    # Headless creates a plain agent and does not join the browser's citic-soc
    # preset. Apply its operational context to the global instruction layer.
    lines += ["- id: system-prompt", "  config:", "    persona: " + json.dumps("You are the CITIC SOC Agent powered by {{model}}. Assist authenticated SOC operators with customer-scoped security investigation and detection engineering. Treat evidence as read-only unless an approved MCP action and its required user confirmation explicitly allow a change. Never invent search results, customer context, Splunk fields, indexes, or completed actions.")]
    lines += ["- id: agent-instructions", "  config:", '    instructionFileCandidates: ["AGENTS.md", "CLAUDE.md"]', '    deferredInstructionFileCandidates: ["BACKGROUND.md"]', '    deferredToolNamePrefixes: ["mcp__soc_agent__splunk_"]']
    path.write_text("\n".join(lines) + "\n")
    return path


def run_dsh_headless(task, overlay_path, timeout_s, workspace):
    env = dict(os.environ)
    # Do not load or copy application/service .env files. Provider credentials
    # continue to resolve through the configured bench profile/harness provider.
    for key in list(env):
        if key.startswith(("APP_", "SPLUNK_", "ZIMBRA_", "SUBSCRIPTION_", "SOC_ADMIN_")):
            env.pop(key)
    env.update(MCP_SERVER_ROOT=str(REPO), DSH_TELEMETRY_DISABLED="1")
    launcher = ["node", "--import", str(HARNESS / "node_modules/tsx/dist/loader.mjs"), str(HARNESS / "apps/cli/src/bin.ts")]
    command = launcher + ["--profile", "bench", "--patch", str(overlay_path), task]
    started = time.monotonic()
    process = subprocess.Popen(command, cwd=workspace, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
    timed_out = False
    try:
        stdout, stderr = process.communicate(timeout=timeout_s)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGTERM)
        try: stdout, stderr = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate()
    except BaseException:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
        raise
    return {"exit_code": process.returncode, "timed_out": timed_out, "stdout": stdout, "stderr": stderr, "duration_s": round(time.monotonic() - started, 3), "tokens_in": None, "tokens_out": None}


def read_trace(path, *, errors=None):
    if not path.exists(): return []
    records = []
    for number, line in enumerate(path.read_bytes().splitlines(), 1):
        if not line.strip(): continue
        try:
            records.append(json.loads(line))
        except (ValueError, UnicodeError):
            if errors is None:
                raise ValueError(f"Malformed trace record at line {number}") from None
            # Preserve previously observed violations even if the process was
            # killed halfway through a later record. The run still cannot pass.
            errors.append(f"malformed_trace_record:{number}")
    return records


def cleanup_owned(directory, manifest, keep=False):
    """Only delete explicitly recorded local scratch files, never remote objects."""
    root = directory.resolve()
    deleted = []
    if keep: return deleted
    for relative in manifest:
        path = root / relative
        if path.is_symlink() or not path.resolve().is_relative_to(root):
            raise ValueError("Cleanup refused a path outside the run directory.")
        if path.is_file():
            path.unlink()
            deleted.append(relative)
    return deleted
