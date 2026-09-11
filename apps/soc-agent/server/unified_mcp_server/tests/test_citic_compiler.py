import pytest

from unified_mcp_server.config import SplunkSettings
from unified_mcp_server.splunk.detection.citic_format import validate_citic_detection_spl
from unified_mcp_server.splunk.detection.compiler import compile_citic_detection
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
        "max_events": 2,
        "risk_tolerance": 75,
        "safe_timerange": "24h",
        "sanitize_output": True,
    }
    values.update(overrides)
    return SplunkSettings(**values)


def compile_definition(**overrides):
    values = {
        "detection_logic": "index=main error | stats count by client_name",
        "rulename": "0724",
        "threat_name": "Suspicious error",
        "threat_type": "Execution",
        "case_prefix": "50176",
        "event_field_mappings": {
            "Fix_Source Type": '"QiAnXin EDR"',
            "Event_Hostname": "client_name",
        },
    }
    values.update(overrides)
    return compile_citic_detection(**values)


def test_compiler_returns_valid_production_and_safe_backtest_forms():
    compiled = compile_definition()

    assert validate_citic_detection_spl(compiled["production_spl"])["valid"] is True
    assert compiled["production_validation"]["valid"] is True
    assert compiled["backtest_validation"]["valid"] is True
    assert "| outputcsv" in compiled["production_spl"]
    assert "| outputcsv" not in compiled["backtest_spl"]
    assert compiled["detection"]["spl"] == compiled["production_spl"]
    assert compiled["detection"]["enabled"] is False
    assert compiled["table_fields"][:6] == [
        "Fix_Ticketnumber",
        "Fix_TriggerTime",
        "Fix_Index",
        "Fix_Source Type",
        "Event_Hostname",
        "Event_Date Time",
    ]






def test_service_compiler_is_read_only_and_returns_validation_results():
    service = SplunkService(
        settings(),
        lambda _: pytest.fail("compiler must not create a Splunk client"),
    )

    result = service.compile_citic_detection(
        detection_logic="index=main error",
        rulename="0724",
        threat_name="Error",
        threat_type="Availability",
        case_prefix="50176",
        event_field_mappings={
            "Fix_Source Type": '"QiAnXin EDR"',
            "Event_Hostname": "client_name",
        },
    )

    assert result["production_validation"]["valid"] is True
    assert result["backtest_validation"]["valid"] is True
    assert any("outputcsv" in warning for warning in result["production_validation"]["warnings"])
    assert service.core._client is None
