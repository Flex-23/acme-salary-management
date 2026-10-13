# Phased prompts

These are the prompts used to build this project with an AI coding agent, in order.
Each phase ends with passing checks, small commits, and a human review before moving on.
Standing rules live in `/CLAUDE.md`; every prompt below assumes the agent has read it.

**How I use these:** paste one phase at a time. After each phase I review the diff, run the
app, and log what the AI got right or wrong in `docs/ai/AI_USAGE.md`.

---

## Phase 0 — Clean the boilerplate and set up tooling

```
Read CLAUDE.md fully. Then inspect the current project (package.json, next.config, tsconfig,
app/ or src/app/, eslint config, any AGENTS.md) and tell me the exact Next.js, React and
Tailwind versions installed before changing anything.

Then:
1. Remove create-next-app boilerplate: demo content in the home page, demo SVGs in public/,
   demo styles in globals.css (keep the Tailwind import only), the default README content.
   Keep the root layout but give it a neutral title "ACME Salary Management".
2. Move to the folder structure in CLAUDE.md section 3 (use src/ if not already).
3. Ensure tsconfig is strict (add noUncheckedIndexedAccess).
4. Install and configure Vitest (node environment, path aliases matching tsconfig).
   Add one trivial passing test to prove the setup.
5. Add the npm scripts listed in CLAUDE.md section 8 (db/loadtest scripts can be placeholders
   that print "not implemented yet" for now).
6. Add .env.example from CLAUDE.md section 9 and make sure .env* is git-ignored.

Commits (separate): "chore: remove create-next-app boilerplate",
"chore: configure strict TypeScript and Vitest", "chore: add scripts and env example".
Run typecheck, lint and test before each commit. Stop and summarize.
```

## Phase 1 — Requirements and design notes (before any feature code)

```
Draft docs/REQUIREMENTS.md — strictly ONE page — using CLAUDE.md sections 1, 4 and 5:
- Goal and persona (HR Manager, 10k employees, multiple countries, replacing Excel)
- Problem statement in one paragraph
- In scope: features as user stories with short acceptance criteria
  (manage employees; search/filter/sort; insights by country, job title, department,
  distribution; summary KPIs)
- Assumptions (money in minor units, currency per country, fixed FX rates, annual gross)
- Deliberately out of scope, each with a one-line reason: authentication/roles, taxes and
  net pay, salary history/audit trail, Excel/CSV import, live FX rates, multi-tenancy,
  E2E browser tests
- Non-functional requirements: p95 API latency target, page size limits, resilience,
  security (RLS, server-only DB access)

Also create docs/DECISIONS.md with short ADR-style entries (Context / Decision /
Consequences) for: Next.js full-stack vs separate backend; Supabase Postgres via Drizzle
(not supabase-js); pooler connection on serverless; money as integer minor units;
fixed FX table; offset pagination (and when we'd move to keyset); PGlite for integration
tests; no Redis/queues at this scale.

Keep language plain and concise. I will edit these myself before committing.
Commit: "docs: add one-page requirements and initial design decisions". Stop.
```

## Phase 2 — Domain layer (pure, TDD)

```
Implement src/server/domain with TDD (test first, then code). No database, no Next imports.

1. countries.ts: the supported countries config (8–10 countries, e.g. US, GB, IN, DE, FR,
   CA, AU, SG, AE, JP) with currency, currency_exponent and fixed usd_per_unit.
2. money.ts:
   - toMinor(major, exponent) / fromMinor(minor, exponent) — integer-safe, no float drift
   - toUsdMinor(minor, country) — conversion using the fixed rate, rounded half-even
   - formatMoney(minor, currency, locale) using Intl.NumberFormat
3. employee.ts: zod schemas
   - EmployeeInput (create): fullName (trimmed, 2–120 chars), email (lowercased, valid),
     jobTitle, department, countryCode (must be supported), salary (major units in the
     form, converted to minor; > 0; sane upper bound), hireDate (not in the future —
     inject "today" so tests are deterministic)
   - EmployeeUpdate (partial of the above)
   - ListEmployeesQuery: page, pageSize (default 25, max 100, clamped), search, filters,
     sort from a whitelist (fullName, hireDate, salaryUsd, createdAt) + direction
4. insights.ts: pure functions for stats over an array of numbers — min, max, mean,
   median (even and odd counts), and banding into histogram buckets. These are used to
   unit-test logic and to verify SQL results in integration tests.

Tests: edge cases first (empty input, single value, rounding, zero-decimal currency like
JPY, invalid country, future hire date, pageSize above max). Keep each test small.

Commit in small steps (e.g. "test: money conversion", "feat: money conversion", ...).
Stop and summarize.
```

