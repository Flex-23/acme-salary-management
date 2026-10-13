# ACME Salary Management

[![CI](https://github.com/Flex-23/acme-salary-management/actions/workflows/ci.yml/badge.svg)](https://github.com/Flex-23/acme-salary-management/actions/workflows/ci.yml)

A web app for **ACME's HR Manager** to keep salary records for **10,000 employees in 10 countries** and to see how
the organisation pays people. It replaces an Excel workbook that could not be searched, filtered or summarised
reliably at this size.

| | |
|---|---|
| **Live demo** | https://acme-salary-management-rust.vercel.app (open to everyone, no credentials needed; the data is synthetic) |
| **Demo video** | _TODO: add the video link_ |

## What it answers

**Manage the records:** list, search by name or email, filter by country, department and job title, sort, create,
edit and delete employees, all server-side and shareable by URL.

**Understand pay** (the `/insights` page): each section is a question the HR Manager asks.

- How big is our payroll? Headcount, total annual payroll, average and median salary.
- Where do we pay the most? Median and average by country, in USD and in local currency.
- What does each role earn in a given country? Lowest, median, average and highest per job title.
- Which departments cost the most per person?
- How are salaries spread across the organisation? A histogram by band, for everyone or one country.

USD figures use fixed reference rates (dated 2026-01-01), so comparisons are reproducible, not live.

## Screenshots

_TODO: add screenshots (suggested: `docs/screenshots/employees.png`, `employee-form.png`, `insights.png`)._

| Employees | Add or edit | Insights |
|---|---|---|
| _placeholder_ | _placeholder_ | _placeholder_ |

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components), React 19, TypeScript `strict` |
| Database | Supabase Postgres, used as plain Postgres (transaction pooler) |
| Data access | Drizzle ORM with postgres.js; SQL aggregation (`percentile_cont`, `GROUP BY`) |
| Validation | zod, one schema shared by the API and the forms |
| UI | Tailwind CSS 4, shadcn/ui, TanStack Table 9, react-hook-form, Recharts |
| Tests | Vitest, PGlite (in-process Postgres, no Docker) |
| Tooling | faker (fixed seed) for the data, autocannon for load tests |
| Hosting | Vercel (functions in `fra1`, next to Supabase `eu-central-1`) |

## Architecture in short

A thin Next.js layer (pages and route handlers) calls **services**, which call **repositories**, which talk to
Postgres through a small **query limiter**. The `server/` folder never imports Next.js, so the same services run
under unit tests with in-memory fakes. Reads on pages go straight to the services; every write goes through the
`/api` routes, which validate, write and invalidate the cache in one place. Details and diagrams (request flow,
data model, write path) are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
src/app          pages and route handlers (thin)        src/server/domain        pure logic, zod schemas, money
src/server/...   services, repositories, db, http       tests/                   unit, contract, integration
```

## Run it locally

```bash
npm ci
cp .env.example .env.local     # then fill it in, see "Database setup" below
npm run db:migrate             # create the tables and the app role
npm run db:seed                # 10,000 deterministic employees
npm run dev                    # http://localhost:3000
```

### Database setup

The app uses Supabase as plain Postgres. Supabase's direct connection host is IPv6-only on the free plan, so both
URLs use the **pooler** host (works over IPv4).

1. In Supabase, open **Connect** and copy the pooler connection strings.
2. Copy `.env.example` to `.env.local` and fill in `DIRECT_URL` first:
   - `DIRECT_URL`: **Session pooler**, port `5432`, user `postgres.<project-ref>`. For migrations and seeding only.
3. Apply the migrations: `npm run db:migrate`. Migration `0004` creates the app role `salary_app` (least privilege,
   with a 15 s server-side `statement_timeout`).
4. Give that role a password once, in the Supabase SQL editor, and use it in `DATABASE_URL`:

   ```sql
   ALTER ROLE salary_app PASSWORD 'choose-a-long-random-password';
   ```

   - `DATABASE_URL`: **Transaction pooler**, port `6543`, user `salary_app.<project-ref>`. Used by the app.
5. Load the sample data: `npm run db:seed`. It is deterministic and idempotent (it truncates `employees` and inserts
   in one transaction, in batches of 1,000), and refuses to run with `NODE_ENV=production` unless `--force` is
   passed. Options: `npm run db:seed -- --count=50 --seed=7`.
6. Optional: `npm run check:timeout` proves the statement timeout against your database.

`.env.local` is git-ignored; only placeholders belong in `.env.example`.

### Environment variables

| Variable | Where | Meaning |
|---|---|---|
| `DATABASE_URL` | app (local and Vercel) | Transaction pooler, port 6543, user `salary_app.<project-ref>` |
| `DIRECT_URL` | your machine only, **never on Vercel** | Session pooler, port 5432, user `postgres.<project-ref>`; migrations and seed |
| `DATABASE_POOL_SIZE` | optional | Connection pool and in-flight query limit, 1 to 20, default 5 |
| `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` | optional, **off by default** | Turn on demo access protection (HTTP Basic Auth). Set both, or neither |

## Deploy to Vercel

1. Import the GitHub repository in Vercel. `vercel.json` already pins the functions to **`fra1`** (the region of
   the Supabase project, `eu-central-1`). Check **Settings, Functions, Function Region** shows Frankfurt.
2. Set the environment variables above for **Production** (and Preview if you use it): `DATABASE_URL` as
   `salary_app` on the transaction pooler. Do not set `DIRECT_URL`. Optionally set `BASIC_AUTH_USER` and
   `BASIC_AUTH_PASSWORD` to put the app behind a password (see below).
3. Deploy. The build needs no database and no secrets (every route that reads data renders at request time).
4. Run the smoke test: `npm run smoke -- --url https://<your-app>.vercel.app`. It detects whether the site is
   public or protected; for a protected one add `--user <user> --password <password>`.

Migrations and the seed are run from your machine against Supabase with `DIRECT_URL` (steps 3 and 5 above), not
by the deployment. Environment variable changes only apply to the next deployment, so redeploy after changing them.

### Demo access: public on purpose, password optional

The live demo is **public so that reviewers can open it directly**. It is writable, but the data is synthetic and
reproducible: if someone changes or deletes records, `npm run db:seed` restores the original 10,000 employees in one
command. The app role cannot alter the schema or truncate tables, and every query has a 15 s server-side limit.

If you want a password in front of it (a real deployment, or a demo with sensitive data), set `BASIC_AUTH_USER` and
`BASIC_AUTH_PASSWORD` in Vercel and redeploy: every page and API route then asks for them, except `/api/health`.
This is demo protection, not user authentication (ADR 22, 23).

## Scripts

| Script | What it does |
|---|---|
| `dev`, `build`, `start` | Next.js development server, production build, production server |
| `typecheck`, `lint` | TypeScript (strict) and ESLint |
| `test`, `test:watch`, `test:coverage` | Vitest |
| `db:generate`, `db:migrate`, `db:seed` | Drizzle migrations and the deterministic seed (use `DIRECT_URL`) |
| `smoke` | Post-deploy check: health, the 401 challenge, the list, an insight, the pages |
| `loadtest` | autocannon scenarios against a **production build** (see `docs/PERFORMANCE.md`) |
| `explain` | `EXPLAIN ANALYZE` of the app's real queries on your database |
| `check:timeout` | Proves the server-side statement timeout and the query limiter |

## Testing strategy

About 570 tests, all fast and deterministic (no network, no real Supabase, no Docker, fixed seeds and an injected
clock). CI runs them without any secrets.

- **Unit:** the domain (money without float drift, validation, insight statistics, the histogram), the services
  (against in-memory fake repositories), the HTTP error mapping, Basic Auth (including a test of its constant-time
  behaviour) and the UI helpers (URL state, form logic).
- **Contract tests:** one suite per repository interface, run against **both** the in-memory fake and the real
  Drizzle implementation on PGlite with the real migrations. This keeps the fakes honest.
- **Integration (PGlite):** migrations, constraints, indexes actually used by search and sorting, the app role's
  privileges, and about 160 hostile inputs sent through the real SQL.
- **Route tests:** the exported route handlers are called with a `Request`, checking status codes, response shapes
  and cache invalidation.
- **Not automated:** browser end-to-end tests (out of scope for this version; see below). The UI was exercised
  by hand and with throwaway browser scripts.

## Key decisions

All of them, with context and trade-offs, are in [docs/DECISIONS.md](docs/DECISIONS.md). The five that shape the
project:

1. **Money is an integer in minor units** in the employee's local currency, with fixed, dated reference rates for
   USD comparisons (ADR 4, 5). No floats, no live FX.
2. **Aggregation happens in SQL and is cached under one tag** that every write invalidates, so insights are fast
   and never stale after an edit (ADR 8, 14).
3. **One zod schema for the API and the forms, and one write path**: the browser writes through the same `/api`
   routes that invalidate the cache (ADR 9, 17).
4. **The app queues its own queries and runs as a least-privilege role with a server-side timeout**, because the
   Supabase transaction pooler hung under concurrency and ignores connection-level settings (ADR 19, 21).
5. **The demo is public on purpose, and Basic Auth is an optional switch, not authentication**: reviewers can open
   it directly, the data is synthetic and `npm run db:seed` restores it; accounts and roles stay out of scope
   (ADR 22, 23).

## Performance

Measured on a production build against the real database from Baghdad (about 116 ms per query to Frankfurt):
zero 5xx under 50 concurrent connections; cached insight endpoints around 1,000 req/s (p95 under 100 ms);
database-backed endpoints 15 to 30 req/s, bounded by round trips, not by the database (queries run in 0.1 to 60 ms
on the server). Search, filters and sorts use indexes; one sequential scan was found and fixed. Full results, query
plans, cache timings and the 10x/100x plan: [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## AI workflow

The project was built with Claude Code, one phase at a time, under the standing rules in [CLAUDE.md](CLAUDE.md)
(TDD, small commits, layering, "stop and ask"). The prompts used are in [docs/ai/PROMPTS.md](docs/ai/PROMPTS.md)
and the log of how AI was used, and where human review changed the result, is in
[docs/ai/AI_USAGE.md](docs/ai/AI_USAGE.md).

## Out of scope, and what I would do next

Out of scope by design (see [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)): authentication and roles, taxes and net
pay, salary history, Excel import, live exchange rates, multi-tenancy.

Next, in the order I would do them:

1. **Real authentication and an audit trail** (who changed which salary, and when), replacing the demo Basic Auth.
2. **Measure from Vercel `fra1`** and add the numbers to `docs/PERFORMANCE.md`; then tune `DATABASE_POOL_SIZE`.
3. **Automated browser tests** (Playwright) for the main flows, run in CI.
4. **Import from the existing Excel files**, with a dry run and a validation report.
5. **Scale levers, only when measured**: keyset pagination, a stored USD salary column, materialized views for the
   insights, a shared cache, a read replica.
6. A dark theme (the app is light-only for now) and exporting insights to CSV.
