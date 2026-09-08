#!/usr/bin/env python3
"""Benchmark-only MCP entrypoint. Synthetic mode cannot open network sockets."""
from __future__ import annotations
import argparse
import asyncio
import json
import os
from pathlib import Path
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/soc-agent/server"))
from scenarios import get_case


def recorder(path):
    def record(name, args, result):
        evidence_id = "ev-" + uuid.uuid4().hex[:16]
        with path.open("a") as stream:
            stream.write(json.dumps({"id": evidence_id, "tool": name, "args": args, "result": result}) + "\n")
        return evidence_id
    return record


def disable_network():
    import socket
    def denied(*_args, **_kwargs): raise RuntimeError("Synthetic fixture process cannot access the network")
    # Preserve local socketpair support used by asyncio, but deny outbound TCP/UDP.
    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    socket.socket.sendto = denied
    socket.create_connection = denied
    socket.getaddrinfo = denied


async def forward_lab_call(upstream, item, name, arguments, *, session_id, investigation_id, record):
    """Forward one scoped call with trusted identity and case-local evidence reuse."""
    from grading import request_violations
    from mcp import types
    try:
        if not session_id or not investigation_id:
            raise ValueError("The trusted benchmark session is missing")
        violations = request_violations(item, name, arguments)
        if violations:
            envelope = {"ok": False, "error": {"code": "benchmark_scope", "message": "; ".join(violations)}}
        else:
            result = await upstream.call_tool(name, arguments, meta={"soc_session_id": session_id, "soc_investigation_id": investigation_id})
            envelope = result.structuredContent
            if not isinstance(envelope, dict):
                envelope = json.loads(next(c.text for c in result.content if c.type == "text"))
            if not isinstance(envelope, dict) or not isinstance(envelope.get("ok"), bool) or not isinstance(envelope.get("meta", {}), dict):
                raise ValueError("Malformed lab response envelope")
            if result.isError: envelope["ok"] = False
    except Exception:
        envelope = {"ok": False, "error": {"code": "lab_transport_error", "message": "Lab call failed; inspect the dedicated lab service."}}
    envelope.setdefault("meta", {})["benchmark_evidence_id"] = record(name, arguments, envelope)
    return types.CallToolResult(content=[types.TextContent(type="text", text=json.dumps(envelope))], structuredContent=envelope, isError=envelope.get("ok") is not True)


async def run_lab(item, config_path, record):
    import httpx
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client
    from mcp.server.lowlevel import Server
    from mcp.server.stdio import stdio_server
    from bench_lib import lab_case, load_lab_config
    from grading import READ_TOOLS
    config = load_lab_config(config_path)
    item = lab_case(item, config)
    if item["id"] not in config["prepared_cases"]: raise ValueError("Case fixtures have not been provisioned in this lab.")
    investigation_id = os.environ.get("BENCH_SESSION_ID")
    if not investigation_id: raise ValueError("The trusted benchmark launcher must supply a unique investigation.")
    async with httpx.AsyncClient(follow_redirects=False, timeout=180) as http:
        async with streamable_http_client(config["mcp_url"], http_client=http) as (read, write, _):
            async with ClientSession(read, write) as upstream:
                await upstream.initialize()
                server = Server("CITIC lab benchmark proxy")
                @server.list_tools()
                async def list_tools():
                    result = await upstream.list_tools()
                    return [t for t in result.tools if t.name in READ_TOOLS | set(item["allowed_drafts"])]
                @server.call_tool()
                async def call_tool(name, arguments):
                    return await forward_lab_call(upstream, item, name, arguments, session_id=os.environ[config["session_env"]], investigation_id=investigation_id, record=record)
                async with stdio_server() as (read, write):
                    await server.run(read, write, server.create_initialization_options())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--suite", required=True, choices=("synthetic", "lab"))
    ap.add_argument("--case", required=True)
    ap.add_argument("--trace", required=True, type=Path)
    ap.add_argument("--phase", default=0, type=int)
    ap.add_argument("--lab-config")
    args = ap.parse_args()
    item, record = get_case(args.case, args.phase), recorder(args.trace)
    if args.suite == "lab":
        asyncio.run(run_lab(item, args.lab_config, record))
    else:
        disable_network()
        from fixture_runtime import create_fixture_server
        session_id = os.environ.get("BENCH_SESSION_ID")
        if not session_id: raise SystemExit("The trusted benchmark launcher must supply a fixture session.")
        server, _, _ = create_fixture_server(item, session_id, record)
        server.run(transport="stdio")


if __name__ == "__main__": main()
