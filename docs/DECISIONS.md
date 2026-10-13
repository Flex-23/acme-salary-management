# Design decisions

## 1. Next.js full-stack instead of a separate backend
- **Context:** One persona, one small team, ~10k rows.
- **Decision:** One Next.js app (App Router): pages, route handlers and server code together.
  Business logic lives in framework-agnostic `server/` modules.
- **Consequences:** One deploy and one language. Logic stays portable, so extracting a
  backend later is a move, not a rewrite.

## 2. Supabase Postgres via Drizzle (not supabase-js)
- **Context:** Needs SQL aggregation (`percentile_cont`, `GROUP BY`) and typed, testable data access.
- **Decision:** Use Supabase only as hosted Postgres; access it with Drizzle ORM and postgres.js.
- **Consequences:** Real SQL and migrations in the repo, and PGlite can run the same schema in
  tests. We do not use Supabase auth, storage or REST, so RLS blocks the public API.

## 3. Pooler connection on serverless
- **Context:** Serverless functions open many short-lived connections.
- **Decision:** App uses the Supabase pooler (transaction mode, :6543) with `prepare: false`
  and a small pool; migrations and seed use the direct connection (:5432).
- **Consequences:** Avoids exhausting connections. Session features such as prepared
  statements are unavailable on the app connection.

## 4. Money as integer minor units
- **Context:** Floating point cannot represent currency exactly.
- **Decision:** Store `salary_minor` as bigint; the exponent comes from the country's currency.
- **Consequences:** Exact arithmetic. Formatting and parsing need one well-tested helper.

## 5. Fixed FX table
- **Context:** Cross-country comparison needs a common currency, but live rates make results
  change between runs.
- **Decision:** A `countries.usd_per_unit` column with fixed, dated, illustrative rates.
- **Consequences:** Reproducible reports and no external dependency. Rates are not
  financially accurate and must be updated manually.

## 6. Offset pagination
- **Context:** 10k rows, arbitrary sort and page jumps.
- **Decision:** `page` / `pageSize` with `LIMIT/OFFSET` and a total count.
- **Consequences:** Simple and supports page jumps. Deep offsets slow down as data grows;
  we would move to keyset pagination beyond roughly hundreds of thousands of rows or when
  deep paging becomes common.

## 7. PGlite for integration tests
- **Context:** Repository code must be tested against real Postgres behaviour without Docker or network.
- **Decision:** Run real migrations on in-process PGlite.
- **Consequences:** Fast, deterministic CI. Small differences from Supabase Postgres are
  possible (e.g. extensions), so critical queries are also checked against the real database manually.

## 8. No Redis or queues
- **Context:** 10k rows, one user, aggregates computed in SQL in milliseconds.
- **Decision:** Use Next.js caching with a tag, invalidated on every employee mutation.
- **Consequences:** Less infrastructure to run. Revisit only if measured load requires it.

## 9. Salary and country are updated together
- **Context:** Salary is stored in the country's currency. A patch with only `countryCode`
  would silently reinterpret the stored amount in another currency (JP→US turns ¥5,000,000
  into $50,000.00). A patch with only `salary` needs the country to convert to minor units.
- **Decision:** `EmployeeUpdate` requires `salary` and `countryCode` to be sent both or neither.
- **Consequences:** The domain schema stays pure and a currency change is always an explicit
  re-entry of the amount. Alternative considered: let the service merge the employee's current
  country into a salary-only patch. It is friendlier for API clients but needs a read before
  every update and still cannot handle a country-only change safely. Revisit if clients
  need salary-only patches.

## 10. Invalid query values return 400; out-of-range numbers are clamped
- **Decision:** Malformed values (non-numeric `page`, unknown sort field, unsupported country) are
  rejected with 400; numeric values outside the allowed range (`pageSize` > 100, `page` < 1) are clamped.

## 11. Default list order is name, compared with the "C" collation
- **Context:** The old default (`created_at desc`) was meaningless for seeded data, where many rows
  share `created_at`, and needed a sort on the whole table. Locale-based name sorting also differs
  between PGlite and Supabase (for example, en_US ignores spaces at the first comparison level).
- **Decision:** Default sort is `fullName:asc`, implemented as `lower(full_name) collate "C", id`,
  backed by an expression index on exactly that expression.
