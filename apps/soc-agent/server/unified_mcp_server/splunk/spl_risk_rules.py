"""Deprecated compatibility module.

SPL authorization now lives in ``query_policy.SplunkQueryPolicy``. The legacy
rule collection is intentionally empty so callers cannot accidentally revive
the old score-threshold execution path.
"""

SPL_RISK_RULES: tuple[()] = ()

__all__ = ["SPL_RISK_RULES"]
