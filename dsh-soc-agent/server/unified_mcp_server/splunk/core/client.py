"""Canonical Core import for the low-level Splunk REST client.

The legacy module remains as a compatibility import path.
"""

from ..splunk_client import SplunkAPIError, SplunkClient

__all__ = ["SplunkAPIError", "SplunkClient"]
