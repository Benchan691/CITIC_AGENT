"""Trusted, intent-to-SPL planning for normal SOC investigations."""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any, Literal

from unified_mcp_server.errors import ServiceError

from .schema_registry import SearchSchema, SearchSchemaRegistry, canonical_entity_type


ResultMode = Literal["auto", "existence", "count", "timeline", "distribution", "raw_evidence"]
SearchStrategy = Literal["raw", "stats", "tstats", "timeline", "existence"]
_RESULT_MODES = frozenset({"auto", "existence", "count", "timeline", "distribution", "raw_evidence"})
_SAFE_FIELD = re.compile(r"^(?:_time|_raw|[A-Za-z_][A-Za-z0-9_.-]{0,127})$")
_SAFE_SCOPE_VALUE = re.compile(r"^[A-Za-z0-9_.:-]{1,256}$")


def _text(value: Any, name: str, *, required: bool = False, maximum: int = 512) -> str | None:
    if value is None:
        if required:
            raise ValueError(f"{name} is required")
        return None
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string")
    value = value.strip()
    if required and not value:
        raise ValueError(f"{name} cannot be empty")
    if len(value) > maximum:
        raise ValueError(f"{name} is too long")
    if "\n" in value or "\r" in value:
        raise ValueError(f"{name} cannot contain newlines")
    return value or None


def _safe_scope(value: Any, name: str) -> str | None:
    value = _text(value, name, maximum=256)
    if value is not None and not _SAFE_SCOPE_VALUE.fullmatch(value):
        raise ValueError(f"{name} must be a single trusted scope value")
    return value


