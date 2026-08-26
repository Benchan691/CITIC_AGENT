"""Read, validate, preview, and guarded-write Zimbra incoming filters."""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from email.utils import parseaddr
from typing import Any

from unified_mcp_server.account_store import AccountStore, StoredAccount
from unified_mcp_server.config import ZimbraSettings
from unified_mcp_server.errors import ConfigurationError, ServiceError
from unified_mcp_server.zimbra import (
    zimbra_get_filter_rules,
    zimbra_list_folders,
    zimbra_login,
    zimbra_modify_filter_rules,
)
from unified_mcp_server.zimbra_service import _upstream_error

from ..core.service import ZimbraCore
from .model import EmailFilter, serialize_filter_rules


SUPPORTED_TESTS = {"header", "subject", "body", "attachment", "size", "date"}
TEST_OPERATORS = {
    "header": {"is", "contains", "matches", "exists", "not_exists"},
    "subject": {"is", "contains", "matches", "exists", "not_exists"},
    "body": {"is", "contains", "matches"},
    "attachment": {"exists", "not_exists"},
    "size": {"over", "under"},
    "date": {"before", "after"},
}
SIZE_OPERATORS = {"over", "under"}
DATE_OPERATORS = {"before", "after"}
SUPPORTED_ACTIONS = {"keep", "file_into", "tag", "flag", "stop", "redirect", "discard"}
VALID_FLAGS = {"read", "flagged"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
SIZE_RE = re.compile(r"^\d+(?:[KMG])?$", re.IGNORECASE)
DATE_RE = re.compile(r"^\d+$")


class ZimbraFilterService:
    def __init__(self, settings: ZimbraSettings, accounts: AccountStore | None = None, core: ZimbraCore | None = None) -> None:
        self.core = core or ZimbraCore(settings, accounts)
        self.settings = self.core.settings

    @staticmethod
    def _fingerprint(rules: list[EmailFilter]) -> str:
        payload = [rule.to_dict() for rule in rules]
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def _find(rules: list[EmailFilter], name: str) -> tuple[int, EmailFilter]:
        for index, rule in enumerate(rules):
            if rule.name == name:
                return index, rule
        raise ServiceError("not_found", "The Zimbra email filter was not found.")

    async def _run(self, function, *args, **kwargs):
        try:
            return await asyncio.to_thread(function, *args, **kwargs)
        except ServiceError:
            raise
        except ValueError as exc:
            raise ServiceError("zimbra_malformed_response", "Zimbra returned a malformed filter response.") from exc
        except (TypeError, OverflowError) as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        except Exception as exc:
            raise _upstream_error(exc) from exc

    def _config(self, account: StoredAccount) -> dict[str, object]:
        return self.core.client_config(account)

    def _resolve_account(self, account_id: str) -> StoredAccount:
        return self.core.resolve_account(account_id)

    def _read_filters_with_token(self, token: str) -> list[EmailFilter]:
        elements = zimbra_get_filter_rules(
            self.settings.host,
            token,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
        )
        return [EmailFilter.from_zimbra(element, order=index) for index, element in enumerate(elements, 1)]

    def _read_folders_with_token(self, token: str) -> list[dict[str, Any]]:
        return zimbra_list_folders(
            self.settings.host,
            token,
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
        )

    def _read_filters_and_folders_with_token(
        self,
        token: str,
    ) -> tuple[list[EmailFilter], list[dict[str, Any]]]:
        return self._read_filters_with_token(token), self._read_folders_with_token(token)

    async def _login(self, account: StoredAccount) -> str:
        if not self.settings.host:
            raise ConfigurationError("Zimbra", ["ZIMBRA_HOST"])
        return await self._run(zimbra_login, self._config(account))

    async def _read_filters(
        self,
        account: StoredAccount,
        token: str = "",
    ) -> list[EmailFilter]:
        if not self.settings.host:
            raise ConfigurationError("Zimbra", ["ZIMBRA_HOST"])
        return await self._run(
            self._read_filters_with_token,
            token or await self._login(account),
        )

    async def _read_filters_and_folders(
        self,
        account: StoredAccount,
        token: str = "",
    ) -> tuple[list[EmailFilter], list[dict[str, Any]]]:
        if not self.settings.host:
            raise ConfigurationError("Zimbra", ["ZIMBRA_HOST"])
        return await self._run(
            self._read_filters_and_folders_with_token,
            token or await self._login(account),
        )

    async def list_email_filters(self, account_id: str = "", include_details: bool = False) -> dict[str, Any]:
        account = self._resolve_account(account_id)
        rules = await self._read_filters(account)
        filters = [
            rule.to_dict() if include_details else {
                "name": rule.name,
                "enabled": rule.enabled,
                "order": rule.order,
                "round_trip_safe": rule.round_trip_safe,
            }
            for rule in rules
        ]
        return {
            "account_id": account.id,
            "account": account.agent_dict(),
            "count": len(rules),
            "filters": filters,
            "details_included": include_details,
            "fingerprint": self._fingerprint(rules),
        }

    async def get_email_filter(self, name: str, account_id: str = "") -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        account = self._resolve_account(account_id)
        rules = await self._read_filters(account)
        _, rule = self._find(rules, name)
        return {"account_id": account.id, "account": account.agent_dict(), "filter": rule.to_dict(), "fingerprint": self._fingerprint(rules)}

    @staticmethod
    def _folder_exists(folder: str, folders: list[dict[str, Any]]) -> bool:
        target = folder.strip().casefold()
        if not target:
            return False
        for item in folders:
            values = {str(item.get(key, "")).strip().casefold() for key in ("id", "name", "path")}
            values |= {value.lstrip("/") for value in values}
            if target in values or target.lstrip("/") in values:
                return True
        return False

    def _validate(
        self,
        rule: EmailFilter,
        current: list[EmailFilter],
        folders: list[dict[str, Any]],
        *,
        current_name: str | None = None,
        order_limit: int | None = None,
    ) -> dict[str, Any]:
        errors: list[dict[str, str]] = []
        warnings: list[str] = []
        dangerous: list[str] = []
        if not rule.name:
            errors.append({"field": "name", "message": "rule name cannot be empty"})
        names = [item.name.casefold() for item in current if item.name != current_name]
        if rule.name.casefold() in names:
            errors.append({"field": "name", "message": "rule name must be unique"})
        if rule.condition not in {"allof", "anyof"}:
            errors.append({"field": "condition", "message": "condition must be allof or anyof"})
        if not rule.tests:
            errors.append({"field": "tests", "message": "at least one test is required"})
        if not rule.actions:
            errors.append({"field": "actions", "message": "at least one action is required"})
        for index, test in enumerate(rule.tests):
            if test.type not in SUPPORTED_TESTS:
                errors.append({"field": f"tests[{index}].type", "message": f"unsupported test: {test.type}"})
                continue
            operators = TEST_OPERATORS[test.type]
            if test.operator not in operators:
                errors.append({"field": f"tests[{index}].operator", "message": "unsupported comparison operator"})
            if test.type in {"header", "subject", "body", "attachment"} and test.operator not in {"exists", "not_exists"} and not test.value:
                errors.append({"field": f"tests[{index}].value", "message": "a comparison value is required"})
            if test.type == "header" and not test.field:
                errors.append({"field": f"tests[{index}].field", "message": "header tests require a header field"})
            if test.type == "size":
                if not SIZE_RE.fullmatch(test.value):
                    errors.append({"field": f"tests[{index}].value", "message": "size must be a non-negative integer with optional K/M/G suffix"})
            if test.type == "date" and (not test.value or not DATE_RE.fullmatch(test.value)):
                errors.append({"field": f"tests[{index}].value", "message": "date must be Unix seconds"})
            if test.type == "attachment" and test.value:
                errors.append({"field": f"tests[{index}].value", "message": "attachment tests do not accept a value"})
        for index, action in enumerate(rule.actions):
            if action.type not in SUPPORTED_ACTIONS:
                errors.append({"field": f"actions[{index}].type", "message": f"unsupported action: {action.type}"})
            elif action.type == "discard":
                dangerous.append("discard")
                if any((action.folder, action.tag, action.flag, action.address)):
                    errors.append({"field": f"actions[{index}]", "message": "discard does not accept parameters"})
            elif action.type in {"keep", "stop"} and any((action.folder, action.tag, action.flag, action.address)):
                errors.append({"field": f"actions[{index}]", "message": f"{action.type} does not accept parameters"})
            elif action.type == "file_into" and not action.folder:
                errors.append({"field": f"actions[{index}].folder", "message": "folder is required"})
            elif action.type == "file_into" and not self._folder_exists(action.folder, folders):
                errors.append({"field": f"actions[{index}].folder", "message": "target folder does not exist"})
            elif action.type == "tag" and not action.tag:
                errors.append({"field": f"actions[{index}].tag", "message": "tag cannot be empty"})
            elif action.type == "flag" and action.flag not in VALID_FLAGS:
                errors.append({"field": f"actions[{index}].flag", "message": "unsupported flag"})
            elif action.type == "redirect" and not action.address:
                dangerous.append("redirect")
                errors.append({"field": f"actions[{index}].address", "message": "redirect address is required"})
            elif action.type == "redirect":
                dangerous.append("redirect")
                if not EMAIL_RE.fullmatch(parseaddr(action.address)[1]):
                    errors.append({"field": f"actions[{index}].address", "message": "redirect address is invalid"})
        limit = order_limit if order_limit is not None else len(current) + (0 if current_name else 1)
        if not 1 <= rule.order <= max(1, limit):
            errors.append({"field": "order", "message": f"order must be between 1 and {max(1, limit)}"})
        if dangerous:
            warnings.append("This rule contains a dangerous action: " + ", ".join(sorted(set(dangerous))))
        gate_violations = []
        if not self.settings.allow_filter_write:
            gate_violations.append("filter_write")
        if "redirect" in dangerous and not self.settings.allow_filter_redirect:
            gate_violations.append("redirect")
        if "discard" in dangerous and not self.settings.allow_filter_discard:
            gate_violations.append("discard")
        return {
            "valid": not errors,
            "server_allowed": not gate_violations,
            "executable": not errors and not gate_violations,
            "errors": errors,
            "warnings": warnings,
            "dangerous_actions": sorted(set(dangerous)),
            "gate_violations": gate_violations,
            "rule": rule.to_dict(),
        }

    async def validate_email_filter(self, payload: dict[str, Any], account_id: str = "") -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "rule must be an object")
        account = self._resolve_account(account_id)
        token = await self._login(account)
        current, folders = await self._read_filters_and_folders(account, token)
        try:
            rule = EmailFilter.from_payload(payload, default_order=len(current) + 1)
        except (TypeError, ValueError) as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        validation = self._validate(rule, current, folders, order_limit=len(current) + 1)
        return {"account_id": account.id, "account": account.agent_dict(), "fingerprint": self._fingerprint(current), **validation}

    async def preview_email_filter_update(self, name: str, payload: dict[str, Any], account_id: str = "") -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "rule must be an object")
        account = self._resolve_account(account_id)
        token = await self._login(account)
        current, folders = await self._read_filters_and_folders(account, token)
        index, existing = self._find(current, name.strip())
        merged = {**existing.to_dict(), **payload, "name": payload.get("name", existing.name), "order": payload.get("order", index + 1)}
        try:
            proposed = EmailFilter.from_payload(merged, default_order=index + 1)
        except (TypeError, ValueError) as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        validation = self._validate(proposed, current, folders, current_name=existing.name, order_limit=len(current))
        changed_fields = [key for key in ("name", "enabled", "condition", "tests", "actions", "order") if existing.to_dict().get(key) != proposed.to_dict().get(key)]
        return {
            "account_id": account.id,
            "account": account.agent_dict(),
            "current_rule": existing.to_dict(),
            "proposed_rule": proposed.to_dict(),
            "changed_fields": changed_fields,
            "resulting_rule_position": proposed.order,
            "current_fingerprint": self._fingerprint(current),
            **{key: validation[key] for key in ("warnings", "dangerous_actions", "valid", "server_allowed", "executable", "errors", "gate_violations")},
        }

    def _require_write(self) -> None:
        if not self.settings.allow_filter_write:
            raise ServiceError("operation_disabled", "Zimbra filter writes are disabled. Set ZIMBRA_ALLOW_FILTER_WRITE=true after review.")

    @staticmethod
    def _require_round_trip_safe(rules: list[EmailFilter]) -> None:
        unsafe = [rule.name for rule in rules if not rule.round_trip_safe]
        if unsafe:
            raise ServiceError(
                "filter_round_trip_unsafe",
                "Zimbra filter writes are blocked because existing rules contain unsupported syntax.",
                details={"filters": unsafe},
            )

    @staticmethod
    def _require_expected(expected_fingerprint: str) -> None:
        if not isinstance(expected_fingerprint, str) or not expected_fingerprint.strip():
            raise ServiceError("expected_fingerprint_required", "expected_fingerprint is required for filter modifications.")

    def _write_rules_sync(
        self,
        token: str,
        rules: list[EmailFilter],
        expected_fingerprint: str,
    ) -> str:
        latest = self._read_filters_with_token(token)
        self._require_round_trip_safe(latest)
        actual = self._fingerprint(latest)
        if actual != expected_fingerprint:
            raise ServiceError("filter_rules_changed", "Zimbra filter rules changed since they were read; refresh and retry.", details={"expected_fingerprint": expected_fingerprint, "current_fingerprint": actual})
        zimbra_modify_filter_rules(
            self.settings.host,
            token,
            serialize_filter_rules(rules),
            verify_ssl=self.settings.verify_ssl,
            timeout=self.settings.timeout,
        )
        return self._fingerprint(rules)

    async def _write_rules(self, token: str, rules: list[EmailFilter], expected_fingerprint: str) -> str:
        return await self._run(
            self._write_rules_sync,
            token,
            rules,
            expected_fingerprint,
        )

    async def create_email_filter(self, payload: dict[str, Any], expected_fingerprint: str, account_id: str = "") -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "rule must be an object")
        self._require_write()
        self._require_expected(expected_fingerprint)
        account = self._resolve_account(account_id)
        token = await self._login(account)
        current, folders = await self._read_filters_and_folders(account, token)
        self._require_round_trip_safe(current)
        try:
            rule = EmailFilter.from_payload(payload, default_order=len(current) + 1)
        except (TypeError, ValueError) as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        validation = self._validate(rule, current, folders, order_limit=len(current) + 1)
        if not validation["executable"]:
            raise ServiceError("filter_invalid", "Email filter validation failed.", details=validation)
        rules = current[:]
        rules.insert(rule.order - 1, rule)
        rules = [EmailFilter(**{**item.__dict__, "order": index}) for index, item in enumerate(rules, 1)]
        fingerprint = await self._write_rules(token, rules, expected_fingerprint)
        return {"account_id": account.id, "account": account.agent_dict(), "created": True, "filter": rule.to_dict(), "fingerprint": fingerprint}

    async def update_email_filter(self, name: str, payload: dict[str, Any], expected_fingerprint: str, account_id: str = "") -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ServiceError("invalid_input", "rule must be an object")
        self._require_write()
        self._require_expected(expected_fingerprint)
        account = self._resolve_account(account_id)
        token = await self._login(account)
        current, folders = await self._read_filters_and_folders(account, token)
        self._require_round_trip_safe(current)
        index, existing = self._find(current, name.strip())
        merged = {**existing.to_dict(), **payload, "name": payload.get("name", existing.name), "order": payload.get("order", index + 1)}
        try:
            proposed = EmailFilter.from_payload(merged, default_order=index + 1)
        except (TypeError, ValueError) as exc:
            raise ServiceError("invalid_input", str(exc)) from exc
        validation = self._validate(proposed, current, folders, current_name=existing.name, order_limit=len(current))
        if not validation["executable"]:
            raise ServiceError("filter_invalid", "Email filter validation failed.", details=validation)
        rules = current[:]
        rules[index] = proposed
        rules.sort(key=lambda item: item.order)
        rules = [EmailFilter(**{**item.__dict__, "order": position}) for position, item in enumerate(rules, 1)]
        fingerprint = await self._write_rules(token, rules, expected_fingerprint)
        return {"account_id": account.id, "account": account.agent_dict(), "updated": True, "filter": proposed.to_dict(), "fingerprint": fingerprint}

    async def delete_email_filter(self, name: str, expected_fingerprint: str, account_id: str = "") -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        self._require_write()
        self._require_expected(expected_fingerprint)
        account = self._resolve_account(account_id)
        token = await self._login(account)
        current = await self._read_filters(account, token)
        self._require_round_trip_safe(current)
        index, removed = self._find(current, name)
        rules = [item for position, item in enumerate(current) if position != index]
        rules = [EmailFilter(**{**item.__dict__, "order": position}) for position, item in enumerate(rules, 1)]
        fingerprint = await self._write_rules(token, rules, expected_fingerprint)
        return {
            "account_id": account.id,
            "account": account.agent_dict(),
            "deleted": True,
            "filter": removed.to_dict(),
            "fingerprint": fingerprint,
        }

    async def set_email_filter_enabled(self, name: str, enabled: bool, expected_fingerprint: str, account_id: str = "") -> dict[str, Any]:
        if enabled:
            return await self.update_email_filter(name, {"enabled": True}, expected_fingerprint, account_id)
        self._require_write()
        self._require_expected(expected_fingerprint)
        account = self._resolve_account(account_id)
        token = await self._login(account)
        current = await self._read_filters(account, token)
        self._require_round_trip_safe(current)
        index, existing = self._find(current, name.strip())
        disabled = EmailFilter(**{**existing.__dict__, "enabled": False})
        rules = current[:]
        rules[index] = disabled
        fingerprint = await self._write_rules(token, rules, expected_fingerprint)
        return {
            "account_id": account.id,
            "account": account.agent_dict(),
            "updated": True,
            "filter": disabled.to_dict(),
            "fingerprint": fingerprint,
        }

    async def reorder_email_filter(self, name: str, order: int, expected_fingerprint: str, account_id: str = "") -> dict[str, Any]:
        self._require_write()
        self._require_expected(expected_fingerprint)
        account = self._resolve_account(account_id)
        token = await self._login(account)
        current, folders = await self._read_filters_and_folders(account, token)
        self._require_round_trip_safe(current)
        index, rule = self._find(current, name.strip())
        try:
            target = int(order)
        except (TypeError, ValueError) as exc:
            raise ServiceError("invalid_input", "order must be an integer") from exc
        if not 1 <= target <= len(current):
            raise ServiceError("filter_invalid", "order must be within the current rule set.")
        rules = current[:]
        rules.pop(index)
        rules.insert(target - 1, rule)
        rules = [EmailFilter(**{**item.__dict__, "order": position}) for position, item in enumerate(rules, 1)]
        validation = self._validate(rules[target - 1], rules, folders, current_name=rule.name, order_limit=len(rules))
        if not validation["executable"]:
            raise ServiceError("filter_invalid", "Email filter validation failed.", details=validation)
        fingerprint = await self._write_rules(token, rules, expected_fingerprint)
        return {"account_id": account.id, "account": account.agent_dict(), "updated": True, "filter": rules[target - 1].to_dict(), "fingerprint": fingerprint}
