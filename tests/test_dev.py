from unified_mcp_server.dev import _docker_postgres_uri, _langgraph_command


def test_langgraph_startup_uses_persistent_postgres_by_default():
    command = _langgraph_command({})

    assert command[1:5] == ["up", "--port", "2024", "--docker-compose"]
    assert "--postgres-uri" not in command


def test_langgraph_startup_accepts_external_postgres_uri():
    command = _langgraph_command(
        {"LANGGRAPH_POSTGRES_URI": "postgresql://db.example.test/app"}
    )

    assert command[-2:] == [
        "--postgres-uri",
        "postgresql://db.example.test/app",
    ]


def test_docker_postgres_uri_rewrites_loopback_hosts():
    assert _docker_postgres_uri("postgresql://chankokpan@localhost:5432/postgres") == (
        "postgresql://chankokpan@host.docker.internal:5432/postgres"
    )
    assert _docker_postgres_uri("postgresql://chankokpan@127.0.0.1:5432/postgres") == (
        "postgresql://chankokpan@host.docker.internal:5432/postgres"
    )
    assert _docker_postgres_uri("postgresql://[::1]:5432/postgres") == (
        "postgresql://host.docker.internal:5432/postgres"
    )


def test_docker_postgres_uri_preserves_remote_hosts():
    uri = "postgresql://user@db.example.test:5432/app"
    assert _docker_postgres_uri(uri) == uri


def test_langgraph_uri_precedence_and_app_fallback_are_docker_safe():
    command = _langgraph_command(
        {
            "APP_POSTGRES_URI": "postgresql://user@localhost:5432/app",
        }
    )
    assert command[-2:] == [
        "--postgres-uri",
        "postgresql://user@host.docker.internal:5432/app",
    ]

    command = _langgraph_command(
        {
            "APP_POSTGRES_URI": "postgresql://user@localhost:5432/app",
            "LANGGRAPH_POSTGRES_URI": "postgresql://user@db.example.test:5432/threads",
        }
    )
    assert command[-2:] == [
        "--postgres-uri",
        "postgresql://user@db.example.test:5432/threads",
    ]
