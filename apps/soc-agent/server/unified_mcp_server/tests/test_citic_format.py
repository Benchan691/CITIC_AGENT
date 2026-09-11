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
