"""Email-to-Splunk workflow boundary.

This package intentionally contains no AI extraction or automatic action
logic yet. It is the only place allowed to coordinate Zimbra Mail and
Splunk Search in a future workflow implementation.
"""

from .service import EmailToSplunkWorkflow

__all__ = ["EmailToSplunkWorkflow"]