## Phase 3 — Database schema, client and repositories

```
1. src/server/db/schema.ts — Drizzle schema exactly as CLAUDE.md section 4
   (tables, FK, unique email, check salary_minor > 0, indexes).
2. Migrations via drizzle-kit. Add a SQL migration that:
   - enables the pg_trgm extension and creates GIN trigram indexes on full_name and email
   - enables RLS on every table with no policies
   - seeds the countries table from domain/countries.ts values
3. src/server/db/client.ts — postgres.js client per CLAUDE.md section 6
   (pooler URL, prepare:false, small max, global singleton in dev, imports "server-only").
4. src/server/repositories:
   - EmployeeRepository interface + Drizzle implementation:
     list(query) → { rows, total } with search (ILIKE on name/email using trigram index),
     filters, whitelisted sort (salaryUsd computed via join to countries), offset paging;
     findById, create, update, delete; map unique-violation to a DuplicateEmailError.
   - InsightsRepository interface + Drizzle implementation using SQL aggregation:
     summary, byCountry (local + USD), byJobTitle(country), byDepartment,
     distribution(country?) — use percentile_cont(0.5) for median.
   - In-memory fake implementations of both interfaces (for service unit tests).
5. Integration tests with PGlite: run the real migrations on an in-process database,
   insert a small fixed dataset, and assert list/search/filter/sort/paging and every
   insight query. Compare aggregate results with the pure functions from domain/insights.ts.
   Tests must not need network or Docker.

Note: if pg_trgm is unavailable in PGlite, make the extension step conditional in tests
only and explain the trade-off. Ask me before working around anything else.

Small commits. Stop and summarize, including any SQL you think I should double-check.
```

## Phase 4 — Seed script (10,000 employees)

```
Create src/server/db/seed/ and the db:seed script.

- Deterministic: faker with a fixed seed, so every run produces identical data.
- Realistic: departments → job titles with levels; salary = base per title × country
  cost factor × small random spread; realistic hire dates over the last ~12 years;
  unique emails derived from names.
- Idempotent: inside one transaction, truncate employees then insert.
- Fast: insert in batches of 1,000; print progress and total duration.
- Uses DIRECT_URL (not the pooler). Refuse to run if NODE_ENV=production unless
  --force is passed.
- Count is configurable (default 10000) so tests can generate 50.

Separate the pure "generate employees" function from the "write to DB" part and unit-test
the generator (count, determinism with same seed, all records pass EmployeeInput schema,
emails unique). Commit: "feat: deterministic seed for 10k employees". Stop.
```

## Phase 5 — Services and API route handlers

```
1. src/server/services:
   - EmployeeService(employeeRepo, clock): list, get, create, update, delete.
     Validates with the domain zod schemas; throws typed errors (ValidationError,
     NotFoundError, DuplicateEmailError).
   - InsightsService(insightsRepo): thin, returns API-ready DTOs (both local and USD
     formatted values where relevant).
   Unit-test services with the in-memory fakes (TDD).
2. src/server/http: error → HTTP mapping producing the error shape in CLAUDE.md section 5,
   plus a small helper to wrap route handlers so unexpected errors return 500 without
   leaking details (log them server-side).
3. Route handlers for every endpoint in CLAUDE.md section 5. Each handler stays thin.
   After any mutation, invalidate the insights cache tag (use the API of the installed
   Next.js version — check the docs first and tell me which API you chose and why).
4. /api/health checks DB connectivity with a trivial query and a short timeout.
5. Add a few tests that call the exported route handler functions with a Request object
   to verify status codes and response shapes (validation 400, not found 404,
   duplicate 409, list pagination shape).

Small commits per endpoint group. Stop and summarize.
```

## Phase 6 — UI: employees management