def _safe_fields(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("fields must be a list of field names")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip() or not _SAFE_FIELD.fullmatch(item.strip()):
            raise ValueError("fields must contain safe field names")
        item = item.strip()
        if item not in result:
            result.append(item)
    if len(result) > 50:
        raise ValueError("fields must contain at most 50 names")
    return result


def _entity(item: Any, index: int) -> dict[str, str]:
    if not isinstance(item, dict):
        raise ValueError(f"entities[{index}] must be an object")
    raw_type = item.get("type", item.get("entity_type"))
    raw_value = item.get("value", item.get("entity"))
    entity_type = _text(raw_type, f"entities[{index}].type", required=True, maximum=64)
    value = _text(raw_value, f"entities[{index}].value", required=True, maximum=512)
    assert entity_type is not None and value is not None
    return {"type": canonical_entity_type(entity_type), "value": value}


@dataclass(frozen=True)
class SearchIntent:
    objective: str
    entity_type: str | None = None
    entity: str | None = None
    entities: list[dict[str, str]] = field(default_factory=list)
    customer: str | None = None
    event_type: str | None = None
    earliest_time: str = "-24h"
    latest_time: str = "now"
    preferred_index: str | None = None
    preferred_sourcetype: str | None = None
    requested_fields: list[str] = field(default_factory=list)
    result_mode: ResultMode = "auto"
    max_count: int = 50

    def __post_init__(self) -> None:
        object.__setattr__(self, "objective", _text(self.objective, "objective", required=True, maximum=2_000))
        entity_type = _text(self.entity_type, "entity_type", maximum=64)
        if entity_type:
            entity_type = canonical_entity_type(entity_type)
        entity = _text(self.entity, "entity", maximum=512)
        if entity is not None and entity_type is None:
            raise ValueError("entity_type is required when entity is supplied")
        if entity_type is not None and not re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_-]{0,63}", entity_type):
            raise ValueError("entity_type must be a safe identifier")
        normalized_entities: list[dict[str, str]] = []
        if self.entities is not None:
            if not isinstance(self.entities, list):
                raise ValueError("entities must be a list")
            normalized_entities = [_entity(item, index) for index, item in enumerate(self.entities)]
        if entity_type is not None and entity is not None:
            normalized_entities.insert(0, {"type": entity_type, "value": entity})
        deduped: list[dict[str, str]] = []
        for item in normalized_entities:
            if item not in deduped:
                deduped.append(item)
        earliest = _text(self.earliest_time, "earliest_time", required=True, maximum=256)
        latest = _text(self.latest_time, "latest_time", required=True, maximum=256)
        assert earliest is not None and latest is not None
        preferred_index = _safe_scope(self.preferred_index, "preferred_index")
        preferred_sourcetype = _safe_scope(self.preferred_sourcetype, "preferred_sourcetype")
        event_type = _text(self.event_type, "event_type", maximum=256)
        customer = _text(self.customer, "customer", maximum=256)
        fields = _safe_fields(self.requested_fields)
        if self.result_mode not in _RESULT_MODES:
            raise ValueError("result_mode is not supported")
        if isinstance(self.max_count, bool) or not isinstance(self.max_count, int) or not 1 <= self.max_count <= 100_000:
            raise ValueError("max_count must be an integer between 1 and 100000")
        object.__setattr__(self, "entity_type", entity_type)
        object.__setattr__(self, "entity", entity)
        object.__setattr__(self, "entities", deduped)
        object.__setattr__(self, "customer", customer)
        object.__setattr__(self, "event_type", event_type)
        object.__setattr__(self, "earliest_time", earliest)
        object.__setattr__(self, "latest_time", latest)
        object.__setattr__(self, "preferred_index", preferred_index)
        object.__setattr__(self, "preferred_sourcetype", preferred_sourcetype)
        object.__setattr__(self, "requested_fields", fields)

    @classmethod
    def from_values(
        cls,
        *,
        objective: str,
        entity_type: str | None = None,
        entity: str | None = None,
        entities: list[dict[str, str]] | None = None,
        customer: str | None = None,
        event_type: str | None = None,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        preferred_index: str | None = None,
        preferred_sourcetype: str | None = None,
        fields: list[str] | None = None,
        result_mode: ResultMode = "auto",
        max_count: int = 50,
    ) -> "SearchIntent":
        return cls(
            objective=objective,
            entity_type=entity_type,
            entity=entity,
            entities=entities or [],
            customer=customer,
            event_type=event_type,
            earliest_time=earliest_time,
            latest_time=latest_time,
            preferred_index=preferred_index,
            preferred_sourcetype=preferred_sourcetype,
            requested_fields=fields or [],
            result_mode=result_mode,
            max_count=max_count,
        )

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "SearchIntent":
        if not isinstance(payload, dict):
            raise ValueError("search intent must be an object")
        allowed = {
            "objective", "entity_type", "entity", "entities", "customer", "event_type",
            "earliest_time", "latest_time", "preferred_index", "preferred_sourcetype",
            "fields", "requested_fields", "result_mode", "max_count",
        }
        unknown = sorted(set(payload) - allowed)
        if unknown:
            raise ValueError("search intent contains unsupported fields: " + ", ".join(unknown))
        return cls.from_values(
            objective=payload.get("objective"),
            entity_type=payload.get("entity_type"),
            entity=payload.get("entity"),
            entities=payload.get("entities"),
            customer=payload.get("customer"),
            event_type=payload.get("event_type"),
            earliest_time=payload.get("earliest_time", "-24h"),
            latest_time=payload.get("latest_time", "now"),
            preferred_index=payload.get("preferred_index"),
            preferred_sourcetype=payload.get("preferred_sourcetype"),
            fields=payload.get("fields", payload.get("requested_fields")),
            result_mode=payload.get("result_mode", "auto"),
            max_count=payload.get("max_count", 50),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "objective": self.objective,
            "entity_type": self.entity_type,
            "entity": self.entity,
            "entities": [dict(item) for item in self.entities],
            "customer": self.customer,
            "event_type": self.event_type,
            "earliest_time": self.earliest_time,
            "latest_time": self.latest_time,
            "preferred_index": self.preferred_index,
            "preferred_sourcetype": self.preferred_sourcetype,
            "fields": list(self.requested_fields),
            "result_mode": self.result_mode,
            "max_count": self.max_count,
        }


