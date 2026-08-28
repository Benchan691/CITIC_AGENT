"""Read-only Splunk Search capability.

The service export is lazy so configuration can import the resource-policy
types without importing the service/core cycle during startup.
"""

__all__ = ["SplunkSearchService"]


def __getattr__(name: str):
    if name == "SplunkSearchService":
        from .service import SplunkSearchService

        return SplunkSearchService
    raise AttributeError(name)
