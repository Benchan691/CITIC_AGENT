"""Catalog service: validation, draft envelopes, and authenticated saves.

The service mirrors the detection workflow: MCP tools prepare draft envelopes
without writing, and an explicit editor Save (actor resolved server-side from
the application session) performs the single transactional write. Catalog
data is never published to Splunk by this application.
"""

from __future__ import annotations

from typing import Any
from ..blocking_io import run_blocking

from ..config import SplunkSettings, redact_endpoint
from ..errors import ServiceError
from .model import CATALOG_EDITABLE_COLUMNS, CATALOG_LABELS, CATALOGS, empty_record
from .publish import (
    LOOKUP_COLUMNS,
    canonical_checksum,
    lookup_rows,
    render_lookup_csv,
    validate_publication,
)
from .store import CatalogStore
from .validation import validate_payload, validation_error


class CatalogService:
    """Facade over catalog storage, validation, and read-only export previews."""

    def __init__(
        self,
        store: CatalogStore | None,
        splunk_settings: SplunkSettings,
    ) -> None:
        self.store = store
        self.settings = splunk_settings

    @classmethod
    def from_env(
        cls,
        splunk_settings: SplunkSettings,
    ) -> "CatalogService":
        store = CatalogStore.from_env()
        return cls(store, splunk_settings)

    async def close(self) -> None:
        if self.store is not None and hasattr(self.store, "close"):
            await run_blocking(self.store.close)

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
            await run_blocking(self._verify_references, catalog, values)
            record = await run_blocking(store.create_record, catalog, values, actor=actor)
            return {"status": "saved", "saved": True, "created": True, "record": record}
        if record_id is None:
            raise ServiceError("invalid_input", "record_id is required to update a catalog record.")
        current = await run_blocking(store.require_record, catalog, record_id)
        self._require_current_revision(current, expected_revision)
        values = self._merge_payload(catalog, current, payload)
        await run_blocking(self._verify_references, catalog, values)
        record = await run_blocking(store.update_record,
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
        record = await run_blocking(self._require_store().set_archived,
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
