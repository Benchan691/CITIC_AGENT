import asyncio
from datetime import datetime, timedelta, timezone

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


_TEST_NOW = datetime.now(timezone.utc).replace(microsecond=0)


def _recent_timestamp(hours=1):
    return (_TEST_NOW - timedelta(hours=hours)).isoformat().replace("+00:00", "Z")


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
                    "trigger_time": _recent_timestamp(),
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
                    "trigger_time": _recent_timestamp(3 - index),
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
                return [{"content": {"sid": f"sid-{name}", "trigger_time": _recent_timestamp()}}]
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
async def test_cursor_rejects_changed_filters():
    class PagedStandardClient(QueueClient):
        entries = [{"name": "one"}, {"name": "two"}]

        async def get_fired_alerts(self, *, limit=50, offset=0):
            return {"items": self.entries[offset:offset + limit], "total": len(self.entries)}

        async def get_fired_alert(self, name):
            return [{"content": {"sid": name, "trigger_time": _recent_timestamp()}}]

    client = PagedStandardClient(None)
    core = SplunkCore(settings(), lambda _: client)
    provider = StandardSplunkProvider(core, OpaqueIdCodec())
    first = await provider.list_findings(FindingFilters(earliest_time="-2d", latest_time="now", limit=1))

    with pytest.raises(ServiceError, match="invalid or expired"):
        await provider.list_findings(
            FindingFilters(earliest_time="-1d", latest_time="now", limit=1, cursor=first.next_cursor or "")
        )
    await core.close()
