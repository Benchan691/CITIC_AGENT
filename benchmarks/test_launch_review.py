"""Offline launch/proxy contract checks; no agents or lab connections."""
import json
from copy import deepcopy
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from mcp import types  # Load runtime types before the offline subprocess guard.

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "benchmarks"), str(ROOT / "apps/soc-agent/server")]
import bench_lib
from bench_mcp_server import forward_lab_call
from scenarios import VERSION, get_case


def config():
    return {"dedicated_test_environment": True, "mcp_url": "https://lab.example/mcp",
            "allowed_origin": "https://lab.example", "session_env": "BENCH_LAB_SESSION",
            "fixture_version": VERSION, "prepared_cases": ["Q1_empty"]}


@pytest.mark.parametrize("changed", [
    [], None, {"mcp_url": 4}, {"mcp_url": "https://lab.example:bad/mcp"},
    {"mcp_url": "https://lab.example/\nmcp"}, {"session_env": "BENCH_LAB_BAD\nkey"},
    {"prepared_cases": ["Q1_empty", "Q1_empty"]}, {"prepared_cases": ["nonexistent"]},
    {"prepared_cases": [{}]}, {"id_map": {"wrong-id": "123"}},
])
def test_invalid_lab_config_fails_before_launch(tmp_path, monkeypatch, changed):
    monkeypatch.setenv("BENCH_LAB_SESSION", "dedicated-secret")
    value = {**config(), **changed} if isinstance(changed, dict) else changed
    path = tmp_path / "lab.json"
    path.write_text(json.dumps(value))
    with pytest.raises(ValueError):
        bench_lib.load_lab_config(path)


def test_provider_id_mapping_is_simultaneous():
    assert bench_lib.lab_case({"ids": ["f-1", "f-2", "other-f-1"]}, {"id_map": {"f-1": "f-2", "f-2": "provider-2"}}) == {"ids": ["f-2", "provider-2", "other-f-1"]}


def test_headless_overlay_loads_operational_background(tmp_path):
    path = bench_lib.write_overlay(tmp_path / "overlay.yml", "Q1_empty", "synthetic", tmp_path / "trace.jsonl", "fixture-session")
    text = path.read_text()
    assert "You are the CITIC SOC Agent" in text
    assert 'deferredInstructionFileCandidates: ["BACKGROUND.md"]' in text
    assert 'deferredToolNamePrefixes: ["mcp__soc_agent__splunk_"]' in text
    # This is the same trigger used by the production browser's CITIC preset.
    preset = (ROOT / "vendor/deepseek-harness/apps/cli/config/agent-presets/citic-soc/agent.cordis.yml").read_text()
    assert "deferredInstructionFileCandidates:\n      - BACKGROUND.md" in preset
    assert "deferredToolNamePrefixes:\n      - mcp__soc_agent__splunk_" in preset


def test_bench_profile_requires_base_and_soc_restrictions_last(tmp_path, monkeypatch):
    monkeypatch.setenv("DSH_HOME", str(tmp_path))
    runtime = tmp_path / "python"
    runtime.touch()
    monkeypatch.setattr(bench_lib, "PYTHON", runtime)
    monkeypatch.setattr(bench_lib, "HARNESS", tmp_path)
    loader = tmp_path / "node_modules/tsx/dist/loader.mjs"
    loader.parent.mkdir(parents=True)
    loader.touch()
    manifest = tmp_path / "profiles/bench/package.json"
    manifest.parent.mkdir(parents=True)
    base, headless, soc = "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless", "dsh-soc-agent"
    for bundles in ([headless, soc], [base, soc, headless], [base, headless, {}], "malformed"):
        manifest.write_text(json.dumps({"dsh": {"profile": {"bundles": bundles}}}))
        with pytest.raises(ValueError): bench_lib.validate_harness()
    manifest.write_text(json.dumps({"dsh": {"profile": {"bundles": [base, headless, soc]}}}))
    bench_lib.validate_harness()


@pytest.mark.asyncio
async def test_lab_proxy_uses_distinct_trusted_investigations_and_keeps_secrets_out_of_trace():
    calls, trace = [], []
    async def call_tool(name, arguments, meta):
        calls.append((name, arguments, meta))
        return SimpleNamespace(structuredContent={"ok": True, "data": {}}, content=[], isError=False)
    def record(name, arguments, envelope):
        trace.append(deepcopy({"tool": name, "args": arguments, "result": envelope}))
        return "ev-recorded"
    for investigation in ("case-one", "case-two"):
        result = await forward_lab_call(SimpleNamespace(call_tool=call_tool), get_case("Q1_empty"), "system_get_status", {}, session_id="dedicated-secret", investigation_id=investigation, record=record)
        assert result.structuredContent["meta"]["benchmark_evidence_id"] == "ev-recorded"
        assert result.isError is False
    assert [c[2]["soc_investigation_id"] for c in calls] == ["case-one", "case-two"]
    assert all(c[2]["soc_session_id"] == "dedicated-secret" for c in calls)
    assert "dedicated-secret" not in json.dumps(trace)


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [[], {"ok": True, "meta": None}, {"unexpected": True}])
async def test_malformed_lab_response_is_traced_as_infrastructure_error(body):
    async def call_tool(*args, **kwargs):
        return SimpleNamespace(structuredContent=body, content=[SimpleNamespace(type="text", text=json.dumps(body))], isError=False)
    trace = []
    result = await forward_lab_call(SimpleNamespace(call_tool=call_tool), get_case("Q1_empty"), "system_get_status", {}, session_id="dedicated-secret", investigation_id="case-one", record=lambda n, a, e: trace.append(deepcopy(e)) or "ev-error")
    assert result.isError is True
    assert trace[0]["error"]["code"] == "lab_transport_error"


@pytest.mark.asyncio
async def test_unauthorized_lab_call_is_not_forwarded():
    async def forbidden(*args, **kwargs): raise AssertionError("Unauthorized request was forwarded")
    result = await forward_lab_call(SimpleNamespace(call_tool=forbidden), get_case("Q1_empty"), "zimbra_send_email", {"to": ["security@orchid.example"]}, session_id="dedicated-secret", investigation_id="case-one", record=lambda *_: "ev-denied")
    assert result.isError is True
    assert result.structuredContent["error"]["code"] == "benchmark_scope"
