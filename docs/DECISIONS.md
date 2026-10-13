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
