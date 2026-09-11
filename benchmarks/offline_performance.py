"""Offline replay of the production coordinators; no credentials or live I/O.

Run with apps/soc-agent/server/.venv/bin/python -B benchmarks/offline_performance.py.
Provider latency is a fixed fixture, not a measurement of Splunk or an LLM.
"""

import asyncio
import json
import math
from pathlib import Path
import shutil
import statistics
import subprocess
import sys
from tempfile import TemporaryDirectory
from time import perf_counter
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/soc-agent/server"))

from unified_mcp_server.attachment_converter import AttachmentConverter, AttachmentConversionLimits
from unified_mcp_server.config import MarkItDownSettings
from unified_mcp_server.splunk.search.evidence import SearchEvidenceCoordinator
from unified_mcp_server.splunk.search.resource_manager import SearchResourceManager
from unified_mcp_server.splunk.search.resource_policy import SearchResourceConfig


def execution(key):
    rows = [{"id": key, "count": 12}]
    return {"events": rows, "retained_events": rows, "result_type": "table",
            "columns": ["id", "count"], "validation": {"query": f"fixture={key}"},
            "earliest_time": "1700000000", "latest_time": "1700003600",
            "search_metadata": {"total_result_count": 1, "splunk_result_truncated": False}}


async def replay(parallel):
    evidence = SearchEvidenceCoordinator()
    manager = SearchResourceManager(SearchResourceConfig(global_concurrency=4, per_principal_concurrency=2))
    dispatches = 0
    async def request(key):
        async def provider():
            nonlocal dispatches
            async with manager.acquire("fixture-user", "low"):
                dispatches += 1
                await asyncio.sleep(0.02)
                return execution(key)
        return await evidence.execute_coalesced(str(key), provider, fresh=not parallel)
    keys = [0, 1, 2, 3] * 2
    started = perf_counter()
    results = await asyncio.gather(*(request(key) for key in keys)) if parallel else [await request(key) for key in keys]
    elapsed_ms = (perf_counter() - started) * 1000
    assert [result[0]["events"][0]["id"] for result in results] == keys
    before = dispatches
    if parallel:
        for key in keys:
            await request(key)
        assert dispatches == before
    return elapsed_ms, dispatches


async def main():
    baseline, optimized = [], []
    for _ in range(12):
        a, baseline_calls = await replay(False)
        b, optimized_calls = await replay(True)
        baseline.append(a)
        optimized.append(b)
    assert baseline_calls == 8 and optimized_calls == 4
    with TemporaryDirectory(prefix="soc-offline-evidence-") as directory:
        path = str(Path(directory) / "evidence.sqlite3")
        evidence = SearchEvidenceCoordinator(store_path=path)
        async def first(): return execution("durable")
        value, _, _ = await evidence.execute_coalesced("durable", first)
        async def forbidden(): raise AssertionError("Restart re-dispatched retained evidence")
        restarted = SearchEvidenceCoordinator(store_path=path)
        _, retained, _ = await restarted.execute_coalesced("durable", forbidden)
        assert retained.durable and retained.evidence_id == value["_evidence_id"]
        assert restarted.read_page(retained.evidence_id)["rows"] == value["retained_events"]
    class Converter:
        calls = 0
        def convert_stream(self, *_args, **_kwargs):
            self.calls += 1
            return SimpleNamespace(markdown="fixture " * 100, title="Fixture")
    converter = Converter()
    cache = AttachmentConverter(MarkItDownSettings(), markitdown=converter)
    for limit in [10, 20, 30]:
        result = cache.convert(b"fixture bytes", "fixture.pdf", "application/pdf", AttachmentConversionLimits(max_chars=limit))
        assert result["text"] == ("fixture " * 100)[:limit]
    assert converter.calls == 1
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is required for the model-preview replay.")
    projection = subprocess.run([node, "--input-type=module", "-e", f"""
      import {{ projectInvestigationResult }} from {json.dumps((ROOT / 'apps/soc-agent/investigation.js').as_uri())}
      const rows = Array.from({{length:50}}, (_, id) => ({{id, text:'fixture '.repeat(40)}}))
      const envelope = {{ok:true,data:{{search:{{result_count:1200,fetched_count:50,returned_count:50}},result:{{type:'events',rows}},evidence:{{id:'fixture',result_count:50}}}}}}
      const original = JSON.stringify(envelope)
      const text = projectInvestigationResult('mcp__soc_agent__splunk_search', [{{type:'text',text:original}}])[0].text
      const data = JSON.parse(text).data
      if (data.search.result_count !== 1200 || data.search.fetched_count !== 50 || data.result.rows.length !== 8 || envelope.data.result.rows.length !== 50) throw Error('Evidence projection lost counts or altered original rows')
      console.log(JSON.stringify({{before_bytes:Buffer.byteLength(original),after_bytes:Buffer.byteLength(text),preview_rows:data.result.rows.length,retained_rows:50}}))
    """], check=True, capture_output=True, text=True)
    def timing(values):
        return {"p50_ms": round(statistics.median(values), 2), "p95_ms": round(sorted(values)[math.ceil(len(values) * .95) - 1], 2)}
    print(json.dumps({
        "mode": "offline synthetic provider; no LLM, Splunk, Zimbra, or PostgreSQL calls",
        "samples": 12, "fixture_provider_ms": 20, "logical_search_requests": 8,
        "sequential_fresh": {**timing(baseline), "dispatches": baseline_calls},
        "bounded_parallel_coalesced": {**timing(optimized), "dispatches": optimized_calls},
        "warm_repeat_dispatches": 0, "restart_reuse_dispatches": 0,
        "attachment_excerpt_requests": 3, "attachment_conversions": converter.calls,
        "model_preview": json.loads(projection.stdout),
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
