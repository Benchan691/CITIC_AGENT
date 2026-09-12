"""Compatibility import for callers using the original mail service name.

Legacy account storage remains available to Python callers; the authenticated
MCP runtime never loads it or exposes mailbox selection.
"""

from .zimbra.errors import _upstream_error
from .zimbra.mail.service import ZimbraMailService as ZimbraService

__all__ = ["ZimbraService"]
