"""MCP registrations for Splunk Detection tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context


def register_tools(server, *, get_runtime, fresh_runtime, execute, success, failure, service_error) -> None:
    @server.tool()
    async def splunk_get_detection(ctx: Context, name: str) -> dict[str, Any]:
        """Retrieve one saved search as a detection-review record without running it."""
        return await execute(ctx, "splunk", "get_detection", lambda: get_runtime(ctx).splunk_detection.get_detection(name))

    @server.tool()
    async def splunk_validate_detection(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Validate a detection draft locally, including SPL safety and schedule metadata."""
        try:
            current = await fresh_runtime(ctx)
            return success("splunk", "validate_detection", current.splunk_detection.validate_detection(detection))
        except service_error as exc:
            return failure("splunk", "validate_detection", exc.code, exc.message, details=exc.details)

    @server.tool()
    async def splunk_backtest_detection(ctx: Context, detection: dict[str, Any], earliest_time: str = "-7d", latest_time: str = "now", max_count: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        """Run a bounded read-only detection sample with optional field projection."""
        return await execute(ctx, "splunk", "backtest_detection", lambda: get_runtime(ctx).splunk_detection.backtest_detection(detection, earliest_time, latest_time, max_count, fields))

    @server.tool()
    async def splunk_create_detection_draft(ctx: Context, detection: dict[str, Any]) -> dict[str, Any]:
        """Create a disabled saved-search draft; requires explicit detection write configuration."""
        return await execute(ctx, "splunk", "create_detection_draft", lambda: get_runtime(ctx).splunk_detection.create_detection_draft(detection))

    @server.tool()
    async def splunk_update_detection_draft(ctx: Context, name: str, detection: dict[str, Any], expected_fingerprint: str) -> dict[str, Any]:
        """Update a disabled detection without overwriting its Splunk alert actions."""
        return await execute(ctx, "splunk", "update_detection_draft", lambda: get_runtime(ctx).splunk_detection.update_detection_draft(name, detection, expected_fingerprint))

    @server.tool()
    async def splunk_enable_detection(ctx: Context, name: str, expected_fingerprint: str) -> dict[str, Any]:
        """Enable a scheduled detection with configured actions and a fresh fingerprint."""
        return await execute(ctx, "splunk", "enable_detection", lambda: get_runtime(ctx).splunk_detection.set_detection_enabled(name, True, expected_fingerprint))

    @server.tool()
    async def splunk_disable_detection(ctx: Context, name: str, expected_fingerprint: str) -> dict[str, Any]:
        """Disable a detection with a fresh fingerprint, providing a reversible rollback."""
        return await execute(ctx, "splunk", "disable_detection", lambda: get_runtime(ctx).splunk_detection.set_detection_enabled(name, False, expected_fingerprint))
