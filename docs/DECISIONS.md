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
