"""Async capacity, dispatch-rate, and weighted budget management for searches."""

from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
import logging
from time import monotonic
from typing import Any

from unified_mcp_server.errors import ServiceError
from unified_mcp_server.request_context import operation_context

from .resource_policy import CostClass, SearchResourceConfig, SearchWorkloadType


logger = logging.getLogger(__name__)
_WINDOW_SECONDS = 60.0


@dataclass(frozen=True)
class ResourceLease:
    principal_id: str
    cost_class: CostClass
    weight: int
    budget_cost: int
    workload_type: SearchWorkloadType
    queue_wait_seconds: float


class SearchResourceManager:
    """Own all mutable search capacity state for one Splunk instance."""

    def __init__(
        self,
        config: SearchResourceConfig | None = None,
        *,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self.config = config or SearchResourceConfig()
        self._clock = clock
        self._condition = asyncio.Condition()
        self._active_weight = 0
        self._active_jobs = 0
        self._active_by_principal: dict[str, int] = defaultdict(int)
        self._active_backtests = 0
        self._queued_jobs = 0
        self._waiters: list[tuple] = []
        self._dispatch_history: dict[str, deque[tuple[float, int]]] = defaultdict(deque)
        self._metrics: dict[str, Any] = {
            "active_splunk_searches": 0,
            "queued_splunk_searches": 0,
            "search_resource_rejections_total": 0,
            "search_resource_queue_timeout_total": 0,
            "search_runtime_limit_total": 0,
            "searches_admitted_total": 0,
            "searches_released_total": 0,
            "searches_by_cost_class": defaultdict(int),
            "queue_wait_seconds_total": 0.0,
            "execution_seconds_total": 0.0,
        }

    @staticmethod
    def _principal(value: Any) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()[:512]
        return "anonymous"

    def _prune(self, principal: str, now: float) -> deque[tuple[float, int]]:
        history = self._dispatch_history[principal]
        cutoff = now - _WINDOW_SECONDS
        while history and history[0][0] <= cutoff:
            history.popleft()
        return history

    def _capacity_available(self, principal: str, weight: int, workload_type: SearchWorkloadType) -> bool:
        return (
            self._active_weight + weight <= self.config.global_concurrency
            and self._active_by_principal[principal] < self.config.per_principal_concurrency
            and (
                workload_type != "backtest"
                or self._active_backtests < self.config.backtest_concurrency
            )
        )

    def _limit_error(
        self,
        principal: str,
        budget_cost: int,
        now: float,
    ) -> ServiceError | None:
        history = self._prune(principal, now)
        if len(history) >= self.config.max_jobs_per_minute:
            return ServiceError(
                "rate_limit_exceeded",
                "The search dispatch rate for this principal is limited. Wait before starting another search.",
                retryable=True,
                details={
                    "limit": self.config.max_jobs_per_minute,
                    "window_seconds": int(_WINDOW_SECONDS),
                },
            )
        used_budget = sum(cost for _, cost in history)
        if used_budget + budget_cost > self.config.budget_per_minute:
            return ServiceError(
                "query_budget_exceeded",
                "The search query budget for this principal is exhausted for the current window.",
                retryable=True,
                details={
                    "budget_per_minute": self.config.budget_per_minute,
                    "used_budget": used_budget,
                    "requested_cost": budget_cost,
                    "window_seconds": int(_WINDOW_SECONDS),
                },
            )
        return None

    def record_rejection(self, code: str, cost_class: str | None = None) -> None:
        """Record a policy rejection without retaining query contents."""
        self._metrics["search_resource_rejections_total"] += 1
        logger.info(
            "splunk search resource rejected",
            extra={"code": code, "cost_class": cost_class or "unknown"},
        )

    def record_runtime_limit(self) -> None:
        self._metrics["search_runtime_limit_total"] += 1

    def snapshot(self) -> dict[str, Any]:
        metrics = dict(self._metrics)
        metrics["searches_by_cost_class"] = dict(metrics["searches_by_cost_class"])
        return {
            **metrics,
            "active_weight": self._active_weight,
            "active_by_principal": dict(self._active_by_principal),
            "active_backtests": self._active_backtests,
        }

    @asynccontextmanager
    async def acquire(
        self,
        principal: str,
        cost_class: CostClass,
        weight: int = 1,
        budget_cost: int = 1,
        workload_type: SearchWorkloadType = "ad_hoc",
    ) -> AsyncIterator[ResourceLease]:
        """Wait briefly for capacity, then reserve it until the job ends."""
        principal_id = self._principal(principal)
        weight = max(1, min(int(weight), self.config.global_concurrency))
        budget_cost = max(1, int(budget_cost))
        if workload_type not in {"ad_hoc", "saved_search", "backtest", "system_internal"}:
            raise ValueError(f"unsupported search workload type: {workload_type}")

        wait_started = self._clock()
        loop = asyncio.get_running_loop()
        loop_deadline = loop.time() + float(self.config.queue_timeout_seconds)
        queued = False
        reserved = False
        priority = 1 if operation_context.get().workload == "scheduled" else 0
        waiter = (object(), priority, principal_id, weight, workload_type)
        lease: ResourceLease | None = None
        try:
            async with self._condition:
                self._queued_jobs += 1
                self._metrics["queued_splunk_searches"] = self._queued_jobs
                queued = True
                self._waiters.append(waiter)
                while True:
                    now = self._clock()
                    limit_error = self._limit_error(principal_id, budget_cost, now)
                    if limit_error is not None:
                        self._metrics["search_resource_rejections_total"] += 1
                        raise limit_error
                    higher_priority_waiting = any(
                        other[1] < priority and self._capacity_available(other[2], other[3], other[4])
                        for other in self._waiters
                    )
                    if not higher_priority_waiting and self._capacity_available(principal_id, weight, workload_type):
                        self._waiters.remove(waiter)
                        self._queued_jobs -= 1
                        self._metrics["queued_splunk_searches"] = self._queued_jobs
                        queued = False
                        self._active_weight += weight
                        self._active_jobs += 1
                        self._active_by_principal[principal_id] += 1
                        if workload_type == "backtest":
                            self._active_backtests += 1
                        self._dispatch_history[principal_id].append((now, budget_cost))
                        self._metrics["active_splunk_searches"] = self._active_jobs
                        self._metrics["searches_admitted_total"] += 1
                        self._metrics["searches_by_cost_class"][cost_class] += 1
                        queue_wait = max(0.0, self._clock() - wait_started)
                        self._metrics["queue_wait_seconds_total"] += queue_wait
                        lease = ResourceLease(
                            principal_id,
                            cost_class,
                            weight,
                            budget_cost,
                            workload_type,
                            queue_wait,
                        )
                        reserved = True
                        logger.info(
                            "splunk search resource admitted",
                            extra={
                                "principal": principal_id,
                                "cost_class": cost_class,
                                "weight": weight,
                                "budget_cost": budget_cost,
                                "workload_type": workload_type,
                                "queue_wait_seconds": queue_wait,
                            },
                        )
                        break

                    remaining = loop_deadline - loop.time()
                    if remaining <= 0:
                        self._metrics["search_resource_queue_timeout_total"] += 1
                        self._metrics["search_resource_rejections_total"] += 1
                        raise ServiceError(
                            "resource_busy",
                            "Search capacity is currently exhausted.",
                            retryable=True,
                            details={
                                "queue_timeout_seconds": self.config.queue_timeout_seconds,
                                "cost_class": cost_class,
                                "workload_type": workload_type,
                            },
                        )
                    try:
                        await asyncio.wait_for(self._condition.wait(), timeout=remaining)
                    except asyncio.TimeoutError as exc:
                        self._metrics["search_resource_queue_timeout_total"] += 1
                        self._metrics["search_resource_rejections_total"] += 1
                        raise ServiceError(
                            "resource_busy",
                            "Search capacity is currently exhausted.",
                            retryable=True,
                            details={
                                "queue_timeout_seconds": self.config.queue_timeout_seconds,
                                "cost_class": cost_class,
                                "workload_type": workload_type,
                            },
                        ) from exc

            assert lease is not None
            execution_started = self._clock()
            try:
                yield lease
            finally:
                execution_seconds = max(0.0, self._clock() - execution_started)
                async with self._condition:
                    if reserved:
                        self._active_weight = max(0, self._active_weight - weight)
                        self._active_jobs = max(0, self._active_jobs - 1)
                        current = self._active_by_principal[principal_id]
                        if current <= 1:
                            self._active_by_principal.pop(principal_id, None)
                        else:
                            self._active_by_principal[principal_id] = current - 1
                        if workload_type == "backtest":
                            self._active_backtests = max(0, self._active_backtests - 1)
                        self._metrics["active_splunk_searches"] = self._active_jobs
                        self._metrics["searches_released_total"] += 1
                        self._metrics["execution_seconds_total"] += execution_seconds
                        reserved = False
                        self._condition.notify_all()
                        logger.info(
                            "splunk search resource released",
                            extra={
                                "principal": principal_id,
                                "cost_class": cost_class,
                                "workload_type": workload_type,
                                "execution_seconds": execution_seconds,
                            },
                        )
        except BaseException:
            # Cancellation while queued must not leave a phantom queue entry.
            if queued:
                async with self._condition:
                    self._waiters.remove(waiter)
                    self._queued_jobs = max(0, self._queued_jobs - 1)
                    self._metrics["queued_splunk_searches"] = self._queued_jobs
                    self._condition.notify_all()
            raise


__all__ = ["ResourceLease", "SearchResourceManager"]
