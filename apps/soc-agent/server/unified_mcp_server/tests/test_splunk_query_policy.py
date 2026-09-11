from datetime import datetime, timezone

import pytest

from unified_mcp_server.errors import ServiceError
from unified_mcp_server.splunk.guardrails import blocked_spl_commands, validate_spl_query
from unified_mcp_server.splunk.query_policy import QueryPolicyConfig, SplunkQueryPolicy
from unified_mcp_server.splunk_service import SplunkService


def fixed_policy(**overrides):
    config = QueryPolicyConfig(**overrides)
    return SplunkQueryPolicy(
        config,
        clock=lambda: datetime(2026, 8, 28, 12, 0, tzinfo=timezone.utc),
    )


OUTPUTCSV_SPL = '''index=main error
| outputcsv [
    | stats count
    | addinfo
    | eval rulename="RULE_NUMBER"
    | eval search=strftime(now(), "%Y%m%d%H%M")
    | eval casename="CASE_PREFIX"."".search."".rulename
    | return $casename
]'''


def test_index_formatting_has_one_wildcard_policy_classification():
    for query in ["index=*", "index = *", "INDEX=*", "INDEX = *", 'index="*"']:
        result = fixed_policy().evaluate(query)
        assert result.decision == "require_approval"
        assert result.wildcard_indexes is True
        assert result.detected_indexes == ["*"]




def test_missing_or_dynamic_index_scope_is_not_assumed_safe():
    assert fixed_policy().evaluate("sourcetype=auth").decision == "require_approval"
    dynamic = fixed_policy().evaluate("index=$runtime_index")
    assert dynamic.index_scope_unknown is True
    assert dynamic.decision == "require_approval"




def test_relative_time_ranges_use_explicit_scope_policy():
    for earliest, expected in [
        ("-15m", "allow"),
        ("-24h", "allow"),
        ("-7d", "allow"),
        ("-30d", "require_approval"),
    ]:
        result = fixed_policy().evaluate("index=main", earliest)
        assert result.decision == expected
        assert result.estimated_lookback_seconds is not None






def test_all_time_and_unknown_time_fail_closed():
    all_time = fixed_policy().evaluate("index=main", "0")
    malformed = fixed_policy().evaluate("index=main", "not-a-time")

    assert all_time.all_time is True
    assert all_time.estimated_lookback_seconds is None
    assert all_time.decision == "require_approval"
    assert malformed.decision == "require_approval"
    assert malformed.estimated_lookback_seconds is None




def test_dangerous_commands_are_denied_at_any_subsearch_depth():
    query = "INDEX=main [ search index=test [ SEARCH index=other |  OUTPUTLOOKUP evidence.csv ] ]"
    result = fixed_policy().evaluate(query)

    assert result.decision == "deny"
    assert result.dangerous_commands == ["outputlookup"]
    assert result.has_subsearch is True
    assert result.subsearch_depth == 2
    assert blocked_spl_commands(query) == ["outputlookup"]


def test_outputcsv_is_only_allowed_for_saved_search_definitions():
    strict = fixed_policy().evaluate(OUTPUTCSV_SPL)
    definition = fixed_policy().evaluate(OUTPUTCSV_SPL, allow_outputcsv=True)

    assert strict.decision == "deny"
    assert strict.dangerous_commands == ["outputcsv"]
    assert definition.decision == "allow"
    assert definition.dangerous_commands == ["outputcsv"]
    assert definition.allowed_commands == ["outputcsv"]
    assert definition.has_subsearch is True
    assert not any("no explicit maxout" in reason for reason in definition.reasons)
    assert any("disabled saved-search definition" in reason for reason in definition.reasons)


def test_saved_search_outputcsv_context_does_not_allow_other_side_effects():
    result = fixed_policy().evaluate(
        "index=main | outputcsv [| stats count | return $filename] | outputlookup results.csv",
        allow_outputcsv=True,
    )

    assert result.decision == "deny"
    assert result.dangerous_commands == ["outputcsv", "outputlookup"]




def test_side_effect_commands_are_hard_denied_case_insensitively():
    for command in ["sendalert", "runshellscript", "dboutput"]:
        result = fixed_policy().evaluate(f"index=main | {command.upper()} target")

        assert result.decision == "deny"
        assert result.dangerous_commands == [command]






def test_macros_are_unresolved_unless_explicitly_trusted():
    unknown = fixed_policy().evaluate("index=main `unknown_macro`")
    trusted = fixed_policy(trusted_macros=("trusted_macro",)).evaluate("index=main `trusted_macro`")

    assert unknown.macros == ["unknown_macro"]
    assert unknown.unresolved_macros == ["unknown_macro"]
    assert unknown.decision == "require_approval"
    assert trusted.unresolved_macros == []
    assert trusted.decision == "allow"


def test_quoted_command_text_does_not_become_a_command():
    result = fixed_policy().evaluate('index=main | eval note="delete outputlookup"')
    assert result.dangerous_commands == []
    assert result.decision == "allow"




@pytest.mark.asyncio
async def test_require_approval_never_creates_or_executes_a_splunk_client():
    service = SplunkService(
        type("Settings", (), {
            "configured": True,
            "host": "splunk.example.com",
            "token": "token",
            "username": "",
            "password": "",
            "query_policy": QueryPolicyConfig(),
            "risk_tolerance": 100,
            "safe_timerange": "24h",
            "max_events": 50,
        })(),
        lambda _: pytest.fail("client must not be created for approval-required SPL"),
    )

    with pytest.raises(ServiceError) as error:
        await service.search("index=*")
    assert error.value.code == "query_approval_required"
    assert error.value.details["policy"]["decision"] == "require_approval"




@pytest.mark.asyncio
async def test_detection_backtest_honors_the_same_approval_gate():
    service = SplunkService(
        type("Settings", (), {
            "configured": True,
            "host": "splunk.example.com",
            "token": "token",
            "username": "",
            "password": "",
            "query_policy": QueryPolicyConfig(),
            "risk_tolerance": 100,
            "safe_timerange": "24h",
            "max_events": 50,
        })(),
        lambda _: pytest.fail("client must not be created for approval-required SPL"),
    )

    with pytest.raises(ServiceError) as error:
        await service.backtest_detection(
            {"name": "wildcard", "spl": "index=*"},
            max_count=10,
        )
    assert error.value.code == "detection_invalid"
    assert "approval" in error.value.details["errors"][0]
