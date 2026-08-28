"""Small curated mappings for planning safe, useful Splunk searches."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Iterable


_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_.-]{0,127}$")


def canonical_entity_type(value: str) -> str:
    normalized = value.strip().casefold().replace("-", "_").replace(" ", "_")
    return {
        "ip_address": "ip",
        "ipaddress": "ip",
        "src": "source_ip",
        "src_ip": "source_ip",
        "source": "source_ip",
        "source_address": "source_ip",
        "dest": "destination_ip",
        "dest_ip": "destination_ip",
        "destination": "destination_ip",
        "destination_address": "destination_ip",
        "account": "user",
        "username": "user",
        "computer": "host",
        "server": "host",
    }.get(normalized, normalized)


@dataclass(frozen=True)
class SearchSchema:
    """A SOC-engineer-curated data-source mapping.

    Values in this class are trusted server-side configuration. User-provided
    values are never added to a schema at runtime.
    """

    name: str
    indexes: tuple[str, ...]
    sourcetypes: tuple[str, ...] = ()
    entities: dict[str, tuple[str, ...]] | None = None
    keywords: tuple[str, ...] = ()
    common_fields: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not self.name.strip():
            raise ValueError("schema name must not be empty")
        indexes = self._normalize_values(self.indexes, "indexes")
        sourcetypes = self._normalize_values(self.sourcetypes, "sourcetypes")
        keywords = tuple(
            dict.fromkeys(
                item.casefold().strip()
                for item in self.keywords
                if isinstance(item, str) and item.strip()
            )
        )
        common_fields = self._normalize_fields(self.common_fields)
        entity_map: dict[str, tuple[str, ...]] = {}
        for raw_type, raw_fields in (self.entities or {}).items():
            if not isinstance(raw_type, str) or not raw_type.strip():
                raise ValueError("schema entity types must be non-empty strings")
            entity_type = canonical_entity_type(raw_type)
            fields = self._normalize_fields(raw_fields)
            if not fields:
                raise ValueError(f"schema entity {raw_type} must contain fields")
            entity_map[entity_type] = fields
        object.__setattr__(self, "indexes", indexes)
        object.__setattr__(self, "sourcetypes", sourcetypes)
        object.__setattr__(self, "keywords", keywords)
        object.__setattr__(self, "common_fields", common_fields)
        object.__setattr__(self, "entities", entity_map)

    @staticmethod
    def _normalize_values(values: Iterable[str], name: str) -> tuple[str, ...]:
        normalized: list[str] = []
        for value in values:
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"schema {name} must contain non-empty strings")
            value = value.strip()
            if not _IDENTIFIER.fullmatch(value) and not re.fullmatch(r"[A-Za-z0-9_.:-]{1,256}", value):
                raise ValueError(f"schema {name[:-1]} {value!r} is not a safe identifier")
            if value not in normalized:
                normalized.append(value)
        if name == "indexes" and not normalized:
            raise ValueError("schema must contain at least one index")
        return tuple(normalized)

    @staticmethod
    def _normalize_fields(values: Iterable[str],) -> tuple[str, ...]:
        normalized: list[str] = []
        for value in values:
            if not isinstance(value, str) or not value.strip():
                raise ValueError("schema fields must contain non-empty strings")
            value = value.strip()
            if value not in {"_time", "_raw"} and not _IDENTIFIER.fullmatch(value):
                raise ValueError(f"schema field {value!r} is not a safe identifier")
            if value not in normalized:
                normalized.append(value)
        return tuple(normalized)

    def fields_for(self, entity_type: str) -> tuple[str, ...]:
        return (self.entities or {}).get(canonical_entity_type(entity_type), ())

    def all_fields(self) -> tuple[str, ...]:
        values: list[str] = list(self.common_fields)
        for fields in (self.entities or {}).values():
            for field in fields:
                if field not in values:
                    values.append(field)
        return tuple(values)


class SearchSchemaRegistry:
    """Resolve intents only against trusted, curated schemas."""

    def __init__(self, schemas: Iterable[SearchSchema] | None = None) -> None:
        values = tuple(self.default().schemas if schemas is None else schemas)
        if not values:
            raise ValueError("at least one search schema is required")
        if len({schema.name for schema in values}) != len(values):
            raise ValueError("search schema names must be unique")
        self.schemas = values

    @classmethod
    def default(cls) -> "SearchSchemaRegistry":
        # Keep this list intentionally short. It is a validated planning
        # registry, not a replacement for broad Splunk data-source discovery.
        return cls(
            (
                SearchSchema(
                    name="windows_security",
                    indexes=("windows",),
                    sourcetypes=("WinEventLog:Security", "XmlWinEventLog:Security"),
                    entities={
                        "ip": ("src_ip", "Source_Network_Address", "IpAddress"),
                        "user": ("user", "Account_Name", "TargetUserName"),
                        "host": ("host", "ComputerName", "dest"),
                    },
                    keywords=(
                        "windows", "security", "authentication", "auth", "login",
                        "logon", "failed", "failure", "eventcode", "powershell",
                    ),
                    common_fields=("_time", "EventCode", "message", "action"),
                ),
                SearchSchema(
                    name="firewall",
                    indexes=("firewall",),
                    entities={
                        "ip": ("src", "src_ip", "source_ip", "dest", "dest_ip", "destination_ip"),
                        "source_ip": ("src", "src_ip", "source_ip"),
                        "destination_ip": ("dest", "dest_ip", "destination_ip"),
                        "host": ("host", "device"),
                        "action": ("action", "vendor_action"),
                    },
                    keywords=(
                        "firewall", "network", "traffic", "connection", "source",
                        "destination", "deny", "allow", "blocked",
                    ),
                    common_fields=("_time", "action", "protocol", "dest_port", "message"),
                ),
            )
        )

    def get(self, name: str) -> SearchSchema | None:
        return next((schema for schema in self.schemas if schema.name == name), None)

    def candidates(
        self,
        *,
        objective: str,
        entity_types: Iterable[str] = (),
        event_type: str | None = None,
        preferred_index: str | None = None,
        preferred_sourcetype: str | None = None,
    ) -> list[tuple[SearchSchema, int]]:
        objective_tokens = set(re.findall(r"[A-Za-z0-9_]+", objective.casefold()))
        event_tokens = set(re.findall(r"[A-Za-z0-9_]+", (event_type or "").casefold()))
        requested_types = {canonical_entity_type(value) for value in entity_types}
        ranked: list[tuple[SearchSchema, int]] = []
        for schema in self.schemas:
            if preferred_index and preferred_index.casefold() not in {
                value.casefold() for value in schema.indexes
            }:
                continue
            if preferred_sourcetype and preferred_sourcetype.casefold() not in {
                value.casefold() for value in schema.sourcetypes
            }:
                continue
            if requested_types and any(not schema.fields_for(value) for value in requested_types):
                continue

            score = 0
            if preferred_index:
                score += 5
            if preferred_sourcetype:
                score += 5
            keywords = set(schema.keywords)
            event_matches = {token for token in event_tokens if token in keywords or token.rstrip("s") in keywords}
            objective_matches = {token for token in objective_tokens if token in keywords or token.rstrip("s") in keywords}
            score += 3 * len(event_matches)
            score += 2 * len(objective_matches)
            score += 3 * len(requested_types)
            if score:
                ranked.append((schema, score))
        return sorted(ranked, key=lambda item: (-item[1], item[0].name))


__all__ = ["SearchSchema", "SearchSchemaRegistry", "canonical_entity_type"]
