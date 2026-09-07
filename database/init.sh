#!/usr/bin/env bash

set -Eeuo pipefail
export LC_ALL=C
unset PGSERVICE

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
SEEDS_DIR="$SCRIPT_DIR/seeds"

db_password=""
trap 'unset db_password' EXIT

die() {
    printf '[ERROR] %s\n' "$1" >&2
    exit 1
}

report_psql_error() {
    local message=${1:-}

    if [[ -n "$db_password" ]]; then
        message=${message//"$db_password"/[REDACTED]}
    fi

    if [[ -n "$message" ]]; then
        printf '%s\n' "$message" >&2
    else
        printf 'PostgreSQL returned no diagnostic output.\n' >&2
    fi
}

read_retry_answer() {
    local answer

    while :; do
        printf 'Would you like to enter the connection information again? [Y/n]: '
        IFS= read -r answer || exit 1
        answer=${answer%$'\r'}

        case "${answer:-Y}" in
            [Yy]|[Yy][Ee][Ss]) return 0 ;;
            [Nn]|[Nn][Oo]) return 1 ;;
            *) printf 'Please answer yes or no.\n' >&2 ;;
        esac
    done
}

read_seed_answer() {
    local answer

    while :; do
        printf 'Run seed files? [y/N]: '
        IFS= read -r answer || exit 1
        answer=${answer%$'\r'}

        case "${answer:-N}" in
            [Yy]|[Yy][Ee][Ss]) return 0 ;;
            [Nn]|[Nn][Oo]) return 1 ;;
            *) printf 'Please answer yes or no.\n' >&2 ;;
        esac
    done
}

if ! command -v psql >/dev/null 2>&1; then
    die 'psql command not found. Install the PostgreSQL client tools and try again.'
fi

if [[ ! -d "$MIGRATIONS_DIR" || ! -d "$SEEDS_DIR" ]]; then
    die "Expected migrations and seeds directories under $SCRIPT_DIR."
fi

while :; do
    printf 'PostgreSQL host: '
    IFS= read -r db_host || exit 1
    db_host=${db_host%$'\r'}
    [[ -n "$db_host" ]] || die 'PostgreSQL host must not be empty.'

    printf 'Port [5432]: '
    IFS= read -r db_port || exit 1
    db_port=${db_port%$'\r'}
    db_port=${db_port:-5432}

    printf 'Database name: '
    IFS= read -r db_name || exit 1
    db_name=${db_name%$'\r'}
    [[ -n "$db_name" ]] || die 'Database name must not be empty.'

    printf 'Username: '
    IFS= read -r db_user || exit 1
    db_user=${db_user%$'\r'}
    [[ -n "$db_user" ]] || die 'Username must not be empty.'

    printf 'Password: '
    IFS= read -r -s db_password || exit 1
    db_password=${db_password%$'\r'}
    printf '\n'

    printf 'SSL mode [prefer]: '
    IFS= read -r db_ssl_mode || exit 1
    db_ssl_mode=${db_ssl_mode%$'\r'}
    db_ssl_mode=${db_ssl_mode:-prefer}

    psql_args=(
        -X
        -w
        -h "$db_host"
        -p "$db_port"
        -U "$db_user"
        -d "$db_name"
    )

    run_psql() {
        PGPASSWORD="$db_password" \
        PGSSLMODE="$db_ssl_mode" \
        PGPASSFILE="${TMPDIR:-/tmp}/.citic-init-passfile-${BASHPID}" \
        PGSERVICEFILE=/dev/null \
        PGCONNECT_TIMEOUT=5 \
        command psql "${psql_args[@]}" "$@"
    }

    connection_output=""
    if connection_output="$(run_psql -qAt -v ON_ERROR_STOP=1 -c 'SELECT 1;' 2>&1)"; then
        printf '[OK] Connected to PostgreSQL\n'
        break
    fi

    printf '[ERROR] Unable to connect to PostgreSQL\n' >&2
    report_psql_error "$connection_output"
    db_password=""

    if ! read_retry_answer; then
        exit 1
    fi
done

schema_output=""
if ! schema_output="$(
    run_psql -q -1 -v ON_ERROR_STOP=1 -c '
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id BIGSERIAL PRIMARY KEY,
            migration_name TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT now()
        );
    ' 2>&1
)"; then
    printf '[ERROR] Unable to create schema_migrations\n' >&2
    report_psql_error "$schema_output"
    exit 1
fi

shopt -s nullglob
migration_files=("$MIGRATIONS_DIR"/*.sql)
seed_files=("$SEEDS_DIR"/*.sql)
shopt -u nullglob

applied_count=0
skipped_count=0

for migration_file in "${migration_files[@]}"; do
    migration_name=${migration_file##*/}
    status_output=""

    if ! status_output="$(
        printf "SELECT 1 FROM schema_migrations WHERE migration_name = :'migration_name' LIMIT 1;\n" |
            run_psql -qAt -v ON_ERROR_STOP=1 -v "migration_name=$migration_name" 2>&1
    )"; then
        printf '[ERROR] Unable to check migration status for %s\n' "$migration_name" >&2
        report_psql_error "$status_output"
        exit 1
    fi

    if [[ "$status_output" == "1" ]]; then
        printf '[SKIP] %s already applied\n' "$migration_name"
        ((skipped_count += 1))
        continue
    fi

    printf '[RUN] %s\n' "$migration_name"
    migration_output=""
    if ! migration_output="$(
        {
            cat -- "$migration_file"
            printf "\nINSERT INTO schema_migrations (migration_name) VALUES (:'migration_name');\n"
        } | run_psql -q -1 -v ON_ERROR_STOP=1 -v "migration_name=$migration_name" 2>&1
    )"; then
        printf '[ERROR] %s failed; changes rolled back\n' "$migration_name" >&2
        report_psql_error "$migration_output"
        exit 1
    fi

    printf '[OK] %s applied\n' "$migration_name"
    ((applied_count += 1))
done

seeds_executed='No'
if read_seed_answer; then
    for seed_file in "${seed_files[@]}"; do
        seed_name=${seed_file##*/}
        printf '[RUN] %s\n' "$seed_name"
        seed_output=""

        if ! seed_output="$(cat -- "$seed_file" | run_psql -q -1 -v ON_ERROR_STOP=1 2>&1)"; then
            printf '[ERROR] %s failed; changes rolled back\n' "$seed_name" >&2
            report_psql_error "$seed_output"
            exit 1
        fi

        printf '[OK] %s executed\n' "$seed_name"
        seeds_executed='Yes'
    done
fi

printf '\nDatabase initialization complete.\n\n'
printf 'Host: %s\n' "$db_host"
printf 'Database: %s\n' "$db_name"
printf 'Applied migrations: %d\n' "$applied_count"
printf 'Skipped migrations: %d\n' "$skipped_count"
printf 'Seeds executed: %s\n' "$seeds_executed"
