from unified_mcp_server.splunk.detection.citic_format import validate_citic_detection_spl
from unified_mcp_server.tests.citic_fixtures import citic_spl


def test_citic_example_is_valid_with_only_the_required_company_fields():
    result = validate_citic_detection_spl(citic_spl())

    assert result["valid"] is True
    assert result["errors"] == []
    assert result["table_fields"] == [
        "Fix_Ticketnumber",
        "Fix_TriggerTime",
        "Fix_Index",
        "Fix_Source Type",
        "Event_Hostname",
        "Event_Date Time",
    ]
    assert result["rulename"] == "0724"


def test_citic_validator_rejects_missing_or_invalid_rule_numbers():
    missing = citic_spl().replace('| eval rulename="0724"\n', "", 1)
    invalid = citic_spl(rulename="724")

    assert validate_citic_detection_spl(missing)["valid"] is False
    assert any("rulename assignment" in error for error in validate_citic_detection_spl(missing)["errors"])
    assert validate_citic_detection_spl(invalid)["valid"] is False
    assert any("exactly four digits" in error for error in validate_citic_detection_spl(invalid)["errors"])


def test_citic_validator_rejects_inconsistent_main_and_output_rule_numbers():
    spl = citic_spl().replace('| eval rulename="0724"\n', '| eval rulename="0725"\n', 1)

    result = validate_citic_detection_spl(spl)

    assert result["valid"] is False
    assert any("must match" in error for error in result["errors"])


def test_citic_validator_rejects_missing_fields_and_wrong_table_order():
    missing_field = citic_spl().replace('| eval "Fix_Source Type"="QiAnXin EDR"\n', "", 1)
    wrong_order = citic_spl().replace(
        'table Fix_Ticketnumber, Fix_TriggerTime, Fix_Index, "Fix_Source Type", Event_Hostname, "Event_Date Time"',
        'table Fix_Ticketnumber, Fix_Index, Fix_TriggerTime, "Fix_Source Type", Event_Hostname, "Event_Date Time"',
    )

    missing_result = validate_citic_detection_spl(missing_field)
    wrong_result = validate_citic_detection_spl(wrong_order)

    assert missing_result["valid"] is False
    assert any("Fix_Source Type" in error for error in missing_result["errors"])
    assert wrong_result["valid"] is False
    assert any("in order" in error for error in wrong_result["errors"])


def test_citic_validator_rejects_empty_required_assignments():
    empty_gid = citic_spl().replace('| eval GID="50176"\n', '| eval GID=""\n', 1)
    empty_index = citic_spl().replace('| eval "Fix_Index"="G50176"\n', '| eval "Fix_Index"=""\n', 1)

    gid_result = validate_citic_detection_spl(empty_gid)
    index_result = validate_citic_detection_spl(empty_index)

    assert gid_result["valid"] is False
    assert any("GID" in error and "empty" in error for error in gid_result["errors"])
    assert index_result["valid"] is False
    assert any("Fix_Index" in error and "empty" in error for error in index_result["errors"])


def test_citic_validator_requires_table_followed_by_final_outputcsv():
    no_table = citic_spl().replace(
        '| table Fix_Ticketnumber, Fix_TriggerTime, Fix_Index, "Fix_Source Type", Event_Hostname, "Event_Date Time"\n',
        "",
    )
    follow_up_table = citic_spl() + "\n| table Event_Hostname"
    no_outputcsv = citic_spl().split("\n| outputcsv [", 1)[0]

    for spl in (no_table, follow_up_table, no_outputcsv):
        result = validate_citic_detection_spl(spl)
        assert result["valid"] is False
        assert any("outputcsv" in error or "table" in error for error in result["errors"])


def test_citic_validator_rejects_invalid_timestamp_case_name_and_return():
    invalid_timestamp = citic_spl().replace("%Y%m%d%H%M", "%Y%m%d%H%M%S")
    invalid_case = citic_spl().replace('casename="50176"."".search', 'casename="fixed"', 1)
    invalid_return = citic_spl().replace("return $casename", "return $filename")

    timestamp_result = validate_citic_detection_spl(invalid_timestamp)
    case_result = validate_citic_detection_spl(invalid_case)
    return_result = validate_citic_detection_spl(invalid_return)

    assert timestamp_result["valid"] is False
    assert any("strftime" in error for error in timestamp_result["errors"])
    assert case_result["valid"] is False
    assert any("casename" in error for error in case_result["errors"])
    assert return_result["valid"] is False
    assert any("return" in error for error in return_result["errors"])


def test_citic_validator_does_not_count_subsearch_pipes_as_top_level_commands():
    result = validate_citic_detection_spl(citic_spl())

    assert result["valid"] is True