@dataclass(frozen=True)
class SearchPlan:
    objective: str
    indexes: list[str]
    sourcetypes: list[str]
    entity_fields: dict[str, list[str]]
    earliest_time: str
    latest_time: str
    strategy: SearchStrategy
    spl: str
    output_fields: list[str]
    confidence: float
    reasons: list[str]
    assumptions: list[str]
    max_count: int = 50
    schema_name: str = field(default="", repr=False)
    alternative_schemas: tuple[str, ...] = field(default_factory=tuple, repr=False)

    @property
    def confidence_label(self) -> str:
        if self.confidence >= 0.85:
            return "high"
        if self.confidence >= 0.65:
            return "medium"
        return "low"

    def to_dict(self) -> dict[str, Any]:
        return {
            "objective": self.objective,
            "indexes": list(self.indexes),
            "sourcetypes": list(self.sourcetypes),
            "entity_fields": {key: list(value) for key, value in self.entity_fields.items()},
            "earliest_time": self.earliest_time,
            "latest_time": self.latest_time,
            "strategy": self.strategy,
            "spl": self.spl,
            "output_fields": list(self.output_fields),
            "confidence": self.confidence,
            "confidence_label": self.confidence_label,
            "reasons": list(self.reasons),
            "assumptions": list(self.assumptions),
            "max_count": self.max_count,
        }


def _quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


