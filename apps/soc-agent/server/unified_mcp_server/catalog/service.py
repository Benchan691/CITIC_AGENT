"""Catalog service: validation, draft envelopes, and authenticated saves.

The service mirrors the detection workflow: MCP tools prepare draft envelopes
without writing, and an explicit editor Save (actor resolved server-side from
the application session) performs the single transactional write. Publication
to Splunk is a separate operator action gated by SPLUNK_ALLOW_LOOKUP_WRITE.
"""

from __future__ import annotations

from typing import Any

from ..config import SplunkSettings, redact_endpoint
from ..errors import ServiceError
from ..splunk_service import SplunkService
from .model import CATALOG_EDITABLE_COLUMNS, CATALOG_LABELS, CATALOGS, empty_record
from .publish import (
    LOOKUP_COLUMNS,
    canonical_checksum,
    lookup_rows,
    parse_lookup_csv,
    render_lookup_csv,
    validate_publication,
)
from .store import CatalogStore
from .validation import validate_payload, validation_error


class CatalogService:
    """Facade over catalog storage, validation, and Splunk publication."""

    def __init__(
        self,
        store: CatalogStore | None,
        splunk_settings: SplunkSettings,
        splunk: SplunkService | None = None,
    ) -> None:
        self.store = store
        self.settings = splunk_settings
        self._splunk = splunk

    @classmethod
    def from_env(
        cls,
        splunk_settings: SplunkSettings,
        splunk: SplunkService | None = None,
    ) -> "CatalogService":
        store = CatalogStore.from_env()
        if splunk is None:
            splunk = SplunkService(splunk_settings)
        return cls(store, splunk_settings, splunk)

    async def close(self) -> None:
        if self._splunk is not None:
            await self._splunk.close()
            self._splunk = None

    @staticmethod
    def _actor_id(actor_id: str | None, *, required: bool = False) -> str:
        if isinstance(actor_id, str) and actor_id.strip():
            return actor_id.strip()
        if required:
            raise ServiceError("not_authorized", "An authenticated SOC user is required for catalog changes.")
        return "internal-service"

    def _require_store(self) -> CatalogStore:
        if self.store is None:
            raise ServiceError(
                "not_configured",
                "Catalog storage requires PostgreSQL. Configure APP_POSTGRES_URI first.",
            )
        return self.store

    @staticmethod
    def _require_catalog(catalog: str) -> str:
        if catalog not in CATALOGS:
            raise ServiceError("invalid_input", f"Unknown catalog: {catalog}")
        return catalog

    # -- reads --------------------------------------------------------------

    def list_records(
        self,
        catalog: str,
        *,
        search: str = "",
        limit: int = 50,
        offset: int = 0,
        include_archived: bool = False,
    ) -> dict[str, Any]:
        return self._require_store().list_records(
            self._require_catalog(catalog),
            search=search,
            limit=limit,
            offset=offset,
            include_archived=include_archived,
        )

    def get_record(self, catalog: str, record_id: str) -> dict[str, Any]:
        return self._require_store().require_record(self._require_catalog(catalog), record_id)

    def record_history(self, catalog: str, record_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        return self._require_store().record_history(self._require_catalog(catalog), record_id, limit=limit)

    def list_publications(self, catalog: str, *, limit: int = 50) -> list[dict[str, Any]]:
        return self._require_store().list_publications(self._require_catalog(catalog), limit=limit)

    # -- draft envelopes (no persistence) -----------------------------------

    def prepare_create(self, catalog: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._require_catalog(catalog)
        base = empty_record(catalog)
        for column, value in (payload or {}).items():
            if column in base:
                base[column] = value
        values = validate_payload(catalog, base, partial=False)
        record = empty_record(catalog)
        record.update(values)
        return self._draft_response("write", record, expected_revision=None, current_revision=None)

    def prepare_update(
        self,
        catalog: str,
        record_id: str,
        payload: dict[str, Any],
        expected_revision: int,
    ) -> dict[str, Any]:
        self._require_catalog(catalog)
        current = self._require_store().require_record(catalog, record_id)
        self._require_current_revision(current, expected_revision)
        merged = self._merge_payload(catalog, current, payload)
        record = dict(current)
        record.update(merged)
        return self._draft_response(
            "update",
            record,
            expected_revision=current["revision"],
            current_revision=current["revision"],
        )

    @staticmethod
    def _draft_response(
        operation: str,
        record: dict[str, Any],
        *,
        expected_revision: int | None,
        current_revision: int | None,
    ) -> dict[str, Any]:
        return {
            "status": "draft",
            "catalog": record["catalog"],
            "record": record,
            "operation": operation,
            "target_id": record.get("record_id") or None,
            "expected_revision": expected_revision,
            "current_revision": current_revision,
            "save_requires_explicit_action": True,
        }

    # -- authenticated saves ------------------------------------------------

    async def save_record(
        self,
        catalog: str,
        operation: str,
        payload: dict[str, Any],
        *,
        record_id: str | None = None,
        expected_revision: int | None = None,
        actor_id: str | None = None,
        reason: str = "",
    ) -> dict[str, Any]:
        catalog = self._require_catalog(catalog)
        actor = self._actor_id(actor_id, required=True)
        store = self._require_store()
        if operation not in {"write", "update"}:
            raise ServiceError("operation_not_supported", "Only write and update catalog saves are supported.")
        if operation == "write":
            base = empty_record(catalog)
            for column, value in (payload or {}).items():
                if column in base:
                    base[column] = value
            values = validate_payload(catalog, base, partial=False)
            self._verify_references(catalog, values)
            record = store.create_record(catalog, values, actor=actor)
            return {"status": "saved", "saved": True, "created": True, "record": record}
        if record_id is None:
            raise ServiceError("invalid_input", "record_id is required to update a catalog record.")
        current = store.require_record(catalog, record_id)
        self._require_current_revision(current, expected_revision)
        values = self._merge_payload(catalog, current, payload)
        self._verify_references(catalog, values)
        record = store.update_record(
            catalog,
            record_id,
            values,
            expected_revision=int(expected_revision or 0),
            actor=actor,
            reason=reason,
        )
        return {"status": "saved", "saved": True, "updated": True, "record": record}

    def _merge_payload(
        self,
        catalog: str,
        current: dict[str, Any],
        payload: dict[str, Any],
    ) -> dict[str, str]:
        """Merge a partial payload over the current record and validate fully.

        Updates always write every editable column, so an omitted field keeps
        its stored value instead of being blanked.
        """
        base = {column: current.get(column, "") for column in CATALOG_EDITABLE_COLUMNS[catalog]}
        for column, value in (payload or {}).items():
            if column in base:
                base[column] = value
        return validate_payload(catalog, base, partial=False)

    async def set_record_archived(
        self,
        catalog: str,
        record_id: str,
        *,
        archived: bool,
        expected_revision: int,
        actor_id: str | None = None,
        reason: str = "",
    ) -> dict[str, Any]:
        catalog = self._require_catalog(catalog)
        actor = self._actor_id(actor_id, required=True)
        record = self._require_store().set_archived(
            catalog,
            record_id,
            archived=archived,
            expected_revision=int(expected_revision),
            actor=actor,
            reason=reason,
        )
        return {
            "status": "saved",
            "saved": True,
            "archived": archived,
            "action": "archive" if archived else "restore",
            "record": record,
        }

    def _verify_references(self, catalog: str, values: dict[str, Any]) -> None:
        """Cross-catalog reference checks with field-level errors."""
        if catalog == "customer":
            return
        customer_id = str(values.get("customer_id", "") or "")
        if catalog == "rule" and not customer_id:
            return
        if not customer_id:
            raise validation_error(catalog, {"customer_id": "a catalog customer is required."})
        customer = self._require_store().get_record("customer", customer_id)
        if customer is None or customer["archived"]:
            raise validation_error(catalog, {"customer_id": "customer does not exist in the catalog."})
        if catalog == "fix_source_type":
            expected_index = f"G{customer.get('gid', '')}" if customer.get("gid") else ""
            value = str(values.get("default_fix_index", "") or "")
            if expected_index and value and value != expected_index:
                raise validation_error(
                    catalog,
                    {"default_fix_index": f"must match the customer Fix_Index {expected_index!r}."},
                )

    @staticmethod
    def _require_current_revision(record: dict[str, Any], expected_revision: Any) -> None:
        try:
            expected = int(expected_revision)
        except (TypeError, ValueError):
            expected = -1
        if record["revision"] != expected:
            raise ServiceError(
                "catalog_conflict",
                "The record changed since it was read; refresh and retry.",
                details={"current_revision": record["revision"]},
            )

    # -- publication --------------------------------------------------------

    def _lookup_name(self, catalog: str) -> str:
        names = {
            "rule": self.settings.rule_lookup_name,
            "customer": self.settings.customer_lookup_name,
            "fix_source_type": self.settings.fix_source_lookup_name,
        }
        return names[catalog]

    def _destination(self, lookup_name: str) -> str:
        endpoint = redact_endpoint(self.settings.url or self.settings.host, allow_bare_host=True)
        return f"{endpoint} app={self.settings.lookup_app} owner={self.settings.lookup_owner} lookup={lookup_name}"

    def _customers_by_id(self) -> dict[str, dict[str, Any]]:
        records = self._require_store().all_records("customer", include_archived=False)
        return {record["record_id"]: record for record in records}

    def preview_publication(self, catalog: str) -> dict[str, Any]:
        catalog = self._require_catalog(catalog)
        store = self._require_store()
        records = store.all_records(catalog, include_archived=False)
        if catalog == "customer":
            customers = {record["record_id"]: record for record in records}
        else:
            customers = self._customers_by_id()
        rows = lookup_rows(catalog, records, customers)
        report = validate_publication(catalog, records, customers)
        csv_text = render_lookup_csv(LOOKUP_COLUMNS[catalog], rows)
        previous = store.latest_publication(catalog, outcome="published")
        return {
            "catalog": catalog,
            "lookup_name": self._lookup_name(catalog),
            "record_count": len(records),
            "columns": LOOKUP_COLUMNS[catalog],
            "rows": rows[:20],
            "content_checksum": canonical_checksum(rows),
            "validation": report,
            "previous_publication": _publication_summary(previous),
            "destination": self._destination(self._lookup_name(catalog)),
            "content_preview": csv_text[:2000],
        }

    async def publish_catalog(self, catalog: str, *, actor_id: str | None = None) -> dict[str, Any]:
        catalog = self._require_catalog(catalog)
        actor = self._actor_id(actor_id, required=True)
        if not self.settings.lookup_write_enabled:
            raise ServiceError(
                "operation_disabled",
                "Lookup publication is disabled. Set SPLUNK_ALLOW_LOOKUP_WRITE=true after review.",
            )
        splunk = self._splunk
        if splunk is None:
            raise ServiceError("not_configured", "The Splunk publish path is unavailable.")
        store = self._require_store()
        records = store.all_records(catalog, include_archived=False)
        customers = self._customers_by_id()
        rows = lookup_rows(catalog, records, customers)
        report = validate_publication(catalog, records, customers)
        if not report["valid"]:
            raise ServiceError(
                "publication_blocked",
                "The catalog snapshot failed publication validation; resolve the errors first.",
                details=report,
            )
        lookup_name = self._lookup_name(catalog)
        csv_text = render_lookup_csv(LOOKUP_COLUMNS[catalog], rows)
        checksum = canonical_checksum(rows)
        previous = store.latest_publication(catalog, outcome="published")
        publication = store.create_publication(
            catalog=catalog,
            lookup_name=lookup_name,
            checksum=checksum,
            destination=self._destination(lookup_name),
            actor=actor,
            content_snapshot=csv_text,
        )
        try:
            await splunk.core.request(
                lambda client: client.upload_lookup_contents(
                    lookup_name,
                    self.settings.lookup_app,
                    self.settings.lookup_owner,
                    csv_text,
                )
            )
            read_back = await splunk.core.request(
                lambda client: client.search_oneshot(
                    f'| inputlookup "{lookup_name}"',
                    earliest_time="0",
                    latest_time="now",
                    max_count=100000,
                )
            )
        except ServiceError as exc:
            failed = store.set_publication_outcome(
                publication["publication_id"], outcome="failed", error=exc.message
            )
            return {
                "status": "failed",
                "published": False,
                "publication": _publication_summary(failed),
                "read_back_checksum": "",
                "validation": report,
            }
        read_back_checksum = canonical_checksum(read_back)
        if read_back_checksum != checksum:
            failed = store.set_publication_outcome(
                publication["publication_id"],
                outcome="failed",
                error="Read-back verification failed; the published lookup does not match the catalog snapshot.",
            )
            return {
                "status": "failed",
                "published": False,
                "publication": _publication_summary(failed),
                "read_back_checksum": read_back_checksum,
                "validation": report,
            }
        saved = store.set_publication_outcome(
            publication["publication_id"],
            outcome="published",
            verified=True,
        )
        return {
            "status": "published",
            "published": True,
            "publication": _publication_summary(saved),
            "read_back_checksum": read_back_checksum,
            "replaced_publication": _publication_summary(previous),
            "validation": report,
        }

    async def rollback_publication(self, publication_id: str, *, actor_id: str | None = None) -> dict[str, Any]:
        actor = self._actor_id(actor_id, required=True)
        if not self.settings.lookup_write_enabled:
            raise ServiceError(
                "operation_disabled",
                "Lookup publication is disabled. Set SPLUNK_ALLOW_LOOKUP_WRITE=true after review.",
            )
        splunk = self._splunk
        if splunk is None:
            raise ServiceError("not_configured", "The Splunk publish path is unavailable.")
        store = self._require_store()
        previous = store.get_publication(publication_id)
        if previous is None or previous["outcome"] != "published" or not previous["content_snapshot"]:
            raise ServiceError(
                "invalid_input",
                "Only a verified published revision with a stored snapshot can be restored.",
            )
        lookup_name = previous["lookup_name"]
        snapshot = previous["content_snapshot"]
        checksum = previous["content_checksum"] or canonical_checksum(parse_lookup_csv(snapshot))
        publication = store.create_publication(
            catalog=previous["catalog"],
            lookup_name=lookup_name,
            checksum=checksum,
            destination=self._destination(lookup_name),
            actor=actor,
            content_snapshot=snapshot,
        )
        store.set_publication_outcome(publication["publication_id"], outcome="pending")
        try:
            await splunk.core.request(
                lambda client: client.upload_lookup_contents(
                    lookup_name,
                    self.settings.lookup_app,
                    self.settings.lookup_owner,
                    snapshot,
                )
            )
            read_back = await splunk.core.request(
                lambda client: client.search_oneshot(
                    f'| inputlookup "{lookup_name}"',
                    earliest_time="0",
                    latest_time="now",
                    max_count=100000,
                )
            )
        except ServiceError as exc:
            failed = store.set_publication_outcome(
                publication["publication_id"], outcome="failed", error=exc.message
            )
            return {
                "status": "failed",
                "published": False,
                "publication": _publication_summary(failed),
                "read_back_checksum": "",
            }
        read_back_checksum = canonical_checksum(read_back)
        if read_back_checksum != canonical_checksum(parse_lookup_csv(snapshot)):
            failed = store.set_publication_outcome(
                publication["publication_id"],
                outcome="failed",
                error="Rollback verification failed; the lookup does not match the restored snapshot.",
            )
            return {
                "status": "failed",
                "published": False,
                "publication": _publication_summary(failed),
                "read_back_checksum": read_back_checksum,
            }
        saved = store.set_publication_outcome(
            publication["publication_id"],
            outcome="published",
            verified=True,
        )
        store.set_publication_outcome(
            publication_id, outcome="rolled_back", error="Replaced by a rollback publication."
        )
        return {
            "status": "published",
            "published": True,
            "publication": _publication_summary(saved),
            "read_back_checksum": read_back_checksum,
            "restored_publication": _publication_summary(previous),
        }


def _publication_summary(publication: dict[str, Any] | None) -> dict[str, Any] | None:
    if publication is None:
        return None
    keys = (
        "publication_id",
        "catalog",
        "lookup_name",
        "content_checksum",
        "destination",
        "actor",
        "published_at",
        "outcome",
        "error",
        "verified",
        "replaced_publication_id",
    )
    return {key: publication.get(key) for key in keys}


__all__ = ["CatalogService", "CATALOG_LABELS"]
