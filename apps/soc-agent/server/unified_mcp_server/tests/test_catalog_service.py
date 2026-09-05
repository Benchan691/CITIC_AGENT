import pytest

from unified_mcp_server.catalog.service import CatalogService
from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError


class StubStore:
    """In-memory stand-in capturing the store calls the service makes."""

    def __init__(self):
        self.customers: dict[str, dict] = {}
        self.records: dict[str, dict] = {}
        self.created: list[tuple] = []
        self.updated: list[tuple] = []
        self.archived: list[tuple] = []

    def require_record(self, catalog, record_id):
        table = self.customers if catalog == "customer" else self.records
        if record_id not in table:
            raise ServiceError("record_not_found", "missing")
        return table[record_id]

    def get_record(self, catalog, record_id):
        return self.customers.get(record_id)

    def create_record(self, catalog, values, *, actor):
        record = {"catalog": catalog, "record_id": "new" + "0" * 29, "revision": 1, "archived": False, **values}
        self.records[record["record_id"]] = record
        self.created.append((catalog, values, actor))
        return record

    def update_record(self, catalog, record_id, values, *, expected_revision, actor, reason=""):
        record = self.records[record_id]
        self.updated.append((catalog, record_id, values, expected_revision, actor, reason))
        updated = {**record, **values, "revision": record["revision"] + 1}
        self.records[record_id] = updated
        return updated

    def set_archived(self, catalog, record_id, *, archived, expected_revision, actor, reason=""):
        record = self.records[record_id]
        self.archived.append((catalog, record_id, archived, expected_revision, actor))
        updated = {**record, "archived": archived, "revision": record["revision"] + 1}
        self.records[record_id] = updated
        return updated


def make_service(store=None):
    settings = SplunkSettings(
        host="splunk.test",
        port=8089,
        username="u",
        password="p",
        token="",
        verify_ssl=False,
        request_timeout=5,
        job_timeout=30,
        max_events=10,
        risk_tolerance=1,
        safe_timerange="24h",
        sanitize_output=True,
    )
    return CatalogService(store, settings, splunk=None)


def test_service_without_storage_reports_not_configured():
    service = make_service()
    with pytest.raises(ServiceError) as caught:
        service.list_records("rule")
    assert caught.value.code == "not_configured"


def test_prepare_create_returns_draft_without_writing():
    store = StubStore()
    service = make_service(store)
    draft = service.prepare_create("rule", {"rule_number": "7732", "rule_name_en": "Malicious File Download", "severity": "high"})
    assert draft["status"] == "draft"
    assert draft["save_requires_explicit_action"] is True
    assert draft["record"]["rule_number"] == "7732"
    assert store.created == []


def test_prepare_update_merges_partial_payload_and_keeps_revision():
    store = StubStore()
    store.records["r1"] = {
        "catalog": "rule", "record_id": "r1", "revision": 4, "archived": False,
        "rule_number": "7732", "rule_name_en": "Old Name", "severity": "low",
        "status": "active", "customer_id": "", "gid": "",
    }
    service = make_service(store)
    draft = service.prepare_update("rule", "r1", {"rule_name_en": "New Name"}, 4)
    assert draft["record"]["rule_name_en"] == "New Name"
    assert draft["record"]["rule_number"] == "7732"
    assert draft["expected_revision"] == 4


def test_prepare_update_rejects_stale_revision():
    store = StubStore()
    store.records["r1"] = {"catalog": "rule", "record_id": "r1", "revision": 7, "archived": False}
    service = make_service(store)
    with pytest.raises(ServiceError) as caught:
        service.prepare_update("rule", "r1", {"rule_name_en": "x"}, 6)
    assert caught.value.code == "catalog_conflict"
    assert caught.value.details["current_revision"] == 7


def test_save_record_write_requires_authenticated_actor():
    import asyncio

    service = make_service(StubStore())
    with pytest.raises(ServiceError) as caught:
        asyncio.run(service.save_record("rule", "write", {"rule_number": "1", "rule_name_en": "x"}))
    assert caught.value.code == "not_authorized"


def test_save_record_write_creates_record_with_actor():
    import asyncio

    store = StubStore()
    service = make_service(store)
    result = asyncio.run(service.save_record(
        "rule", "write",
        {"rule_number": "7732", "rule_name_en": "Malicious File Download", "severity": "high"},
        actor_id="analyst-1",
    ))
    assert result["saved"] is True and result["created"] is True
    assert store.created[0][2] == "analyst-1"


def test_save_record_update_requires_expected_revision():
    import asyncio

    store = StubStore()
    store.records["r1"] = {"catalog": "rule", "record_id": "r1", "revision": 2, "archived": False,
                           "rule_number": "7732", "rule_name_en": "Old"}
    service = make_service(store)
    with pytest.raises(ServiceError) as caught:
        asyncio.run(service.save_record("rule", "update", {"rule_name_en": "New"}, record_id="r1", expected_revision=1, actor_id="a"))
    assert caught.value.code == "catalog_conflict"


def test_save_record_rejects_unknown_customer_reference():
    import asyncio

    store = StubStore()
    service = make_service(store)
    with pytest.raises(ServiceError) as caught:
        asyncio.run(service.save_record(
            "rule", "write",
            {"rule_number": "7732", "rule_name_en": "x", "customer_id": "f" * 32},
            actor_id="a",
        ))
    assert caught.value.details["fields"]["customer_id"]


def test_save_fix_source_type_verifies_default_fix_index_against_customer_gid():
    import asyncio

    store = StubStore()
    customer_id = "c" * 32
    store.customers[customer_id] = {"catalog": "customer", "record_id": customer_id, "customer_code": "fubon", "gid": "50176", "archived": False}
    service = make_service(store)
    with pytest.raises(ServiceError) as caught:
        asyncio.run(service.save_record(
            "fix_source_type", "write",
            {"customer_id": customer_id, "system_name": "EDR", "fix_source_type_value": "QiAnXin EDR", "default_fix_index": "G11111"},
            actor_id="a",
        ))
    assert caught.value.details["fields"]["default_fix_index"]

    result = asyncio.run(service.save_record(
        "fix_source_type", "write",
        {"customer_id": customer_id, "system_name": "EDR", "fix_source_type_value": "QiAnXin EDR", "default_fix_index": "G50176"},
        actor_id="a",
    ))
    assert result["saved"] is True


def test_publish_is_blocked_without_lookup_write_flag():
    import asyncio

    service = make_service(StubStore())
    with pytest.raises(ServiceError) as caught:
        asyncio.run(service.publish_catalog("rule", actor_id="a"))
    assert caught.value.code == "operation_disabled"
