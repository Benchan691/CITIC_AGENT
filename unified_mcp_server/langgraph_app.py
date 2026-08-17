"""LangGraph Agent Server entry point for the official Deep Agents UI."""

import asyncio

from unified_mcp_server.deep_agent import create_agent


def _build_agent():
    """Build the compiled Deep Agent during LangGraph graph discovery."""
    return asyncio.run(create_agent())[0]


agent = _build_agent()
