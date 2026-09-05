"""MCP registrations for Splunk Detection tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context
from unified_mcp_server.errors import ServiceError


def _authenticated_actor(get_runtime, ctx: Context) -> str:
    identity = getattr(get_runtime(ctx), "identity", None)
    actor = getattr(identity, "user_id", "") or getattr(identity, "zimbra_email", "")
    if not isinstance(actor, str) or not actor.strip():
        raise ServiceError("not_authorized", "An authenticated SOC user is required for detection changes.")
    return actor.strip()


def _principal_id(get_runtime, ctx: Context) -> str:
    identity = getattr(get_runtime(ctx), "identity", None)
    principal = getattr(identity, "user_id", "") or getattr(identity, "zimbra_email", "")
    return principal.strip() if isinstance(principal, str) and principal.strip() else "anonymous"


def register_tools(server, *, get_runtime, fresh_runtime, execute, success, failure, service_error) -> None:
    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_get_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Retrieve one saved search with alert timing, trigger, throttle, and action fields; secret-like fields are omitted."""
        return await execute(ctx, "splunk", "get_detection", lambda: get_runtime(ctx).splunk_detection.get_detection(name))

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_validate_detection(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Validate a CITIC production saved-search definition; outputcsv is definition-only and is never executed here."""
        async def validate():
            return get_runtime(ctx).splunk_detection.validate_detection(detection)
        return await execute(ctx, "splunk", "validate_detection", validate)

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_compile_citic_detection(
        ctx: Context,
        detection_logic: str,
        rulename: str,
        threat_name: str,
        threat_type: str,
        case_prefix: str,
        event_field_mappings: dict[str, str],
        extra_table_fields: list[str] | None = None,
    ) -> dict[str, Any]:
        """Compile base detection SPL into one CITIC production SPL and one safe backtest SPL without writing or executing either."""
        async def compile_definition() -> dict[str, Any]:
            return get_runtime(ctx).splunk_detection.compile_citic_detection(
                detection_logic=detection_logic,
                rulename=rulename,
                threat_name=threat_name,
                threat_type=threat_type,
                case_prefix=case_prefix,
                event_field_mappings=event_field_mappings,
                extra_table_fields=extra_table_fields,
            )

        return await execute(
            ctx,
            "splunk",
            "compile_citic_detection",
            compile_definition,
        )

    @server.tool(annotations={"readOnlyHint": True})
    async def splunk_backtest_detection(ctx: Context, detection: dict[str, Any], earliest_time: str = "-7d", latest_time: str = "now", max_count: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        """Run a bounded read-only detection sample; outputcsv and other writes are rejected."""
        return await execute(ctx, "splunk", "backtest_detection", lambda: get_runtime(ctx).splunk_detection.backtest_detection(detection, earliest_time, latest_time, max_count, fields, principal_id=_principal_id(get_runtime, ctx)))

    @server.tool()
    async def splunk_write_detection(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Prepare an editable new detection draft without writing; the editor Save keeps it disabled and never executes outputcsv."""
        return await execute(ctx, "splunk", "write_detection", lambda: get_runtime(ctx).splunk_detection.write_detection(detection, actor_id=_authenticated_actor(get_runtime, ctx)))

    @server.tool()
    async def splunk_update_detection(ctx: Context, name: str, detection: dict[str, Any], expected_fingerprint: str) -> dict[str, Any]:
        """Prepare an editable fingerprint-bound detection draft without writing; the editor Save preserves omitted fields, keeps it disabled, and never executes outputcsv."""
        return await execute(ctx, "splunk", "update_detection", lambda: get_runtime(ctx).splunk_detection.update_detection(name, detection, expected_fingerprint, actor_id=_authenticated_actor(get_runtime, ctx)))
