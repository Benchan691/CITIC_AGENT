import asyncio

import httpx
import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.core.service import SplunkCore
from unified_mcp_server.splunk.security_queue.classic_provider import ClassicSplunkProvider
from unified_mcp_server.splunk.security_queue.model import OpaqueIdCodec, normalize_disposition, normalize_status
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
        "security_queue_mode": "auto",
    }
    values.update(overrides)
    return SplunkSettings(**values)


class QueueClient:
    def __init__(self, config, *, mode="classic", error=None):
        self.config = config
        self.mode = mode
        self.error = error
        self.connected = False
        self.closed = False
        self.es_calls = 0
        self.alert_calls = []

    async def connect(self):
        self.connected = True

    async def disconnect(self):
        self.closed = True

    async def get_es_findings(self, **_kwargs):
        self.es_calls += 1
        if self.error is not None:
            raise self.error
        return {
            "items": [
                {
                    "id": "es-1",
                    "title": "Suspicious login",
                    "detection_name": "Login analytic",
                    "trigger_time": "2026-08-27T10:00:00Z",
                    "severity": "Critical",
                    "urgency": "High",
                    "status": "In progress",
                    "owner": "analyst",
                    "disposition": "False positive",
                    "entities": ["user:alice", "user:alice"],
                    "risk_objects": [{"field": "src_ip", "value": "192.0.2.1"}],
                    "annotations": {"mitre_attack": ["T1059"]},
                    "event_count": 0,
                }
            ],
            "total": 1,
        }

    async def get_es_finding(self, finding_id):
        assert finding_id == "es-1"
        return {
            "id": finding_id,
            "title": "Suspicious login",
            "detection_name": "Login analytic",
            "severity": "critical",
            "urgency": "high",
            "status": "in progress",
            "owner": "analyst",
            "contributing_events": [
                {"user": "alice", "card": "4111-1111-1111-1111", "ssn": "123-45-6789"}
            ],
            "investigations": ["case-1"],
        }

    async def get_es_investigation(self, investigation_id):
        assert investigation_id == "case-1"
        return {
            "id": investigation_id,
            "title": "Login investigation",
            "status": "In progress",
            "urgency": "high",
            "disposition": "Undetermined",
            "findings": [{"id": "es-1", "title": "Suspicious login"}],
            "timeline": [{"message": "reviewed"}],
        }

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
async def test_classic_queue_maps_alerts_and_preserves_unknown_soc_fields():
    core = SplunkCore(settings(security_queue_mode="classic"), QueueClient)
    service = SplunkSecurityQueueService(core)

    result = await service.list_security_findings(urgency="", limit=1)
    finding = result["findings"][0]

    assert result["source"] == "classic"
    assert result["capabilities"]["native_findings"] is False
    assert result["history_complete"] is False
    assert result["retention_limited"] is True
    assert result["total_count"] is None
    assert finding["source_type"] == "classic_alert"
    assert finding["detection_name"] == "Daily login alert"
    assert finding["supporting_sid"] == "sid-1"
    assert finding["event_count"] == 3
    assert finding["severity"] == "high"
    assert finding["urgency"] is None
    assert finding["status"] is None
    assert finding["disposition"] is None
    assert finding["finding_id"].startswith("classic:finding:")
    assert "Daily login alert" not in finding["finding_id"]
    await core.close()


@pytest.mark.asyncio
async def test_classic_finding_detail_and_investigation_capability():
    core = SplunkCore(settings(security_queue_mode="classic"), QueueClient)
    service = SplunkSecurityQueueService(core)
    listed = await service.list_security_findings(limit=1)
    finding_id = listed["findings"][0]["finding_id"]

    detail = await service.get_security_finding(finding_id)
    assert detail["finding"]["supporting_sid"] == "sid-1"
    assert detail["evidence"]["contributing_events"] == []
    assert detail["capabilities"]["native_investigations"] is False

    investigation_id = service.codec.encode("classic", "investigation", {"id": "not-supported"})
    unsupported = await service.get_investigation(investigation_id)
    assert unsupported["supported"] is False
    assert unsupported["capabilities"]["native_investigations"] is False
    assert "native investigation" in unsupported["reason"]
    await core.close()


