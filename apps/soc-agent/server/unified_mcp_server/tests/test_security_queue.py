import asyncio

import httpx
import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.core.service import SplunkCore
from unified_mcp_server.splunk.security_queue.standard_provider import StandardSplunkProvider
from unified_mcp_server.splunk.security_queue.model import (
    FindingFilters,
    OpaqueIdCodec,
    SecurityQueueConfig,
    normalize_disposition,
    normalize_status,
)
from unified_mcp_server.splunk.security_queue.provider import normalize_timestamp
from unified_mcp_server.splunk.security_queue.service import SplunkSecurityQueueService
from unified_mcp_server.splunk.splunk_client import SplunkAPIError, SplunkClient
from unified_mcp_server.splunk_service import SplunkService


def settings(**overrides):
    values = {
        "host": "splunk.example.com",
        "port": 8089,
        "username": "",
        "password": "",
        "token": "token",
        "verify_ssl": True,
        "request_timeout": 30,
        "job_timeout": 120,
        "max_events": 100,
        "risk_tolerance": 75,
        "safe_timerange": "24h",
        "sanitize_output": True,
    }
    values.update(overrides)
    return SplunkSettings(**values)


class QueueClient:
    def __init__(self, config, *, error=None):
        self.config = config
        self.error = error
        self.connected = False
        self.closed = False
        self.alert_calls = []

    async def connect(self):
        self.connected = True

    async def disconnect(self):
        self.closed = True

    async def get_fired_alerts(self, *, limit=50, offset=0):
        assert offset >= 0
        return {
            "items": [
                {
                    "name": "Daily login alert",
                    "acl": {"owner": "queue-owner"},
                    "content": {"savedsearch_name": "Daily login alert"},
                }
            ],
            "total": 1,
        }

    async def get_fired_alert(self, name):
        self.alert_calls.append(name)
        return [
            {
                "content": {
                    "sid": "sid-1",
                    "trigger_time": "2026-08-27T11:00:00Z",
                    "severity": "high",
                    "triggered_alerts": "3",
                }
            }
        ]


@pytest.mark.asyncio
async def test_standard_queue_maps_alerts_and_preserves_unknown_soc_fields():
    core = SplunkCore(settings(), QueueClient)
    service = SplunkSecurityQueueService(core)
    assert isinstance(service.provider, StandardSplunkProvider)

    result = await service.list_security_findings(urgency="", limit=1)
    finding = result["findings"][0]

    assert result["source"] == "standard"
    assert result["history_complete"] is False
    assert result["retention_limited"] is True
    assert result["total_count"] is None
    assert finding["source_type"] == "standard_alert"
    assert finding["detection_name"] == "Daily login alert"
    assert finding["supporting_sid"] == "sid-1"
    assert finding["event_count"] == 3
    assert finding["severity"] == "high"
    assert finding["urgency"] is None
    assert finding["status"] is None
    assert finding["disposition"] is None
    assert finding["finding_id"].startswith("standard:finding:")
    assert "Daily login alert" not in finding["finding_id"]
    await core.close()


@pytest.mark.asyncio
async def test_standard_finding_detail_preserves_bounded_response():
    core = SplunkCore(settings(), QueueClient)
    service = SplunkSecurityQueueService(core)
    listed = await service.list_security_findings(limit=1)
    finding_id = listed["findings"][0]["finding_id"]

    detail = await service.get_security_finding(finding_id)
    assert detail["finding"]["supporting_sid"] == "sid-1"
    assert detail["evidence"]["contributing_events"] == []
    await core.close()


