import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { COUNTRIES } from "@/server/domain/countries";
import { countries, employees } from "@/server/db/schema";
import { createTestDb } from "../support/test-db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

const validEmployee = {
  fullName: "Ada Lovelace",
  email: "ada@acme.com",
  jobTitle: "Engineer",
  department: "Engineering",
  countryCode: "GB",
  salaryMinor: 8_500_000,
  hireDate: "2024-03-01",
};

describe("migrations", () => {
  it("seed the countries table with the domain configuration", async () => {
    const rows = await ctx.db.select().from(countries).orderBy(countries.code);
    const expected = COUNTRIES.map((c) => ({
      code: c.code,
      name: c.name,
      currency: c.currency,
      currencyExponent: c.currencyExponent,
      usdPerUnit: Number(c.usdPerUnit),
    })).sort((a, b) => a.code.localeCompare(b.code));
    expect(rows.map((r) => ({ ...r, usdPerUnit: Number(r.usdPerUnit) }))).toEqual(expected);
  });

  it("enable row level security on every table, with no policies", async () => {
    const tables = await ctx.client.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' order by c.relname`,
    );
    expect(tables.rows).toEqual([
      { relname: "countries", relrowsecurity: true },
      { relname: "employees", relrowsecurity: true },
    ]);
    const policies = await ctx.client.query(`select 1 from pg_policies`);
    expect(policies.rows).toHaveLength(0);
  });

  it("create the trigram indexes on name and email", async () => {
    const indexes = await ctx.client.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes where tablename = 'employees'`,
    );
    const trigram = indexes.rows.filter((i) => i.indexdef.includes("gin_trgm_ops"));
    expect(trigram.map((i) => i.indexname).sort()).toEqual([
      "employees_email_trgm_idx",
      "employees_full_name_trgm_idx",
    ]);
  });

  it("reject a zero salary", async () => {
    await expect(
      ctx.db.insert(employees).values({ ...validEmployee, salaryMinor: 0 }),
    ).rejects.toThrow();
  });

  it("reject an email that is not lowercase", async () => {
    await expect(
      ctx.db.insert(employees).values({ ...validEmployee, email: "Ada@acme.com" }),
    ).rejects.toThrow();
  });

  it("reject an unknown country", async () => {
    await expect(
      ctx.db.insert(employees).values({ ...validEmployee, countryCode: "ZZ" }),
    ).rejects.toThrow();
  });

  it("reject a duplicate email", async () => {
    await ctx.db.insert(employees).values(validEmployee);
    await expect(ctx.db.insert(employees).values(validEmployee)).rejects.toThrow();
    await ctx.db.execute(sql`delete from employees`);
  });
});
