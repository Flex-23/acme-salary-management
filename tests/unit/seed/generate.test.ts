import { describe, expect, it } from "vitest";
import { COUNTRIES, getCountry } from "@/server/domain/countries";
import { makeEmployeeSchemas } from "@/server/domain/employee";
import { fromMinor, toUsdMinor } from "@/server/domain/money";
import { generateEmployees, SEED_REFERENCE_DATE } from "@/server/db/seed/generate";

const { EmployeeInput } = makeEmployeeSchemas({ today: SEED_REFERENCE_DATE });
const employees = generateEmployees({ count: 10_000, seed: 1 });

const usd = (e: (typeof employees)[number]) => toUsdMinor(e.salaryMinor, getCountry(e.countryCode)) / 100;
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

describe("generateEmployees", () => {
  it("generates the requested number of employees", () => {
    expect(generateEmployees({ count: 50, seed: 1 })).toHaveLength(50);
    expect(generateEmployees({ count: 0, seed: 1 })).toEqual([]);
  });

  it("defaults to 10,000 employees", () => {
    expect(generateEmployees({})).toHaveLength(10_000);
  });

  it("is identical for the same seed and different for another seed", () => {
    const first = generateEmployees({ count: 200, seed: 7 });
    expect(generateEmployees({ count: 200, seed: 7 })).toEqual(first);
    expect(generateEmployees({ count: 200, seed: 8 })).not.toEqual(first);
  });

  it("produces a prefix-stable sequence when the count grows", () => {
    const small = generateEmployees({ count: 50, seed: 1 });
    expect(employees.slice(0, 50)).toEqual(small);
  });

  it("produces records that all pass the EmployeeInput schema", () => {
    for (const e of employees) {
      const result = EmployeeInput.safeParse({
        fullName: e.fullName,
        email: e.email,
        jobTitle: e.jobTitle,
        department: e.department,
        countryCode: e.countryCode,
        salary: fromMinor(e.salaryMinor, getCountry(e.countryCode).currencyExponent),
        hireDate: e.hireDate,
      });
      expect(result.success, `${e.email}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it("gives every employee a unique, lowercase email and a unique id", () => {
    expect(new Set(employees.map((e) => e.email)).size).toBe(employees.length);
    expect(new Set(employees.map((e) => e.id)).size).toBe(employees.length);
    for (const e of employees) expect(e.email).toBe(e.email.toLowerCase());
  });

  it("derives emails from names", () => {
    const [first] = employees;
    const [given] = first!.fullName.toLowerCase().split(" ");
    expect(first!.email.startsWith(given!.replace(/[^a-z0-9]/g, ""))).toBe(true);
    expect(first!.email.endsWith("@acme.com")).toBe(true);
  });

  it("uses uuid ids", () => {
    for (const e of employees.slice(0, 100)) {
      expect(e.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it("hires over roughly the last twelve years and never after the reference date", () => {
    const dates = employees.map((e) => e.hireDate).sort();
    expect(dates[dates.length - 1]! <= SEED_REFERENCE_DATE).toBe(true);
    expect(dates[0]! >= "2014-10-01").toBe(true);
    expect(dates[0]! < "2015-12-31").toBe(true);
  });

  it("derives distinct created_at values from the hire date", () => {
    expect(new Set(employees.map((e) => e.createdAt.getTime())).size).toBe(employees.length);
    for (const e of employees) {
      expect(dayOf(e.createdAt)).toBe(e.hireDate);
      expect(e.updatedAt).toEqual(e.createdAt);
    }
  });

  it("covers every supported country and several departments", () => {
    expect(new Set(employees.map((e) => e.countryCode))).toEqual(new Set(COUNTRIES.map((c) => c.code)));
    expect(new Set(employees.map((e) => e.department)).size).toBeGreaterThanOrEqual(8);
  });

  it("uses job titles with levels", () => {
    const titles = new Set(employees.map((e) => e.jobTitle));
    expect(titles.has("Software Engineer")).toBe(true);
    expect(titles.has("Senior Software Engineer")).toBe(true);
    expect(titles.has("Junior Software Engineer")).toBe(true);
  });

  it("pays seniors more than juniors and the US more than India, in USD terms", () => {
    const average = (rows: typeof employees) => rows.reduce((sum, e) => sum + usd(e), 0) / rows.length;
    const engineers = employees.filter((e) => e.jobTitle.endsWith("Software Engineer"));
    const senior = engineers.filter((e) => e.jobTitle.startsWith("Senior"));
    const junior = engineers.filter((e) => e.jobTitle.startsWith("Junior"));
    expect(average(senior)).toBeGreaterThan(average(junior));

    const usEngineers = engineers.filter((e) => e.countryCode === "US");
    const inEngineers = engineers.filter((e) => e.countryCode === "IN");
    expect(average(usEngineers)).toBeGreaterThan(average(inEngineers) * 2);
  });

  it("keeps salaries realistic: whole currency steps and plausible USD range", () => {
    for (const e of employees) {
      expect(usd(e)).toBeGreaterThan(5_000);
      expect(usd(e)).toBeLessThan(600_000);
      const { currencyExponent } = getCountry(e.countryCode);
      expect(e.salaryMinor % 10 ** currencyExponent).toBe(0);
    }
  });
});
