@AGENTS.md

# CLAUDE.md — Project rules for AI assistants

> Standing instructions for any AI agent working in this repo. Read fully before every task.
> If an `AGENTS.md` already exists (create-next-app may generate one), keep its Next.js docs
> pointer and treat this file as the project-specific source of truth.

## 1. Product context

**Goal:** Web-based salary management for ACME's HR Manager (single persona), replacing Excel.
The org has **10,000 employees across multiple countries**. The HR Manager must be able to:

1. **Manage** employee salary records: list, search, filter, sort, create, edit, delete.
2. **Answer questions about how the org pays people**: headcount and pay statistics
   (min / max / average / median) by country, by job title (within a country), by department,
   and pay distribution.

We value **good engineering judgment over complexity**. Do not add infrastructure
(Redis, queues, microservices, auth providers) unless a task explicitly asks for it.

### Working assumptions (documented in docs/REQUIREMENTS.md — do not silently change)
- Salary = **annual gross salary**, stored in the employee's **local currency**, as an
  **integer in minor units** (e.g. cents). Never use floats for money.
- Currency is **derived from the employee's country** (one currency per country).
- Cross-country comparisons use **fixed reference FX rates** stored in a `countries` table
  (illustrative, dated, not live).
- Single HR Manager role. **Authentication, taxes/net pay, salary history, Excel import,
  multi-tenant** are **out of scope** for this version.

## 2. Tech stack (fixed — do not swap libraries without asking)

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, latest installed version), React, TypeScript `strict` |
| Database | Supabase **Postgres** (used as plain Postgres) |
| DB access | **Drizzle ORM** + `postgres` (postgres.js) driver |
| Validation | **zod** — one schema shared by API and forms |
| UI | Tailwind + **shadcn/ui**, **TanStack Table**, **Recharts** |
| Tests | **Vitest**; **PGlite** for DB integration tests (no Docker, no network) |
| Seed data | `@faker-js/faker` with a **fixed seed** |
| Load test | `autocannon` |
| Hosting | Vercel (same region as the Supabase project) |

### Next.js version rule (important)
Next.js changes fast and your training data may be outdated. **Before using any Next.js API
(caching, `searchParams`, route handlers, server actions, config), check the docs for the
installed version** — `node_modules/next/dist/docs/` if present, otherwise the official docs
for the version in `package.json`. Do not use deprecated patterns. If unsure, say so and ask.

## 3. Architecture

```
src/
  app/                    # Next.js: pages, layouts, route handlers — THIN layer only
    api/                  # Route handlers: parse → validate (zod) → call service → respond
  server/                 # Everything below is framework-agnostic (no Next imports)
    domain/               # Types, zod schemas, money/currency, pure insight calculations
    services/             # Use cases (EmployeeService, InsightsService)
    repositories/         # Interfaces + Drizzle implementations
    db/                   # schema.ts, client.ts, migrations/, seed/
    http/                 # Error types → HTTP mapping, response helpers
  components/             # UI components (ui/ = shadcn primitives)
  lib/                    # Client-safe utilities
tests/                    # unit/ and integration/ (mirror src/ structure)
docs/                     # REQUIREMENTS, ARCHITECTURE, DECISIONS, PERFORMANCE, ai/
```

**Rules**
- Dependency direction: `app → services → repositories → db`. `domain` depends on nothing.
- Services receive repositories via **constructor injection** so tests can pass in-memory fakes.
- Route handlers contain **no business logic** (≈ 10 lines max).
- Server Components may call services directly for first render (no extra HTTP hop).
  Client components use the `/api` routes.
- Anything touching the DB imports `server-only`. Never expose secrets via `NEXT_PUBLIC_*`.
- Heavy aggregation happens **in SQL** (`GROUP BY`, `percentile_cont`), never by loading
  all rows into JS.

## 4. Data model

`countries`: `code` (ISO-3166 alpha-2, PK), `name`, `currency` (ISO-4217),
`currency_exponent` (minor-unit digits, e.g. 2; JPY 0), `usd_per_unit` (numeric, fixed).

