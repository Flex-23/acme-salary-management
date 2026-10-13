# ACME Salary Management

Web-based salary management for ACME's HR Manager. See `CLAUDE.md` for project rules and
`docs/` for requirements, decisions and performance results.

## Database setup

The app uses Supabase as plain Postgres. Supabase's direct connection host is IPv6-only on the
free plan, so both URLs below use the **pooler** host (works over IPv4).

1. In Supabase, open **Connect** and copy the pooler connection strings.
2. Copy `.env.example` to `.env.local` and fill in `DIRECT_URL` first:
   - `DIRECT_URL` - **Session pooler**, port `5432` on the pooler host, user `postgres.<project-ref>`.
     Used for migrations and seeding.
3. Apply the migrations: `npm run db:migrate`. Migration `0004` creates the app role `salary_app`
   (least privilege, with a 15 s server-side `statement_timeout`).
4. Give that role a password once, in the Supabase SQL editor, and use it in `DATABASE_URL`:

   ```sql
   ALTER ROLE salary_app PASSWORD 'choose-a-long-random-password';
   ```

   - `DATABASE_URL` - **Transaction pooler**, port `6543`, user `salary_app.<project-ref>`. Used by the app.
5. Load the sample data (10,000 employees): `npm run db:seed`
6. Optional: `npm run check:timeout` proves the statement timeout against your database.

The seed is deterministic (fixed faker seed) and idempotent: it truncates `employees` and inserts
everything in one transaction, in batches of 1,000. Options: `npm run db:seed -- --count=50 --seed=7`.
It refuses to run with `NODE_ENV=production` unless `--force` is passed.

`.env.local` is git-ignored. Only placeholders belong in `.env.example`.
