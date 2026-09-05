from unified_mcp_server.catalog.publish import (
    RULESET_COLUMNS,
    canonical_checksum,
    lookup_rows,
    parse_lookup_csv,
    render_lookup_csv,
    validate_publication,
)
from unified_mcp_server.catalog.validation import citic_rule_number_warning
from unified_mcp_server.errors import ServiceError


def rule_record(**overrides):
    record = {
        "catalog": "rule",
        "record_id": "a" * 32,
        "rule_number": "7732",
        "rule_name_en": "Malicious File Download",
        "rule_name_cn": "",
        "rule_name_zh": "",
        "description_en": "Detects downloads.",
        "description_cn": "",
        "description_zh": "",
        "remediation_en": "Investigate the host.",
        "remediation_cn": "",
        "remediation_zh": "",
        "severity": "high",
        "status": "active",
        "customer_id": "",
        "gid": "Default",
        "revision": 3,
        "archived": False,
    }
    record.update(overrides)
    return record


def test_ruleset_row_maps_catalog_fields_and_uppercases_severity():
    row = lookup_rows("rule", [rule_record()], {})[0]
    assert row["RuleNum"] == "7732"
    assert row["RuleName_EN"] == "Malicious File Download"
    assert row["Severity"] == "HIGH"
    assert row["GID"] == "Default"


def test_render_parse_round_trip_preserves_rule_number_text():
    rows = lookup_rows("rule", [rule_record(rule_number="0042"), rule_record(rule_number="0", gid="")], {})
    csv_text = render_lookup_csv(RULESET_COLUMNS, rows)
    assert csv_text.splitlines()[0] == ",".join(RULESET_COLUMNS)
    parsed = parse_lookup_csv(csv_text)
    assert [row["RuleNum"] for row in parsed] == ["0042", "0"]
    assert canonical_checksum(parsed) == canonical_checksum(rows)


def test_canonical_checksum_is_order_independent_per_row_and_stable():
    rows = [{"A": "1", "B": "2"}]
    assert canonical_checksum(rows) == canonical_checksum([{"B": "2", "A": "1"}])
    assert canonical_checksum(rows) != canonical_checksum([{"A": "1", "B": "3"}])


def test_publication_blocks_duplicate_rule_numbers():
    records = [rule_record(), rule_record(record_id="b" * 32)]
    report = validate_publication("rule", records, {})
    assert report["valid"] is False
    assert any("duplicate rule numbers" in error for error in report["errors"])


def test_publication_flags_unknown_customer_and_legacy_rule_numbers():
    records = [rule_record(customer_id="f" * 32, rule_number="0")]
    report = validate_publication("rule", records, {})
    assert report["valid"] is False
    assert any("unknown customer" in error for error in report["errors"])
    assert any("four digits" in warning for warning in report["warnings"])


def test_publication_fix_source_type_index_must_match_customer_gid():
    customers = {"c1": {"record_id": "c1", "customer_code": "fubon", "gid": "50176"}}
    mismatch = {
        "catalog": "fix_source_type",
        "record_id": "s1",
        "customer_id": "c1",
        "system_name": "QiAnXin EDR",
        "fix_source_type_value": "QiAnXin EDR",
        "default_fix_index": "G99999",
        "description": "",
    }
    report = validate_publication("fix_source_type", [mismatch], customers)
    assert report["valid"] is False

    match = dict(mismatch, default_fix_index="G50176")
    report = validate_publication("fix_source_type", [match], customers)
    assert report["valid"] is True


def test_publication_customer_requires_code_and_display_name():
    report = validate_publication("customer", [{"record_id": "c1", "customer_code": "", "display_name": ""}], {})
    assert report["valid"] is False


def test_lookup_rows_rejects_unknown_catalog():
    try:
        lookup_rows("unknown", [], {})
    except ServiceError as exc:
        assert exc.code == "invalid_input"
    else:
        raise AssertionError("unknown catalog must be rejected")


def test_citic_warning_helper():
    assert citic_rule_number_warning("0001") is None
    assert citic_rule_number_warning("7") is not None
