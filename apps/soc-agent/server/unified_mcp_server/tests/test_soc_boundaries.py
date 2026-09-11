import ast
import inspect
from pathlib import Path

import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.splunk.core.service import SplunkCore
from unified_mcp_server.splunk.detection.service import SplunkDetectionService
from unified_mcp_server.splunk.search.service import SplunkSearchService


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
        "max_events": 2,
        "risk_tolerance": 75,
        "safe_timerange": "24h",
        "sanitize_output": True,
    }
    values.update(overrides)
    return SplunkSettings(**values)


class FakeClient:
    def __init__(self, config):
        self.config = config

    async def connect(self):
        pass

    async def disconnect(self):
        pass

    async def get_indexes(self):
        return [{"name": "main"}]

    async def run_search_job(self, *args, **kwargs):
        return {
            "events": [{"event": "match"}],
            "metadata": {
                "total_result_count": 1,
                "fetched_count": 1,
                "splunk_result_truncated": False,
            },
        }

    async def get_saved_search(self, name, app="", owner=""):
        return {
            "name": name,
            "content": {
                "search": "index=main error",
                "disabled": "1",
                "actions": "",
            },
            "acl": {"app": app, "owner": owner},
        }

@pytest.mark.asyncio
async def test_search_service_is_read_only_and_independent_of_detection():
    core = SplunkCore(settings(), FakeClient)
    search = SplunkSearchService(core)

    result = await search.search("index=main error")

    assert result["result"]["type"] == "events"
    assert result["result"]["rows"] == [{"event": "match"}]
    assert not hasattr(search, "detection_service")
    assert "detection" not in inspect.getsource(type(search)).lower()
    await core.close()


@pytest.mark.asyncio
async def test_detection_service_is_read_only_and_backtests_through_core():
    core = SplunkCore(settings(), FakeClient)
    detection = SplunkDetectionService(core)

    result = await detection.backtest_detection({"name": "test", "spl": "index=main error"})
    assert result["sample_count"] == 1
    assert not hasattr(detection, "write_detection")
    assert not hasattr(detection, "update_detection")
    assert not hasattr(detection, "save_detection")
    await core.close()
