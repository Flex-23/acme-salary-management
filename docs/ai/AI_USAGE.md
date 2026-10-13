# AI usage log

How AI tools were used to build this project, and where human judgment overrode them.
Prompts are in `docs/ai/PROMPTS.md`; standing rules are in `/CLAUDE.md`.

## Tools and roles

| Tool | Role |
|---|---|
| **Claude (chat)** | Requirement analysis, architecture discussion, writing `CLAUDE.md` and the phased prompts, and an independent review of each phase's code |
| **Claude Code (agent)** | Implementation, tests and commits, one phase at a time |

I deliberately split the roles: one AI writes the code and a separate AI session reviews it
against the rules. The reviewer doesn't share the implementer's context, so it catches
things the implementer rationalised. I verify every finding myself before acting on it.

## Workflow

1. Read the brief, list the ambiguities, and send clarifying questions to the hiring team.
   Where an answer was still pending, I wrote the assumption down in `REQUIREMENTS.md`
   instead of guessing silently.
2. Settle the architecture and the trade-offs in conversation before writing any code.
3. Encode the decisions once in `CLAUDE.md`: stack, layering, data model, API contract,
   TDD and commit rules.
4. Run one phase at a time. The agent stops at the end of each phase; I review the diff
   and get an independent review, then approve or redirect.
5. When a mistake reveals a missing rule, add the rule to `CLAUDE.md` so it doesn't happen again.

---

## Phase 0 — Boilerplate cleanup and tooling
- **Asked for:** Remove the create-next-app demo, use strict TypeScript, set up Vitest, standard scripts, `.env.example`.
- **AI did well:** First reported the installed versions (Next.js 16.4, React 19.3), as
  instructed, before changing anything. Kept the generated `AGENTS.md`, which tells agents
  to read the Next.js docs bundled with the installed version instead of relying on training data.
- **AI got wrong / I changed:** It installed `prettier` by mistake and then removed it,
  since it wasn't in the agreed stack.
- **Lesson:** The "no dependencies beyond the agreed stack without asking" rule is worth having.

## Phase 1 — Requirements and design decisions
- **Asked for:** A one-page `REQUIREMENTS.md` and ADR-style `DECISIONS.md`, written before any feature code.
- **AI did well:** A clear scope, with a reason for every out-of-scope item.
- **I changed:** The doc said "sort by any listed column", but only four fields were
  sortable. I aligned the wording with the implementation.

## Phase 2 — Domain layer (TDD)
- **Asked for:** Money/currency handling, zod schemas and pure statistics functions, test first.
- **AI did well:** Exact money handling (BigInt, round half-to-even, JPY with zero decimals);
  "today" injected so date tests are deterministic; a whitelisted sort, including a SQL-injection test case.
- **AI got wrong / I changed:**
  - **Hidden test failure.** One commit went in with 3 failing tests. The agent had piped
    the test command through `grep`, which hid the non-zero exit code. It amended the
    (unpushed) commit.
    → New rule in `CLAUDE.md`: run `npm test` directly and check the exit code before committing.
  - **Data-integrity bug I caught in review.** `EmployeeUpdate` let you change `countryCode`
    without `salary`. The stored `salary_minor` would then be read in a different currency:
    moving someone from JP to US silently turns ¥5,000,000 into $50,000.00. The rule is now
    "salary and countryCode are updated together, or not at all", with a test written first.
    The alternative (the service merges in the current country) is recorded as a trade-off.
- **Rejected suggestion:** The idea to commit failing tests separately to "show" TDD. That
  would break the green-commit rule and `git bisect`. Every commit stays green; the
  red→green cycle happened locally.
- **Decisions I approved:** ES2022 target (needed for BigInt); a 10M USD salary cap as a
  guard against data-entry errors; empty stats return `null` (an empty group isn't an
  error); invalid params return 400, while numeric values out of range are clamped.

## Phase 3 — Database, client and repositories
- **Asked for:** Drizzle schema and migrations, RLS, pg_trgm search, a pooled client,
  repositories, and integration tests on PGlite.
- **AI did well:**
  - **Contract tests.** The real Drizzle repositories (on PGlite) and the in-memory fakes
    run the same behaviour suite, which proves the fakes used in service tests are faithful.
  - Migration tests check RLS with no policies, and use `EXPLAIN` to prove that search hits the trigram indexes.
  - **A bug its own tests missed.** The agent wrote the LIKE-escaping function through a shell
    command, and shell quoting mangled the regex. The first tests passed by coincidence.
    It added a literal case (`Pat 50% Off`), watched it fail, and fixed the function.
    → New rule: write source files with the editor tools, never via shell `echo`/heredoc.
  - Every list query uses `id` as a final sort key, with a test that paging has no gaps or overlaps.