`employees`: `id` (uuid, PK), `full_name`, `email` (unique, lowercased), `job_title`,
`department`, `country_code` (FK → countries), `salary_minor` (bigint, > 0),
`hire_date` (date, not in future), `created_at`, `updated_at`.

**Indexes:** `country_code`; `(country_code, job_title)`; `department`;
GIN trigram (`pg_trgm`) on `full_name` and `email` for search.
**Security:** enable **Row Level Security on every table with no policies** (blocks
Supabase's public REST API; the app connects server-side with the DB role).

Sorting by salary across countries uses the **USD-normalized** value; per-country views
show local currency. Format money with `Intl.NumberFormat`.

## 5. API contract

```
GET    /api/employees?page=1&pageSize=25&search=&country=&department=&jobTitle=&sort=salaryUsd:desc
POST   /api/employees
GET    /api/employees/:id
PATCH  /api/employees/:id
DELETE /api/employees/:id
GET    /api/insights/summary                 # headcount, total payroll (USD), avg, median
GET    /api/insights/by-country              # per country: headcount, min/max/avg/median (local + USD)
GET    /api/insights/by-job-title?country=XX # per title in a country: headcount, min/max/avg/median
GET    /api/insights/by-department
GET    /api/insights/distribution?country=   # salary bands histogram (USD)
GET    /api/meta/filters                     # distinct countries, departments, job titles
GET    /api/health                           # app + DB check
```
- List response: `{ data: T[], page: { page, pageSize, total, totalPages } }`.
- `pageSize` max **100**; validate and clamp all query params with zod.
- Error response (always this shape): `{ error: { code, message, details? } }`
  with correct status (400 validation, 404 not found, 409 duplicate email, 500 unexpected).
  Never leak stack traces or SQL.
- Whitelisted sort fields only (no raw user input in SQL).
- Every list query must use `id` as a final sort tiebreaker so paging is stable (seeded rows
  share `created_at`).

## 6. Performance & resilience rules
- DB client: connect via **Supabase pooler** (`DATABASE_URL`, transaction mode, port 6543)
  with `prepare: false` and a small pool (`max` ≈ 5). Reuse one client per process
  (global singleton in dev to survive HMR). `DIRECT_URL` (port 5432) only for migrations/seed.
- Server-side pagination, filtering and sorting. Never send all 10k rows to the client.
- Insights are cached with the installed Next.js caching API and a cache **tag**;
  every employee mutation **invalidates** that tag.
- Search input is debounced on the client; filters live in the URL (`searchParams`).
- UI has loading states, empty states and error boundaries.

## 7. Engineering workflow

- **TDD:** write a failing test → minimal code to pass → refactor. Show the red→green cycle
  in commits where practical.
- Tests must be **fast, deterministic, readable**: no network, no real Supabase, no
  `Date.now()`/random without injection, fixed faker seed. Name tests by behaviour
  (`it("rejects a hire date in the future")`).
- Unit-test: domain (money, validation, insight math), services (with in-memory fake repos).
  Integration-test: repositories against **PGlite** with real migrations.
- **Small commits**, Conventional Commits (`feat:`, `test:`, `refactor:`, `chore:`, `docs:`),
  one logical change each. Never commit failing tests, secrets, or `.env*` (except `.env.example`).
- Before every commit run: `npm run typecheck && npm run lint && npm test`.
- Run `npm test` directly (never piped through grep or other tools) and check its exit code
  before committing.
- Keep functions small and named for intent. No `any`. No dead code or commented-out code.
- Do **not** add dependencies beyond section 2 without asking first.
- If a requirement is ambiguous, **stop and ask** — do not guess.
- End of each phase: stop, summarize what changed, list any decisions/trade-offs made,
  and wait for review.

## 8. Scripts (keep these names)
`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:coverage`,
`db:generate`, `db:migrate`, `db:seed`, `loadtest`.

## 9. Environment
```
DATABASE_URL=   # Supabase pooler (transaction mode, :6543) — used by the app
DIRECT_URL=     # Supabase direct connection (:5432) — migrations & seed only
```