@pytest.mark.asyncio
async def test_standard_cursor_advances_through_alert_instances_without_duplicates():
    class PagedStandardClient(QueueClient):
        names = ["alert-c", "alert-b", "alert-a"]

        async def get_fired_alerts(self, *, limit=50, offset=0):
            return {
                "items": [{"name": name} for name in self.names[offset:offset + limit]],
                "total": len(self.names),
            }

        async def get_fired_alert(self, name):
            self.alert_calls.append(name)
            index = {"alert-a": 0, "alert-b": 1, "alert-c": 2}[name]
            return [{
                "content": {
                    "sid": f"sid-{name}",
                    "trigger_time": f"2026-08-27T{10 + index:02d}:00:00Z",
                    "severity": "high",
                }
            }]

    core = SplunkCore(settings(), PagedStandardClient)
    service = SplunkSecurityQueueService(core)
    first = await service.list_security_findings(limit=1)
    second = await service.list_security_findings(limit=1, cursor=first["next_cursor"])
    third = await service.list_security_findings(limit=1, cursor=second["next_cursor"])

    assert [item["detection_name"] for item in first["findings"] + second["findings"] + third["findings"]] == [
        "alert-c", "alert-b", "alert-a",
    ]
    assert len({item["finding_id"] for item in first["findings"] + second["findings"] + third["findings"]}) == 3
    assert third["next_cursor"] is None
    await core.close()


@pytest.mark.asyncio
async def test_queue_input_validation_and_signed_ids_prevent_path_injection():
    core = SplunkCore(settings(), QueueClient)
    service = SplunkSecurityQueueService(core)

    with pytest.raises(ServiceError, match="supported queue value"):
        await service.list_security_findings(status="open")
    with pytest.raises(ServiceError, match="invalid or expired"):
        await service.get_security_finding("standard:finding:../../services/alerts")
    with pytest.raises(ServiceError, match="invalid"):
        await service.get_security_finding(service.codec.encode("other", "finding", {"id": "x"}))
    assert service._limit(10_000) == 200
    await core.close()


@pytest.mark.asyncio
async def test_expired_standard_fired_alert_is_not_found():
    class ExpiredClient(QueueClient):
        async def get_fired_alert(self, _name):
            raise SplunkAPIError("expired", status_code=404)

    core = SplunkCore(settings(), ExpiredClient)
    service = SplunkSecurityQueueService(core)
    finding_id = service.codec.encode(
        "standard",
        "finding",
        {"alert_name": "Daily login alert", "sid": "sid-1", "trigger_time": "", "fingerprint": ""},
    )
    with pytest.raises(ServiceError) as error:
        await service.get_security_finding(finding_id)
    assert error.value.code == "not_found"
    await core.close()


def test_canonical_enum_normalization_keeps_absent_values_absent():
    assert normalize_status("In progress") == "in_progress"
    assert normalize_disposition("true positive") == "true_positive"
    assert normalize_status(None) is None
    assert normalize_disposition(None) is None
    assert normalize_timestamp("not-a-timestamp") is None
    assert normalize_timestamp("1700000000000").startswith("2023-11-14T22:13:20")


def test_splunk_service_injects_one_executor_into_search_detection_and_queue():
    service = SplunkService(settings(), QueueClient)
    assert service.search_service.executor is service.detection_service.executor
    assert service.search_service.executor is service.security_queue_service.executor


def response(payload=None, *, status_code=200, text=None):
    request = httpx.Request("GET", "https://splunk.example.com")
    return httpx.Response(status_code, text=text, json=None if text is not None else payload, request=request)


class QueueHTTP:
    def __init__(self, response_payload, *, path_response=None):
        self.response_payload = response_payload
        self.path_response = path_response or {}
        self.calls = []

    async def get(self, path, params):
        self.calls.append((path, params))
        return self.path_response.get(path, response(self.response_payload))


def raw_client(http):
    client = SplunkClient({"splunk_host": "splunk.example.com", "splunk_port": 8089})
    client._client = http
    return client


@pytest.mark.asyncio
async def test_queue_client_parses_pages_and_quotes_resource_ids():
    http = QueueHTTP({"entry": [{"name": "alert-1", "content": {"savedsearch_name": "alert-1"}}], "total": "1"})
    client = raw_client(http)
    page = await client.get_fired_alerts(limit=1, offset=0)
    assert page == {
        "items": [{"name": "alert-1", "content": {"savedsearch_name": "alert-1"}}],
        "total": 1,
        "next_offset": None,
    }

    direct = QueueHTTP({"entry": [{"name": "alert/1", "content": {"sid": "sid-1"}}]})
    direct_client = raw_client(direct)
    assert await direct_client.get_fired_alert("alert/1") == [{"name": "alert/1", "content": {"sid": "sid-1"}}]
    assert direct.calls[0][0].endswith("/alert%2F1")


