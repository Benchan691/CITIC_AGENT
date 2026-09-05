"""MCP registrations for Splunk Search and lookup tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context
from unified_mcp_server.errors import ServiceError

from .planner import SearchIntent

def _principal_id(get_runtime, ctx: Context) -> str:
    identity = getattr(get_runtime(ctx), "identity", None)
    principal = getattr(identity, "user_id", "") or getattr(identity, "zimbra_email", "")
    return principal.strip() if isinstance(principal, str) and principal.strip() else "anonymous"


def _authenticated_actor(get_runtime, ctx: Context) -> str:
    identity = getattr(get_runtime(ctx), "identity", None)
    actor = getattr(identity, "user_id", "") or getattr(identity, "zimbra_email", "")
    if not isinstance(actor, str) or not actor.strip():
        raise ServiceError("not_authorized", "An authenticated SOC user is required for lookup CSV changes.")
    return actor.strip()


def register_tools(server, *, get_runtime, fresh_runtime, execute, success, failure, service_error) -> None:
    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_validate_query(ctx: Context, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        """Analyze SPL scope and safety locally without executing it."""
        try:
            data = (await fresh_runtime(ctx)).splunk_search.validate(query, earliest_time, latest_time)
            return success("splunk", "validate_query", data)
        except service_error as exc:
            return failure("splunk", "validate_query", exc.code, exc.message, details=exc.details)

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_search(ctx: Context, query: str, earliest_time: str = "-24h", latest_time: str = "now", max_count: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        """Execute a guarded read-only Splunk search. Use an exact index and narrow time range; use stats, tstats, chart, or similar aggregation for statistical questions, then sort/head as appropriate. Keep raw-event samples small, and never treat returned_count as total matches; inspect truncation metadata before volume or absence conclusions."""
        return await execute(ctx, "splunk", "search", lambda: get_runtime(ctx).splunk_search.search(query, earliest_time, latest_time, max_count, fields, principal_id=_principal_id(get_runtime, ctx)))

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_list_saved_searches(ctx: Context, name: str = "", app: str = "", limit: int = 50, include_spl: bool = False) -> dict[str, Any]:
        """Find bounded saved-search summaries; request SPL only when it is needed."""
        return await execute(ctx, "splunk", "list_saved_searches", lambda: get_runtime(ctx).splunk_search.list_saved_searches(name, app, limit, include_spl))

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_find_lookup(ctx: Context, name: str) -> dict[str, Any]:
        """Find a visible Splunk lookup-table file by exact name."""
        return await execute(ctx, "splunk", "find_lookup", lambda: get_runtime(ctx).splunk_search.find_lookup(name))

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_list_lookups(ctx: Context, app: str = "", name: str = "", limit: int = 50) -> dict[str, Any]:
        """List visible Splunk lookup-table files with optional app and name filters."""
        return await execute(ctx, "splunk", "list_lookups", lambda: get_runtime(ctx).splunk_search.list_lookups(app, name, limit))

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_get_lookup(ctx: Context, name: str) -> dict[str, Any]:
        """Read one visible persistent CSV lookup, including canonical CSV text and a concurrency fingerprint."""
        return await execute(ctx, "splunk", "get_lookup", lambda: get_runtime(ctx).splunk_search.get_lookup(name))

    @server.tool()
    async def splunk_write_lookup(ctx: Context, name: str, content: str) -> dict[str, Any]:
        """Prepare an editable new persistent CSV lookup draft without writing it; the authenticated editor Save performs the approved write."""
        return await execute(
            ctx,
            "splunk",
            "write_lookup",
            lambda: get_runtime(ctx).splunk_search.write_lookup(
                name,
                content,
                actor_id=_authenticated_actor(get_runtime, ctx),
            ),
        )

    @server.tool()
    async def splunk_update_lookup(
        ctx: Context,
        name: str,
        content: str,
        expected_fingerprint: str,
    ) -> dict[str, Any]:
        """Prepare an editable fingerprint-bound persistent CSV lookup draft without writing it; the authenticated editor Save performs the approved replacement."""
        return await execute(
            ctx,
            "splunk",
            "update_lookup",
            lambda: get_runtime(ctx).splunk_search.update_lookup(
                name,
                content,
                expected_fingerprint,
                actor_id=_authenticated_actor(get_runtime, ctx),
            ),
        )

    @server.tool()
    async def splunk_delete_lookup(
        ctx: Context,
        name: str,
        expected_fingerprint: str,
    ) -> dict[str, Any]:
        """Prepare a fingerprint-bound persistent CSV lookup deletion draft without deleting it; the authenticated editor Delete action performs the approved deletion."""
        return await execute(
            ctx,
            "splunk",
            "delete_lookup",
            lambda: get_runtime(ctx).splunk_search.delete_lookup(
                name,
                expected_fingerprint,
                actor_id=_authenticated_actor(get_runtime, ctx),
            ),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_run_saved_search(ctx: Context, name: str, max_count: int = 50, app: str = "", owner: str = "") -> dict[str, Any]:
        """Run a scoped saved search with actions disabled and bounded results."""
        return await execute(ctx, "splunk", "run_saved_search", lambda: get_runtime(ctx).splunk_search.run_saved_search(name, max_count, app, owner, principal_id=_principal_id(get_runtime, ctx)))

    @server.tool(annotations={"readOnlyHint": True})
    async def soc_evidence_read(ctx: Context, evidence_id: str, offset: int = 0, limit: int = 50) -> dict[str, Any]:
        """Page through a retained search snapshot by evidence ID without re-running the search; snapshots are timestamped and evicted oldest-first."""
        return await execute(ctx, "splunk", "evidence_read", lambda: get_runtime(ctx).splunk_search.read_evidence(evidence_id, offset=offset, limit=limit))

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_plan_search(
        ctx: Context,
        objective: str,
        entity_type: str = "",
        entity: str = "",
        customer: str = "",
        event_type: str = "",
        earliest_time: str = "-24h",
        latest_time: str = "now",
        preferred_index: str = "",
        preferred_sourcetype: str = "",
        requested_fields: list[str] | None = None,
        max_count: int = 50,
    ) -> dict[str, Any]:
        """Plan one deterministic, scoped SPL search from an objective without executing it; disabled until SPLUNK_SEARCH_PLANNER_ENABLED=true and the schema mappings are verified."""
        try:
            intent = SearchIntent(
                objective=objective,
                entity_type=entity_type or None,
                entity=entity or None,
                customer=customer or None,
                event_type=event_type or None,
                earliest_time=earliest_time,
                latest_time=latest_time,
                preferred_index=preferred_index or None,
                preferred_sourcetype=preferred_sourcetype or None,
                requested_fields=list(requested_fields or []),
                max_count=max_count,
            )
        except ValueError as exc:
            from unified_mcp_server.errors import ServiceError

            raise ServiceError("invalid_input", str(exc)) from exc

        async def plan() -> dict[str, Any]:
            return get_runtime(ctx).splunk_search.plan_search(intent)

        return await execute(ctx, "splunk", "plan_search", plan)
