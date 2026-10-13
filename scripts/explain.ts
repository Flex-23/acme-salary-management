/**
 * EXPLAIN (ANALYZE, BUFFERS) for the app's real queries against the real database.
 *
 *   npm run explain                 # plans as the app runs them
 *   npm run explain -- --no-seqscan # also try to force indexes, to see whether an index could be used
 *
 * The SQL is captured from the repositories (through Drizzle's logger), so these are the exact statements
 * the app sends, with the same parameters. Runs on the session pooler (DIRECT_URL) as a read-only session.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "../src/server/db/env";
import * as schema from "../src/server/db/schema";
import { ListEmployeesQuery } from "../src/server/domain/employee";
import { DrizzleEmployeeRepository } from "../src/server/repositories/drizzle-employee-repository";
import { DrizzleInsightsRepository } from "../src/server/repositories/drizzle-insights-repository";

type Captured = { query: string; params: unknown[] };

async function main() {
  const client = postgres(requireEnv("DIRECT_URL"), { max: 1, prepare: false, connect_timeout: 15 });
  const captured: Captured[] = [];
  const db = drizzle(client, { schema, logger: { logQuery: (query, params) => void captured.push({ query, params }) } });
  const employees = new DrizzleEmployeeRepository(db);
  const insights = new DrizzleInsightsRepository(db);
  const list = (params: Record<string, string>) => employees.list(ListEmployeesQuery.parse(params));

  const cases: { name: string; run: () => Promise<unknown> }[] = [
    { name: "list: default (name order, page 1)", run: () => list({}) },
    { name: "list: search by name (trigram)", run: () => list({ search: "smith" }) },
    { name: "list: search by email (trigram)", run: () => list({ search: "abagail.ebert" }) },
    { name: "list: filter country + job title", run: () => list({ country: "US", jobTitle: "Senior Software Engineer" }) },
    { name: "list: filter department", run: () => list({ department: "Engineering" }) },
    { name: "list: sort by USD salary", run: () => list({ sort: "salaryUsd:desc" }) },
    { name: "list: sort by hire date", run: () => list({ sort: "hireDate:desc" }) },
    { name: "list: deep page (399)", run: () => list({ page: "399" }) },
    { name: "list: search + filter + salary sort", run: () => list({ search: "smith", country: "US", sort: "salaryUsd:desc", pageSize: "50" }) },
    { name: "filter options (distinct values)", run: () => employees.filterOptions() },
    { name: "insights: summary", run: () => insights.summary() },
    { name: "insights: by country", run: () => insights.byCountry() },
    { name: "insights: by job title (US)", run: () => insights.byJobTitle("US") },
    { name: "insights: by department", run: () => insights.byDepartment() },
    { name: "insights: distribution (all)", run: () => insights.distribution() },
    { name: "insights: distribution (IN)", run: () => insights.distribution("IN") },
  ];

  const noSeqscan = process.argv.includes("--no-seqscan");
  await client`set default_transaction_read_only = on`;
  if (noSeqscan) await client`set enable_seqscan = off`;

  for (const { name, run } of cases) {
    captured.length = 0;
    await run();
    console.log(`\n=== ${name}`);
    for (const { query, params } of [...captured]) {
      const rows = await client.unsafe(`explain (analyze, buffers, costs off, timing on) ${query}`, params as never[]);
      const lines = rows.map((row) => String(row["QUERY PLAN"]));
      const kind = /^select count\(\*\)/.test(query) ? "count" : query.startsWith("select") ? "rows" : "query";
      console.log(`--- ${kind}`);
      console.log(lines.join("\n"));
    }
  }
  await client.end({ timeout: 2 });
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
