import asyncio
import json
from types import SimpleNamespace

import pytest

import unified_mcp_server.admin_cli as module
from unified_mcp_server.errors import ServiceError






def test_service_setting_writes_are_disabled():
    class Store:
        def __init__(self):
            self.writes = []

        def set_config(self, key, value):
            self.writes.append((key, value))

        def delete_config(self, key):
            self.writes.append(("delete", key))

    store = Store()

    with pytest.raises(RuntimeError, match=r"server \.env file"):
        module.update_settings(store, {"splunk": {"url": "https://splunk.example.test"}})
    with pytest.raises(RuntimeError, match=r"server \.env file"):
        module.delete_setting(store, "splunk.url")

    assert store.writes == []
