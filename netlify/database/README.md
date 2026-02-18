# Database Migrations

This project uses schema-as-code for Neon/Postgres.

Rules:

- `schema.sql` is the baseline for a fresh database.
- Every change must be added as a new, numbered SQL file in `migrations/`.
- Migrations are applied in order and are append-only (never edit old migrations).

Naming convention:

- `netlify/database/migrations/NNN_description.sql` (three-digit prefix)
- Example: `netlify/database/migrations/009_add_scores_index.sql`

Suggested workflow:

1. Add a new migration file.
2. Apply it to your Neon database.
3. Keep `schema.sql` in sync if you want a clean bootstrap.