@pytest.mark.asyncio
async def test_enterprise_security_normalizes_details_and_bounds_evidence():
    core = SplunkCore(settings(security_queue_mode="enterprise_security"), QueueClient)
    service = SplunkSecurityQueueService(core)

    listed = await service.list_security_findings(limit=1)
    finding = listed["findings"][0]
    assert finding["severity"] == "critical"
    assert finding["urgency"] == "high"
    assert finding["status"] == "in_progress"
    assert finding["source_status"] == "In progress"
    assert finding["disposition"] == "false_positive"
    assert finding["entities"] == ["user:alice"]
    assert finding["event_count"] == 0

    detail = await service.get_security_finding(finding["finding_id"])
    event = detail["evidence"]["contributing_events"][0]
    assert event["card"] == "****-****-****-1111"
    assert event["ssn"] == "***-**-****"
    assert detail["evidence"]["investigation_ids"]
    assert detail["capabilities"]["native_findings"] is True

    investigation_id = service.codec.encode("enterprise_security", "investigation", {"id": "case-1"})
    investigation = await service.get_investigation(investigation_id)
    assert investigation["supported"] is True
    assert investigation["investigation"]["status"] == "in_progress"
    assert investigation["investigation_id"] == investigation["investigation"]["investigation_id"]
    assert investigation["findings"][0]["finding_id"].startswith("enterprise_security:finding:")
    assert "case-1" not in investigation["investigation"]["investigation_id"]
    await core.close()


@pytest.mark.asyncio
async def test_auto_mode_falls_back_only_for_missing_es_capability():
    clients = []

    class MissingESClient(QueueClient):
        async def get_es_findings(self, **_kwargs):
            self.es_calls += 1
            raise SplunkAPIError("missing", status_code=404)

    def factory(config):
        client = MissingESClient(config)
        clients.append(client)
        return client

    core = SplunkCore(settings(), factory)
    service = SplunkSecurityQueueService(core)
    result = await service.list_security_findings(limit=1)
    assert result["source"] == "classic"
    assert clients[0].es_calls == 1
    assert clients[0].alert_calls == ["Daily login alert"]
    await core.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [401, 403])
async def test_auto_mode_does_not_turn_permission_errors_into_empty_queue(status):
    class PermissionClient(QueueClient):
        async def get_es_findings(self, **_kwargs):
            raise SplunkAPIError("denied", status_code=status)

    core = SplunkCore(settings(), PermissionClient)
    service = SplunkSecurityQueueService(core)
    with pytest.raises(ServiceError) as error:
        await service.list_security_findings()
    assert error.value.code == "insufficient_permissions"
    assert error.value.details["status_code"] == status
    await core.close()


@pytest.mark.asyncio
async def test_auto_mode_does_not_fallback_on_server_errors():
    class ServerErrorClient(QueueClient):
        async def get_es_findings(self, **_kwargs):
            raise SplunkAPIError("unavailable", status_code=500)

    core = SplunkCore(settings(), ServerErrorClient)
    service = SplunkSecurityQueueService(core)
    with pytest.raises(ServiceError) as error:
        await service.list_security_findings()
    assert error.value.code == "splunk_api_error"
    assert error.value.retryable is True
    await core.close()


@pytest.mark.asyncio
async def test_classic_cursor_advances_through_alert_instances_without_duplicates():
    class PagedClassicClient(QueueClient):
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

    core = SplunkCore(settings(security_queue_mode="classic"), PagedClassicClient)
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
    core = SplunkCore(settings(security_queue_mode="classic"), QueueClient)
    service = SplunkSecurityQueueService(core)

    with pytest.raises(ServiceError, match="supported queue value"):
        await service.list_security_findings(status="open")
    with pytest.raises(ServiceError, match="invalid or expired"):
        await service.get_security_finding("classic:finding:../../services/alerts")
    with pytest.raises(ServiceError, match="active queue provider"):
        await service.get_security_finding(service.codec.encode("enterprise_security", "finding", {"id": "x"}))
    assert service._limit(10_000) == 200
    await core.close()


@pytest.mark.asyncio
async def test_expired_classic_fired_alert_is_not_found():
    class ExpiredClient(QueueClient):
        async def get_fired_alert(self, _name):
            raise SplunkAPIError("expired", status_code=404)

    core = SplunkCore(settings(security_queue_mode="classic"), ExpiredClient)
    service = SplunkSecurityQueueService(core)
    finding_id = service.codec.encode(
        "classic",
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
    http = QueueHTTP({"entry": [{"name": "f-1", "content": {"id": "f-1"}}], "total": "1"})
    client = raw_client(http)
    page = await client.get_es_findings(limit=1, offset=0)
    assert page == {
        "items": [{"name": "f-1", "content": {"id": "f-1"}}],
        "total": 1,
        "next_offset": None,
    }

    direct = QueueHTTP({"id": "f-1", "title": "Finding"})
    direct_client = raw_client(direct)
    assert await direct_client.get_es_finding("f/1") == {"id": "f-1", "title": "Finding"}
    assert direct.calls[0][0].endswith("/f%2F1")


@pytest.mark.asyncio
async def test_queue_client_rejects_http_and_malformed_payloads():
    denied = QueueHTTP({}, path_response={"/services/alerts/fired_alerts": response({}, status_code=403)})
    with pytest.raises(SplunkAPIError) as error:
        await raw_client(denied).get_fired_alerts()
    assert error.value.status_code == 403

    malformed = QueueHTTP({"entry": ["bad"]})
    with pytest.raises(SplunkAPIError, match="malformed"):
        await raw_client(malformed).get_fired_alerts()
