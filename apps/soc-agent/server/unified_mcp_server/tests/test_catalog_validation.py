import pytest

from unified_mcp_server.catalog.validation import (
    citic_rule_number_warning,
    validate_payload,
    validation_error,
)
from unified_mcp_server.errors import ServiceError


def field_messages(exc: ServiceError) -> dict[str, str]:
    assert exc.code == "validation_failed"
    return exc.details["fields"]


def test_customer_requires_code_display_and_known_status():
    with pytest.raises(ServiceError) as caught:
        validate_payload("customer", {"customer_code": "", "display_name": "", "lifecycle_status": "bogus"}, partial=False)
    fields = field_messages(caught.value)
    assert "customer_code" in fields
    assert "display_name" in fields
    assert "lifecycle_status" in fields


def test_customer_rejects_bad_tenant_and_gid_formats():
    with pytest.raises(ServiceError) as caught:
        validate_payload("customer", {
            "customer_code": "fubon",
            "display_name": "Fubon",
            "tenant_number": "4a1228",
            "gid": "not valid!",
            "lifecycle_status": "active",
        }, partial=False)
    fields = field_messages(caught.value)
    assert "tenant_number" in fields
    assert "gid" in fields


def test_rule_number_preserves_digits_only_and_rejects_other_input():
    values = validate_payload("rule", {
        "rule_number": "0042",
        "rule_name_en": "Malicious File Download",
        "severity": "high",
        "status": "active",
    }, partial=False)
    assert values["rule_number"] == "0042"
    assert values["severity"] == "high"

    with pytest.raises(ServiceError) as caught:
        validate_payload("rule", {"rule_number": "741x", "rule_name_en": "x"}, partial=False)
    assert "rule_number" in field_messages(caught.value)


def test_rule_severity_and_status_are_enums():
    with pytest.raises(ServiceError) as caught:
        validate_payload("rule", {"rule_number": "1", "rule_name_en": "x", "severity": "severe", "status": "on"}, partial=False)
    fields = field_messages(caught.value)
    assert "severity" in fields
    assert "status" in fields


def test_partial_update_skips_required_checks_and_fills_defaults():
    values = validate_payload("rule", {"severity": "low"}, partial=True)
    assert values["severity"] == "low"
    # Unsupplied editable columns normalize to empty strings; the service merges
    # them over the current record before persisting.
    assert values["rule_number"] == ""
    assert values["rule_name_en"] == ""


def test_fix_source_type_requires_customer_system_and_value():
    with pytest.raises(ServiceError) as caught:
        validate_payload("fix_source_type", {}, partial=False)
    fields = field_messages(caught.value)
    assert "customer_id" in fields
    assert "system_name" in fields
    assert "fix_source_type_value" in fields


def test_fix_source_type_rejects_bad_fix_index_format():
    with pytest.raises(ServiceError) as caught:
        validate_payload("fix_source_type", {
            "customer_id": "a" * 32,
            "system_name": "QiAnXin EDR",
            "fix_source_type_value": "QiAnXin EDR",
            "default_fix_index": "50176",
        }, partial=False)
    assert "default_fix_index" in field_messages(caught.value)


def test_validation_errors_identify_the_catalog():
    exc = validation_error("rule", {"rule_number": "bad"})
    assert exc.details["catalog"] == "rule"
    assert exc.details["fields"] == {"rule_number": "bad"}


def test_citic_rule_number_warning_flags_non_four_digit_numbers():
    assert citic_rule_number_warning("7412") is None
    warning = citic_rule_number_warning("0")
    assert warning is not None and "four digits" in warning


def test_unknown_catalog_is_rejected():
    with pytest.raises(ServiceError) as caught:
        validate_payload("unknown", {})
    assert caught.value.code == "invalid_input"