@pytest.mark.asyncio
async def test_queue_client_rejects_http_and_malformed_payloads():
    denied = QueueHTTP({}, path_response={"/services/alerts/fired_alerts": response({}, status_code=403)})
    with pytest.raises(SplunkAPIError) as error:
        await raw_client(denied).get_fired_alerts()
    assert error.value.status_code == 403

    malformed = QueueHTTP({"entry": ["bad"]})
    with pytest.raises(SplunkAPIError, match="malformed"):
        await raw_client(malformed).get_fired_alerts()


@pytest.mark.asyncio
async def test_standard_provider_uses_bounded_concurrency_and_early_definition_filtering():
    class ConcurrentStandardClient(QueueClient):
        def __init__(self, config):
            super().__init__(config)
            self.active = 0
            self.max_active = 0
            self.definition_calls = 0

        async def get_fired_alerts(self, *, limit=50, offset=0):
            self.definition_calls += 1
            entries = [
                {
                    "name": f"alert-{index}",
                    "content": {"savedsearch_name": "Endpoint Malware" if index == 2 else "Other"},
                }
                for index in range(10)
            ]
            return {"items": entries[offset:offset + limit], "total": len(entries)}

        async def get_fired_alert(self, name):
            self.alert_calls.append(name)
            self.active += 1
            self.max_active = max(self.max_active, self.active)
            try:
                await asyncio.sleep(0.01)
                return [{"content": {"sid": f"sid-{name}", "trigger_time": "2026-08-27T10:00:00Z"}}]
            finally:
                self.active -= 1

    client = ConcurrentStandardClient(None)
    core = SplunkCore(
        settings(
            security_queue=SecurityQueueConfig(standard_concurrency=3),
        ),
        lambda _: client,
    )
    provider = StandardSplunkProvider(core, OpaqueIdCodec())

    page = await provider.list_findings(
        FindingFilters(detection="Endpoint Malware", earliest_time="0", latest_time="now", limit=1)
    )

    assert len(page.findings) == 1
    assert client.alert_calls == ["alert-2"]
    assert client.max_active == 1
    assert client.max_active <= 3
    assert client.definition_calls > 1
    await core.close()


@pytest.mark.asyncio
async def test_standard_provider_never_exceeds_configured_concurrency():
    class ManyStandardClient(QueueClient):
        def __init__(self, config):
            super().__init__(config)
            self.active = 0
            self.max_active = 0

        async def get_fired_alerts(self, *, limit=50, offset=0):
            entries = [{"name": f"alert-{index}"} for index in range(10)]
            return {"items": entries[offset:offset + limit], "total": len(entries)}

        async def get_fired_alert(self, name):
            self.active += 1
            self.max_active = max(self.max_active, self.active)
            try:
                await asyncio.sleep(0.01)
                return [{"content": {"sid": f"sid-{name}", "trigger_time": "2026-08-27T10:00:00Z"}}]
            finally:
                self.active -= 1

    client = ManyStandardClient(None)
    core = SplunkCore(
        settings(
            security_queue=SecurityQueueConfig(standard_concurrency=3),
        ),
        lambda _: client,
    )
    provider = StandardSplunkProvider(core, OpaqueIdCodec())

    page = await provider.list_findings(
        FindingFilters(earliest_time="0", latest_time="now", limit=10)
    )

    assert len(page.findings) == 10
    assert client.max_active == 3
    await core.close()


