"""Shared helpers for the CITIC_AGENT SOC benchmark: Splunk REST access, dsh
invocation, session-log parsing, and lookup provisioning.

Credentials are read from (in order):
  1. environment variables: BENCH_TEST_AUTH, BENCH_PROD_AUTH ("user:pass")
  2. benchmarks/bench_config.local.json ({"test_auth": "...", "prod_auth": "..."})
  3. built-in defaults for the two well-known lab endpoints (test only; prod
     auth falls back to the test auth if unset).
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import ssl
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HARNESS = REPO / "vendor" / "deepseek-harness"
SERVER_DIR = REPO / "apps" / "soc-agent" / "server"
RESULTS_DIR = Path(__file__).resolve().parent / "results"
DSH_HOME = Path(os.environ.get("DSH_HOME", str(Path.home() / ".dsh")))

DEFAULT_TEST = "https://100.89.29.121:8089"
DEFAULT_PROD = "https://localhost:8089"  # SSH tunnel to prod search head

# Lookups the daily SOC workflow (skills + BACKGROUND.md) depends on.
REQUIRED_LOOKUPS = [
    "Ruleset.csv",
    "7103_CIM_Parameters.csv",
    "33054_Rule_Parameter.csv",
]


def _load_local_config() -> dict:
    p = Path(__file__).resolve().parent / "bench_config.local.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return {}


def _auth_from_env_or_config(env_name: str, config_key: str, fallback: str | None) -> tuple[str, str]:
    raw = os.environ.get(env_name) or _load_local_config().get(config_key) or fallback or ""
    if ":" not in raw:
        raise SystemExit(
            f"Missing credentials: set {env_name}='user:pass' or "
            f"benchmarks/bench_config.local.json {config_key}"
        )
    user, pw = raw.split(":", 1)
    return user, pw


def get_test_auth() -> tuple[str, str]:
    return _auth_from_env_or_config("BENCH_TEST_AUTH", "test_auth", "admin:cpcsoc1@3")


def get_prod_auth() -> tuple[str, str]:
    return _auth_from_env_or_config("BENCH_PROD_AUTH", "prod_auth", None)


class SplunkREST:
    """Minimal read/write Splunk REST client for one instance."""

    def __init__(self, base_url: str, user: str, password: str, verify_ssl: bool = False):
        self.base = base_url.rstrip("/")
        self.auth = base64.b64encode(f"{user}:{password}".encode()).decode()
        self.ctx = ssl.create_default_context()
        if not verify_ssl:
            self.ctx.check_hostname = False
            self.ctx.verify_mode = ssl.CERT_NONE

    def request(self, path: str, params: dict | None = None, method: str = "GET") -> tuple[int, str]:
        url = self.base + path
        data = None
        if params is not None:
            data = urllib.parse.urlencode(params, doseq=True).encode()
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", "Basic " + self.auth)
        try:
            with urllib.request.urlopen(req, context=self.ctx, timeout=180) as resp:
                return resp.status, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")

    def oneshot(self, search: str, max_time: int = 240) -> list[dict]:
        """Run a oneshot search, return result rows (dicts).

        Splunk answers in two shapes depending on how the job completed: one
        JSON document with a `results` array, or newline-delimited
        {"result": {...}} fragments (cumulative preview re-emissions included —
        the last fragment per row wins).
        """
        status, body = self.request(
            "/services/search/jobs",
            params={
                "search": search,
                "exec_mode": "oneshot",
                "output_mode": "json",
                "max_time": max_time,
                "count": 0,
            },
            method="POST",
        )
        stripped = body.strip()
        if stripped.startswith("{"):
            try:
                obj = json.loads(stripped)
                if isinstance(obj, dict) and isinstance(obj.get("results"), list):
                    return obj["results"]
            except Exception:
                pass
        rows: dict[tuple, dict] = {}
        for line in body.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if isinstance(obj, dict) and "result" in obj:
                rows[json.dumps(obj["result"], sort_keys=True)] = obj["result"]
        return list(rows.values())

    def oneshot_scalar(self, search: str) -> str | None:
        rows = self.oneshot(search)
        if not rows:
            return None
        first = rows[0]
        for v in first.values():
            return str(v)
        return None

    def server_name(self) -> str:
        status, body = self.request("/services/server/info?output_mode=json")
        if status != 200:
            raise RuntimeError(f"Splunk unreachable at {self.base}: HTTP {status}")
        info = json.loads(body)["entry"][0]["content"]
        return info.get("serverName", "?")

    def list_saved_searches(self, app: str = "search", owner: str = "-") -> dict[str, dict]:
        status, body = self.request(
            f"/servicesNS/{owner}/{app}/saved/searches?count=0&output_mode=json"
        )
        out = {}
        if status != 200:
            return out
        for e in json.loads(body).get("entry", []):
            if e.get("acl", {}).get("app") != app:
                continue
            c = e["content"]
            out[e["name"]] = {
                "disabled": bool(c.get("disabled")),
                "is_scheduled": c.get("is_scheduled"),
                "cron_schedule": c.get("cron_schedule"),
                "dispatch.earliest_time": c.get("dispatch.earliest_time"),
                "dispatch.latest_time": c.get("dispatch.latest_time"),
                "alert.expires": c.get("alert.expires"),
                "alert_type": c.get("alert_type"),
                "counttype": c.get("counttype"),
                "comparator": c.get("comparator"),
                "quantity": c.get("quantity"),
                "alert.digest_mode": c.get("alert.digest_mode"),
                "alert.suppress": c.get("alert.suppress"),
                "alert.track": c.get("alert.track"),
                "actions": c.get("actions"),
                "action.logevent": c.get("action.logevent"),
                "action.logevent.param.keyword": c.get("action.logevent.param.keyword"),
                "search": c.get("search", ""),
            }
        return out

    def get_saved_search(self, name: str, app: str = "search", owner: str = "-") -> dict | None:
        s = self.request(f"/servicesNS/{owner}/{app}/saved/searches?count=0&output_mode=json")[1]
        for e in json.loads(s).get("entry", []):
            if e["name"] == name and e.get("acl", {}).get("app") == app:
                return e["content"]
        return None

    def delete_saved_search(self, name: str, app: str = "search", owner: str = "-") -> bool:
        from urllib.parse import quote

        status, _ = self.request(
            f"/servicesNS/{owner}/{app}/saved/searches/{quote(name, safe='')}",
            method="DELETE",
        )
        return status in (200, 204)

    def lookup_exists(self, name: str, app: str = "search") -> bool:
        status, body = self.request(
            f"/servicesNS/-/{app}/data/lookup-table-files?count=0&output_mode=json"
        )
        if status != 200:
            return False
        for e in json.loads(body).get("entry", []):
            if e["name"] == name:
                return True
        return False

    def lookup_rows(self, name: str, app: str = "search") -> list[dict]:
        return self.oneshot(f'| inputlookup "{name}"', max_time=180)


def test_client(cfg: dict | None = None) -> SplunkREST:
    cfg = cfg or {}
    user, pw = get_test_auth()
    return SplunkREST(cfg.get("test_url", DEFAULT_TEST), user, pw, verify_ssl=False)


def prod_client(cfg: dict | None = None) -> SplunkREST | None:
    try:
        user, pw = get_prod_auth()
    except SystemExit:
        return None
    return SplunkREST(cfg.get("prod_url", DEFAULT_PROD), user, pw, verify_ssl=False)


# --------------------------------------------------------------------------- dsh


def load_harness_env() -> dict[str, str]:
    """Load vendor/deepseek-harness/.env (DEEPSEEK_API_KEY, APP_POSTGRES_URI, ...)."""
    out = {}
    envfile = HARNESS / ".env"
    if envfile.exists():
        for line in envfile.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


# ----------------------------------------------------------- server .env swap

ENV_OVERRIDES_MARKER = "# === appended by benchmarks/run_benchmark.py (bench env) ==="


def swap_server_env(cfg: dict) -> str:
    """Point the MCP server's .env at the test Splunk for the bench run.

    load_dotenv(override=True) makes the server .env beat process env vars, so
    the only reliable way to retarget the server is to edit the file for the
    duration of the run. Returns the original content for restore_server_env.
    """
    env_path = SERVER_DIR / ".env"
    original = env_path.read_text()

    from urllib.parse import urlsplit

    host = urlsplit(cfg["test_url"]).hostname or ""
    overrides = {
        "SPLUNK_URL": cfg["test_url"],
        "SPLUNK_HOST": host,
        "SPLUNK_TOKEN": "",
        "SPLUNK_USERNAME": cfg["test_user"],
        "SPLUNK_PASSWORD": cfg["test_password"],
        "SPLUNK_PORT": "8089",
        "SPLUNK_VERIFY_SSL": "0",
        "SPLUNK_ALLOW_INSECURE_HTTP": "1",
        "SPLUNK_ALLOW_DETECTION_WRITE": "1",
        "SPLUNK_ALLOW_DETECTION_ENABLE": "0",
        "SPLUNK_DETECTION_APP": "search",
        "SPLUNK_DETECTION_OWNER": "nobody",
        "SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP": "1",
        "LOG_LEVEL": "DEBUG",
    }
    lines = original.splitlines()
    seen: set[str] = set()
    out = []
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line else None
        if key and key in overrides:
            out.append(f"{key}={overrides[key]}")
            seen.add(key)
        else:
            out.append(line)
    missing = [k for k in overrides if k not in seen]
    if missing:
        out.append(ENV_OVERRIDES_MARKER)
        out.extend(f"{k}={overrides[k]}" for k in missing)
    out.append(ENV_OVERRIDES_MARKER)
    out.append(f"# swapped {datetime.now().isoformat()}")
    env_path.write_text("\n".join(out) + "\n")
    return original


def restore_server_env(original: str) -> None:
    (SERVER_DIR / ".env").write_text(original)


def run_dsh_headless(task: str, overlay_path: Path, timeout_s: int, log_prefix: str, cfg: dict) -> dict:
    """Run one headless agent task with the bench profile + SOC overlay.

    Returns {exit_code, stdout, stderr, duration_s, session_log}.
    """
    harness_env = load_harness_env()
    env = dict(os.environ)
    env.update({k: v for k, v in harness_env.items() if v})
    env.update(
        {
            "MCP_SERVER_ROOT": str(REPO),
            "BENCH_MCP_SERVER_ROOT": str(REPO),
            "BENCH_APP_POSTGRES_URI": harness_env.get("APP_POSTGRES_URI", ""),
            "BENCH_APP_SETTINGS_ENCRYPTION_KEY": harness_env.get("APP_SETTINGS_ENCRYPTION_KEY", ""),
        }
    )
    started = time.time()
    sess_dir = DSH_HOME / "sessions"
    before = {
        str(p): p.stat().st_mtime
        for p in sess_dir.rglob("*")
        if p.is_file() and (p.name == "session.jsonl" or p.name == "session.jsonl.zstd")
    } if sess_dir.exists() else {}

    try:
        proc = subprocess.run(
            ["pnpm", "dsh", "--profile", "bench", "--patch", str(overlay_path), task],
            cwd=str(HARNESS),
            capture_output=True,
            text=True,
            timeout=timeout_s,
            env=env,
        )
    except subprocess.TimeoutExpired as e:
        # grade whatever state exists (artifacts may already be created)
        return {
            "exit_code": None,
            "stdout": (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or ""),
            "stderr": (e.stderr or b"").decode("utf-8", "replace") if isinstance(e.stderr, bytes) else (e.stderr or ""),
            "duration_s": round(time.time() - started, 1),
            "timed_out": True,
            "mcp_log": None,
            "session_log": None,
        }
    duration = time.time() - started
    # newest session log file that appeared/changed during the run (secondary)
    session_log = None
    if sess_dir.exists():
        after = {
            str(p): p.stat().st_mtime
            for p in sess_dir.rglob("*")
            if p.is_file() and (p.name == "session.jsonl" or p.name == "session.jsonl.zstd")
        }
        new = [n for n, m in after.items() if before.get(n, 0) < started - 1]
        if new:
            session_log = max(new, key=lambda n: after[n])

    return {
        "exit_code": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
        "duration_s": round(duration, 1),
        "mcp_log": None,
        "session_log": session_log,
    }


def parse_tool_activity(stderr_text: str | None) -> dict:
    """Extract MCP tool-call activity from the MCP server's DEBUG stderr.

    The mcp python SDK logs every request at DEBUG level; the benchmark only
    needs which tools were called, how often, and with what search strings.
    """
    out = {
        "tool_calls": [],
        "tool_call_count": 0,
        "searches": [],
        "tools_called": [],
    }
    text = stderr_text or ""
    if not text:
        return out
    # The MCP SDK logs every request at DEBUG as "Processing/Dispatching
    # request of type CallToolRequest" without the tool name; count those.
    out["tool_call_count"] = len(re.findall(r"type CallToolRequest", text))
    # some paths log the method/name directly; capture them when present
    for line in text.splitlines():
        if "tools/call" not in line:
            continue
        m = re.search(r"name[\"']?[:=]\s*[\"']([\w.]+)[\"']", line)
        if m:
            out["tool_calls"].append({"name": m.group(1), "line": line.strip()[:400]})
    out["tools_called"] = sorted({t["name"] for t in out["tool_calls"]})
    return out


def _read_session_log(path: str | None) -> str:
    """Read a session log, transparently decompressing session.jsonl.zstd."""
    if not path or not Path(path).exists():
        return ""
    data = Path(path).read_bytes()
    if path.endswith(".zstd") or data[:4] == b"\x28\xb5\x2f\xfd":
        import zstandard

        return zstandard.ZstdDecompressor().decompress(data, max_output_size=1 << 30).decode(
            "utf-8", "replace"
        )
    return data.decode("utf-8", "replace")


def parse_session_metrics(session_log: str | None) -> dict:
    """Extract benchmark metrics from a dsh session JSONL log."""
    body = _read_session_log(session_log)
    if not body:
        return {"tool_calls": [], "steps": 0, "tokens_in": 0, "tokens_out": 0, "turn_completed": None}
    tool_calls: list[dict] = []
    steps = 0
    tin = tout = 0
    completed = None
    t0 = None
    tend = None
    for line in body.splitlines():
        try:
            ev = json.loads(line)
        except Exception:
            continue
        typ = ev.get("type")
        ts = ev.get("time")
        if ts:
            if t0 is None:
                t0 = ts
            tend = ts
        if typ == "tool/call":
            tool_calls.append({"name": ev.get("data", {}).get("name"), "ts": ts})
        elif typ == "step/start":
            steps += 1
        elif typ == "assistant/message":
            usage = ev.get("data", {}).get("usage") or {}
            tin += int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
            tout += int(usage.get("output_tokens") or usage.get("completion_tokens") or 0)
        elif typ == "turn/end":
            completed = (ev.get("data", {}).get("reason") or {}).get("kind")
    names = [t["name"] for t in tool_calls]
    return {
        "tool_calls": names,
        "tool_call_count": len(names),
        "steps": steps,
        "tokens_in": tin,
        "tokens_out": tout,
        "turn_completed": completed,
        "session_span_s": _span(t0, tend),
    }


def _span(t0, t1):
    try:
        from datetime import datetime

        f = lambda s: datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return round((f(t1) - f(t0)).total_seconds(), 1) if t0 and t1 else None
    except Exception:
        return None


# ------------------------------------------------------------------ lookups


def ensure_required_lookups(test: SplunkREST, prod: SplunkREST | None, log) -> list[str]:
    """Return list of lookups that were copied from prod to test (or failed)."""
    copied = []
    for name in REQUIRED_LOOKUPS:
        if test.lookup_exists(name):
            continue
        log(f"lookup {name} missing on test")
        if prod is None:
            log(f"  !! no prod credentials; cannot copy {name}")
            copied.append(f"{name} (MISSING, no prod access)")
            continue
        rows = prod.lookup_rows(name, app="search")
        if not rows:
            log(f"  !! prod returned no rows for {name}")
            copied.append(f"{name} (MISSING, prod empty)")
            continue
        _place_lookup_on_test(name, rows, log)
        copied.append(f"{name} (copied {len(rows)} rows from prod)")
    return copied


def _place_lookup_on_test(name: str, rows: list[dict], log) -> None:
    """Write lookup rows onto the test box: export CSV locally, scp, install."""
    import csv
    import io

    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in rows[0].keys()})
    local = Path("/tmp/bench_lookup.csv")
    local.write_text(buf.getvalue())
    app = "search"
    subprocess.run(
        [
            "scp",
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=accept-new",
            "-q",
            str(local),
            f"root@100.89.29.121:/opt/splunk/etc/apps/{app}/lookups/{name}",
        ],
        check=True,
        timeout=120,
    )
    subprocess.run(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=accept-new",
            "root@100.89.29.121",
            f"chown splunk:splunk '/opt/splunk/etc/apps/{app}/lookups/{name}' && chmod 644 '/opt/splunk/etc/apps/{app}/lookups/{name}'",
        ],
        check=True,
        timeout=60,
    )
    local.unlink(missing_ok=True)
    log(f"  copied {name} to test ({len(rows)} rows)")
