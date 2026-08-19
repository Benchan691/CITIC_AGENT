"""MCP registrations for Splunk Detection tools."""

from __future__ import annotations

from typing import Any


def register_tools(server, *, get_runtime, fresh_runtime, execute, success, failure, service_error) -> None:
    @server.tool()
    async def splunk_get_detection(ctx, name: str) -> dict[str, Any]:
        """Retrieve one saved search as a detection-review record without running it."""
        return await execute(ctx, "splunk", "get_detection", lambda: get_runtime(ctx).splunk_detection.get_detection(name))

    @server.tool()
    async def splunk_validate_detection(ctx, detection: dict[str, Any]) -> dict[str, Any]:
        """Validate a detection draft locally, including SPL safety and schedule metadata."""
        try:
            current = await fresh_runtime(ctx)
            return success("splunk", "validate_detection", current.splunk_detection.validate_detection(detection))
        except service_error as exc:
            return failure("splunk", "validate_detection", exc.code, exc.message, details=exc.details)

    @server.tool()
    async def splunk_backtest_detection(ctx, detection: dict[str, Any], earliest_time: str = "-7d", latest_time: str = "now", max_count: int = 100) -> dict[str, Any]:
        """Run a bounded, read-only historical sample of a validated detection."""
        return await execute(ctx, "splunk", "backtest_detection", lambda: get_runtime(ctx).splunk_detection.backtest_detection(detection, earliest_time, latest_time, max_count))

    @server.tool()
    async def splunk_create_detection_draft(ctx, detection: dict[str, Any]) -> dict[str, Any]:
        """Create a disabled saved-search draft; requires explicit detection write configuration."""
        return await execute(ctx, "splunk", "create_detection_draft", lambda: get_runtime(ctx).splunk_detection.create_detection_draft(detection))

    @server.tool()
    async def splunk_update_detection_draft(ctx, name: str, detection: dict[str, Any]) -> dict[str, Any]:
        """Update a disabled detection draft after re-validating its complete definition."""
        return await execute(ctx, "splunk", "update_detection_draft", lambda: get_runtime(ctx).splunk_detection.update_detection_draft(name, detection))

    @server.tool()
    async def splunk_enable_detection(ctx, name: str) -> dict[str, Any]:
        """Enable a reviewed detection through a separate approval-gated operation."""
        return await execute(ctx, "splunk", "enable_detection", lambda: get_runtime(ctx).splunk_detection.set_detection_enabled(name, True))

    @server.tool()
    async def splunk_disable_detection(ctx, name: str) -> dict[str, Any]:
        """Disable a detection without deleting it, providing a reversible rollback."""
        return await execute(ctx, "splunk", "disable_detection", lambda: get_runtime(ctx).splunk_detection.set_detection_enabled(name, False))
