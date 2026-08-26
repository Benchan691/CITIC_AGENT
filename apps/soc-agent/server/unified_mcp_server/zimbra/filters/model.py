"""Typed, provider-neutral email-filter models and Zimbra XML serialization."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any


def _text(value: Any) -> str:
    return str(value if value is not None else "").strip()


def _bool(value: Any, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value is True or _text(value).lower() in {"1", "true", "yes", "on"}


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


_TEST_ELEMENTS = {
    "filtertest", "headertest", "headerexiststest", "sizetest",
    "datetest", "bodytest", "attachmenttest",
}
_ACTION_ELEMENTS = {
    "filteraction", "actionkeep", "actionfileinto", "actiontag",
    "actionflag", "actionredirect", "actionstop", "actiondiscard",
}
_TEST_ATTRIBUTES = {
    "filtertest": {"index", "name", "header", "stringComparison", "numberComparison", "dateComparison", "relationalComparison", "comparison", "value", "s", "d", "negative"},
    "headertest": {"index", "header", "stringComparison", "value", "negative"},
    "headerexiststest": {"index", "header", "negative"},
    "sizetest": {"index", "numberComparison", "s", "negative"},
    "datetest": {"index", "dateComparison", "d", "negative"},
    "bodytest": {"index", "stringComparison", "value", "negative"},
    "attachmenttest": {"index", "negative"},
}
_ACTION_ATTRIBUTES = {
    "filteraction": {"index", "name", "folderPath", "folder", "tagName", "tag", "flagName", "flag", "a", "address"},
    "actionkeep": {"index"},
    "actionfileinto": {"index", "folderPath", "folder"},
    "actiontag": {"index", "tagName", "tag"},
    "actionflag": {"index", "flagName", "flag"},
    "actionredirect": {"index", "a", "address"},
    "actionstop": {"index"},
    "actiondiscard": {"index"},
}
_SERIALIZABLE_TESTS = {
    ("header", "exists"), ("header", "not_exists"), ("header", "is"),
    ("header", "contains"), ("header", "matches"), ("header", "begins"),
    ("header", "ends"), ("subject", "exists"), ("subject", "not_exists"),
    ("subject", "is"), ("subject", "contains"), ("subject", "matches"),
    ("subject", "begins"), ("subject", "ends"), ("body", "contains"),
    ("body", "is"), ("body", "matches"), ("attachment", "exists"),
    ("attachment", "not_exists"), ("size", "over"), ("size", "under"),
    ("date", "before"), ("date", "after"),
}
_SERIALIZABLE_ACTIONS = {"keep", "file_into", "tag", "flag", "redirect", "stop", "discard"}


def _unsupported_zimbra_parts(element: ET.Element) -> tuple[str, ...]:
    unsupported: list[str] = []
    unknown_rule_attrs = set(element.attrib) - {"name", "active", "enabled"}
    unsupported.extend(f"rule attribute {name}" for name in sorted(unknown_rule_attrs))
    containers = {
        name: [item for item in element if _local_name(item.tag).lower() == name]
        for name in ("filtertests", "filteractions")
    }
    for name, items in containers.items():
        if len(items) != 1:
            unsupported.append(f"{name} container count {len(items)}")
    known_containers = {item for items in containers.values() for item in items}
    for item in element:
        if item not in known_containers:
            unsupported.append(f"rule element {_local_name(item.tag)}")
    for container in containers["filtertests"]:
        unsupported.extend(f"filterTests attribute {name}" for name in sorted(set(container.attrib) - {"condition"}))
        for item in container:
            name = _local_name(item.tag).lower()
            if name not in _TEST_ELEMENTS:
                unsupported.append(f"test element {_local_name(item.tag)}")
                continue
            unsupported.extend(
                f"{_local_name(item.tag)} attribute {attr}"
                for attr in sorted(set(item.attrib) - _TEST_ATTRIBUTES[name])
            )
            if name == "filtertest" and _text(item.get("name")).lower().replace("-", "_") not in {
                "header", "header_exists", "subject", "body", "attachment", "size", "date",
            }:
                unsupported.append(f"filtertest type {_text(item.get('name')) or '<missing>'}")
    for container in containers["filteractions"]:
        unsupported.extend(f"filterActions attribute {name}" for name in sorted(container.attrib))
        for item in container:
            name = _local_name(item.tag).lower()
            if name not in _ACTION_ELEMENTS:
                unsupported.append(f"action element {_local_name(item.tag)}")
                continue
            unsupported.extend(
                f"{_local_name(item.tag)} attribute {attr}"
                for attr in sorted(set(item.attrib) - _ACTION_ATTRIBUTES[name])
            )
            if name == "filteraction" and _text(item.get("name")).lower().replace("-", "_") not in {
                "keep", "fileinto", "file_into", "tag", "flag", "redirect", "forward", "stop", "discard",
            }:
                unsupported.append(f"filteraction type {_text(item.get('name')) or '<missing>'}")
    return tuple(dict.fromkeys(unsupported))


@dataclass(frozen=True)
class FilterTest:
    type: str
    operator: str = "contains"
    value: str = ""
    field: str = ""
    negative: bool = False

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "FilterTest":
        if not isinstance(payload, dict):
            raise ValueError("each test must be an object")
        test_type = _text(payload.get("type", payload.get("name", payload.get("test")))).lower().replace("-", "_")
        if test_type == "header_exists":
            test_type = "header"
            operator = "exists"
        else:
            operator = _text(
                payload.get(
                    "operator",
                    payload.get("string_comparison", payload.get("number_comparison", payload.get("date_comparison", "contains"))),
                )
            ).lower()
            if test_type == "attachment" and "operator" not in payload:
                operator = "exists"
        return cls(
            type=test_type,
            operator=operator,
            value=_text(payload.get("value", payload.get("pattern", payload.get("date", payload.get("size", ""))))),
            field=_text(payload.get("field", payload.get("header", ""))),
            negative=_bool(payload.get("negative")),
        )

    @classmethod
    def from_zimbra(cls, element: ET.Element) -> "FilterTest":
        element_name = _local_name(element.tag)
        names = {
            "headerTest": ("header", "value"),
            "headerExistsTest": ("header", "exists"),
            "sizeTest": ("size", "s"),
            "dateTest": ("date", "d"),
            "bodyTest": ("body", "value"),
            "attachmentTest": ("attachment", "exists"),
        }
        mapped = names.get(element_name)
        test_type = mapped[0] if mapped else _text(element.get("name")).lower().replace("-", "_")
        operator = _text(
            (mapped[1] if mapped and mapped[1] == "exists" else None)
            or element.get("stringComparison")
            or element.get("numberComparison")
            or element.get("dateComparison")
            or element.get("relationalComparison")
            or element.get("comparison")
            or "contains"
        ).lower()
        field = _text(element.get("header"))
        if test_type == "header" and field.casefold() == "subject":
            test_type = "subject"
        negative = _bool(element.get("negative"))
        if operator == "exists" and negative:
            operator = "not_exists"
            negative = False
        return cls(
            type=test_type,
            operator=operator,
            value=_text(element.get(mapped[1] if mapped and mapped[1] in {"s", "d", "value"} else "value")),
            field=field,
            negative=negative,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "operator": self.operator,
            "value": self.value,
            "field": self.field,
            "negative": self.negative,
        }

    def to_zimbra(self, index: int) -> ET.Element:
        names = {
            ("header", "exists"): "headerExistsTest",
            ("header", "not_exists"): "headerExistsTest",
            ("header", "is"): "headerTest",
            ("header", "contains"): "headerTest",
            ("header", "matches"): "headerTest",
            ("header", "begins"): "headerTest",
            ("header", "ends"): "headerTest",
            ("subject", "exists"): "headerExistsTest",
            ("subject", "not_exists"): "headerExistsTest",
            ("subject", "is"): "headerTest",
            ("subject", "contains"): "headerTest",
            ("subject", "matches"): "headerTest",
            ("subject", "begins"): "headerTest",
            ("subject", "ends"): "headerTest",
            ("body", "contains"): "bodyTest",
            ("body", "is"): "bodyTest",
            ("body", "matches"): "bodyTest",
            ("attachment", "exists"): "attachmentTest",
            ("attachment", "not_exists"): "attachmentTest",
            ("size", "over"): "sizeTest",
            ("size", "under"): "sizeTest",
            ("date", "before"): "dateTest",
            ("date", "after"): "dateTest",
        }
        name = names.get((self.type, self.operator))
        if name is None:
            raise ValueError(f"unsupported filter test: {self.type}/{self.operator}")
        element = ET.Element(name, {"index": str(index)})
        if self.operator:
            if name in {"headerTest", "bodyTest"}:
                element.set("stringComparison", self.operator)
            elif name == "sizeTest":
                element.set("numberComparison", self.operator)
            elif name == "dateTest":
                element.set("dateComparison", self.operator)
        if self.field and name in {"headerTest", "headerExistsTest"}:
            element.set("header", self.field)
        if self.type == "subject" and name in {"headerTest", "headerExistsTest"}:
            element.set("header", self.field or "Subject")
        if self.value and name in {"headerTest", "bodyTest"}:
            element.set("value", self.value)
        elif self.value and name == "sizeTest":
            element.set("s", self.value)
        elif self.value and name == "dateTest":
            element.set("d", self.value)
        if self.negative or self.operator == "not_exists":
            element.set("negative", "1")
        return element


@dataclass(frozen=True)
class FilterAction:
    type: str
    folder: str = ""
    tag: str = ""
    flag: str = ""
    address: str = ""

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "FilterAction":
        if not isinstance(payload, dict):
            raise ValueError("each action must be an object")
        action_type = _text(payload.get("type", payload.get("name", payload.get("action")))).lower().replace("-", "_")
        aliases = {"fileinto": "file_into", "file_into_folder": "file_into", "forward": "redirect"}
        action_type = aliases.get(action_type, action_type)
        allowed = {
            "keep": {"type", "name", "action"},
            "stop": {"type", "name", "action"},
            "discard": {"type", "name", "action"},
            "file_into": {"type", "name", "action", "folder", "folder_id", "folder_path"},
            "tag": {"type", "name", "action", "tag", "tag_name"},
            "flag": {"type", "name", "action", "flag", "flag_name"},
            "redirect": {"type", "name", "action", "address", "email", "to"},
        }.get(action_type)
        if allowed is not None:
            unexpected = sorted(set(payload) - allowed)
            if unexpected:
                raise ValueError(f"unsupported {action_type} action parameter: {unexpected[0]}")
        return cls(
            type=action_type,
            folder=_text(payload.get("folder", payload.get("folder_id", payload.get("folder_path", "")))),
            tag=_text(payload.get("tag", payload.get("tag_name", ""))),
            flag=_text(payload.get("flag", payload.get("flag_name", ""))),
            address=_text(payload.get("address", payload.get("email", payload.get("to", "")))),
        )

    @classmethod
    def from_zimbra(cls, element: ET.Element) -> "FilterAction":
        names = {
            "actionKeep": "keep",
            "actionFileInto": "file_into",
            "actionTag": "tag",
            "actionFlag": "flag",
            "actionRedirect": "redirect",
            "actionStop": "stop",
            "actionDiscard": "discard",
        }
        action_type = names.get(_local_name(element.tag), _text(element.get("name")).lower().replace("-", "_"))
        action_type = {"fileinto": "file_into", "forward": "redirect"}.get(action_type, action_type)
        return cls(
            type=action_type,
            folder=_text(element.get("folderPath") or element.get("folder")),
            tag=_text(element.get("tagName") or element.get("tag")),
            flag=_text(element.get("flagName") or element.get("flag")),
            address=_text(element.get("a") or element.get("address")),
        )

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"type": self.type}
        if self.folder:
            result["folder"] = self.folder
        if self.tag:
            result["tag"] = self.tag
        if self.flag:
            result["flag"] = self.flag
        if self.address:
            result["address"] = self.address
        return result

    def to_zimbra(self, index: int) -> ET.Element:
        names = {
            "keep": "actionKeep",
            "file_into": "actionFileInto",
            "tag": "actionTag",
            "flag": "actionFlag",
            "redirect": "actionRedirect",
            "stop": "actionStop",
            "discard": "actionDiscard",
        }
        action_type = names.get(self.type)
        if action_type is None:
            raise ValueError(f"unsupported filter action: {self.type}")
        attrs = {"index": str(index)}
        if self.folder:
            attrs["folderPath"] = self.folder
        if self.tag:
            attrs["tagName"] = self.tag
        if self.flag:
            attrs["flagName"] = self.flag
        if self.address:
            attrs["a"] = self.address
        return ET.Element(action_type, attrs)


@dataclass(frozen=True)
class EmailFilter:
    name: str
    enabled: bool
    condition: str
    tests: tuple[FilterTest, ...]
    actions: tuple[FilterAction, ...]
    order: int = 1
    round_trip_safe: bool = True
    unsupported: tuple[str, ...] = ()

    @classmethod
    def from_payload(cls, payload: dict[str, Any], *, default_order: int = 1) -> "EmailFilter":
        if not isinstance(payload, dict):
            raise ValueError("rule must be an object")
        tests = payload.get("tests", [])
        actions = payload.get("actions", [])
        if not isinstance(tests, list) or not isinstance(actions, list):
            raise ValueError("tests and actions must be arrays")
        condition = _text(payload.get("condition", payload.get("match", "allof"))).lower()
        return cls(
            name=_text(payload.get("name")),
            enabled=_bool(payload.get("enabled", payload.get("active")), True),
            condition=condition,
            tests=tuple(FilterTest.from_payload(item) for item in tests),
            actions=tuple(FilterAction.from_payload(item) for item in actions),
            order=int(payload.get("order", payload.get("position", default_order)) or default_order),
        )

    @classmethod
    def from_zimbra(cls, element: ET.Element, *, order: int) -> "EmailFilter":
        tests_container = next((item for item in element if _local_name(item.tag).lower() == "filtertests"), None)
        actions_container = next((item for item in element if _local_name(item.tag).lower() == "filteractions"), None)
        parsed_tests = tuple(
            FilterTest.from_zimbra(item)
            for item in (tests_container if tests_container is not None else [])
            if _local_name(item.tag).lower() in {"filtertest", "headertest", "headerexiststest", "sizetest", "datetest", "bodytest", "attachmenttest"}
        )
        parsed_actions = tuple(
            FilterAction.from_zimbra(item)
            for item in (actions_container if actions_container is not None else [])
            if _local_name(item.tag).lower() in {"filteraction", "actionkeep", "actionfileinto", "actiontag", "actionflag", "actionredirect", "actionstop", "actiondiscard"}
        )
        unsupported = list(_unsupported_zimbra_parts(element))
        unsupported.extend(
            f"filter test {test.type}/{test.operator}"
            for test in parsed_tests
            if (test.type, test.operator) not in _SERIALIZABLE_TESTS
        )
        unsupported.extend(
            f"filter action {action.type or '<missing>'}"
            for action in parsed_actions
            if action.type not in _SERIALIZABLE_ACTIONS
        )
        tests = tuple(test for test in parsed_tests if (test.type, test.operator) in _SERIALIZABLE_TESTS)
        actions = tuple(action for action in parsed_actions if action.type in _SERIALIZABLE_ACTIONS)
        unsupported = list(dict.fromkeys(unsupported))
        return cls(
            name=_text(element.get("name")),
            enabled=_bool(element.get("active", element.get("enabled")), True),
            condition=_text(tests_container.get("condition") if tests_container is not None else "allof").lower(),
            tests=tests,
            actions=actions,
            order=order,
            round_trip_safe=not unsupported,
            unsupported=tuple(unsupported),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "enabled": self.enabled,
            "condition": self.condition,
            "tests": [test.to_dict() for test in self.tests],
            "actions": [action.to_dict() for action in self.actions],
            "order": self.order,
            "round_trip_safe": self.round_trip_safe,
            "unsupported": list(self.unsupported),
        }

    def to_zimbra(self) -> ET.Element:
        element = ET.Element("filterRule", {"name": self.name, "active": "1" if self.enabled else "0"})
        tests = ET.SubElement(element, "filterTests", {"condition": self.condition})
        # ponytail: normalize unsupported existing syntax instead of owning a raw-XML
        # preservation layer; add raw fragments only if lossless edits become required.
        for test in self.tests:
            try:
                tests.append(test.to_zimbra(len(tests)))
            except ValueError:
                continue
        actions = ET.SubElement(element, "filterActions")
        for action in self.actions:
            try:
                actions.append(action.to_zimbra(len(actions)))
            except ValueError:
                continue
        return element


def serialize_filter_rules(rules: list[EmailFilter]) -> str:
    container = ET.Element("filterRules")
    for rule in rules:
        container.append(rule.to_zimbra())
    return ET.tostring(container, encoding="unicode", short_empty_elements=True)
