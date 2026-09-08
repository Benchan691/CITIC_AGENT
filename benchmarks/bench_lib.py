"""Isolated harness launch and run-owned reporting helpers. No production clients."""
from __future__ import annotations
import json
import os
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
    bundles = manifest.get("dsh", {}).get("profile", {}).get("bundles", [])
    if not {"@deepseek-ai/dsh-headless", "dsh-soc-agent"} <= set(bundles):
        raise ValueError("The bench profile must include the headless and SOC bundles; see benchmarks/README.md.")


def load_lab_config(path):
    config = json.loads(Path(path).read_text())
    required = {"dedicated_test_environment", "mcp_url", "allowed_origin", "session_env", "fixture_version", "prepared_cases"}
    if not required <= config.keys() or config["dedicated_test_environment"] is not True:
        raise ValueError("Lab configuration must explicitly identify a dedicated test environment and prepared cases.")
    url = urlsplit(config["mcp_url"])
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError("Lab MCP endpoint must be HTTPS without embedded credentials, query or fragment.")
    if f"{url.scheme}://{url.netloc}" != config["allowed_origin"]:
        raise ValueError("Lab MCP origin does not match the explicit allowlist.")
    if not isinstance(config["session_env"], str) or not config["session_env"].startswith("BENCH_LAB_"):
        raise ValueError("Use a dedicated BENCH_LAB_* environment variable for the authenticated test session.")
    if not os.environ.get(config["session_env"]): raise ValueError("The dedicated authenticated lab session is missing.")
    from scenarios import VERSION
    if config["fixture_version"] != VERSION: raise ValueError("Lab fixture version does not match this suite.")
    if not isinstance(config["prepared_cases"], list): raise ValueError("prepared_cases must be a list of provisioned case IDs.")
    return config


def lab_case(item, config):
    """Operator-supplied provider IDs, never inferred from another customer's data."""
    import re
    mapping = config.get("id_map", {})
    allowed = {"mail-1", *(f"f-{n}" for n in range(1, 6))}
    if not isinstance(mapping, dict) or set(mapping) - allowed or any(not isinstance(v, str) or not v or len(v) > 4096 for v in mapping.values()):
        raise ValueError("Lab id_map may only map fixture finding/message IDs to verified test-provider IDs.")
    def replace(value):
        if isinstance(value, str):
            for old, new in mapping.items():
                value = re.sub(r"(?<![\w-])" + re.escape(old) + r"(?![\w-])", lambda _: new, value)
            return value
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


def read_trace(path):
    if not path.exists(): return []
    # A partial final record after process failure is an infrastructure error,
    # never silently dropped and graded as a clean execution.
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


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
