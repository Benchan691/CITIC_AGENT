from unified_mcp_server.responses import failure, success


def test_response_envelopes_have_stable_shape():
    ok = success("splunk", "search", {"events": []})
    error = failure("zimbra", "search_emails", "not_configured", "missing")

    assert ok == {
        "ok": True,
        "service": "splunk",
        "operation": "search",
        "data": {"events": []},
        "error": None,
        "meta": {},
    }
    assert error["ok"] is False
    assert error["data"] is None
    assert error["error"]["code"] == "not_configured"
    assert error["error"]["retryable"] is False

