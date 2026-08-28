"""Read-only Splunk Search capability.

The service export is lazy so configuration can import the resource-policy
types without importing the service/core cycle during startup.
"""

__all__ = [
    "SearchIntent",
    "SearchPlan",
    "SearchPlanner",
    "SearchSchema",
    "SearchSchemaRegistry",
    "SearchResultVerifier",
    "SplunkSearchService",
]


def __getattr__(name: str):
    if name == "SplunkSearchService":
        from .service import SplunkSearchService

        return SplunkSearchService
    if name in {"SearchIntent", "SearchPlan", "SearchPlanner"}:
        from .planner import SearchIntent, SearchPlan, SearchPlanner

        return {"SearchIntent": SearchIntent, "SearchPlan": SearchPlan, "SearchPlanner": SearchPlanner}[name]
    if name in {"SearchSchema", "SearchSchemaRegistry"}:
        from .schema_registry import SearchSchema, SearchSchemaRegistry

        return {"SearchSchema": SearchSchema, "SearchSchemaRegistry": SearchSchemaRegistry}[name]
    if name == "SearchResultVerifier":
        from .verifier import SearchResultVerifier

        return SearchResultVerifier
    raise AttributeError(name)