- **Consequences:** The first page is served from the index, and ordering is identical in tests and
  production. Names sort by code point, so non-ASCII letters are not locale-aware. The ORDER BY in
  the repository and the index definition must stay in sync.

## 12. Rounding of USD amounts
- **Context:** Per-employee USD values and SQL aggregates are computed in different places.
- **Decision:** Aggregates (min, max, average, median, totals) are computed on exact numerics in SQL
  and rounded once, half away from zero. Per-employee USD amounts are rounded half to even in the domain.
  Sorting uses the unrounded value.
- **Consequences:** Min, max, average and median can differ from the same figure computed from rounded
  per-row values by at most 1 cent. Total payroll is a sum, so it can differ by up to half a cent per
  employee (about 50 USD at 10,000 employees) in the worst case; in practice the errors largely cancel.
  Acceptable for reporting; no figure is used for payments.

## 13. Hire-date rule lives in the domain only
- **Decision:** "Hire date is not in the future" is validated by the zod schema, not a `CHECK`
  constraint, because `CURRENT_DATE` is not immutable and constraints that depend on it break dump/restore.
- **Consequences:** Rows inserted outside the application (SQL console, seed) are not checked by the database.

## 14. Caching: `use cache` + `cacheTag` + `revalidateTag(tag, { expire: 0 })`
- **Context:** `cacheComponents` is enabled. Insight and filter-option reads are expensive relative to
  their change rate, and the HR Manager must see their own edits immediately.
- **Decision:**
  - Reads go through helper functions with `'use cache'`, `cacheLife('minutes')` and `cacheTag('insights')`
    (in `src/app/api/_lib/cache.ts`; the Next-specific code stays out of `server/`). `use cache` cannot sit
    directly in a route handler body, and arguments (the country) become part of the cache key.
  - Mutations call `revalidateTag('insights', { expire: 0 })`. `updateTag` is the read-your-own-writes API
    but is Server-Action-only; `revalidateTag(tag, 'max')` would serve stale totals right after an edit.
    `{ expire: 0 }` makes the next read wait for fresh data.
  - API routes call `connection()` first, so they run at request time. Without it Next prerendered the
    parameterless GET routes at build time, which needs a database during `next build` and bakes data in.
- **Consequences:** Verified against the real database: an insight read is a cache hit (about 5 ms vs about
  150 ms) and a create/delete is visible in the next summary. With the default in-memory cache handler on
  serverless hosting, entries rarely survive between requests and invalidation is per instance, so the
  cache mainly helps on a long-lived server; staleness is bounded by `cacheLife('minutes')` (1 minute).
  `use cache: remote` or a custom handler is the upgrade path if measured load needs it.

## 15. "Today" is a UTC date supplied by a clock
- **Decision:** `Clock.today()` returns the current date in UTC (`YYYY-MM-DD`); the services use it for the
  "hire date is not in the future" rule, and tests inject a fixed clock.
- **Consequences:** Just after local midnight east of UTC, "today" in the user's calendar is still tomorrow
  in UTC (for example, a hire on the current local day in UTC+3 is rejected before 03:00 local time).
  Accepted: it is deterministic and server-timezone independent. A time-zone-aware clock can be added later.

## 16. Route handler error policy
- **Decision:** Every route is wrapped by `apiRoute`: typed errors map to 400/404/409 in the standard error
  shape; anything else becomes a generic 500 (`INTERNAL_ERROR`, fixed message) and the cause is logged
  server-side only. Next.js control-flow errors (such as the prerender bail-out) are re-thrown with
  `unstable_rethrow`; catching them turned a request-time signal into a 500 during the first build.
- **Consequences:** Responses never contain stack traces, SQL or driver messages. Non-UUID ids are treated as
  not found in the service, so every caller is covered. `unstable_rethrow` is marked unstable in Next.js 16.

## 17. Employees page: static shell, streamed data, single write path
- **Context:** `cacheComponents` is on, so reading `searchParams` or the database outside `<Suspense>` blocks
  the route.
