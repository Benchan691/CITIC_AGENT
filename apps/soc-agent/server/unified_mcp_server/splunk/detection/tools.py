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
    @server.tool()
    async def splunk_get_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Retrieve one saved search with alert timing, trigger, throttle, and action fields; secret-like fields are omitted."""
        return await execute(ctx, "splunk", "get_detection", lambda: get_runtime(ctx).splunk_detection.get_detection(name))

    @server.tool()
    async def splunk_validate_detection(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Validate SPL safety plus saved-search timing, trigger, throttle, expiry, and action settings."""
        try:
            current = await fresh_runtime(ctx)
            return success("splunk", "validate_detection", current.splunk_detection.validate_detection(detection))
        except service_error as exc:
            return failure("splunk", "validate_detection", exc.code, exc.message, details=exc.details)

    @server.tool()
    async def splunk_backtest_detection(ctx: Context, detection: dict[str, Any], earliest_time: str = "-7d", latest_time: str = "now", max_count: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        """Run a bounded read-only detection sample with optional field projection."""
        return await execute(ctx, "splunk", "backtest_detection", lambda: get_runtime(ctx).splunk_detection.backtest_detection(detection, earliest_time, latest_time, max_count, fields, principal_id=_principal_id(get_runtime, ctx)))

    @server.tool()
    async def splunk_create_detection_draft(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Propose an exact disabled detection and alert configuration; approval is required before applying it."""
        return await execute(ctx, "splunk", "create_detection_draft", lambda: get_runtime(ctx).splunk_detection.create_detection_draft(detection, actor_id=_authenticated_actor(get_runtime, ctx)))

    @server.tool()
    async def splunk_update_detection_draft(ctx: Context, name: str, detection: dict[str, Any], expected_fingerprint: str) -> dict[str, Any]:
        """Propose an exact disabled detection and alert-configuration update; omitted fields stay unchanged."""
        return await execute(ctx, "splunk", "update_detection_draft", lambda: get_runtime(ctx).splunk_detection.update_detection_draft(name, detection, expected_fingerprint, actor_id=_authenticated_actor(get_runtime, ctx)))

    @server.tool()
    async def splunk_enable_detection(ctx: Context, name: str, expected_fingerprint: str) -> dict[str, Any]:
        """Propose enabling one exact scheduled or real-time detection after its alert action is configured."""
        return await execute(ctx, "splunk", "enable_detection", lambda: get_runtime(ctx).splunk_detection.set_detection_enabled(name, True, expected_fingerprint, actor_id=_authenticated_actor(get_runtime, ctx)))

    @server.tool()
    async def splunk_disable_detection(ctx: Context, name: str, expected_fingerprint: str) -> dict[str, Any]:
        """Propose disabling one exact detection; approval is required before it can be applied."""
        return await execute(ctx, "splunk", "disable_detection", lambda: get_runtime(ctx).splunk_detection.set_detection_enabled(name, False, expected_fingerprint, actor_id=_authenticated_actor(get_runtime, ctx)))

    @server.tool()
    async def splunk_approve_detection_change(ctx: Context, proposal_id: str, proposal_hash: str = "") -> dict[str, Any]:
        """Approve one immutable detection proposal by its exact stored hash."""
        return await execute(ctx, "splunk", "approve_detection_change", lambda: get_runtime(ctx).splunk_detection.approve_detection_change(proposal_id, proposal_hash, actor_id=_authenticated_actor(get_runtime, ctx)))

    @server.tool()
    async def splunk_apply_approved_detection_change(ctx: Context, approval_id: str) -> dict[str, Any]:
        """Apply one unexpired, single-use detection approval; no replacement payload is accepted."""
        return await execute(ctx, "splunk", "apply_approved_detection_change", lambda: get_runtime(ctx).splunk_detection.apply_approved_detection_change(approval_id, actor_id=_authenticated_actor(get_runtime, ctx)))
