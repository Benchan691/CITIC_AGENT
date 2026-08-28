"""Admission policy for Splunk search workloads.

Result limits protect the MCP response.  This module protects the Splunk
workload itself by classifying a search before a job is dispatched.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import math
from typing import Any, Literal, Mapping

from unified_mcp_server.errors import ServiceError


CostClass = Literal["low", "medium", "high", "restricted"]
SearchWorkloadType = Literal["ad_hoc", "saved_search", "backtest", "system_internal"]

_COST_CLASSES = frozenset({"low", "medium", "high", "restricted"})
_WORKLOAD_TYPES = frozenset({"ad_hoc", "saved_search", "backtest", "system_internal"})
_EXPENSIVE_COMMANDS = frozenset(
    {
        "append",
        "appendcols",
        "eventstats",
        "join",
        "map",
        "multisearch",
        "streamstats",
        "transaction",
    }
)
_TABLE_COMMANDS = frozenset(
    {
        "chart",
        "geostats",
        "mstats",
        "pivot",
        "rare",
        "stats",
        "table",
        "timechart",
        "top",
        "tstats",
        "transpose",
        "untable",
        "xyseries",
    }
)
_INDEX_FREE_COMMANDS = frozenset({"inputlookup", "loadjob", "makeresults", "metadata"})


@dataclass(frozen=True)
class SearchResourceConfig:
    """Centralized workload-governance settings."""

    global_concurrency: int = 8
    per_principal_concurrency: int = 2
    queue_timeout_seconds: float = 5.0
    max_jobs_per_minute: int = 20
    budget_per_minute: int = 20
    max_runtime_low: int = 30
    max_runtime_medium: int = 60
    max_runtime_high: int = 120
    max_lookback_low: int = 86_400
    max_lookback_medium: int = 604_800
    max_lookback_high: int = 2_592_000
    max_results_low: int = 100
    max_results_medium: int = 500
    max_results_high: int = 1_000
    backtest_concurrency: int = 1
    restricted_decision: Literal["deny", "require_approval"] = "deny"

    def __post_init__(self) -> None:
        positive_ints = (
            "global_concurrency",
            "per_principal_concurrency",
            "max_jobs_per_minute",
            "budget_per_minute",
            "max_runtime_low",
            "max_runtime_medium",
            "max_runtime_high",
            "max_lookback_low",
            "max_lookback_medium",
            "max_lookback_high",
            "max_results_low",
            "max_results_medium",
            "max_results_high",
            "backtest_concurrency",
        )
        for name in positive_ints:
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                raise ValueError(f"{name} must be a positive integer")
        if isinstance(self.queue_timeout_seconds, bool) or not isinstance(
            self.queue_timeout_seconds, (int, float)
        ) or not math.isfinite(float(self.queue_timeout_seconds)) or self.queue_timeout_seconds < 0:
            raise ValueError("queue_timeout_seconds must be a non-negative number")
        if self.max_runtime_low > self.max_runtime_medium or self.max_runtime_medium > self.max_runtime_high:
            raise ValueError("runtime limits must increase from low to high")
        if self.max_lookback_low > self.max_lookback_medium or self.max_lookback_medium > self.max_lookback_high:
            raise ValueError("lookback limits must increase from low to high")
        if self.max_results_low > self.max_results_medium or self.max_results_medium > self.max_results_high:
            raise ValueError("result limits must increase from low to high")
        if self.restricted_decision not in {"deny", "require_approval"}:
            raise ValueError("restricted_decision must be deny or require_approval")

    def to_dict(self) -> dict[str, Any]:
        return {
            "global_concurrency": self.global_concurrency,
            "per_principal_concurrency": self.per_principal_concurrency,
            "queue_timeout_seconds": self.queue_timeout_seconds,
            "max_jobs_per_minute": self.max_jobs_per_minute,
            "budget_per_minute": self.budget_per_minute,
            "max_runtime_low": self.max_runtime_low,
            "max_runtime_medium": self.max_runtime_medium,
            "max_runtime_high": self.max_runtime_high,
            "max_lookback_low": self.max_lookback_low,
            "max_lookback_medium": self.max_lookback_medium,
            "max_lookback_high": self.max_lookback_high,
            "max_results_low": self.max_results_low,
            "max_results_medium": self.max_results_medium,
            "max_results_high": self.max_results_high,
            "backtest_concurrency": self.backtest_concurrency,
            "restricted_decision": self.restricted_decision,
        }


@dataclass
class SearchResourceProfile:
    indexes: list[str]
    wildcard_index: bool
    lookback_seconds: int | None
    commands: list[str]
    expensive_commands: list[str]
    has_subsearch: bool
    subsearch_depth: int
    requested_max_results: int
    cost_class: CostClass = "low"
    reasons: list[str] = field(default_factory=list)
    all_time: bool = False
    index_scope_unknown: bool = False
    aggregated: bool = False

    @classmethod
    def from_validation(
        cls,
        validation: Mapping[str, Any],
        requested_max_results: int,
    ) -> "SearchResourceProfile":
        policy = validation.get("policy", validation)
        if not isinstance(policy, Mapping):
            policy = {}

        def strings(name: str) -> list[str]:
            value = policy.get(name, [])
            if not isinstance(value, (list, tuple)):
                return []
            return list(dict.fromkeys(item.casefold().strip() for item in value if isinstance(item, str) and item.strip()))

        def nonnegative_int(name: str, default: int = 0) -> int:
            value = policy.get(name, default)
            if isinstance(value, bool):
                return default
            try:
                parsed = int(value)
            except (TypeError, ValueError):
                return default
            return max(0, parsed)

        commands = strings("commands")
        expensive = list(dict.fromkeys(command for command in strings("expensive_commands") if command in _EXPENSIVE_COMMANDS))
        for command in commands:
            if command in _EXPENSIVE_COMMANDS and command not in expensive:
                expensive.append(command)
        indexes = strings("detected_indexes")
        wildcard = policy.get("wildcard_indexes") is True
        all_time = policy.get("all_time") is True
        index_scope_unknown = policy.get("index_scope_unknown") is True
        if not indexes and not any(command in _INDEX_FREE_COMMANDS for command in commands):
            index_scope_unknown = True

        requested = requested_max_results
        if isinstance(requested, bool):
            requested = 1
        try:
            requested = max(1, int(requested))
        except (TypeError, ValueError):
            requested = 1

        lookback_value = policy.get("estimated_lookback_seconds")
        lookback: int | None = None
        if lookback_value is not None and not isinstance(lookback_value, bool):
            try:
                parsed_lookback = int(lookback_value)
            except (TypeError, ValueError):
                parsed_lookback = -1
            if parsed_lookback >= 0 and (
                not isinstance(lookback_value, float) or lookback_value.is_integer()
            ):
                lookback = parsed_lookback

        return cls(
            indexes=indexes,
            wildcard_index=wildcard,
            lookback_seconds=lookback,
            commands=commands,
            expensive_commands=expensive,
            has_subsearch=policy.get("has_subsearch") is True,
            subsearch_depth=nonnegative_int("subsearch_depth"),
            requested_max_results=requested,
            all_time=all_time,
            index_scope_unknown=index_scope_unknown,
            aggregated=any(command in _TABLE_COMMANDS for command in commands),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "indexes": list(self.indexes),
            "wildcard_index": self.wildcard_index,
            "lookback_seconds": self.lookback_seconds,
            "commands": list(self.commands),
            "expensive_commands": list(self.expensive_commands),
            "has_subsearch": self.has_subsearch,
            "subsearch_depth": self.subsearch_depth,
            "requested_max_results": self.requested_max_results,
            "cost_class": self.cost_class,
            "reasons": list(self.reasons),
            "all_time": self.all_time,
            "index_scope_unknown": self.index_scope_unknown,
            "aggregated": self.aggregated,
        }


@dataclass(frozen=True)
class ResourceAdmissionResult:
    allowed: bool
    cost_class: CostClass
    reasons: list[str]
    max_runtime_seconds: int
    max_results: int
    max_lookback_seconds: int | None
    concurrency_weight: int
    budget_cost: int
    workload_type: SearchWorkloadType
    error_code: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "allowed": self.allowed,
            "cost_class": self.cost_class,
            "reasons": list(self.reasons),
            "max_runtime_seconds": self.max_runtime_seconds,
            "max_results": self.max_results,
            "max_lookback_seconds": self.max_lookback_seconds,
            "concurrency_weight": self.concurrency_weight,
            "budget_cost": self.budget_cost,
            "workload_type": self.workload_type,
            "error_code": self.error_code,
        }


@dataclass(frozen=True)
class SearchResourceExecution:
    """Effective limits held for one admitted search lifecycle."""

    admission: ResourceAdmissionResult
    requested_max_results: int
    effective_max_results: int
    principal_id: str


class SearchResourcePolicy:
    """Classify and admit search work independently of result truncation."""

    def __init__(
        self,
        config: SearchResourceConfig | Mapping[str, Any] | None = None,
        *,
        job_timeout_seconds: int | float | None = None,
    ) -> None:
        if isinstance(config, Mapping):
            config = SearchResourceConfig(**config)
        self.config = config or SearchResourceConfig()
        self.job_timeout_seconds = self._positive_float(job_timeout_seconds)

    @staticmethod
    def _positive_float(value: Any) -> float | None:
        if value is None or isinstance(value, bool):
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        return parsed if math.isfinite(parsed) and parsed > 0 else None

    def profile(
        self,
        validation: Mapping[str, Any],
        requested_max_results: int,
    ) -> SearchResourceProfile:
        profile = SearchResourceProfile.from_validation(validation, requested_max_results)
        reasons: list[str] = []
        restricted = False

        def reason(text: str, *, deny: bool = False) -> None:
            nonlocal restricted
            if text not in reasons:
                reasons.append(text)
            restricted = restricted or deny

        if profile.all_time:
            reason("All-time searches are not permitted by the resource policy.", deny=True)
        elif profile.lookback_seconds is None:
            reason("The search lookback is unknown or cannot be safely bounded.", deny=True)
        elif profile.lookback_seconds > self.config.max_lookback_high:
            reason("The search lookback exceeds the high-cost resource limit.", deny=True)

        if profile.index_scope_unknown:
            reason("An explicit index scope is required for resource admission.", deny=True)
        if profile.wildcard_index:
            reason("Wildcard index scope increases search resource usage.")
        if profile.has_subsearch:
            reason("Subsearches increase search resource usage.")
        if profile.subsearch_depth >= 3:
            reason("Deeply nested subsearches are restricted.", deny=True)
        if profile.expensive_commands:
            reason(
                "Expensive SPL commands: " + ", ".join(profile.expensive_commands) + "."
            )

        lookback = profile.lookback_seconds
        high_lookback = lookback is not None and lookback > self.config.max_lookback_medium
        medium_lookback = lookback is not None and lookback > self.config.max_lookback_low

        if profile.wildcard_index and (high_lookback or profile.expensive_commands):
            reason("Wildcard index searches cannot combine with long lookback or expensive commands.", deny=True)
        if profile.expensive_commands and (high_lookback or profile.has_subsearch):
            reason("Expensive commands cannot combine with long lookback or subsearches.", deny=True)

        if restricted:
            cost_class: CostClass = "restricted"
        elif (
            high_lookback
            or profile.wildcard_index
            or profile.subsearch_depth >= 2
            or profile.requested_max_results > self.config.max_results_medium
        ):
            cost_class = "high"
        elif (
            medium_lookback
            or profile.has_subsearch
            or len(profile.indexes) > 1
            or bool(profile.expensive_commands)
            or profile.requested_max_results > self.config.max_results_low
        ):
            cost_class = "medium"
        else:
            cost_class = "low"

        # Raw event searches consume more Splunk/result handling capacity than
        # an equivalent aggregation over the same window.
        if not profile.aggregated and medium_lookback and cost_class == "medium":
            cost_class = "high"
            reason("Long raw-event searches receive the high-cost profile.")

        if not reasons:
            reasons.append(f"Search fits the {cost_class}-cost resource profile.")
        elif cost_class in {"medium", "high"}:
            reasons.append(f"Search is classified as {cost_class}-cost work.")
        profile.cost_class = cost_class
        profile.reasons = reasons
        return profile

    # ``profile`` is the canonical name; keep an analyzer-shaped alias for
    # internal callers that already use that vocabulary.
    analyze = profile

    def evaluate(
        self,
        profile: SearchResourceProfile,
        workload_type: SearchWorkloadType = "ad_hoc",
    ) -> ResourceAdmissionResult:
        if workload_type not in _WORKLOAD_TYPES:
            raise ValueError(f"unsupported search workload type: {workload_type}")

        cost_class = profile.cost_class
        reasons = list(profile.reasons)
        if workload_type == "backtest" and cost_class == "low":
            cost_class = "medium"
            reasons.append("Backtests use a dedicated heavier resource profile.")

        runtime_by_class = {
            "low": self.config.max_runtime_low,
            "medium": self.config.max_runtime_medium,
            "high": self.config.max_runtime_high,
            "restricted": self.config.max_runtime_high,
        }
        results_by_class = {
            "low": self.config.max_results_low,
            "medium": self.config.max_results_medium,
            "high": self.config.max_results_high,
            "restricted": self.config.max_results_high,
        }
        lookback_by_class = {
            "low": self.config.max_lookback_low,
            "medium": self.config.max_lookback_medium,
            "high": self.config.max_lookback_high,
            "restricted": self.config.max_lookback_high,
        }
        weight_by_class = {"low": 1, "medium": 2, "high": 4, "restricted": 4}
        budget_by_class = {"low": 1, "medium": 3, "high": 8, "restricted": 8}
        runtime = runtime_by_class[cost_class]
        if self.job_timeout_seconds is not None:
            runtime = max(1, min(runtime, int(self.job_timeout_seconds)))
        weight = min(weight_by_class[cost_class], self.config.global_concurrency)
        budget_cost = budget_by_class[cost_class]
        if workload_type == "backtest":
            weight = min(max(2, weight), self.config.global_concurrency)
            budget_cost *= 2

        allowed = cost_class != "restricted"
        error_code: str | None = None
        if profile.all_time or profile.lookback_seconds is None or (
            profile.lookback_seconds > self.config.max_lookback_high
        ):
            error_code = "lookback_limit_exceeded"
        elif not allowed:
            error_code = "resource_policy_denied"

        return ResourceAdmissionResult(
            allowed=allowed,
            cost_class=cost_class,
            reasons=list(dict.fromkeys(reasons)),
            max_runtime_seconds=runtime,
            max_results=results_by_class[cost_class],
            max_lookback_seconds=lookback_by_class[cost_class],
            concurrency_weight=weight,
            budget_cost=budget_cost,
            workload_type=workload_type,
            error_code=error_code,
        )

    def require_allowed(
        self,
        profile: SearchResourceProfile,
        admission: ResourceAdmissionResult,
    ) -> None:
        if admission.allowed:
            return
        details: dict[str, Any] = {
            "cost_class": admission.cost_class,
            "reasons": list(admission.reasons),
            "profile": profile.to_dict(),
            "admission": admission.to_dict(),
            "suggestion": "Specify an exact index, reduce the time range, or use an aggregated search.",
        }
        if admission.error_code == "lookback_limit_exceeded":
            details.update(
                {
                    "requested_seconds": profile.lookback_seconds,
                    "allowed_seconds": admission.max_lookback_seconds,
                }
            )
        if profile.all_time:
            details["requested_seconds"] = None
            details["allowed_seconds"] = admission.max_lookback_seconds
        if self.config.restricted_decision == "require_approval":
            details["approval_required"] = True
        code = admission.error_code or "resource_policy_denied"
        raise ServiceError(code, self._message(admission), details=details)

    @staticmethod
    def _message(admission: ResourceAdmissionResult) -> str:
        if admission.error_code == "lookback_limit_exceeded":
            return "The search time range exceeds the allowed Splunk resource lookback."
        return "The search workload is restricted by the Splunk resource policy."


__all__ = [
    "CostClass",
    "ResourceAdmissionResult",
    "SearchResourceConfig",
    "SearchResourceExecution",
    "SearchResourcePolicy",
    "SearchResourceProfile",
    "SearchWorkloadType",
]
