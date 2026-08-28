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


@pytest.mark.parametrize(
    "query",
    ["index=*", "index = *", "INDEX=*", "INDEX = *", 'index="*"'],
)
def test_index_formatting_has_one_wildcard_policy_classification(query):
    result = fixed_policy().evaluate(query)
    assert result.decision == "require_approval"
    assert result.wildcard_indexes is True
    assert result.detected_indexes == ["*"]


def test_index_normalization_detects_exact_wildcard_and_multiple_scopes():
    exact = fixed_policy().evaluate("INDEX = MAIN")
    wildcard = fixed_policy().evaluate("index=prod*")
    multiple = fixed_policy().evaluate("(index=a OR index=b)")

    assert exact.decision == "allow"
    assert exact.detected_indexes == ["main"]
    assert wildcard.wildcard_indexes is True
    assert wildcard.detected_indexes == ["prod*"]
    assert multiple.detected_indexes == ["a", "b"]


def test_missing_or_dynamic_index_scope_is_not_assumed_safe():
    assert fixed_policy().evaluate("sourcetype=auth").decision == "require_approval"
    dynamic = fixed_policy().evaluate("index=$runtime_index")
    assert dynamic.index_scope_unknown is True
    assert dynamic.decision == "require_approval"


def test_index_field_assignments_after_a_pipeline_do_not_fake_source_scope():
    result = fixed_policy().evaluate("sourcetype=auth | eval index=main")
    scoped = fixed_policy().evaluate("index=main | search index=other")

    assert result.decision == "require_approval"
    assert scoped.detected_indexes == ["main", "other"]
    assert scoped.decision == "allow"


@pytest.mark.parametrize(
    ("earliest", "expected"),
    [("-15m", "allow"), ("-24h", "allow"), ("-7d", "allow"), ("-30d", "require_approval")],
)
def test_relative_time_ranges_use_explicit_scope_policy(earliest, expected):
    result = fixed_policy().evaluate("index=main", earliest)
    assert result.decision == expected
    assert result.estimated_lookback_seconds is not None


def test_absolute_time_and_calendar_rounding_are_interpreted():
    absolute = fixed_policy().evaluate(
        "index=main", "04/19/2025:00:00:00", "04/20/2025:00:00:00"
    )
    rounded = fixed_policy().evaluate("index=main", "-1d@d")

    assert absolute.estimated_lookback_seconds == 86_400
    assert absolute.decision == "allow"
    assert rounded.estimated_lookback_seconds == 129_600


def test_all_time_and_unknown_time_fail_closed():
    all_time = fixed_policy().evaluate("index=main", "0")
    malformed = fixed_policy().evaluate("index=main", "not-a-time")

    assert all_time.all_time is True
    assert all_time.estimated_lookback_seconds is None
    assert all_time.decision == "require_approval"
    assert malformed.decision == "require_approval"
    assert malformed.estimated_lookback_seconds is None


def test_invalid_dispatch_bound_is_not_hidden_by_a_query_override():
    result = fixed_policy().evaluate(
        "index=main earliest=-15m",
        "not-a-time",
        "now",
    )

    assert result.decision == "require_approval"
    assert result.estimated_lookback_seconds is None


def test_dangerous_commands_are_denied_at_any_subsearch_depth():
    query = "INDEX=main [ search index=test [ SEARCH index=other |  OUTPUTLOOKUP evidence.csv ] ]"
    result = fixed_policy().evaluate(query)

    assert result.decision == "deny"
    assert result.dangerous_commands == ["outputlookup"]
    assert result.has_subsearch is True
    assert result.subsearch_depth == 2
    assert blocked_spl_commands(query) == ["outputlookup"]


@pytest.mark.parametrize("command", ["sendalert", "runshellscript", "dboutput"])
def test_side_effect_commands_are_hard_denied_case_insensitively(command):
    result = fixed_policy().evaluate(f"index=main | {command.upper()} target")

    assert result.decision == "deny"
    assert result.dangerous_commands == [command]


def test_expensive_commands_use_explicit_policy_not_score_thresholds():
    short = fixed_policy().evaluate("index=main | transaction host", "-15m")
    all_time = fixed_policy().evaluate("index=main | transaction host", "0")

    assert short.decision == "require_approval"
    assert short.expensive_commands == ["transaction"]
    assert all_time.decision == "deny"


def test_subsearch_bounds_and_nesting_are_visible_to_policy():
    bounded = fixed_policy().evaluate("index=main [ search index=test maxout=100 ]")
    nested = fixed_policy().evaluate("index=main [ search index=test [ search index=other ] ]")

    assert bounded.decision == "allow"
    assert nested.has_subsearch is True
    assert nested.subsearch_depth == 2
    assert nested.decision == "require_approval"
    assert any("Nested subsearch" in reason for reason in nested.reasons)


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


def test_legacy_risk_tuple_is_only_compatibility_metadata():
    score, message = validate_spl_query("index=main | transaction host", "24h")
    result = fixed_policy().evaluate("index=main | transaction host")

    assert score > 0
    assert "transaction" in message.lower()
    assert result.decision == "require_approval"


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


def test_risk_tolerance_is_not_the_authorization_decision():
    service = SplunkService(
        type("Settings", (), {
            "configured": True,
            "host": "splunk.example.com",
            "token": "token",
            "username": "",
            "password": "",
            "query_policy": QueryPolicyConfig(),
            "risk_tolerance": 0,
            "safe_timerange": "24h",
            "max_events": 50,
        })(),
        lambda _: pytest.fail("validation must not create a client"),
    )

    result = service.validate("index=main")

    assert result["decision"] == "allow"
    assert result["would_execute"] is True


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
