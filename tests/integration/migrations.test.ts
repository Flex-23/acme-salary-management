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

  it("let name and email substring searches use the trigram indexes", async () => {
    await ctx.client.exec("set enable_seqscan = off");
    const plan = async (column: string) => {
      const result = await ctx.client.query<{ "QUERY PLAN": string }>(
        `explain select 1 from employees where ${column} ilike '%ada%'`,
      );
      return result.rows.map((r) => r["QUERY PLAN"]).join(" ");
    };
    expect(await plan("full_name")).toContain("employees_full_name_trgm_idx");
    expect(await plan("email")).toContain("employees_email_trgm_idx");
    await ctx.client.exec("reset enable_seqscan");
  });

  it("serve the default name ordering from an index on (lower(full_name), id)", async () => {
    await ctx.client.exec("set enable_seqscan = off");
    const result = await ctx.client.query<{ "QUERY PLAN": string }>(
      `explain select id from employees order by lower(full_name) collate "C", id limit 25`,
    );
    await ctx.client.exec("reset enable_seqscan");
    const plan = result.rows.map((r) => r["QUERY PLAN"]).join(" ");
    expect(plan).toContain("employees_full_name_sort_idx");
    expect(plan).not.toContain("Sort");
  });

  it("serve the hire-date sort (both directions) from an index instead of scanning the table", async () => {
    await ctx.client.exec("set enable_seqscan = off");
    const plan = async (direction: "asc" | "desc") => {
      const result = await ctx.client.query<{ "QUERY PLAN": string }>(
        `explain select id from employees order by hire_date ${direction}, id asc limit 25`,
      );
      return result.rows.map((r) => r["QUERY PLAN"]).join(" ");
    };
    expect(await plan("asc")).toContain("employees_hire_date_idx");
    expect(await plan("desc")).toContain("employees_hire_date_idx");
    await ctx.client.exec("reset enable_seqscan");
  });

  it("create a least-privilege app role with a statement timeout", async () => {
    const role = await ctx.client.query<{ rolcanlogin: boolean; rolbypassrls: boolean; rolsuper: boolean; rolconfig: string[] }>(
      `select rolcanlogin, rolbypassrls, rolsuper, rolconfig from pg_roles where rolname = 'salary_app'`,
    );
    expect(role.rows).toEqual([
      { rolcanlogin: true, rolbypassrls: true, rolsuper: false, rolconfig: ["statement_timeout=15s"] },
    ]);
  });

  it("let the app role read and write employees but not change the schema or empty the table", async () => {
    const can = async (privilege: string, table: string) => {
      const result = await ctx.client.query<{ allowed: boolean }>(
        `select has_table_privilege('salary_app', '${table}', '${privilege}') as allowed`,
      );
      return result.rows[0]?.allowed;
    };
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) expect(await can(privilege, "employees")).toBe(true);
    expect(await can("TRUNCATE", "employees")).toBe(false);
    expect(await can("SELECT", "countries")).toBe(true);
    expect(await can("INSERT", "countries")).toBe(false);
    expect(await can("UPDATE", "countries")).toBe(false);
    const schema = await ctx.client.query<{ allowed: boolean }>(`select has_schema_privilege('salary_app', 'public', 'CREATE') as allowed`);
    expect(schema.rows[0]?.allowed).toBe(false);
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
