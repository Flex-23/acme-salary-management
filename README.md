# ACME Salary Management

Web-based salary management for ACME's HR Manager. See `CLAUDE.md` for project rules.

## Database setup

The app uses Supabase as plain Postgres. Supabase's direct connection host is IPv6-only on the
free plan, so both URLs below use the **pooler** host (works over IPv4).

1. In Supabase, open **Connect** and copy the pooler connection strings.
2. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` - **Transaction pooler**, port `6543`. Used by the app.
   - `DIRECT_URL` - **Session pooler**, port `5432` on the pooler host. Used for migrations and seeding.
3. Apply the migrations: `npm run db:migrate`
4. Load the sample data (10,000 employees): `npm run db:seed`

`.env.local` is git-ignored. Only placeholders belong in `.env.example`.
