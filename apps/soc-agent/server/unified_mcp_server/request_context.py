"""Host-resolved investigation identity and one deadline across provider stages."""

from contextlib import asynccontextmanager
from contextvars import ContextVar
from dataclasses import dataclass, replace
import asyncio
import hashlib
import json
import math
import time

from .errors import ServiceError


@dataclass(frozen=True)
class OperationContext:
    principal_id: str = ""
    investigation_id: str = ""
    customer_id: str = ""
    config_revision: str = ""
    scheduled_at: float | None = None
    workload: str = "interactive"
    deadline: float = float("inf")

    @property
    def evidence_scope(self) -> str:
        return hashlib.sha256(json.dumps([
            self.principal_id, self.investigation_id, self.customer_id,
        ], separators=(",", ":")).encode()).hexdigest()


operation_context: ContextVar[OperationContext] = ContextVar("soc_operation", default=OperationContext())


def remaining_seconds(maximum: float) -> float:
    remaining = min(maximum, operation_context.get().deadline - time.monotonic())
    if remaining <= 0:
        raise ServiceError("operation_timeout", "The investigation operation reached its deadline.")
    return remaining


@asynccontextmanager
async def operation_budget(deadline_ms=None, *, maximum_seconds=180):
    budget = float(maximum_seconds)
    if isinstance(deadline_ms, (int, float)) and math.isfinite(deadline_ms):
        budget = max(0, min(budget, deadline_ms / 1000 - time.time()))
    token = operation_context.set(replace(operation_context.get(), deadline=time.monotonic() + budget))
    try:
        async with asyncio.timeout(budget):
            yield
    except TimeoutError as exc:
        raise ServiceError("operation_timeout", "The investigation operation reached its deadline.") from exc
    finally:
        operation_context.reset(token)
