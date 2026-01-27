# Database Migrations

## How to Run Migrations

### Production (Neon Database)

```bash
# Connect to your Neon database
psql $NETLIFY_DATABASE_URL

# Run the migration
\i netlify/database/migrations/001_add_csrf_token.sql

# Verify the change
\d sessions
```

### Local Development

If you're using a local PostgreSQL database for testing:

```bash
psql your_local_db < netlify/database/migrations/001_add_csrf_token.sql
```

## Migration History

| Version | File | Description | Date |
|---------|------|-------------|------|
| 001 | `001_add_csrf_token.sql` | Add CSRF token support to sessions table | 2026-01-27 |

## Notes

- Migrations are safe to run multiple times (use `IF NOT EXISTS`)
- Always backup your database before running migrations in production
- Test migrations in a staging environment first