- **Decision:** `/employees` is a sync Server Component that renders the static title and wraps an async
  `EmployeesContent` in `<Suspense>` with a table-shaped skeleton (same columns, so nothing jumps). Only that
  child awaits `searchParams`, so it is the only dynamic part: the build reports the route as partially
  prerendered. It calls `EmployeeService` directly (no HTTP hop) and reads filter options through the same
  tagged cache as `/api/meta/filters`. Table state (search, filters, sort, page, page size) lives only in the
  URL; sort, page and filter changes push history entries and search typing replaces them. Mutations are
  `fetch` calls to the existing `/api/employees` routes followed by `router.refresh()`, so there is one write
  path and the cache invalidation stays in one place (no duplicate Server Actions).
- **Consequences:** Every view is shareable and back-button friendly. An out-of-range page redirects to the
  last page; an invalid URL falls back to defaults with a notice. The shared zod schema validates the form in
  the browser, so the client bundle includes zod and the domain money/country modules (small, pure).

## 18. Light theme only (dark theme is future work)
- **Context:** The page background was a translucent colour, so with an OS in dark mode the browser's dark
  canvas showed through and text became unreadable.
- **Decision:** This version is light only. `html` declares `color-scheme: light` (so form controls,
  scrollbars and the canvas stay light) and `html`/`body` use one opaque background (`--page`). The
  muted text colour is darker than shadcn's default so secondary text meets 4.5:1 on that background.
  The generated `.dark` variables are class-based and never activated.
- **Consequences:** The app looks the same whatever the OS preference. Verified with `prefers-color-scheme:
  dark` emulation. A real dark theme needs the `.dark` palette checked for contrast and a user switch.

## 19. Queries are queued in the application, not on a connection
- **Context:** The insights page runs several aggregate queries at once. Through Supabase's transaction
  pooler (port 6543, `prepare: false`) postgres.js hung whenever more queries were issued than the pool had
  connections (6 queries on 5 connections was enough), and under load results could arrive crossed (a
  `RangeError: Minor amount must be an integer` appeared once). Stuck sessions stayed "active" on the
  server for many minutes. Short queries did not trigger it, long aggregate ones did; the session pooler
  (port 5432) did not hang. Measured with a stress script against the real database.
- **Decision:** `src/server/db/limit-concurrency.ts` wraps the client so at most `max` (5) queries are in
  flight and the rest wait in the application, in order. postgres.js therefore never queues a query on a
  connection. We stay on the transaction pooler.
- **Consequences:** 90 concurrent queries (10 simultaneous page loads) complete with identical results.
  Throughput is bounded by the pool size, which is what the pool is for. The wrapper only covers `unsafe`
  (Drizzle's query entry point), not `begin`; the app uses no transactions (the seed uses the session pooler
  directly). If postgres.js or Supavisor fix this, the wrapper can be deleted.

## 20. Insights page: sections, URL state and charts
- **Decision:**
  - Same rendering pattern as `/employees`: a static shell (title, question, FX note) and one `<Suspense>`
    boundary per section with a matching skeleton, so a slow section does not hold up the others. Sections read
    the tagged cached helpers directly (no HTTP hop) and call `connection()` first, so the build never queries
    the database; a create, edit or delete invalidates them, verified through client-side navigation.
  - The countries for "by job title" (`titleCountry`, default US) and "distribution" (`distributionCountry`,
    default all) are separate URL parameters, so each view is shareable and they do not disturb each other.
    Unknown values fall back to the default instead of failing.
  - The distribution has 20,000 USD bands and one open-ended top band from 300,000 USD (`to: null`, labelled
    "$300k+"), so a single outlier cannot produce hundreds of empty bars.
  - Charts are Recharts with one fixed palette (median blue, average amber), animation off, an SVG title and
    description, axis titles, tooltips with exact formatted values and, next to each chart, a table of the exact
    figures (for the histogram, in a collapsible table). Chart scales use whole dollars; every exact amount comes
    from the same formatted DTOs as the tables.
  - Each section's subtitle is the question it answers, and the page states that USD figures use fixed
    reference rates as of 2026-01-01.
- **Consequences:** The charts draw in the browser (ResponsiveContainer measures its parent), so the server HTML
  holds the section frames and skeletons, and the figures stream in. The job-title table can be long (about 90
  titles per country), so it scrolls inside its card with a sticky header.