- **Review findings (fixed before Phase 4):**
  - `drizzle-kit` and the scripts don't load `.env.local`, and the config fell back to
    `""` silently. Env loading is now shared via `@next/env`, and a missing variable fails loudly.
  - Supabase direct connections are IPv6-only on the free plan, and my network is IPv4.
    Migrations and the seed now use the Session pooler.
  - Seeded rows share `created_at`, so the default "newest first" order would look random
    to the HR manager. The default sort is now name A→Z, backed by an index.
  - Connection timeouts added, so a slow database fails fast instead of hanging requests.
  - Sorting by name depended on the database collation, which can differ between PGlite and
    Supabase. I suggested `lower(full_name)`; the agent pointed out that `lower()` alone is
    still locale-dependent (en_US ignores spaces at the first comparison level) and used
    `lower(full_name) collate "C"`, with an expression index on exactly that expression and an
    `EXPLAIN` test proving the index is used. That was better than my suggestion, so I accepted it.
- **SQL decisions I reviewed and accepted:** aggregates are computed on exact values and
  rounded once at the end. Per-row USD values are rounded half-to-even, so an aggregate can
  differ by a cent from summing the rounded rows; this is documented in `DECISIONS.md`. The
  median uses `double precision`, which is exact up to 2^53 cents (about $90 trillion). The
  "hire date not in the future" rule stays in the domain, because a `CHECK` with
  `CURRENT_DATE` isn't immutable.

## Phase 4 — Seed script (10,000 employees)
- **Asked for:** A deterministic, realistic, idempotent and fast seed, with generation kept separate from writing.
- **AI did well:**
  - A pure generator (no DB, no clock). The same seed always gives identical data, and the
    sequence is prefix-stable, so `--count=50` returns the first 50 of the full 10,000.
  - Realistic data: a department → role → level catalogue, per-country cost factors, and
    salaries rounded to whole currency steps (100 units, or ¥10,000), so they look like real offers.
  - Deterministic uuids, and a `created_at` derived from the hire date, with distinct
    timestamps for same-day hires.
  - Every generated record is validated against the same `EmployeeInput` schema the API uses.
  - The writer runs in one transaction. A test injects a duplicate email in a later batch and
    proves the previous data survives (rollback). The largest batch size is derived from
    Postgres's 65,535-parameter limit, not hard-coded.
  - A production guard: it refuses `NODE_ENV=production` unless `--force` is passed.
- **Verified on real Supabase:** migrations applied, 10,000 employees seeded, RLS enabled on both tables.

## Phase 5 — Services and API
- **Asked for:** Services with typed errors, a consistent error shape, thin route handlers,
  cache invalidation on mutations, and a health check.
- **AI did well:**
  - Before touching caching, it read the Next.js 16 docs bundled in `node_modules` (as `AGENTS.md`
    requires) and explained its choice. `updateTag` only works in Server Actions, so route handlers
    use `revalidateTag(tag, { expire: 0 })`; otherwise the HR manager would see stale totals right
    after an edit (ADR 14).
  - **A bug it found in its own work:** its error wrapper caught Next.js's internal control-flow
    errors and turned them into 500s during the first production build. It fixed this with
    `unstable_rethrow`, and added `connection()` so the API never queries the database at build time.
  - Measured against the real database: a cached insight read takes ~5 ms vs ~150 ms uncached,
    and a create or delete shows up in the very next summary.
  - It was honest about a limit: on serverless hosting, the default cache lives in memory per
    instance, so invalidation is per instance and staleness is bounded by `cacheLife` (1 minute).
    Documented, with the upgrade path.
  - Non-UUID ids are treated as "not found" inside the service, so every caller is protected.
    Route tests run against the in-memory fakes, so there's no database in unit tests.
- **Decisions I made:**
  - "Today" is a UTC date (ADR 15). The UTC+3 edge case is documented rather than handled.
  - The API is public and writable once deployed. → See the Phase 9 decision on access protection.

## Phase 6 — Employees UI
- **Asked for:** A server-rendered table with server-side search, filters, sort and paging kept in the URL,
  plus create, edit and delete dialogs that reuse the shared schema.
- **AI did well:**
  - Before building it read the Next.js 16 docs on `cacheComponents`. The result is a static shell plus
    one `<Suspense>`-wrapped async component that reads `searchParams` and calls the service directly,
    with a skeleton shaped like the table so nothing jumps (ADR 17).
  - One write path: every dialog calls the existing `/api` routes, which already invalidate the cache,
    then `router.refresh()`. No duplicate Server Actions.
  - The form validates with the **same zod schema as the API**, and maps 400 details and 409 duplicate
    email back onto individual fields. It always sends salary and country together (ADR 9), and warns
    that changing the country means re-entering the salary in the new currency, with no silent conversion.
  - Thoughtful UX: an invalid or old URL falls back to the defaults with a notice instead of crashing;
    deleting the last row of the last page redirects to the real last page; typing in the search box
    replaces the history entry while sort, filter and page changes push one, so Back behaves as expected;
    a 404 on delete counts as "already gone".
  - It used the new shadcn `cn` package. I checked it on npm before accepting: it's published by shadcn
    and replaces clsx + tailwind-merge.
- **Found in review (in the browser):**
  - On an OS set to dark mode, the page body (light gray at 40% opacity) sat over the browser's dark
    canvas, so the header area turned dark gray and the subtitle and search placeholder were unreadable.
  - At a 1024 px width the table is wider than the screen (the "Hired" column is cut off).
