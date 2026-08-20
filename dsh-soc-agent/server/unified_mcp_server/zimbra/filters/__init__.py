"""Zimbra incoming email-filter capability."""

from .model import EmailFilter, FilterAction, FilterTest
from .service import ZimbraFilterService

__all__ = ["EmailFilter", "FilterAction", "FilterTest", "ZimbraFilterService"]
