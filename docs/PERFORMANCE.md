# Performance and resilience

Measured on 13 Oct 2026 against the real Supabase database with 10,000 seeded employees.
Reproduce everything with the commands in [How to reproduce](#how-to-reproduce).

## Summary

- **Zero 5xx, zero connection errors, zero timeouts** in the load test, including 50 concurrent connections
  (10x the pool size) and a set of hostile inputs.
- **The database is not the bottleneck.** Every query the app runs executes in 0.1 to 60 ms on the server
  (see [Query plans](#query-plans)). What dominates is the round trip from this machine (Baghdad) to the
  database (Frankfurt): about **116 ms per query** (median).
- **Insight endpoints are cache hits** (2 to 7 ms server time, 600 to 1,150 req/s). Uncached, database-backed
  endpoints are bounded by `pool size / round trip`: 15 to 30 req/s here with the default pool of 5. Both
  the latency and the throughput limit would mostly disappear when the app runs next to the database (see
  [what we did not measure](#known-limits)).
- Found and fixed along the way: a pooler hang under concurrency (ADR 19), a missing server-side timeout
  (ADR 21), a sequential scan on the hire-date sort, and NUL characters that turned into a 500.

## Setup

| | |
|---|---|
| App | Next.js 16.4.0 **production build** (`next build && next start`), React 19.3.0, Node 24.14.1 |
| Load generator | autocannon 8.0.0, same machine as the app (so they compete for CPU) |
| Machine | Intel Core i5-9300H (4 cores / 8 threads), 16 GB RAM, Windows 11 |
| Database | Supabase Postgres 17.11, region eu-central-1 (Frankfurt), free-tier pooler |
| Connection | Transaction pooler (port 6543), `prepare: false`, role `salary_app`, pool of 5 |
| Distance | Baghdad to Frankfurt. `select 1` through the pooler: **p50 116 ms, p95 272 ms, min 91 ms** |
| Data | 10,000 employees in 10 countries (seeded, deterministic), 10 departments, about 90 job titles per country |
| Runs | 10 s per scenario, 10 connections, and 50 connections for the scenarios that exercise the limiter |

The numbers are for a laptop talking to a database on another continent. They show relative behaviour and
the shape of the limits, not what a deployed instance would do (a Vercel function in the same region as the
database has a round trip of a few milliseconds, not 116).

## Results

Latencies are measured per response by the load script (exact percentiles, not autocannon's coarse
histogram). `4xx` are correct answers to bad input and are not failures.

| Scenario | Conns | req/s | p50 ms | p95 ms | p99 ms | 2xx | 4xx | 5xx |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| list: default | 10 | 17 | 579 | 683 | 1,053 | 165 | 0 | 0 |
| list: default | 50 | 16 | 2,916 | 3,063 | 3,479 | 162 | 0 | 0 |
| list: search + filter + sort | 10 | 9 | 799 | 3,449 | 3,716 | 89 | 0 | 0 |
| list: search + filter + sort | 50 | 12 | 3,889 | 4,023 | 4,378 | 120 | 0 | 0 |
| list: deep page | 10 | 9 | 695 | 4,136 | 4,431 | 91 | 0 | 0 |
| get by id | 10 | 26 | 359 | 410 | 908 | 262 | 0 | 0 |
| get by id | 50 | 27 | 1,801 | 1,912 | 1,981 | 270 | 0 | 0 |
| insights: summary (API) | 10 | 861 | 8 | 26 | 48 | 8,613 | 0 | 0 |
| insights: by country (API) | 10 | 957 | 9 | 19 | 31 | 9,574 | 0 | 0 |
| insights: by country (API) | 50 | 1,014 | 48 | 79 | 107 | 10,142 | 0 | 0 |
| insights: by job title (API) | 10 | 522 | 17 | 30 | 39 | 5,215 | 0 | 0 |
| insights: by department (API) | 10 | 1,123 | 8 | 19 | 39 | 11,233 | 0 | 0 |
| insights: distribution (API) | 10 | 1,164 | 7 | 17 | 27 | 11,637 | 0 | 0 |
| meta: filters (API) | 10 | 1,156 | 7 | 15 | 30 | 11,561 | 0 | 0 |
| pages: `/employees` and `/insights` (SSR) | 10 | 15 | 680 | 1,391 | 1,596 | 153 | 0 | 0 |
| mixed browsing session | 10 | 22 | 422 | 1,221 | 1,502 | 222 | 0 | 0 |
| mixed browsing session | 50 | 15 | 2,808 | 3,504 | 3,696 | 151 | 0 | 0 |
| hostile input | 10 | 26 | 5 | 876 | 4,285 | 86 | 170 | 0 |

**Pass criterion: zero 5xx.** Met in every scenario, in this run and in the earlier runs made while tuning.

How to read it:

- **Cached insight endpoints** do not touch the database, so they show the app's own capacity: about 1,000 req/s
  with a p95 under 100 ms even at 50 connections, on a laptop that is also running the load generator.
- **Database-backed endpoints** are limited by round trips. A list request issues two queries (rows and total),
  `get by id` one. With 5 queries in flight and about 120 to 250 ms per query under load, the ceiling is
  roughly 20 to 40 queries per second, which matches 16 to 27 req/s. At 50 connections the extra clients just
  wait in the application's queue: p50 grows (2.9 s) but throughput stays flat and nothing fails.
- **The p95 of "search + filter + sort" and "deep page"** is high (3 to 4 s) while their p50 is not. Those
  scenarios rotate through requests with 50 to 100 rows per page (25 to 60 KB of JSON each) while the
  other requests return 25 rows. The queries themselves take under 30 ms on the server, so the likely
  explanation is the transfer of larger responses over a high-latency link (several extra round trips), but this
  was not isolated.
- **The hostile scenario** sends 22 kinds of bad input (negative and huge pages, SQL-looking text, `%00`,
  a 4,000-character search, malformed ids, unsupported countries). 170 requests were rejected with 4xx and none
  produced a 5xx. Its p99 (4.3 s) comes from the slowest requests in the mix, which are the ones that return
  full pages (not isolated).

### Pool size

`DATABASE_POOL_SIZE` (default 5, maximum 20) sets the pool and the number of queries in flight. Same scenarios,
fresh server each time (a single run per size on a noisy network, so read it as a trend):

| Pool | get by id, 10 / 50 conns | list default, 10 / 50 conns | mixed, 10 / 50 conns |
|---:|---:|---:|---:|
| 5 | 26 / 27 req/s | 17 / 16 req/s | 22 / 15 req/s |
| 10 | 52 / 37 req/s | 29 / 34 req/s | 29 / 28 req/s |
| 15 | 41 / 54 req/s | 33 / 28 req/s | 22 / 27 req/s |

Throughput roughly doubles from 5 to 10, then flattens, with no errors at any size. The default stays at 5 (the
project rule, and enough for one HR user); raise it if you run the app far from the database.

## Query plans

`npm run explain` runs `EXPLAIN (ANALYZE, BUFFERS)` on the exact SQL the repositories send, against the real
database. Server-side execution times (the round trip is on top of these):

| Query | Plan | Execution |
|---|---|---:|
| list: default (name order, page 1) | index scan `employees_full_name_sort_idx`, stops after 25 rows | 0.34 ms |
| list: total count | index-only scan | 2.2 ms |
| list: search by name | bitmap OR of `employees_full_name_trgm_idx` and `employees_email_trgm_idx` | 0.52 ms |
| list: search by email | same trigram indexes | 0.30 ms |
| list: filter country + job title | `employees_country_job_title_idx` | 0.39 ms |
| list: filter department | name-order index scan with a filter on `department` | 0.24 ms |
| list: search + filter + sort by salary | trigram + `employees_country_idx` bitmap AND | 0.37 ms |
| list: sort by hire date (before) | **sequential scan** + top-N sort | 11.6 ms |
| list: sort by hire date (after) | index scan on `employees_hire_date_idx (hire_date, id)` | **0.25 ms** |
| list: sort by USD salary | sequential scan + top-N sort | 27 ms |
| list: deep page (399 of 400) | name-order index scan reading 9,975 rows | 26 ms |
| filter options (3 distinct queries) | index-only scans | 2.5 to 4.4 ms each |
| insights: summary | sequential scan, aggregate | 33 ms |
| insights: by country | `employees_country_idx` + join | 62 ms |
| insights: by job title (US) | `employees_country_job_title_idx` | 19 ms |
| insights: by department | `employees_department_idx` | 60 ms |
| insights: distribution (all / IN) | sequential scan / bitmap scan | 25 ms / 5 ms |

Conclusions:

- **Search uses the trigram indexes** (the `ILIKE '%term%'` that a B-tree cannot serve), as do the filters and the
  default ordering.
- **Fixed:** sorting by hire date scanned the whole table; the new index serves both directions (migration
  `0005`, verified on the real database and in a test).
- **Sequential scans that remain are intentional:** the summary, the distribution and the by-country and
  by-department statistics aggregate every row, so an index cannot help, and they are cached.
- **Sort by USD salary cannot use an index.** It orders by an expression that joins `employees` to
  `countries` (`salary_minor * rate / 10^exponent`). 27 ms on 10,000 rows is fine here; see the 10x section for
  the fix (store the USD value).

## Caching and invalidation

- Insight reads, and the filter options, use `use cache` with `cacheLife('minutes')` and the tag `insights`
  (ADR 14). Every create, update and delete calls `revalidateTag('insights', { expire: 0 })`, so the next read
  waits for fresh data instead of serving stale totals.
- Measured against the real database, right after a write invalidated the tag:

| Endpoint | First read (miss) | Next 20 reads (hit) p50 / p95 |
|---|---:|---:|
| `/api/insights/summary` | 137 ms | 7 ms / 8 ms |
| `/api/insights/by-country` | 175 ms | 2 ms / 4 ms |
| `/api/insights/by-department` | 148 ms | 3 ms / 4 ms |
| `/api/insights/distribution` | 116 ms | 2 ms / 2 ms |

- A miss costs one database round trip plus the query (116 to 175 ms from here); a hit costs about 3 ms.
  The page `/insights` was checked to show a new employee immediately, also through client-side navigation.
- The default cache is in memory. On a serverless host entries rarely outlive a request and invalidation
  is per instance, so the effective benefit there is smaller; staleness is bounded by one minute.

## Resilience: the limiter and the statement timeout

Two failure modes were found and closed. Details are in ADR 19 and ADR 21.

1. **Pooler hang.** postgres.js hung through the Supabase transaction pooler as soon as more long queries
   were issued than there were connections (6 queries on 5 connections was enough), and results could arrive
   crossed. The page's six concurrent aggregates triggered it. `limitConcurrency` keeps at most `pool size`
   queries in flight and queues the rest in the application, so postgres.js never queues. Verified with 90
   concurrent queries (10 simultaneous page loads), identical results, no hang; and by the 50-connection runs above.
2. **A query that never returns holds its slot for ever; five of them would freeze the app.** Supabase's
   poolers ignore connection-level settings (a startup `options` string and postgres.js's `connection` option were
   both dropped), so the app runs as its own role, `salary_app`, with `statement_timeout = 15s` set on the role
   (migration `0004`). Migrations and the seed keep using `postgres` and are unaffected (2 minutes).

`npm run check:timeout` proves it on the real database. Output of the last run:

```
PASS  app role has a 15 s statement_timeout through the transaction pooler  (salary_app: 15s)
PASS  migrations and seed (admin role) are not affected by it  (postgres: 2min)
PASS  the app role cannot truncate the table (least privilege)
PASS  every slow query was cancelled by the server (SQLSTATE 57014), none hung  (6 x 57014)
PASS  all of them finished, including the one that had to wait for a slot  (30.2 s in total)
PASS  slots were freed one wave at a time (about two timeouts, not forty seconds each)  (30.2 s)
PASS  the next normal query succeeds immediately  (126 ms)
```

Six `pg_sleep(40)` queries on a pool of 5: five are cancelled at 15 s, the sixth takes the freed slot and is
cancelled at 30 s; then a normal query answers in 126 ms. At the HTTP level (a production build whose role had a
1 ms timeout), the API answered **500 with `{ "error": { "code": "INTERNAL_ERROR", "message": "Something went
wrong" } }`**, the server log held the cancellation (SQLSTATE 57014) and nothing reached the client, and the
same build with the normal role served the next request with 200. A route test covers the same path.

## Hostile input

`tests/integration/hostile-input.test.ts` sends about 160 hostile inputs through the real services and SQL
(PGlite) and requires every one to end as a validation error, not found, or a normal result. It found a real bug:
**a NUL character (`%00`) in a search, a filter or a name made Postgres fail, which the API turned into a 500.**
They are now rejected with 400. `pageSize` is clamped to 100 (also for huge values), non-UUID ids answer 404, and
the load test sends the same kinds of input to the running server (170 rejections, no 5xx).

## Measured from Vercel (fra1)

_TODO: fill in after the first deployment. Everything above includes about 116 ms of Baghdad to Frankfurt
latency on every query; this section is the same app next to its database._

Run it gently, so a public demo is not hammered (a single connection pair and at most 5 requests per second in
total, 10 s per scenario). The access credentials go through the environment, not the command line history:

```bash
BASIC_AUTH_USER='<user>' BASIC_AUTH_PASSWORD='<password>' \
  npm run loadtest -- --base-url https://<your-app>.vercel.app --connections 2 --rate 5 --duration 10 \
  --json .loadtest/vercel-fra1.json
```

Add `--cache-probe` only if you accept one temporary test employee being created and deleted on the deployed
database. For a one-off round-trip figure from the same machine, run `npm run smoke -- --url <url> --user <u>
--password <p>`: it prints the time of each request.

| Scenario | Conns | req/s | p50 ms | p95 ms | p99 ms | 5xx |
|---|---:|---:|---:|---:|---:|---:|
| _TODO_ | | | | | | |

## Known limits

- **Throughput of uncached, database-backed endpoints is bounded by `pool / round trip`** (15 to 30 req/s here).
  Fine for the intended single HR user (a page needs two to four queries), not for a crowd.
- **Not measured:** the app running next to the database, a Vercel deployment, or a larger plan. The results
  here include 116 ms of intercontinental latency on every query; a same-region deployment would be far
  faster, but that is an expectation, not a measurement.
- **The load generator shares the machine** with the app, which lowers the cached-endpoint numbers.
- **Free-tier pooler.** The limits of its connection pool were not measured; with `salary_app` and 5
  connections nothing was refused.
- **Sorting by USD salary** costs about 27 ms and scales with the table (it sorts all rows).
- **Offset pagination:** the cost of a deep page grows with the page number (26 ms for page 399 of 400).
- **Cached insights can be up to one minute stale** after a change made outside the app (such as a re-seed),
  and the in-memory cache is per process.
- **The statement timeout does not cover a connection that stalls at the protocol level** (no query is
  running); the no-queue rule of the limiter prevents the known cause.
- **One run per scenario, 10 s each, over a long-distance network:** read the numbers as orders of magnitude.

## What we would do at 10x and 100x (not built, on purpose)

At 10,000 rows and one user none of this is needed, and each item adds code, infrastructure and ways to fail.
The measurements above say what would hurt first.

| When this hurts | What we would do | Why not now |
|---|---|---|
| Deep pages get slow (100,000+ rows) | **Keyset pagination** on `(sort key, id)`: "next page after this row" instead of `OFFSET`. Replace the exact total with an estimate. | At 10,000 rows page 399 costs 26 ms. Keyset breaks arbitrary page jumps, which the UI offers. |
| USD salary sort or the aggregates take hundreds of ms | Store `salary_usd_minor` (maintained by a trigger or on write) and index it; for the insights, **materialized views** (or summary tables) refreshed on write or on a schedule. | Today the sort is 27 ms and the aggregates 20 to 60 ms, cached. A stored derived value can drift from the fixed rates and adds a write path to maintain. |
| Several app instances, or the cache must survive deploys | A **remote cache** (`use cache: remote` or a shared handler such as Redis) so entries and invalidation are shared across instances. | The in-memory cache is enough for one process, and the project rule is no extra infrastructure until measured load needs it. |
| Reads from many users compete with writes | A **read replica** for the insights and lists (the writes stay on the primary), with the cache hiding the replication lag. | One user does not need it, and replicas add lag and cost. |
| The round trip dominates | Run the app **in the database's region** (Vercel `fra1` for eu-central-1); batch the list's two queries into one (rows with a window-function total); raise `DATABASE_POOL_SIZE`. | The first is a deployment setting. Merging the queries makes the default sort scan every matching row to count them, so it is only worth it once latency, not row count, is the problem. |
| Heavy concurrent traffic | A connection-count budget per instance (`DATABASE_POOL_SIZE` times instances against the pooler's limit), and rate limiting at the edge. | Needs real traffic to size; premature numbers would be guesses. |
| 100x: tens of millions of rows | Partition `employees` (for example by country), move reporting to a warehouse or columnar store, search in a dedicated engine. | Far outside this product's scope (10,000 employees). |

## How to reproduce

```bash
# 1. a production build, connected to the database
npm run build && npm start               # http://localhost:3000

# 2. in another terminal
npm run loadtest                         # all scenarios, 10 s each
npm run loadtest -- --only "list" --duration 20
npm run loadtest -- --cache-probe --json .loadtest/results.json
BASE_URL=https://your-preview-url npm run loadtest      # a deployed preview, never production

npm run explain                          # query plans on the real database
npm run check:timeout                    # statement timeout and limiter, about 40 s
```

The load test writes one row (the cache probe) and removes it again; run it against a database you can afford
to write to, and never against production data. It exits non-zero on any 5xx, connection error or timeout.