## 21. A dedicated app role carries the server-side statement timeout
- **Context:** The limiter (ADR 19) frees a slot only when its query returns. A query that never returns would
  hold a slot for good, and five of them would freeze the app. Supabase's poolers ignore connection-level
  settings: `options=-c statement_timeout=...` in the URL and postgres.js's `connection` option were both
  dropped (checked on the transaction and the session pooler). `SET` per connection is meaningless when
  connections are multiplexed, and `SET LOCAL` needs a transaction (three round trips per query, painful at
  about 100 ms from Baghdad). The `postgres` role already has a 2-minute timeout, far too long for the app.
- **Decision:** Migration `0004` creates the role `salary_app` (LOGIN, BYPASSRLS, `statement_timeout = 15s`)
  with only SELECT/INSERT/UPDATE/DELETE on `employees` and SELECT on `countries`. The app connects as that role
  through the transaction pooler (user `salary_app.<project-ref>`). Migrations and the seed keep using
  `postgres` through `DIRECT_URL`, so the 15 s limit never touches them. The role is created without a password
  (a secret does not belong in a migration); the password is set once with `ALTER ROLE`. BYPASSRLS keeps the
  "RLS on every table, no policies" rule intact.
- **Consequences:** A slow query is cancelled by the server (SQLSTATE 57014), its slot is freed, and the API
  answers the standard 500 without leaking the message; the next request works (`npm run check:timeout` against
  the real database, plus a route test). Extra setup step: set the role's password. The app can no longer
  truncate or alter tables. A timeout does not cover a connection that stalls at the protocol level; the
  limiter's no-queue rule is what prevents that case. 15 s is far above the slowest legitimate query (well
  under 1 s); raise it if reports ever need it.

## 22. Demo access protection, not user authentication
- **Context:** The demo is deployed on a public URL and the app can write (create, edit, delete). Anyone who
  finds the link could change the data. Authentication, roles and accounts stay out of scope (CLAUDE.md,
  REQUIREMENTS.md); this is a stop-gap for the demo, not a feature.
- **Decision:** HTTP Basic Auth in front of the whole app, in `src/proxy.ts` (Next.js 16 renamed
  `middleware` to `proxy`; it runs on the Node.js runtime). It is active only when `BASIC_AUTH_USER` and
  `BASIC_AUTH_PASSWORD` are both set, so local development, tests and CI are unaffected. Every page and API
  route is covered except `/api/health` (for uptime monitors) and Next.js's static assets (JavaScript, CSS and
  images, which hold no data). The comparison is constant time (SHA-256 digests compared with
  `timingSafeEqual`, both user and password always checked), failures all give the same 401 with the
  standard error shape, and one variable set without the other is a 503 for every request, so a typo can never
  leave the app open. The logic lives in `src/server/http/basic-auth.ts` (framework-free, unit-tested,
  including a test that pins the timing behaviour); `proxy.ts` only maps the result to Next.js.
- **Consequences:** One shared credential, no accounts, no logout, no per-user audit trail, and no lock-out after
  repeated failures. Basic Auth is only safe over HTTPS (Vercel provides it). The password must be long and
  random, and rotating it means changing the environment variable and redeploying. Real authentication would
  replace this file, not extend it.
- **Status:** kept as an optional, environment-gated feature. The public demo has it switched off (ADR 23).

## 23. The public demo is open on purpose
- **Context:** The demo is deployed at a public URL for reviewers. ADR 22 added a password in front of it, but a
  password makes the project harder to review (a reviewer has to ask for credentials before seeing anything), and
  the data is synthetic.
- **Decision:** The deployed demo runs **without** `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD`, so anyone can open
  it. The Basic Auth code stays, off by default, for any deployment that should be private; setting the two variables
  and redeploying turns it on. Because the site is public and writable, the data is treated as disposable: it is
  synthetic, deterministic and idempotent to restore (`npm run db:seed` truncates and reloads the same 10,000
  employees in one transaction), and the load and smoke tests never depend on state they cannot rebuild.
- **Consequences:** Anyone can create, edit or delete records and can fill the database with rows; there is no rate
  limiting and no per-user audit. What limits the damage: the app role cannot change the schema or truncate tables,
  queries are cancelled after 15 s, list pages are capped at 100 rows, and the free database tier has a size limit.
  A visitor can break the demo's data, not its code or the database. If abuse shows up, switch the password on, or
  reseed. The smoke test detects whether a site is public or protected and skips the 401 checks on a public one.
