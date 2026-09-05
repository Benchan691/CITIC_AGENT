"""Splunk search, lookup discovery, and guarded lookup CSV editing."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from ..core.service import SplunkCore
from .executor import SearchExecutor
from .evidence import SearchEvidenceCoordinator, fingerprint_request, resolve_time_window
from .lookup import (
    canonical_csv_text,
    lookup_fingerprint,
    lookup_rows_from_response,
    lookup_summary,
    normalize_lookup_name,
    normalize_lookups,
    rest_search_filter,
    serialize_csv_rows,
)
from .planner import SearchIntent, SearchPlanner
from .schema_registry import SearchSchemaRegistry
from .verifier import SearchResultVerifier
from unified_mcp_server.errors import ServiceError


logger = logging.getLogger(__name__)


class SplunkSearchService:
    def __init__(
        self,
        core: SplunkCore,
        executor: SearchExecutor | None = None,
        planner: SearchPlanner | None = None,
        schema_registry: SearchSchemaRegistry | None = None,
        verifier: SearchResultVerifier | None = None,
        evidence: SearchEvidenceCoordinator | None = None,
    ) -> None:
        self.core = core
        self.executor = executor if executor is not None else SearchExecutor(core)
        self.planner = planner if planner is not None else SearchPlanner(
            getattr(core.settings, "search_planner_max_refinements", 0)
        )
        self.schema_registry = schema_registry or SearchSchemaRegistry.default()
        self.verifier = verifier or SearchResultVerifier()
        self.evidence = evidence if evidence is not None else SearchEvidenceCoordinator(
            reuse_ttl_seconds=int(getattr(core.settings, "search_reuse_ttl_seconds", 300)),
            store_path=getattr(core.settings, "evidence_store_path", ""),
        )
        self._lookup_save_lock = asyncio.Lock()

    def validate(self, query: str, earliest_time: str = "-24h", latest_time: str = "now") -> dict[str, Any]:
        return self.core.validate_query(query, earliest_time, latest_time)

    async def search(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_count: int = 50,
        fields: list[str] | None = None,
        *,
        principal_id: str | None = None,
        fresh: bool = False,
    ) -> dict[str, Any]:
        resolved_start, resolved_end, resolved = resolve_time_window(earliest_time, latest_time)
        fingerprint = fingerprint_request(
            query=query,
            earliest_time=earliest_time,
            latest_time=latest_time,
            max_count=max_count,
            fields=fields,
            principal_id=principal_id,
        )

        async def runner() -> dict[str, Any]:
            return await self.executor.execute(
                query,
                resolved_start,
                resolved_end,
                max_count,
                fields,
                principal_id=principal_id,
            )

        execution, reused, coalesced = await self.evidence.execute_coalesced(fingerprint, runner, fresh=fresh or not resolved)
        response = self._format_execution(query, execution["earliest_time"], execution["latest_time"], execution)
        evidence_id = execution.get("_evidence_id")
        record = reused
        if record is None and evidence_id:
            try:
                record = self.evidence.get_record(evidence_id)
            except ServiceError:
                pass  # An oversized or concurrently evicted snapshot has no reference.
        if record is not None:
            response["evidence"] = record.summary(reused=reused is not None)
            if coalesced:
                response["evidence"]["coalesced"] = True
        else:
            response["evidence"] = {"retained": False, "reason": "snapshot_exceeds_retention_limit"}
        response["search"]["time_window_resolved"] = resolved
        return response

    @staticmethod
    def _format_execution(
        query: str,
        earliest_time: str,
        latest_time: str,
        execution: dict[str, Any],
    ) -> dict[str, Any]:
        validation = execution["validation"]
        events = execution["events"]
        metadata = execution["search_metadata"]
        run_duration = metadata["run_duration"]
        run_duration_ms = (
            int(round(run_duration * 1000))
            if isinstance(run_duration, (int, float)) and not isinstance(run_duration, bool)
            else None
        )
        result: dict[str, Any] = {
            "type": execution["result_type"],
            "rows": events,
        }
        if execution["result_type"] == "table":
            result["columns"] = execution["columns"]
        return {
            "query": query,
            "search": {
                "earliest_time": earliest_time,
                "latest_time": latest_time,
                "run_duration_seconds": run_duration,
                "run_duration_ms": run_duration_ms,
                "scanned_events": metadata["scan_count"],
                "result_count": metadata["total_result_count"],
                "fetched_count": metadata["fetched_count"],
                "returned_count": metadata["returned_count"],
                "splunk_result_truncated": metadata["splunk_result_truncated"],
                "mcp_context_truncated": metadata["mcp_context_truncated"],
            },
            "result": result,
            "truncated": (
                metadata["splunk_result_truncated"] is True
                or metadata["mcp_context_truncated"] is True
            ),
            "risk": {
                "score": validation["risk_score"],
                "tolerance": validation["risk_tolerance"],
            },
        }

    async def search_intent(
        self,
        intent: SearchIntent,
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        """Plan and execute one normal SOC search inside this backend call."""
        if not isinstance(intent, SearchIntent):
            raise ServiceError("invalid_input", "search intent is malformed")
        plan = self.planner.plan(intent, self.schema_registry)
        logger.info(
            "splunk search intent planned",
            extra={
                "objective": intent.objective[:256],
                "planner_confidence": plan.confidence,
                "selected_indexes": plan.indexes,
                "selected_sourcetypes": plan.sourcetypes,
                "strategy": plan.strategy,
                "refinement_count": 0,
            },
        )
        refinement_count = 0
        execution = await self.executor.execute(
            plan.spl,
            plan.earliest_time,
            plan.latest_time,
            plan.max_count,
            plan.output_fields,
            principal_id=principal_id,
        )

        # The initial plan already expands every alias in its trusted schema.
        # Only low-confidence zero-result plans may try another ranked trusted
        # schema, and the planner bounds the number of attempts.
        while (
            refinement_count < self.planner.max_refinements
            and plan.confidence < 0.85
            and self._can_refine(execution)
        ):
            next_plan = self.planner.refine(
                intent,
                self.schema_registry,
                plan,
                refinement_count,
            )
            if next_plan is None:
                break
            refinement_count += 1
            plan = next_plan
            logger.info(
                "splunk search intent refined",
                extra={
                    "objective": intent.objective[:256],
                    "planner_confidence": plan.confidence,
                    "selected_indexes": plan.indexes,
                    "selected_sourcetypes": plan.sourcetypes,
                    "strategy": plan.strategy,
                    "refinement_count": refinement_count,
                },
            )
            execution = await self.executor.execute(
                plan.spl,
                plan.earliest_time,
                plan.latest_time,
                plan.max_count,
                plan.output_fields,
                principal_id=principal_id,
            )

        response = self._format_execution(
            plan.spl,
            plan.earliest_time,
            plan.latest_time,
            execution,
        )
        response["plan"] = plan.to_dict()
        response["verification"] = self.verifier.verify(
            plan,
            execution,
            refinement_count=refinement_count,
        )
        logger.info(
            "splunk search intent verified",
            extra={
                "objective": intent.objective[:256],
                "planner_confidence": plan.confidence,
                "selected_indexes": plan.indexes,
                "selected_sourcetypes": plan.sourcetypes,
                "strategy": plan.strategy,
                "refinement_count": refinement_count,
                "result_count": response["search"].get("result_count"),
                "verification_confidence": response["verification"].get("confidence"),
            },
        )
        return response

    @staticmethod
    def _can_refine(execution: dict[str, Any]) -> bool:
        metadata = execution.get("search_metadata", {})
        if not isinstance(metadata, dict):
            return False
        if metadata.get("returned_count") != 0:
            return False
        if metadata.get("splunk_result_truncated") is True or metadata.get("mcp_context_truncated") is True:
            return False
        return metadata.get("total_result_count") in {None, 0}

    def read_evidence(self, evidence_id: str, *, offset: int = 0, limit: int = 50, fields: list[str] | None = None) -> dict[str, Any]:
        """Page through a retained search snapshot without dispatching new work."""
        return self.evidence.read_page(evidence_id, offset=offset, limit=limit, fields=fields)

    def evidence_stats(self) -> dict[str, Any]:
        return self.evidence.stats()

    def plan_search(self, intent: SearchIntent) -> dict[str, Any]:
        """Deterministically plan one search without executing anything.

        Exposed behind SPLUNK_SEARCH_PLANNER_ENABLED so the schema mappings can
        be verified for the deployment first; the returned SPL is run explicitly
        through splunk_search.
        """
        if not getattr(self.core.settings, "search_planner_enabled", False):
            raise ServiceError(
                "operation_disabled",
                "The deterministic search planner is disabled. Verify the schema mappings, then set SPLUNK_SEARCH_PLANNER_ENABLED=true.",
            )
        if not isinstance(intent, SearchIntent):
            raise ServiceError("invalid_input", "search intent is malformed")
        plan = self.planner.plan(intent, self.schema_registry)
        return {
            "plan": plan.to_dict(),
            "spl": plan.spl,
            "planner_confidence": plan.confidence,
            "planner_confidence_label": plan.confidence_label,
            "indexes": list(plan.indexes),
            "sourcetypes": list(plan.sourcetypes),
            "output_fields": list(plan.output_fields),
            "note": "The plan is definition-only and was not executed; run splunk_search with the planned SPL to fetch evidence.",
        }

    async def test_connection(self) -> dict[str, Any]:
        indexes = await self.core.request(lambda client: client.get_indexes())
        return {"connected": True, "index_count": len(indexes)}

    async def list_saved_searches(
        self,
        name: str = "",
        app: str = "",
        limit: int = 50,
        include_spl: bool = False,
    ) -> dict[str, Any]:
        name = name.strip()
        app = app.strip()
        limit = min(max(1, int(limit)), 200)
        searches = await self.core.request(lambda client: client.get_saved_searches(name=name, app=app, count=limit))
        if name:
            needle = name.casefold()
            searches = [item for item in searches if needle in item.get("name", "").casefold()]
        if app:
            searches = [item for item in searches if item.get("app", "") == app]
        searches = searches[:limit]
        if not include_spl:
            searches = [{key: value for key, value in item.items() if key != "search"} for item in searches]
        return {"count": len(searches), "saved_searches": self.core.sanitize(searches)}

    async def list_lookups(self, app: str = "", name: str = "", limit: int = 50) -> dict[str, Any]:
        app = app.strip()
        name = name.strip()
        limit = min(max(1, int(limit)), 200)
        entries = await self.core.request(
            lambda client: client.get_lookup_table_files(app=app, count=limit)
        )
        lookups = normalize_lookups(entries)
        if app:
            lookups = [lookup for lookup in lookups if lookup["app"] == app]
        if name:
            needle = name.casefold()
            lookups = [lookup for lookup in lookups if needle in lookup["name"].casefold()]
        lookups = lookups[:limit]
        return {"count": len(lookups), "lookups": lookups}

    async def find_lookup(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        entries = await self.core.request(
            lambda client: client.get_lookup_table_files(search=rest_search_filter(name), count=20)
        )
        lookup = next(
            (item for item in normalize_lookups(entries) if item["name"] == name),
            None,
        )
        if lookup is None:
            raise ServiceError("not_found", "The requested lookup-table file was not found.", details={"name": name})
        return {"lookup": lookup}

    @staticmethod
    def _actor_id(actor_id: str | None, *, required: bool = False) -> str:
        if isinstance(actor_id, str) and actor_id.strip():
            return actor_id.strip()
        if required:
            raise ServiceError("not_authorized", "An authenticated SOC user is required for this operation.")
        return "internal-service"

    @staticmethod
    def _normalize_lookup_name(name: str) -> str:
        try:
            return normalize_lookup_name(name)
        except ValueError as exc:
            raise ServiceError("invalid_input", str(exc)) from exc

    def _lookup_scope(self) -> tuple[str, str]:
        settings = self.core.settings
        return (
            str(getattr(settings, "lookup_app", "search") or "search").strip() or "search",
            str(getattr(settings, "lookup_owner", "nobody") or "nobody").strip() or "nobody",
        )

    def _lookup_limits(self) -> dict[str, int]:
        settings = self.core.settings
        return {
            "max_bytes": int(getattr(settings, "lookup_max_bytes", 5_000_000)),
            "max_rows": int(getattr(settings, "lookup_max_rows", 50_000)),
            "max_columns": int(getattr(settings, "lookup_max_columns", 100)),
        }

    def _require_lookup_write(self) -> None:
        if not getattr(self.core.settings, "lookup_write_enabled", False):
            raise ServiceError(
                "operation_disabled",
                "Lookup CSV writes are disabled. Set SPLUNK_ALLOW_LOOKUP_WRITE=true after review.",
            )

    async def _lookup_metadata(
        self,
        name: str,
        *,
        app: str = "",
        owner: str = "",
        exact_scope: bool = False,
    ) -> dict[str, Any] | None:
        entries = await self.core.request(
            lambda client: client.get_lookup_table_files(
                app=app,
                search=rest_search_filter(name),
                count=20,
            )
        )
        for lookup in normalize_lookups(entries):
            if lookup["name"] != name:
                continue
            if app and lookup["app"] != app:
                continue
            if exact_scope and owner and lookup["owner"] != owner:
                continue
            return lookup
        return None

    def _canonical_lookup_content(self, content: str) -> tuple[str, list[list[str]]]:
        try:
            return canonical_csv_text(content, **self._lookup_limits())
        except ValueError as exc:
            raise ServiceError("lookup_invalid", str(exc)) from exc

    async def _lookup_state(
        self,
        metadata: dict[str, Any],
        *,
        app: str | None = None,
        owner: str | None = None,
    ) -> dict[str, Any]:
        name = self._normalize_lookup_name(metadata.get("name", ""))
        selected_app = str(app or metadata.get("app") or self._lookup_scope()[0]).strip()
        selected_owner = str(owner or metadata.get("owner") or self._lookup_scope()[1]).strip()
        payload = await self.core.request(
            lambda client: client.get_lookup_contents(name, selected_app, selected_owner)
        )
        try:
            rows = lookup_rows_from_response(payload)
            raw_content = serialize_csv_rows(rows)
            content, rows = canonical_csv_text(raw_content, **self._lookup_limits())
        except ValueError as exc:
            raise ServiceError("lookup_malformed", str(exc)) from exc
        summary = lookup_summary(rows, content)
        return {
            "lookup": metadata,
            "name": name,
            "app": selected_app,
            "owner": selected_owner,
            "content": content,
            "summary": summary,
            "fingerprint": lookup_fingerprint(name, selected_app, selected_owner, content),
        }

    async def _scoped_lookup_state(self, name: str) -> dict[str, Any] | None:
        app, owner = self._lookup_scope()
        metadata = await self._lookup_metadata(name, app=app, owner=owner, exact_scope=True)
        if metadata is None:
            return None
        return await self._lookup_state(metadata, app=app, owner=owner)

    @staticmethod
    def _lookup_draft(
        operation: str,
        state: dict[str, Any],
        *,
        expected_fingerprint: str | None,
        current_fingerprint: str | None,
    ) -> dict[str, Any]:
        draft = {
            "name": state["name"],
            "app": state["app"],
            "owner": state["owner"],
            "content": state["content"],
            "summary": state["summary"],
            "fingerprint": current_fingerprint,
        }
        return {
            "status": "draft",
            "operation": operation,
            "target_id": state["name"],
            "draft": draft,
            "expected_fingerprint": expected_fingerprint,
            "current_fingerprint": current_fingerprint,
            "save_requires_explicit_action": True,
            "review_only_metadata": {
                "content_format": "CSV",
                "write_scope": {"app": state["app"], "owner": state["owner"]},
                "persisted": False,
                "app_and_owner_are_read_only": True,
            },
        }

    @staticmethod
    def _require_lookup_fingerprint(expected_fingerprint: str | None, current: dict[str, Any]) -> None:
        if not isinstance(expected_fingerprint, str) or not expected_fingerprint.strip():
            raise ServiceError(
                "expected_fingerprint_required",
                "expected_fingerprint is required for lookup CSV modifications.",
            )
        if expected_fingerprint != current["fingerprint"]:
            raise ServiceError(
                "lookup_changed",
                "The Splunk lookup CSV changed since it was read; refresh and retry.",
                details={"current_fingerprint": current["fingerprint"]},
            )

    async def get_lookup(self, name: str) -> dict[str, Any]:
        name = self._normalize_lookup_name(name)
        metadata = await self._lookup_metadata(name)
        if metadata is None:
            raise ServiceError("not_found", "The requested lookup-table file was not found.", details={"name": name})
        return await self._lookup_state(metadata)

    async def write_lookup(self, name: str, content: str, *, actor_id: str | None = None) -> dict[str, Any]:
        del actor_id
        name = self._normalize_lookup_name(name)
        canonical, rows = self._canonical_lookup_content(content)
        app, owner = self._lookup_scope()
        state = {
            "name": name,
            "app": app,
            "owner": owner,
            "content": canonical,
            "summary": lookup_summary(rows, canonical),
        }
        return self._lookup_draft(
            "write",
            state,
            expected_fingerprint=None,
            current_fingerprint=None,
        )

    async def update_lookup(
        self,
        name: str,
        content: str,
        expected_fingerprint: str,
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        del actor_id
        name = self._normalize_lookup_name(name)
        current = await self._scoped_lookup_state(name)
        if current is None:
            raise ServiceError("target_not_found", "The lookup CSV target no longer exists.", details={"name": name})
        self._require_lookup_fingerprint(expected_fingerprint, current)
        canonical, rows = self._canonical_lookup_content(content)
        state = {
            "name": name,
            "app": current["app"],
            "owner": current["owner"],
            "content": canonical,
            "summary": lookup_summary(rows, canonical),
        }
        return self._lookup_draft(
            "update",
            state,
            expected_fingerprint=expected_fingerprint,
            current_fingerprint=current["fingerprint"],
        )

    async def delete_lookup(
        self,
        name: str,
        expected_fingerprint: str,
        *,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        del actor_id
        name = self._normalize_lookup_name(name)
        current = await self._scoped_lookup_state(name)
        if current is None:
            raise ServiceError("target_not_found", "The lookup CSV target no longer exists.", details={"name": name})
        self._require_lookup_fingerprint(expected_fingerprint, current)
        return self._lookup_draft(
            "delete",
            current,
            expected_fingerprint=expected_fingerprint,
            current_fingerprint=current["fingerprint"],
        )

    @staticmethod
    def _saved_lookup_response(operation: str, state: dict[str, Any]) -> dict[str, Any]:
        return {
            "status": "saved",
            "saved": True,
            operation: True,
            "lookup": state["lookup"],
            "name": state["name"],
            "app": state["app"],
            "owner": state["owner"],
            "content": state["content"],
            "summary": state["summary"],
            "fingerprint": state["fingerprint"],
        }

    async def save_lookup(
        self,
        operation: str,
        name: str,
        *,
        content: str | None = None,
        expected_fingerprint: str | None = None,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        if operation not in {"write", "update", "delete"}:
            raise ServiceError(
                "operation_not_supported",
                "Only write, update, and delete lookup CSV saves are supported.",
            )
        self._require_lookup_write()
        self._actor_id(actor_id, required=True)
        name = self._normalize_lookup_name(name)
        async with self._lookup_save_lock:
            app, owner = self._lookup_scope()
            if operation == "write":
                if not isinstance(content, str):
                    raise ServiceError("invalid_input", "content is required for lookup CSV creation.")
                # Validate the complete edited value before checking or
                # changing the target. There is no partial write path.
                canonical, rows = self._canonical_lookup_content(content)
                existing = await self._lookup_metadata(name, app=app)
                if existing is not None:
                    raise ServiceError(
                        "target_exists",
                        "The lookup CSV target already exists; use update instead.",
                        details={"name": name, "app": app},
                    )
                await self.core.request(
                    lambda client: client.create_lookup_contents(name, app, owner, rows)
                )
                persisted = await self._scoped_lookup_state(name)
                if persisted is None:
                    raise ServiceError("write_verification_failed", "Splunk did not return the created lookup CSV.")
                return self._saved_lookup_response("created", persisted)

            current = await self._scoped_lookup_state(name)
            if current is None:
                raise ServiceError("target_not_found", "The lookup CSV target no longer exists.", details={"name": name})
            self._require_lookup_fingerprint(expected_fingerprint, current)

            if operation == "delete":
                await self.core.request(
                    lambda client: client.delete_lookup_table_file(name, app, owner)
                )
                if await self._scoped_lookup_state(name) is not None:
                    raise ServiceError("write_verification_failed", "Splunk did not confirm lookup CSV deletion.")
                return {
                    "status": "saved",
                    "saved": True,
                    "deleted": True,
                    "name": name,
                    "app": app,
                    "owner": owner,
                    "fingerprint": None,
                }

            if not isinstance(content, str):
                raise ServiceError("invalid_input", "content is required for lookup CSV updates.")
            # Re-validate before the replacement request so malformed edits
            # cannot partially overwrite a valid lookup.
            _canonical, rows = self._canonical_lookup_content(content)
            latest = await self._scoped_lookup_state(name)
            if latest is None:
                raise ServiceError("target_not_found", "The lookup CSV target no longer exists.", details={"name": name})
            self._require_lookup_fingerprint(expected_fingerprint, latest)
            await self.core.request(
                lambda client: client.update_lookup_contents(name, app, owner, rows)
            )
            persisted = await self._scoped_lookup_state(name)
            if persisted is None:
                raise ServiceError("write_verification_failed", "Splunk did not return the updated lookup CSV.")
            return self._saved_lookup_response("updated", persisted)

    async def run_saved_search(
        self,
        name: str,
        max_count: int = 50,
        app: str = "",
        owner: str = "",
        *,
        principal_id: str | None = None,
    ) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ServiceError("invalid_input", "name cannot be empty")
        limit = self.executor.normalize_limit(max_count)
        limit = min(limit, self.core.settings.max_events)
        app = app.strip()
        owner = owner.strip()
        definition = await self.core.request(
            lambda client: client.get_saved_search(name, app, owner)
        )
        content = definition.get("content") if isinstance(definition, dict) else None
        if not isinstance(content, dict) or not isinstance(content.get("search"), str) or not content["search"].strip():
            raise ServiceError("splunk_api_error", "Splunk returned a saved search without executable SPL.")
        earliest = content.get("dispatch.earliest_time")
        latest = content.get("dispatch.latest_time")
        # A saved search without a known earliest bound may use Splunk's own
        # potentially unbounded dispatch defaults.  Fail closed instead of
        # turning missing metadata into an assumed 24-hour workload.
        earliest = earliest.strip() if isinstance(earliest, str) and earliest.strip() else ""
        latest = latest.strip() if isinstance(latest, str) and latest.strip() else "now"
        validation = self.core.validate_query(content["search"], earliest, latest)
        if validation.get("decision") != "allow":
            raise self.executor._blocked_query_error(validation)
        async with self.executor.resource_scope(
            content["search"],
            earliest,
            latest,
            limit,
            principal_id=principal_id,
            workload_type="saved_search",
        ) as resource:
            result = await self.core.request(
                lambda client: client.run_saved_search(
                    name,
                    False,
                    resource.effective_max_results,
                    app,
                    owner,
                    runtime_limit=resource.admission.max_runtime_seconds,
                )
            )
        result = self.core.sanitize(result)
        events = result.get("events") if isinstance(result, dict) else None
        if isinstance(events, list):
            result["events"], result["event_budget"] = self.core.bound_events(events)
            result["event_count"] = len(result["events"])
        return result
