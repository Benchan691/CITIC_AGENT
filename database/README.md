# PostgreSQL database initialization

Run the initializer from the repository root:

```sh
./database/init.sh
```

The script requires Bash and the PostgreSQL `psql` client. It does not read
connection settings from command-line arguments or environment variables.

## Interactive configuration

The script asks for:

```text
PostgreSQL host:
Port [5432]:
Database name:
Username:
Password:
SSL mode [prefer]:
```

Press Enter to use the port `5432` or SSL mode `prefer`. Password input is
hidden. The password is passed to `psql` only in memory for the current run;
it is never printed or written to a file.

After the connection information is entered, the script immediately runs a
read-only `SELECT 1` connection test. It does this before creating
`schema_migrations`, running migrations, or running seeds. If the test fails,
the PostgreSQL diagnostic is shown with the password redacted and the script
asks whether to enter the connection information again. Answer `n` to exit
without modifying the database.

After a successful connection, the script creates this tracking table if it
does not already exist:

```sql
CREATE TABLE schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    migration_name TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT now()
);
```

## Migrations

Place migration files directly in `database/migrations/` using a numbered
filename such as:

```text
001_create_customers.sql
002_add_customer_status.sql
```

Files are processed in filename order. The complete filename is stored in
`schema_migrations`. Files already recorded there are skipped. Each pending
migration and its tracking row run in one transaction, so a failure rolls back
the migration and stops initialization.

To add a schema change, add the next numbered `.sql` file. Do not edit an
already-applied migration; create a new migration instead. Migration files
should contain SQL statements only and should not manage their own `BEGIN`,
`COMMIT`, or `ROLLBACK` commands.

## Seeds

After all migrations succeed, the script asks:

```text
Run seed files? [y/N]:
```

Answer `y` or `yes` to run `.sql` files directly under `database/seeds/` in
filename order. Each seed file runs in its own transaction, and initialization
stops if one fails. Seeds are not recorded in `schema_migrations`, so they run
again whenever they are selected. Make repeatable seeds idempotent where
possible.

The final summary reports the host, database, migrations applied during the
current run, migrations skipped, and whether at least one seed file executed.
It never reports the password.
