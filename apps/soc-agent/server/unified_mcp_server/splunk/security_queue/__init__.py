"""Read-only standard Splunk fired-alert finding queue support."""

__all__ = ["SplunkSecurityQueueService"]


def __getattr__(name: str):
    if name == "SplunkSecurityQueueService":
        from .service import SplunkSecurityQueueService

        return SplunkSecurityQueueService
    raise AttributeError(name)
