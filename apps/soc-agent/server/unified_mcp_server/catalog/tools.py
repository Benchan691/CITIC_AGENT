"""MCP registrations for SOC catalog tools.

Read tools surface the PostgreSQL catalogs. Write tools only prepare draft
envelopes — persistence happens through the authenticated editor Save (host
RPC -> auth_cli), and publication to Splunk is a separate operator action.
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context
from unified_mcp_server.errors import ServiceError


def _authenticated_actor(get_runtime, ctx: Context) -> str:
    identity = getattr(get_runtime(ctx), "identity", None)
    actor = getattr(identity, "user_id", "") or getattr(identity, "zimbra_email", "")
    if not isinstance(actor, str) or not actor.strip():
        raise ServiceError("not_authorized", "An authenticated SOC user is required for catalog changes.")
    return actor.strip()


def _catalog_service(get_runtime, ctx: Context):
    service = getattr(get_runtime(ctx), "catalog", None)
    if service is None:
        raise ServiceError(
            "not_configured",
            "Catalog storage requires PostgreSQL. Configure APP_POSTGRES_URI first.",
        )
    return service


def register_tools(server, *, get_runtime, fresh_runtime, execute, success, failure, service_error) -> None:
    @server.tool(annotations={"readOnlyHint": True})
    async def catalog_list_rules(
        ctx: Context,
        search: str = "",
        limit: int = 50,
        offset: int = 0,
        include_archived: bool = False,
    ) -> dict[str, Any]:
        """Search the Ruleset catalog by rule number, name, or description; read-only."""
        return await execute(
            ctx,
            "catalog",
            "list_rules",
            lambda: _catalog_service(get_runtime, ctx).list_records(
                "rule", search=search, limit=limit, offset=offset, include_archived=include_archived
            ),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def catalog_get_rule(ctx: Context, rule_id: str) -> dict[str, Any]:
        """Retrieve one Ruleset record with its revision; read-only."""
        return await execute(
            ctx,
            "catalog",
            "get_rule",
            lambda: _catalog_service(get_runtime, ctx).get_record("rule", rule_id),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def catalog_list_customers(
        ctx: Context,
        search: str = "",
        limit: int = 50,
        offset: int = 0,
        include_archived: bool = False,
    ) -> dict[str, Any]:
        """Search the Customer Information catalog by code, name, tenant, or GID; read-only."""
        return await execute(
            ctx,
            "catalog",
            "list_customers",
            lambda: _catalog_service(get_runtime, ctx).list_records(
                "customer", search=search, limit=limit, offset=offset, include_archived=include_archived
            ),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def catalog_get_customer(ctx: Context, customer_id: str) -> dict[str, Any]:
        """Retrieve one Customer Information record with its revision; read-only."""
        return await execute(
            ctx,
            "catalog",
            "get_customer",
            lambda: _catalog_service(get_runtime, ctx).get_record("customer", customer_id),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def catalog_list_fix_source_types(
        ctx: Context,
        search: str = "",
        limit: int = 50,
        offset: int = 0,
        include_archived: bool = False,
    ) -> dict[str, Any]:
        """Search the Fix Source type catalog by system name, value, or Fix_Index; read-only."""
        return await execute(
            ctx,
            "catalog",
            "list_fix_source_types",
            lambda: _catalog_service(get_runtime, ctx).list_records(
                "fix_source_type", search=search, limit=limit, offset=offset, include_archived=include_archived
            ),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def catalog_get_fix_source_type(ctx: Context, source_type_id: str) -> dict[str, Any]:
        """Retrieve one Fix Source type record with its revision; read-only."""
        return await execute(
            ctx,
            "catalog",
            "get_fix_source_type",
            lambda: _catalog_service(get_runtime, ctx).get_record("fix_source_type", source_type_id),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def catalog_get_record_history(
        ctx: Context,
        catalog: str,
        record_id: str,
        limit: int = 100,
    ) -> dict[str, Any]:
        """List the audit history (actor, timestamp, reason, before/after) for one catalog record; read-only."""
        return await execute(
            ctx,
            "catalog",
            "get_record_history",
            lambda: _catalog_service(get_runtime, ctx).record_history(catalog, record_id, limit=limit),
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def catalog_preview_publication(ctx: Context, catalog: str) -> dict[str, Any]:
        """Generate the lookup snapshot and validation report for a catalog without publishing; read-only."""
        return await execute(
            ctx,
            "catalog",
            "preview_publication",
            lambda: _catalog_service(get_runtime, ctx).preview_publication(catalog),
        )

    @server.tool()
    async def catalog_write_rule(ctx: Context, rule: dict[str, Any]) -> dict[str, Any]:
        """Prepare an editable new Ruleset draft without writing; the editor Save persists it to PostgreSQL."""
        return await execute(
            ctx,
            "catalog",
            "write_rule",
            lambda: _catalog_service(get_runtime, ctx).prepare_create("rule", rule),
        )

    @server.tool()
    async def catalog_update_rule(
        ctx: Context,
        rule_id: str,
        rule: dict[str, Any],
        expected_revision: int,
    ) -> dict[str, Any]:
        """Prepare a revision-bound Ruleset edit draft without writing; the editor Save rejects stale revisions."""
        return await execute(
            ctx,
            "catalog",
            "update_rule",
            lambda: _catalog_service(get_runtime, ctx).prepare_update("rule", rule_id, rule, expected_revision),
        )

    @server.tool()
    async def catalog_write_customer(ctx: Context, customer: dict[str, Any]) -> dict[str, Any]:
        """Prepare an editable new Customer Information draft without writing; the editor Save persists it."""
        return await execute(
            ctx,
            "catalog",
            "write_customer",
            lambda: _catalog_service(get_runtime, ctx).prepare_create("customer", customer),
        )

    @server.tool()
    async def catalog_update_customer(
        ctx: Context,
        customer_id: str,
        customer: dict[str, Any],
        expected_revision: int,
    ) -> dict[str, Any]:
        """Prepare a revision-bound Customer Information edit draft without writing."""
        return await execute(
            ctx,
            "catalog",
            "update_customer",
            lambda: _catalog_service(get_runtime, ctx).prepare_update(
                "customer", customer_id, customer, expected_revision
            ),
        )

    @server.tool()
    async def catalog_write_fix_source_type(ctx: Context, fix_source_type: dict[str, Any]) -> dict[str, Any]:
        """Prepare an editable new Fix Source type draft without writing; the editor Save persists it."""
        return await execute(
            ctx,
            "catalog",
            "write_fix_source_type",
            lambda: _catalog_service(get_runtime, ctx).prepare_create("fix_source_type", fix_source_type),
        )

    @server.tool()
    async def catalog_update_fix_source_type(
        ctx: Context,
        source_type_id: str,
        fix_source_type: dict[str, Any],
        expected_revision: int,
    ) -> dict[str, Any]:
        """Prepare a revision-bound Fix Source type edit draft without writing."""
        return await execute(
            ctx,
            "catalog",
            "update_fix_source_type",
            lambda: _catalog_service(get_runtime, ctx).prepare_update(
                "fix_source_type", source_type_id, fix_source_type, expected_revision
            ),
        )

    @server.tool()
    async def catalog_archive_record(
        ctx: Context,
        catalog: str,
        record_id: str,
        expected_revision: int,
        restore: bool = False,
        reason: str = "",
    ) -> dict[str, Any]:
        """Archive (or restore) one catalog record under the authenticated identity; referenced customers are refused."""
        return await execute(
            ctx,
            "catalog",
            "archive_record",
            lambda: _catalog_service(get_runtime, ctx).set_record_archived(
                catalog,
                record_id,
                archived=not restore,
                expected_revision=expected_revision,
                actor_id=_authenticated_actor(get_runtime, ctx),
                reason=reason,
            ),
        )