```
Install and set up shadcn/ui (check its docs for the installed Tailwind/Next versions).
Build a clean, professional HR admin UI — clarity over decoration.

- App shell: sidebar or top nav with "Employees" and "Insights".
- /employees (Server Component for first render, data from EmployeeService directly):
  - TanStack Table with server-side pagination, sorting and filters.
  - All table state lives in the URL searchParams (shareable, back-button friendly).
  - Debounced search (300ms), filter selects populated from /api/meta/filters.
  - Salary shown in local currency, with USD equivalent as secondary text.
  - Loading skeleton, empty state, error boundary.
- Create / edit employee in a dialog or side sheet using react-hook-form + the SAME zod
  schema as the API; show field-level server errors (e.g. duplicate email).
- Delete with a confirmation dialog.
- After mutations: refresh the current page data and show a toast.
- Accessible: labels, keyboard navigation, focus management in dialogs.

Keep components small; extract hooks for URL state. Commit per feature
(table, filters, create, edit, delete). Stop and summarize.
```

## Phase 7 — UI: insights dashboard

```
Build /insights so the HR Manager can answer "how does the org pay people?" at a glance.

- KPI cards: headcount, total annual payroll (USD), average and median salary (USD).
- By country: table + bar chart (median and average in USD; local currency in table).
- By job title: country selector → table of titles with headcount, min, median, avg, max.
- By department: bar chart.
- Distribution: histogram of salary bands, filterable by country.
- Every chart has a clear title, axis labels, readable number formatting, and a table
  or tooltip with exact values. State the FX note ("USD at fixed reference rates as of …").
- Server-rendered first paint from InsightsService (cached), with loading skeletons.

Commit per section. Stop and summarize.
```

## Phase 8 — Performance and resilience verification

```
1. Add scripts/loadtest.ts using autocannon against a configurable BASE_URL, covering:
   list (page 1), list with search + filter + sort, deep page, get by id,
   insights/summary, insights/by-country. Report req/s, p50, p95, p99, errors.
2. Run EXPLAIN ANALYZE for the list (with search/sort) and each insight query against
   seeded data; confirm indexes are used, and fix any that aren't.
3. Verify: invalid query params never cause 500s; pageSize is clamped; the app survives
   the load test with zero 5xx.
4. Write docs/PERFORMANCE.md: setup used (local prod build or Vercel preview — not
   production), results table, query plans summary, what is cached and how it is
   invalidated, known limits, and "what we'd do at 10x/100x scale" (keyset pagination,
   read replicas, materialized views, Redis) — explicitly not built now and why.

Commit: "perf: add load test and document results". Stop.
```

## Phase 9 — Deployment and documentation

```
1. Deployment readiness for Vercel + Supabase:
   - Document setting the Vercel function region to match the Supabase region.
   - Migrations and seed run against Supabase using DIRECT_URL (document the commands).
   - Env vars documented; nothing secret in the repo.
2. README.md: what it is, live URL placeholder, demo video placeholder, screenshots
   placeholder, tech stack, how to run locally (with a local Postgres or Supabase),
   scripts, testing strategy, project structure, links to docs/.
3. docs/ARCHITECTURE.md: Mermaid diagrams for (a) the request flow
   browser → Next.js (Server Components / route handlers) → services → repositories →
   Supabase pooler → Postgres, and (b) the data model.
4. Make sure docs/ai/AI_USAGE.md has an entry per phase (I will fill in my own notes on
   what I accepted, changed or rejected).
5. Final check: typecheck, lint, all tests, production build.

Commit: "docs: add README, architecture and deployment guide". Stop and give me a short
checklist of anything left for me to do manually.
```

---

## Reusable mini-prompts

- **Review before commit:**
  `Review the staged diff as a strict senior reviewer: correctness, naming, test quality,
  layering violations against CLAUDE.md, security, performance. List issues; don't fix yet.`
- **When the AI is unsure about Next.js APIs:**
  `Stop. Read the docs for the installed Next.js version for <topic> and quote the relevant
  part before writing code.`
- **Refactor pass:**
  `All tests are green. Refactor <file> for readability only — no behaviour change — and
  keep tests passing. Explain each change in one line.`