class SearchPlanner:
    """Turn a validated intent into one deterministic, scoped SPL query."""

    def __init__(self, max_refinements: int = 2) -> None:
        if isinstance(max_refinements, bool) or not isinstance(max_refinements, int) or not 0 <= max_refinements <= 5:
            raise ValueError("max_refinements must be between 0 and 5")
        self.max_refinements = max_refinements

    @staticmethod
    def _intent_entity_types(intent: SearchIntent) -> list[str]:
        return _unique([item["type"] for item in intent.entities])

    @staticmethod
    def _infer_entity_type(intent: SearchIntent, schema: SearchSchema) -> str | None:
        tokens = set(re.findall(r"[A-Za-z0-9_]+", intent.objective.casefold()))
        if "user" in tokens or "account" in tokens or "username" in tokens:
            candidates = ("user",)
        elif "host" in tokens or "server" in tokens or "computer" in tokens:
            candidates = ("host",)
        elif "source" in tokens or "src" in tokens:
            candidates = ("source_ip", "ip")
        elif "destination" in tokens or "dest" in tokens:
            candidates = ("destination_ip", "ip")
        elif "ip" in tokens:
            candidates = ("ip",)
        else:
            candidates = ("host", "user", "ip")
        return next((value for value in candidates if schema.fields_for(value)), None)

    @staticmethod
    def _strategy(intent: SearchIntent) -> SearchStrategy:
        if intent.result_mode == "raw_evidence":
            return "raw"
        if intent.result_mode == "existence":
            return "existence"
        if intent.result_mode in {"count", "distribution"}:
            return "stats"
        if intent.result_mode == "timeline":
            return "timeline"
        tokens = set(re.findall(r"[A-Za-z0-9_]+", intent.objective.casefold()))
        if tokens & {"did", "any", "exists", "exist", "appear", "seen", "whether"}:
            return "existence"
        if {"count", "number", "volume", "total"} & tokens or "how many" in intent.objective.casefold():
            return "stats"
        if tokens & {"which", "top", "most", "distribution", "breakdown", "frequent"}:
            return "stats"
        # Timeline is the safe default for an investigative question. Raw
        # event retrieval must be explicitly requested as raw_evidence.
        return "timeline"

    @staticmethod
    def _wants_distribution(intent: SearchIntent) -> bool:
        if intent.result_mode == "distribution":
            return True
        if intent.result_mode != "auto":
            return False
        tokens = set(re.findall(r"[A-Za-z0-9_]+", intent.objective.casefold()))
        return bool(tokens & {"which", "top", "most", "distribution", "breakdown", "frequent"})

    @staticmethod
    def _distribution_field(intent: SearchIntent, schema: SearchSchema) -> str | None:
        if intent.requested_fields:
            return intent.requested_fields[0]
        inferred = SearchPlanner._infer_entity_type(intent, schema)
        aliases = schema.fields_for(inferred or "")
        return aliases[0] if aliases else None

    @staticmethod
    def _entity_filter(intent: SearchIntent, schema: SearchSchema) -> tuple[str, dict[str, list[str]]]:
        by_type: dict[str, list[str]] = {}
        for entity in intent.entities:
            entity_type = entity["type"]
            aliases = schema.fields_for(entity_type)
            if not aliases:
                raise ServiceError(
                    "planning_failed",
                    "No trusted field mapping exists for the requested entity type.",
                    details={"entity_type": entity_type, "schema": schema.name},
                )
            by_type.setdefault(entity_type, []).append(entity["value"])
        groups: list[str] = []
        for entity_type, values in by_type.items():
            conditions = [
                f"{field}={_quote(value)}"
                for field in schema.fields_for(entity_type)
                for value in values
            ]
            groups.append("(" + " OR ".join(conditions) + ")")
        return " ".join(groups), {key: list(schema.fields_for(key)) for key in by_type}

    @staticmethod
    def _scope(schema: SearchSchema, preferred_index: str | None, preferred_sourcetype: str | None) -> tuple[str, list[str], list[str]]:
        indexes = [preferred_index] if preferred_index else list(schema.indexes)
        sourcetypes = [preferred_sourcetype] if preferred_sourcetype else list(schema.sourcetypes)
        index_part = (
            f"index={indexes[0]}"
            if len(indexes) == 1
            else "index IN (" + ",".join(_quote(value) for value in indexes) + ")"
        )
        if not sourcetypes:
            return index_part, indexes, sourcetypes
        source_part = (
            f"sourcetype={_quote(sourcetypes[0])}"
            if len(sourcetypes) == 1
            else "sourcetype IN (" + ",".join(_quote(value) for value in sourcetypes) + ")"
        )
        return f"{index_part} {source_part}", indexes, sourcetypes

    @staticmethod
    def _output_fields(intent: SearchIntent, schema: SearchSchema, strategy: SearchStrategy) -> list[str]:
        if strategy == "existence":
            return ["count"]
        if strategy == "stats":
            group_field = (
                SearchPlanner._distribution_field(intent, schema)
                if SearchPlanner._wants_distribution(intent)
                else None
            )
            required = [group_field, "count"] if group_field else ["count"]
            return _unique(required + list(intent.requested_fields))
        inferred = SearchPlanner._infer_entity_type(intent, schema)
        if intent.requested_fields:
            return list(intent.requested_fields)
        fields = ["_time"]
        if strategy == "raw":
            fields.append("_raw")
        if inferred:
            fields.extend(schema.fields_for(inferred))
        fields.extend(schema.common_fields)
        return _unique(fields)

    @staticmethod
    def _pipeline(
        strategy: SearchStrategy,
        output_fields: list[str],
        max_count: int,
        group_field: str | None = None,
    ) -> list[str]:
        if strategy == "existence":
            return ["stats count", "fields " + " ".join(output_fields)]
        if strategy == "stats":
            stats = "stats count" + (" by " + group_field if group_field else "")
            parts = [stats]
            if group_field:
                parts.append("sort - count")
                parts.append(f"head {max_count}")
            parts.append("fields " + " ".join(output_fields))
            return parts
        return [
            "fields " + " ".join(output_fields),
            "sort - _time",
            f"head {max_count}",
        ]

    def _build(
        self,
        intent: SearchIntent,
        schema: SearchSchema,
        *,
        confidence: float,
        alternatives: tuple[str, ...] = (),
        refinement: bool = False,
    ) -> SearchPlan:
        strategy = self._strategy(intent)
        scope, indexes, sourcetypes = self._scope(
            schema, intent.preferred_index, intent.preferred_sourcetype
        )
        entity_filter, entity_fields = self._entity_filter(intent, schema)
        output_fields = self._output_fields(intent, schema, strategy)
        group_field = (
            self._distribution_field(intent, schema)
            if strategy == "stats" and self._wants_distribution(intent)
            else None
        )
        query_parts = [scope]
        if entity_filter:
            query_parts.append(entity_filter)
        spl = " ".join(query_parts) + " | " + " | ".join(
            self._pipeline(strategy, output_fields, intent.max_count, group_field)
        )
        reasons = [f"Selected curated schema '{schema.name}'."]
        if sourcetypes:
            reasons.append("Restricted the search to the schema's known sourcetypes.")
        if entity_fields:
            reasons.append("Expanded entity matching across configured field aliases.")
        if strategy in {"existence", "stats"}:
            reasons.append("Used Splunk-side aggregation for a non-raw objective.")
        elif strategy == "raw":
            reasons.append("Raw evidence was explicitly requested.")
        else:
            reasons.append("Used a bounded timeline projection instead of raw-event output.")
        if refinement:
            reasons.append("This is a bounded refinement against another trusted schema.")
        assumptions = [
            "The curated schema represents the relevant telemetry for this search.",
            "The requested time range is passed to Splunk unchanged and remains subject to query/resource policy.",
        ]
        if intent.customer:
            assumptions.append("Customer context is retained for the caller and does not alter Splunk scope.")
        return SearchPlan(
            objective=intent.objective,
            indexes=indexes,
            sourcetypes=sourcetypes,
            entity_fields=entity_fields,
            earliest_time=intent.earliest_time,
            latest_time=intent.latest_time,
            strategy=strategy,
            spl=spl,
            output_fields=output_fields,
            confidence=max(0.0, min(1.0, confidence)),
            reasons=reasons,
            assumptions=assumptions,
            max_count=intent.max_count,
            schema_name=schema.name,
            alternative_schemas=alternatives,
        )

    def plan(
        self,
        intent: SearchIntent,
        schema_registry: SearchSchemaRegistry | None = None,
    ) -> SearchPlan:
        if not isinstance(intent, SearchIntent):
            raise ServiceError("invalid_input", "search intent is malformed")
        registry = schema_registry or SearchSchemaRegistry.default()
        ranked = registry.candidates(
            objective=intent.objective,
            entity_types=self._intent_entity_types(intent),
            event_type=intent.event_type,
            preferred_index=intent.preferred_index,
            preferred_sourcetype=intent.preferred_sourcetype,
        )
        if not ranked:
            raise ServiceError(
                "planning_failed",
                "No trusted schema mapping exists for this search intent.",
                details={
                    "entity_type": intent.entity_type,
                    "event_type": intent.event_type,
                    "preferred_index": intent.preferred_index,
                    "preferred_sourcetype": intent.preferred_sourcetype,
                },
            )
        top_score = ranked[0][1]
        tied = [schema.name for schema, score in ranked if score == top_score]
        if len(tied) > 1:
            raise ServiceError(
                "planning_failed",
                "The search intent matches multiple trusted schemas; specify a preferred index or sourcetype.",
                details={"candidate_schemas": tied},
            )
        schema, score = ranked[0]
        confidence = 0.95 if score >= 8 else 0.85 if score >= 4 else 0.7 if score >= 2 else 0.55
        alternatives = tuple(item.name for item, _ in ranked[1:])
        return self._build(intent, schema, confidence=confidence, alternatives=alternatives)

    def refine(
        self,
        intent: SearchIntent,
        schema_registry: SearchSchemaRegistry,
        plan: SearchPlan,
        attempt: int,
    ) -> SearchPlan | None:
        if attempt < 0 or attempt >= self.max_refinements:
            return None
        candidate_name = plan.alternative_schemas[attempt] if attempt < len(plan.alternative_schemas) else None
        schema = schema_registry.get(candidate_name) if candidate_name else None
        if schema is None:
            return None
        try:
            self._entity_filter(intent, schema)
        except ServiceError:
            return None
        return self._build(
            intent,
            schema,
            confidence=0.55,
            alternatives=plan.alternative_schemas[attempt + 1 :],
            refinement=True,
        )


__all__ = [
    "ResultMode",
    "SearchIntent",
    "SearchPlan",
    "SearchPlanner",
    "SearchStrategy",
]
