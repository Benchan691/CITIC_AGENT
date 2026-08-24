from unified_mcp_server.splunk.guardrails import blocked_spl_commands, sanitize_output, validate_spl_query


def test_safe_query_has_zero_risk():
    score, message = validate_spl_query("index=main earliest=-1h | head 10", "24h")
    assert score == 0
    assert "safe" in message.lower()


def test_inputlookup_is_allowed():
    score, message = validate_spl_query("| inputlookup Ruleset.csv | head 100 earliest=-1h", "24h")
    assert score == 0
    assert "safe" in message.lower()


def test_delete_command_is_high_risk():
    score, message = validate_spl_query("index=* | delete", "24h")
    assert score > 0
    assert "delete" in message.lower() or "Risk factors" in message


def test_all_mutating_or_external_commands_are_hard_blocked():
    for command in (
        "delete", "collect index=summary", "mcollect index=metrics",
        "meventcollect index=metrics", "outputlookup evidence.csv",
        "outputcsv evidence.csv", "sendemail to=ops@example.com",
        "script test", "external test",
    ):
        query = f"index=main | {command}"
        assert blocked_spl_commands(query) == [command.split()[0]]


def test_inputlookup_is_not_a_blocked_write_command():
    assert blocked_spl_commands("| inputlookup evidence.csv | head 10") == []


def test_sanitize_output_masks_sensitive_values():
    sanitized = sanitize_output({"card": "4111-1111-1111-1111", "ssn": "123-45-6789"})
    assert "4111-1111-1111-1111" not in str(sanitized)
    assert "123-45-6789" not in str(sanitized)
