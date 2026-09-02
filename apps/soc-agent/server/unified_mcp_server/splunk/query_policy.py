"""Structural SPL policy analysis used before any Splunk search executes.

The analyzer is intentionally small: it is not an SPL compiler. It tracks the
parts that matter for read-only safety (commands, index scope, time scope,
subsearches, and macros) without treating a numeric score as authorization.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import logging
import re
from collections.abc import Callable, Iterable, Mapping
from typing import Any, Literal


logger = logging.getLogger(__name__)

PolicyDecision = Literal["allow", "require_approval", "deny"]

_DECISIONS = frozenset({"allow", "require_approval", "deny"})
_DECISION_RANK = {"allow": 0, "require_approval": 1, "deny": 2}


@dataclass(frozen=True)
class QueryPolicyConfig:
    """Explicit policy knobs; safe defaults are suitable for an SOC agent."""

    short_search_seconds: int = 24 * 60 * 60
    normal_search_seconds: int = 7 * 24 * 60 * 60
    very_long_search_seconds: int = 30 * 24 * 60 * 60
    wildcard_index_decision: PolicyDecision = "require_approval"
    no_index_decision: PolicyDecision = "require_approval"
    long_raw_decision: PolicyDecision = "require_approval"
    very_long_decision: PolicyDecision = "require_approval"
    all_time_decision: PolicyDecision = "require_approval"
    expensive_command_decision: PolicyDecision = "require_approval"
    subsearch_decision: PolicyDecision = "require_approval"
    nested_subsearch_decision: PolicyDecision = "require_approval"
    unresolved_macro_decision: PolicyDecision = "require_approval"
    unparseable_time_decision: PolicyDecision = "require_approval"
    max_subsearch_depth: int = 1
    trusted_macros: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        for name in (
            "short_search_seconds",
            "normal_search_seconds",
            "very_long_search_seconds",
            "max_subsearch_depth",
        ):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                raise ValueError(f"{name} must be a positive integer")
        if self.short_search_seconds > self.normal_search_seconds:
            raise ValueError("short_search_seconds cannot exceed normal_search_seconds")
        if self.normal_search_seconds > self.very_long_search_seconds:
            raise ValueError("normal_search_seconds cannot exceed very_long_search_seconds")
        for name in (
            "wildcard_index_decision",
            "no_index_decision",
            "long_raw_decision",
            "very_long_decision",
            "all_time_decision",
            "expensive_command_decision",
            "subsearch_decision",
            "nested_subsearch_decision",
            "unresolved_macro_decision",
            "unparseable_time_decision",
        ):
            value = getattr(self, name)
            if value not in _DECISIONS:
                raise ValueError(f"{name} must be allow, require_approval, or deny")
        macros = tuple(
            dict.fromkeys(
                item.casefold().strip()
                for item in self.trusted_macros
                if isinstance(item, str) and item.strip()
            )
        )
        object.__setattr__(self, "trusted_macros", macros)

    def to_dict(self) -> dict[str, Any]:
        return {
            "short_search_seconds": self.short_search_seconds,
            "normal_search_seconds": self.normal_search_seconds,
            "very_long_search_seconds": self.very_long_search_seconds,
            "wildcard_index_decision": self.wildcard_index_decision,
            "no_index_decision": self.no_index_decision,
            "long_raw_decision": self.long_raw_decision,
            "very_long_decision": self.very_long_decision,
            "all_time_decision": self.all_time_decision,
            "expensive_command_decision": self.expensive_command_decision,
            "subsearch_decision": self.subsearch_decision,
            "nested_subsearch_decision": self.nested_subsearch_decision,
            "unresolved_macro_decision": self.unresolved_macro_decision,
            "unparseable_time_decision": self.unparseable_time_decision,
            "max_subsearch_depth": self.max_subsearch_depth,
            "trusted_macros": list(self.trusted_macros),
        }


@dataclass(frozen=True)
class QueryPolicyResult:
    decision: PolicyDecision
    reasons: list[str]
    detected_indexes: list[str]
    wildcard_indexes: bool
    earliest: str | None
    latest: str | None
    estimated_lookback_seconds: int | None
    commands: list[str]
    expensive_commands: list[str]
    dangerous_commands: list[str]
    allowed_commands: list[str]
    has_subsearch: bool
    subsearch_depth: int
    macros: list[str]
    unresolved_macros: list[str]
    risk_score: int | None
    index_scope_unknown: bool = False
    all_time: bool = False

    @property
    def risk_message(self) -> str:
        if not self.reasons:
            return "Query appears safe under the structural SPL policy."
        return "Policy findings:\n" + "\n".join(f"- {reason}" for reason in self.reasons)

    def to_dict(self) -> dict[str, Any]:
        return {
            "decision": self.decision,
            "reasons": list(self.reasons),
            "detected_indexes": list(self.detected_indexes),
            "wildcard_indexes": self.wildcard_indexes,
            "earliest": self.earliest,
            "latest": self.latest,
            "estimated_lookback_seconds": self.estimated_lookback_seconds,
            "commands": list(self.commands),
            "expensive_commands": list(self.expensive_commands),
            "dangerous_commands": list(self.dangerous_commands),
            "allowed_commands": list(self.allowed_commands),
            "has_subsearch": self.has_subsearch,
            "subsearch_depth": self.subsearch_depth,
            "macros": list(self.macros),
            "unresolved_macros": list(self.unresolved_macros),
            "risk_score": self.risk_score,
            "index_scope_unknown": self.index_scope_unknown,
            "all_time": self.all_time,
        }


@dataclass(frozen=True)
class _ParsedTime:
    value: str
    timestamp: float | None
    known: bool
    all_time: bool = False


@dataclass(frozen=True)
class _Subsearch:
    start: int
    end: int | None
    depth: int


@dataclass(frozen=True)
class _Scan:
    masked: str
    commands: list[str]
    macros: list[str]
    subsearches: list[_Subsearch]
    max_depth: int
    malformed: bool
    first_command: str | None


_WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_MACRO_NAME = re.compile(r"^([A-Za-z_][A-Za-z0-9_.-]*)")
_TIME_UNIT_SECONDS = {
    "s": 1,
    "m": 60,
    "h": 60 * 60,
    "d": 24 * 60 * 60,
    "w": 7 * 24 * 60 * 60,
    "mon": 30 * 24 * 60 * 60,
    "q": 90 * 24 * 60 * 60,
    "y": 365 * 24 * 60 * 60,
}
_RELATIVE_TIME = re.compile(
    r"^(?P<sign>[+-]?)(?P<amount>\d+(?:\.\d+)?)(?P<unit>mon|[smhdwqy])"
    r"(?:@(?P<round>mon|[smhdwqy]))?$",
    re.IGNORECASE,
)
_ABSOLUTE_TIME_FORMATS = (
    "%m/%d/%Y:%H:%M:%S",
    "%m/%d/%Y:%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S.%f%z",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%d %H:%M:%S%z",
    "%Y-%m-%d %H:%M:%S",
)

_DANGEROUS_COMMANDS = frozenset({
    "collect",
    "dboutput",
    "delete",
    "external",
    "mcollect",
    "meventcollect",
    "outputcsv",
    "outputlookup",
    "outputtext",
    "outputxml",
    "script",
    "sendalert",
    "sendemail",
    "sendresults",
    "runshellscript",
})
_EXPENSIVE_COMMANDS = frozenset({
    "append",
    "appendcols",
    "join",
    "map",
    "multisearch",
    "transaction",
})
_TABLE_COMMANDS = frozenset({
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
})
_KNOWN_COMMANDS = _DANGEROUS_COMMANDS | _EXPENSIVE_COMMANDS | _TABLE_COMMANDS | frozenset({
    "addinfo",
    "bin",
    "bucket",
    "convert",
    "dedup",
    "datamodel",
    "eval",
    "eventstats",
    "fields",
    "fillnull",
    "filter",
    "foreach",
    "head",
    "inputlookup",
    "loadjob",
    "lookup",
    "makeresults",
    "metadata",
    "mvcombine",
    "mvexpand",
    "predict",
    "rename",
    "regex",
    "rex",
    "rest",
    "return",
    "search",
    "sort",
    "streamstats",
    "tail",
    "table",
    "where",
})
_INDEX_FREE_COMMANDS = frozenset({"inputlookup", "loadjob", "makeresults", "metadata"})


def _unique(values: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _read_word(value: str, start: int) -> tuple[str | None, int]:
    while start < len(value) and value[start].isspace():
        start += 1
    match = _WORD.match(value, start)
    if not match:
        return None, start
    return match.group(0).casefold(), match.end()


def _mask_and_scan(query: str) -> _Scan:
    masked = list(query)
    commands: list[str] = []
    macros: list[str] = []
    subsearches: list[_Subsearch] = []
    stack: list[tuple[int, int]] = []
    quote: str | None = None
    escaped = False
    macro_start: int | None = None
    malformed = False

    def blank(start: int, end: int) -> None:
        for index in range(start, end):
            if masked[index] not in "\r\n":
                masked[index] = " "

    index = 0
    while index < len(query):
        character = query[index]
        if macro_start is not None:
            if character == "`":
                raw_name = query[macro_start:index].strip()
                match = _MACRO_NAME.match(raw_name)
                macros.append(match.group(1).casefold() if match else raw_name.casefold())
                blank(macro_start - 1, index + 1)
                macro_start = None
            index += 1
            continue
        if quote is not None:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            masked[index] = " "
            index += 1
            continue
        if character in {"'", '"'}:
            quote = character
            masked[index] = " "
            index += 1
            continue
        if character == "`":
            macro_start = index + 1
            masked[index] = " "
            index += 1
            continue
        if character == "[":
            depth = len(stack) + 1
            stack.append((index, depth))
            subsearches.append(_Subsearch(index, None, depth))
            index += 1
            continue
        if character == "]":
            if not stack:
                malformed = True
            else:
                start, depth = stack.pop()
                for position in range(len(subsearches) - 1, -1, -1):
                    item = subsearches[position]
                    if item.start == start and item.end is None:
                        subsearches[position] = _Subsearch(item.start, index, item.depth)
                        break
            index += 1
            continue
        if character == "|":
            command, _ = _read_word(query, index + 1)
            if command:
                commands.append(command)
            index += 1
            continue
        index += 1

    if quote is not None or macro_start is not None or stack:
        malformed = True
    plain = "".join(masked)
    first_command: str | None = None
    start = 0
    while start < len(plain) and plain[start].isspace():
        start += 1
    candidate, _ = _read_word(plain, start)
    if candidate in _KNOWN_COMMANDS:
        first_command = candidate
        commands.append(candidate)
    elif start < len(plain) and plain[start] == "|" and commands:
        first_command = commands[0]

    # A subsearch may begin with ``search`` or a dangerous/expensive command
    # without a leading pipe. Only known command words are structural here;
    # ordinary predicates such as ``index=main`` are not commands.
    for item in subsearches:
        begin = item.start + 1
        while begin < len(plain) and plain[begin].isspace():
            begin += 1
        command, _ = _read_word(plain, begin)
        if command in _KNOWN_COMMANDS:
            commands.append(command)

    return _Scan(
        masked=plain,
        commands=_unique(commands),
        macros=_unique(macros),
        subsearches=subsearches,
        max_depth=max((item.depth for item in subsearches), default=0),
        malformed=malformed,
        first_command=first_command,
    )


def _read_value(query: str, start: int) -> tuple[str | None, int, bool]:
    while start < len(query) and query[start].isspace():
        start += 1
    if start >= len(query):
        return None, start, False
    if query[start] in {'"', "'"}:
        quote = query[start]
        index = start + 1
        value: list[str] = []
        escaped = False
        while index < len(query):
            character = query[index]
            if escaped:
                value.append(character)
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                return "".join(value), index + 1, True
            else:
                value.append(character)
            index += 1
        return None, index, False
    index = start
    while index < len(query) and not query[index].isspace() and query[index] not in ")]|,":
        index += 1
    value = query[start:index].strip()
    return (value or None), index, bool(value)


def _iter_assignments(query: str, name: str) -> list[tuple[str | None, bool]]:
    values: list[tuple[str | None, bool]] = []
    quote: str | None = None
    escaped = False
    macro = False
    index = 0
    lower = query.casefold()
    while index < len(query):
        character = query[index]
        if macro:
            if character == "`":
                macro = False
            index += 1
            continue
        if quote is not None:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            index += 1
            continue
        if character == "`":
            macro = True
            index += 1
            continue
        if character in {'"', "'"}:
            quote = character
            index += 1
            continue
        if lower.startswith(name, index):
            before = query[index - 1] if index else " "
            after_index = index + len(name)
            after = query[after_index] if after_index < len(query) else " "
            if not (before.isalnum() or before == "_") and not (after.isalnum() or after == "_"):
                cursor = after_index
                while cursor < len(query) and query[cursor].isspace():
                    cursor += 1
                if cursor < len(query) and query[cursor] == "=":
                    value, _, valid = _read_value(query, cursor + 1)
                    values.append((value, valid))
                    index = max(cursor + 1, index + len(name))
                    continue
        index += 1
    return values


def _index_values(query: str) -> tuple[list[str], bool, bool, bool]:
    values: list[str] = []
    wildcard = False
    unknown = False
    top_level = False
    quote: str | None = None
    escaped = False
    macro = False
    square_depth = 0
    pipe_seen_by_depth = {0: False}
    lower = query.casefold()
    index = 0
    while index < len(query):
        character = query[index]
        if macro:
            if character == "`":
                macro = False
            index += 1
            continue
        if quote is not None:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            index += 1
            continue
        if character == "`":
            macro = True
            index += 1
            continue
        if character in {'"', "'"}:
            quote = character
            index += 1
            continue
        if character == "[":
            square_depth += 1
            pipe_seen_by_depth[square_depth] = False
            index += 1
            continue
        if character == "]":
            pipe_seen_by_depth.pop(square_depth, None)
            square_depth = max(0, square_depth - 1)
            index += 1
            continue
        if character == "|":
            pipe_seen_by_depth[square_depth] = True
            index += 1
            continue
        if lower.startswith("index", index):
            before = query[index - 1] if index else " "
            after_index = index + 5
            after = query[after_index] if after_index < len(query) else " "
            if not (before.isalnum() or before == "_") and not (after.isalnum() or after == "_"):
                cursor = after_index
                while cursor < len(query) and query[cursor].isspace():
                    cursor += 1
                operator = "="
                if lower.startswith("in", cursor) and (
                    cursor + 2 == len(query) or not (query[cursor + 2].isalnum() or query[cursor + 2] == "_")
                ):
                    operator = "in"
                    cursor += 2
                    while cursor < len(query) and query[cursor].isspace():
                        cursor += 1
                    if cursor >= len(query) or query[cursor] != "(":
                        unknown = True
                        index = cursor
                        continue
                    cursor += 1
                elif cursor < len(query) and query[cursor] in {"=", "!"}:
                    if query[cursor] == "!":
                        unknown = True
                    cursor += 1
                else:
                    index += 5
                    continue
                if operator == "in":
                    while cursor < len(query) and query[cursor] != ")":
                        value, next_cursor, valid = _read_value(query, cursor)
                        if not valid or value is None:
                            unknown = True
                            break
                        normalized = value.strip().casefold()
                        values.append(normalized)
                        top_level = top_level or (
                            square_depth == 0 and not pipe_seen_by_depth.get(square_depth, False)
                        )
                        unknown = unknown or normalized.startswith("$")
                        wildcard = wildcard or "*" in normalized or "?" in normalized
                        cursor = next_cursor
                        while cursor < len(query) and query[cursor].isspace():
                            cursor += 1
                        if cursor < len(query) and query[cursor] == ",":
                            cursor += 1
                    if cursor >= len(query) or query[cursor] != ")":
                        unknown = True
                    index = max(index + 5, cursor)
                    continue
                value, next_cursor, valid = _read_value(query, cursor)
                if not valid or value is None:
                    unknown = True
                else:
                    normalized = value.strip().casefold()
                    values.append(normalized)
                    top_level = top_level or (
                        square_depth == 0 and not pipe_seen_by_depth.get(square_depth, False)
                    )
                    unknown = unknown or normalized.startswith("$")
                    wildcard = wildcard or "*" in normalized or "?" in normalized
                index = max(index + 5, next_cursor)
                continue
        index += 1
    return _unique(values), wildcard, unknown, top_level


def _round_time(value: datetime, unit: str) -> datetime:
    unit = unit.casefold()
    if unit == "s":
        return value.replace(microsecond=0)
    if unit == "m":
        return value.replace(second=0, microsecond=0)
    if unit == "h":
        return value.replace(minute=0, second=0, microsecond=0)
    if unit == "d":
        return value.replace(hour=0, minute=0, second=0, microsecond=0)
    if unit == "w":
        start = value.replace(hour=0, minute=0, second=0, microsecond=0)
        return start - timedelta(days=start.weekday())
    # Month/quarter/year rounding is deliberately calendar-based.
    if unit == "mon":
        return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if unit == "q":
        month = ((value.month - 1) // 3) * 3 + 1
        return value.replace(month=month, day=1, hour=0, minute=0, second=0, microsecond=0)
    if unit == "y":
        return value.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    raise ValueError(f"unknown time rounding unit: {unit}")


def parse_splunk_time(value: Any, *, now: datetime | None = None, earliest: bool = False) -> _ParsedTime:
    """Parse a safe subset of Splunk time syntax without fail-open defaults."""
    if not isinstance(value, str):
        return _ParsedTime("", None, False)
    raw = value.strip()
    if not raw:
        return _ParsedTime(raw, None, False)
    current = now or datetime.now(timezone.utc)
    lowered = raw.casefold()
    if lowered == "rt":
        return _ParsedTime(raw, current.timestamp(), True)
    if lowered.startswith("rt"):
        realtime_value = raw[2:]
        parsed = parse_splunk_time(realtime_value, now=current, earliest=earliest)
        return _ParsedTime(raw, parsed.timestamp, parsed.known, parsed.all_time)
    if earliest and lowered in {"0", "all", "alltime"}:
        return _ParsedTime(raw, None, True, True)
    if lowered in {"now", "latest"}:
        return _ParsedTime(raw, current.timestamp(), True)
    if lowered == "0":
        return _ParsedTime(raw, 0.0, True)
    if lowered.startswith("@"):
        try:
            return _ParsedTime(raw, _round_time(current, lowered[1:]).timestamp(), True)
        except ValueError:
            return _ParsedTime(raw, None, False)

    relative = _RELATIVE_TIME.fullmatch(lowered)
    if relative:
        amount = float(relative.group("amount"))
        unit = relative.group("unit").casefold()
        delta = timedelta(seconds=amount * _TIME_UNIT_SECONDS[unit])
        sign = -1 if relative.group("sign") == "-" else 1
        parsed = current + sign * delta
        round_unit = relative.group("round")
        if round_unit:
            try:
                parsed = _round_time(parsed, round_unit)
            except ValueError:
                return _ParsedTime(raw, None, False)
        return _ParsedTime(raw, parsed.timestamp(), True)

    if re.fullmatch(r"\d{10}(?:\.\d+)?|\d{13}", raw):
        try:
            timestamp = float(raw)
            if len(raw.split(".", 1)[0]) == 13:
                timestamp /= 1_000
            datetime.fromtimestamp(timestamp, timezone.utc)
            return _ParsedTime(raw, timestamp, True)
        except (OverflowError, ValueError):
            return _ParsedTime(raw, None, False)

    for format_string in _ABSOLUTE_TIME_FORMATS:
        candidate = raw
        if "%z" in format_string and candidate.endswith("Z"):
            candidate = candidate[:-1] + "+00:00"
        try:
            parsed = datetime.strptime(candidate, format_string)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return _ParsedTime(raw, parsed.astimezone(timezone.utc).timestamp(), True)
        except ValueError:
            continue
    return _ParsedTime(raw, None, False)


class SplunkQueryPolicy:
    """Analyze SPL and make an explicit authorization decision."""

    def __init__(
        self,
        config: QueryPolicyConfig | Mapping[str, Any] | None = None,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        if isinstance(config, Mapping):
            config = QueryPolicyConfig(**config)
        self.config = config or QueryPolicyConfig()
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def evaluate(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        *,
        allow_outputcsv: bool = False,
    ) -> QueryPolicyResult:
        if not isinstance(query, str):
            query = ""
        query = query.strip()
        scan = _mask_and_scan(query)
        detected_indexes, wildcard_indexes, index_scope_unknown, top_level_index = _index_values(query)

        earliest_values = _iter_assignments(query, "earliest")
        latest_values = _iter_assignments(query, "latest")
        all_earliest_values = [earliest_time, *(value for value, valid in earliest_values if valid)]
        all_latest_values = [latest_time, *(value for value, valid in latest_values if valid)]
        effective_earliest = all_earliest_values[-1] if all_earliest_values else None
        effective_latest = all_latest_values[-1] if all_latest_values else None
        now = self._clock()
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        parsed_input_earliest = parse_splunk_time(earliest_time, now=now, earliest=True)
        parsed_input_latest = parse_splunk_time(latest_time, now=now)
        parsed_earliest = parse_splunk_time(effective_earliest, now=now, earliest=True)
        parsed_latest = parse_splunk_time(effective_latest, now=now)
        invalid_assignment = any(not valid for _, valid in (*earliest_values, *latest_values))
        all_time = parsed_input_earliest.all_time or parsed_earliest.all_time or any(
            isinstance(value, str) and value.strip().casefold() in {"0", "all", "alltime"}
            for value, valid in earliest_values
            if valid
        )
        estimated_lookback: int | None = None
        # Validate both dispatch bounds even if the SPL contains an override.
        # The REST request still carries the caller-supplied values, so an
        # invalid bound must never become safe merely because another value was
        # found later in the query text.
        time_known = (
            parsed_input_earliest.known
            and parsed_input_latest.known
            and parsed_earliest.known
            and parsed_latest.known
            and not invalid_assignment
        )
        if time_known and not all_time and parsed_earliest.timestamp is not None and parsed_latest.timestamp is not None:
            difference = parsed_latest.timestamp - parsed_earliest.timestamp
            if difference < 0:
                time_known = False
            else:
                estimated_lookback = int(difference)

        expensive_commands = [command for command in scan.commands if command in _EXPENSIVE_COMMANDS]
        dangerous_commands = [command for command in scan.commands if command in _DANGEROUS_COMMANDS]
        allowed_commands = (
            ["outputcsv"]
            if allow_outputcsv and "outputcsv" in dangerous_commands
            else []
        )
        unresolved_macros = [
            macro for macro in scan.macros if macro.casefold() not in set(self.config.trusted_macros)
        ]
        reasons: list[str] = []
        decision: PolicyDecision = "allow"

        def add(decision_value: PolicyDecision, reason: str) -> None:
            nonlocal decision
            reasons.append(reason)
            if _DECISION_RANK[decision_value] > _DECISION_RANK[decision]:
                decision = decision_value

        if scan.malformed:
            add("deny", "SPL structure is malformed or unbalanced.")
        for command in dangerous_commands:
            if command in allowed_commands:
                reasons.append(
                    "Dangerous command 'outputcsv' is permitted only in an exact, "
                    "disabled saved-search definition and is not executable as a read-only search."
                )
                continue
            add("deny", f"Dangerous command '{command}' is not allowed for read-only searches.")

        if wildcard_indexes:
            add(self.config.wildcard_index_decision, "Wildcard index scope requires explicit review.")
        if index_scope_unknown:
            add("require_approval", "The index expression could not be interpreted safely.")
        elif not top_level_index and scan.first_command not in _INDEX_FREE_COMMANDS:
            add(self.config.no_index_decision, "No explicit index scope was found.")

        if not time_known:
            add(
                self.config.unparseable_time_decision,
                "The earliest/latest time expression could not be interpreted safely.",
            )
        elif all_time:
            add(self.config.all_time_decision, "The search has an all-time earliest bound.")
        elif estimated_lookback is not None:
            if estimated_lookback > self.config.very_long_search_seconds:
                add(
                    self.config.very_long_decision,
                    "The search window exceeds the configured very-long threshold.",
                )
            elif estimated_lookback > self.config.normal_search_seconds and not self._is_aggregated(scan.commands):
                add(
                    self.config.long_raw_decision,
                    "A raw-event search exceeds the configured normal time window.",
                )

        if expensive_commands:
            expensive_decision = self.config.expensive_command_decision
            # A relaxed expensive-command setting only applies to a short,
            # known, index-scoped search. Larger or structurally nested work
            # remains approval-gated regardless of its informational score.
            if (
                time_known
                and not all_time
                and estimated_lookback is not None
                and estimated_lookback <= self.config.short_search_seconds
                and top_level_index
                and not scan.subsearches
            ):
                scope_decision = expensive_decision
            else:
                scope_decision = (
                    expensive_decision
                    if _DECISION_RANK[expensive_decision] >= _DECISION_RANK["require_approval"]
                    else "require_approval"
                )
            for command in expensive_commands:
                add(
                    scope_decision,
                    (
                        f"Expensive command '{command}' is allowed within the configured short-search policy."
                        if scope_decision == "allow"
                        else f"Expensive command '{command}' requires review for this scope."
                    ),
                )

        if scan.subsearches:
            unbounded = [item for item in scan.subsearches if item.end is None or not self._has_subsearch_limit(scan.masked[item.start:item.end])]
            if unbounded:
                add(self.config.subsearch_decision, "A subsearch has no explicit maxout/maxresults bound.")
            if scan.max_depth > self.config.max_subsearch_depth:
                add(
                    self.config.nested_subsearch_decision,
                    f"Nested subsearch depth {scan.max_depth} exceeds the configured depth.",
                )

        for macro in unresolved_macros:
            add(self.config.unresolved_macro_decision, f"Macro '{macro}' is unresolved and requires review.")

        # A broad, unbounded expensive search is unsafe even if individual
        # configurable checks were relaxed. This is a structural deny, not a
        # score threshold.
        if all_time and any(command in expensive_commands for command in ("transaction", "join", "map")):
            add("deny", "All-time searches cannot execute transaction, join, or map commands.")

        risk_score = self._risk_score(
            dangerous_commands=dangerous_commands,
            wildcard_indexes=wildcard_indexes,
            index_scope_unknown=index_scope_unknown,
            no_index=not top_level_index and scan.first_command not in _INDEX_FREE_COMMANDS,
            all_time=all_time,
            time_known=time_known,
            lookback=estimated_lookback,
            normal_search_seconds=self.config.normal_search_seconds,
            expensive_commands=expensive_commands,
            subsearch_depth=scan.max_depth,
            macros=unresolved_macros,
            malformed=scan.malformed,
        )
        result = QueryPolicyResult(
            decision=decision,
            reasons=_unique(reasons),
            detected_indexes=detected_indexes,
            wildcard_indexes=wildcard_indexes,
            earliest=effective_earliest,
            latest=effective_latest,
            estimated_lookback_seconds=estimated_lookback,
            commands=scan.commands,
            expensive_commands=_unique(expensive_commands),
            dangerous_commands=_unique(dangerous_commands),
            allowed_commands=_unique(allowed_commands),
            has_subsearch=bool(scan.subsearches),
            subsearch_depth=scan.max_depth,
            macros=scan.macros,
            unresolved_macros=unresolved_macros,
            risk_score=risk_score,
            index_scope_unknown=index_scope_unknown,
            all_time=all_time,
        )
        logger.info(
            "splunk query policy decision",
            extra={
                "decision": result.decision,
                "reasons": result.reasons,
                "detected_indexes": result.detected_indexes,
                "wildcard_indexes": result.wildcard_indexes,
                "estimated_lookback_seconds": result.estimated_lookback_seconds,
                "expensive_commands": result.expensive_commands,
                "dangerous_commands": result.dangerous_commands,
                "allowed_commands": result.allowed_commands,
                "subsearch_depth": result.subsearch_depth,
                "macros": result.macros,
            },
        )
        return result

    @staticmethod
    def _is_aggregated(commands: list[str]) -> bool:
        return any(command in _TABLE_COMMANDS for command in commands)

    @staticmethod
    def _has_subsearch_limit(value: str) -> bool:
        if re.search(r"\b(?:maxout|maxresults)\s*=", value, re.IGNORECASE):
            return True
        inner = value.strip()
        if inner.startswith("[") and inner.endswith("]"):
            inner = inner[1:-1]
        # Splunk's terminal return command defaults to the first row, which is
        # the bounded filename subsearch used by outputcsv definitions.
        return bool(
            re.search(
                r"(?:^|\|)\s*return(?:\s+1)?\s+\$?[A-Za-z_][A-Za-z0-9_]*\s*$",
                inner,
                re.IGNORECASE,
            )
        )

    @staticmethod
    def _risk_score(
        *,
        dangerous_commands: list[str],
        wildcard_indexes: bool,
        index_scope_unknown: bool,
        no_index: bool,
        all_time: bool,
        time_known: bool,
        lookback: int | None,
        normal_search_seconds: int,
        expensive_commands: list[str],
        subsearch_depth: int,
        macros: list[str],
        malformed: bool,
    ) -> int | None:
        if not time_known:
            score = 30
        else:
            score = 0
        score += 100 if dangerous_commands or malformed else 0
        score += 35 if wildcard_indexes else 0
        score += 25 if index_scope_unknown else 0
        score += 20 if no_index else 0
        score += 50 if all_time else 0
        score += 25 if lookback is not None and lookback > normal_search_seconds else 0
        score += 25 * len(expensive_commands)
        score += 15 if subsearch_depth else 0
        score += 15 * len(macros)
        return min(score, 100)


__all__ = [
    "PolicyDecision",
    "QueryPolicyConfig",
    "QueryPolicyResult",
    "SplunkQueryPolicy",
    "parse_splunk_time",
]
