import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { employees } from "@/server/db/schema";
import { DuplicateEmailError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { DrizzleEmployeeRepository } from "@/server/repositories/drizzle-employee-repository";
import { DrizzleInsightsRepository } from "@/server/repositories/drizzle-insights-repository";
import { EmployeeService } from "@/server/services/employee-service";
import { InsightsService, optionalCountryParam, requireCountryParam } from "@/server/services/insights-service";
import { FIXTURE_EMPLOYEES } from "../support/fixtures";
import { createTestDb } from "../support/test-db";

// Real SQL on a real (in-process) Postgres: hostile input must end as a clean "expected" outcome
// (a validation error, not found, or a normal result) and never as an unexpected database error,
// because an unexpected error is what the API turns into a 500.
const database = createTestDb();
let service: EmployeeService;
let insights: InsightsService;

beforeAll(async () => {
  const { db } = await database;
  await db.insert(employees).values(FIXTURE_EMPLOYEES);
  service = new EmployeeService(new DrizzleEmployeeRepository(db), { today: () => "2026-06-15" });
  insights = new InsightsService(new DrizzleInsightsRepository(db));
});

afterAll(async () => {
  await (await database).client.close();
});

const isExpected = (error: unknown) =>
  error instanceof ValidationError || error instanceof NotFoundError || error instanceof DuplicateEmailError;

async function settles(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    expect(isExpected(error), `unexpected ${(error as Error).name}: ${(error as Error).message}`).toBe(true);
  }
}

const TEXTS = [
  "",
  " ",
  "%",
  "_",
  "\\",
  "%_\\",
  "'; drop table employees; --",
  '"quoted"',
  "a\u0000b", // NUL byte: Postgres rejects it in text
  "\u0000",
  "😀".repeat(50),
  "x".repeat(10_000),
  "ünïcödé İ ß",
  "\n\t\r",
  "<script>alert(1)</script>",
  "../../etc/passwd",
];

describe("list query with hostile input", () => {
  for (const text of TEXTS) {
    const label = JSON.stringify(text.length > 30 ? `${text.slice(0, 12)}…(${text.length} chars)` : text);
    it(`search=${label}`, () => settles(() => service.list({ search: text })));
    it(`department=${label}`, () => settles(() => service.list({ department: text })));
    it(`jobTitle=${label}`, () => settles(() => service.list({ jobTitle: text })));
    it(`country=${label}`, () => settles(() => service.list({ country: text })));
    it(`sort=${label}`, () => settles(() => service.list({ sort: text })));
  }

  const numbers = ["0", "-1", "-0", "1.5", "1e3", "NaN", "Infinity", "abc", "", " 5 ", "9007199254740993", "99999999999999999999", "1e400", "0x10", "٣"];
  for (const value of numbers) {
    it(`page=${JSON.stringify(value)}`, () => settles(() => service.list({ page: value })));
    it(`pageSize=${JSON.stringify(value)}`, () => settles(() => service.list({ pageSize: value })));
  }

  it("clamps pageSize and still answers for an enormous page number", async () => {
    const result = await service.list({ pageSize: "1000000", page: "9007199254740991" });
    expect(result.page.pageSize).toBe(100);
    expect(result.data).toEqual([]);
  });
});

describe("ids with hostile input", () => {
  for (const id of ["", "x", "1", "'; drop table employees; --", "00000000-0000-0000-0000-000000000000", "a\u0000b", "x".repeat(5_000), "../1"]) {
    const label = JSON.stringify(id.length > 30 ? `${id.slice(0, 12)}…` : id);
    it(`get/update/delete ${label} is "not found", never a database error`, async () => {
      await expect(service.get(id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.update(id, { jobTitle: "x" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.delete(id)).rejects.toBeInstanceOf(NotFoundError);
    });
  }
});

describe("request bodies with hostile input", () => {
  const valid = {
    fullName: "Mia Novak",
    email: "mia@acme.com",
    jobTitle: "Designer",
    department: "Product",
    countryCode: "DE",
    salary: 72000,
    hireDate: "2026-01-12",
  };
  const mutations: Record<string, object> = {
    "NUL byte in the name": { ...valid, fullName: "Mia\u0000Novak" },
    "NUL byte in the email": { ...valid, email: "mia\u0000@acme.com" },
    "NUL byte in the job title": { ...valid, jobTitle: "a\u0000b" },
    "NUL byte in the department": { ...valid, department: "a\u0000b" },
    "huge job title": { ...valid, jobTitle: "x".repeat(100_000) },
    "huge salary": { ...valid, salary: 1e300 },
    "negative zero salary": { ...valid, salary: -0 },
    "salary with many decimals": { ...valid, salary: 0.1 + 0.2 },
    "salary as a string": { ...valid, salary: "72000" },
    "unsupported country": { ...valid, countryCode: "ZZ" },
    "impossible date": { ...valid, hireDate: "2026-02-31" },
    "extra unknown fields": { ...valid, id: "x", isAdmin: true, __proto__: { polluted: true } },
    "nested objects": { ...valid, fullName: { $ne: "" } },
    "arrays": { ...valid, email: ["a@b.co"] },
  };
  for (const [name, body] of Object.entries(mutations)) {
    it(`create: ${name}`, () => settles(() => service.create(body)));
    it(`update: ${name}`, () => settles(() => service.update(FIXTURE_EMPLOYEES[0]!.id, body)));
  }
});

describe("insight parameters with hostile input", () => {
  for (const value of ["", "xx", "US; drop table employees", "us", "U\u0000S", "x".repeat(1_000), "💥"]) {
    const label = JSON.stringify(value.length > 20 ? `${value.slice(0, 10)}…` : value);
    it(`by-job-title country=${label}`, () => settles(async () => insights.byJobTitle(requireCountryParam(value))));
    it(`distribution country=${label}`, () => settles(async () => insights.distribution(optionalCountryParam(value))));
  }
});