@pytest.mark.asyncio
async def test_standard_provider_deduplicates_repeated_alert_instance_lookups():
    class DuplicateStandardClient(QueueClient):
        async def get_fired_alerts(self, *, limit=50, offset=0):
            return {
                "items": [{"name": "same-alert"}, {"name": "same-alert"}],
                "total": 2,
            }

        async def get_fired_alert(self, name):
            self.alert_calls.append(name)
            return [{"content": {"sid": "sid-1", "trigger_time": "2026-08-27T10:00:00Z"}}]

    client = DuplicateStandardClient(None)
    core = SplunkCore(settings(), lambda _: client)
    provider = StandardSplunkProvider(core, OpaqueIdCodec())

    await provider.list_findings(FindingFilters(earliest_time="0", latest_time="now", limit=2))

    assert client.alert_calls == ["same-alert"]
    await core.close()


@pytest.mark.asyncio
async def test_standard_local_time_filter_continues_across_catalog_pages():
    class PagedStandardClient(QueueClient):
        entries = [
            {"name": "old-a"},
            {"name": "old-b"},
            *[{"name": f"new-{index}"} for index in range(5)],
        ]

        async def get_fired_alerts(self, *, limit=50, offset=0):
            # Simulate a backend that returns smaller pages than requested.
            return {"items": self.entries[offset:offset + 2], "total": len(self.entries)}

        async def get_fired_alert(self, name):
            self.alert_calls.append(name)
            trigger = "2020-01-01T00:00:00Z" if name.startswith("old") else "2026-08-27T10:00:00Z"
            return [{"content": {"sid": f"sid-{name}", "trigger_time": trigger}}]

    client = PagedStandardClient(None)
    core = SplunkCore(settings(), lambda _: client)
    provider = StandardSplunkProvider(core, OpaqueIdCodec())

    page = await provider.list_findings(
        FindingFilters(earliest_time="-2d", latest_time="now", limit=5)
    )

    assert {item.title for item in page.findings} == {f"new-{index}" for index in range(5)}
    assert [call for call in client.alert_calls] == [
        "old-a", "old-b", "new-0", "new-1", "new-2", "new-3", "new-4"
    ]
    await core.close()


@pytest.mark.asyncio
async def test_standard_filtered_overflow_is_preserved_in_cursor():
    class OverflowStandardClient(QueueClient):
        async def get_fired_alerts(self, *, limit=50, offset=0):
            return {"items": [{"name": "one-alert"}], "total": 1}

        async def get_fired_alert(self, name):
            self.alert_calls.append(name)
            return [
                {"content": {"sid": f"sid-{index}", "trigger_time": "2026-08-27T10:00:00Z"}}
                for index in range(20)
            ]

    client = OverflowStandardClient(None)
    core = SplunkCore(settings(), lambda _: client)
    provider = StandardSplunkProvider(core, OpaqueIdCodec())
    request = FindingFilters(earliest_time="0", latest_time="now", limit=10)

    first = await provider.list_findings(request)
    second = await provider.list_findings(
        FindingFilters(earliest_time="0", latest_time="now", limit=10, cursor=first.next_cursor or "")
    )

    assert {item.supporting_sid for item in first.findings + second.findings} == {
        f"sid-{index}" for index in range(20)
    }
    assert {item.finding_id for item in first.findings}.isdisjoint(item.finding_id for item in second.findings)
    assert second.next_cursor is None
    assert client.alert_calls == ["one-alert", "one-alert"]
    await core.close()


@pytest.mark.asyncio
async def test_cursor_rejects_changed_filters():
    class PagedStandardClient(QueueClient):
        entries = [{"name": "one"}, {"name": "two"}]

        async def get_fired_alerts(self, *, limit=50, offset=0):
            return {"items": self.entries[offset:offset + limit], "total": len(self.entries)}

        async def get_fired_alert(self, name):
            return [{"content": {"sid": name, "trigger_time": "2026-08-27T10:00:00Z"}}]

    client = PagedStandardClient(None)
    core = SplunkCore(settings(), lambda _: client)
    provider = StandardSplunkProvider(core, OpaqueIdCodec())
    first = await provider.list_findings(FindingFilters(earliest_time="-2d", latest_time="now", limit=1))

    with pytest.raises(ServiceError, match="invalid or expired"):
        await provider.list_findings(
            FindingFilters(earliest_time="-1d", latest_time="now", limit=1, cursor=first.next_cursor or "")
        )
    await core.close()
