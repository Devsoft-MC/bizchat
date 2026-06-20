# BizChat Local Database Setup

Use a local PostgreSQL database during development so backend work can be tested before using the VPS.

## Database Name

Recommended local database:

```text
bizchat_local
```

## Create Local Database

Start PostgreSQL first, then run:

```bash
createdb -h localhost -p 5432 bizchat_local
psql -h localhost -p 5432 -d bizchat_local -f database/schema.sql
```

If the database already exists and you want to recreate it during early development:

```bash
dropdb -h localhost -p 5432 bizchat_local
createdb -h localhost -p 5432 bizchat_local
psql -h localhost -p 5432 -d bizchat_local -f database/schema.sql
```

Only use the reset commands for local development data.

## Local Connection String

Default local connection string:

```text
DATABASE_URL=postgresql://localhost:5432/bizchat_local
```

If your local PostgreSQL uses username and password, use:

```text
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/bizchat_local
```

## Environment Plan

Use separate databases for each environment:

```text
Local development: bizchat_local
VPS staging:       bizchat_staging
VPS production:    bizchatdb
```

Develop and test locally first. Move to VPS staging only after the backend APIs and schema are stable.

## Hostinger VPS Production with DBeaver

Use an SSH tunnel in DBeaver instead of exposing PostgreSQL port `5432` publicly.

Run the production scripts in this order:

1. Connect to the VPS `postgres` database as the PostgreSQL administrator and run `database/vps/01_create_database.sql`.
2. Reconnect to `bizchatdb` as `bizchat_app` and run `database/schema.sql`.
3. In the same production connection, run `database/vps/02_create_icon_company.sql`.
4. Run `database/vps/03_verify_database.sql`; the expected public table count is `24`.

Keep the database password and iCON temporary admin password outside source control.

### DBeaver schema files

If the complete `database/schema.sql` is too large for one execution, run these files in order:

1. `database/schema-parts/01_organization.sql`
2. `database/schema-parts/02_messaging.sql`
3. `database/schema-parts/03_calls_and_devices.sql`
4. `database/schema-parts/04_work_management.sql`
5. `database/schema-parts/05_facilities_audit_indexes.sql`

## Migrations

Apply migrations to an existing local database without deleting its data:

```bash
psql -h localhost -p 5432 -d bizchat_local -f database/migrations/001_user_location.sql
```
