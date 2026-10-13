import { describe, expect, it } from "vitest";
import {
  checkSalary,
  ListEmployeesQuery,
  makeEmployeeSchemas,
  MAX_PAGE_SIZE,
} from "@/server/domain/employee";

const { EmployeeInput, EmployeeUpdate } = makeEmployeeSchemas({ today: "2026-06-15" });

const valid = {
  fullName: "Ada Lovelace",
  email: "ada@acme.com",
  jobTitle: "Software Engineer",
  department: "Engineering",
  countryCode: "GB",
  salary: 85000.5,
  hireDate: "2024-03-01",
};

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((i) => i.path.join(".")) ?? [];

describe("EmployeeInput", () => {
  it("accepts a valid employee and converts salary to minor units", () => {
    const parsed = EmployeeInput.parse(valid);
    expect(parsed.salaryMinor).toBe(8500050);
    expect(parsed).not.toHaveProperty("salary");
  });

  it("trims the name and lowercases the email", () => {
    const parsed = EmployeeInput.parse({ ...valid, fullName: "  Ada Lovelace ", email: " ADA@Acme.COM " });
    expect(parsed.fullName).toBe("Ada Lovelace");
    expect(parsed.email).toBe("ada@acme.com");
  });

  it("rejects a name shorter than 2 or longer than 120 characters", () => {
    expect(EmployeeInput.safeParse({ ...valid, fullName: "A" }).success).toBe(false);
    expect(EmployeeInput.safeParse({ ...valid, fullName: "x".repeat(121) }).success).toBe(false);
    expect(EmployeeInput.safeParse({ ...valid, fullName: "x".repeat(120) }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(EmployeeInput.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects an unsupported country", () => {
    const result = EmployeeInput.safeParse({ ...valid, countryCode: "XX" });
    expect(issuePaths(result)).toContain("countryCode");
  });

  it("rejects zero and negative salaries", () => {
    expect(EmployeeInput.safeParse({ ...valid, salary: 0 }).success).toBe(false);
    expect(EmployeeInput.safeParse({ ...valid, salary: -1 }).success).toBe(false);
  });

  it("rejects more decimals than the currency allows", () => {
    expect(issuePaths(EmployeeInput.safeParse({ ...valid, salary: 1.234 }))).toContain("salary");
    const yen = { ...valid, countryCode: "JP", salary: 5000000.5 };
    expect(issuePaths(EmployeeInput.safeParse(yen))).toContain("salary");
  });

  it("accepts a whole-yen salary for a zero-decimal currency", () => {
    const parsed = EmployeeInput.parse({ ...valid, countryCode: "JP", salary: 6500000 });
    expect(parsed.salaryMinor).toBe(6500000);
  });

  it("rejects a salary above the USD-equivalent upper bound", () => {
    const result = EmployeeInput.safeParse({ ...valid, countryCode: "US", salary: 10_000_001 });
    expect(issuePaths(result)).toContain("salary");
    expect(EmployeeInput.safeParse({ ...valid, countryCode: "US", salary: 10_000_000 }).success).toBe(true);
  });

  it("applies the upper bound after currency conversion", () => {
    // 8,000,000 GBP is about 10.2M USD
    expect(EmployeeInput.safeParse({ ...valid, salary: 8_000_000 }).success).toBe(false);
  });

  it("rejects a hire date in the future but accepts today", () => {
    expect(issuePaths(EmployeeInput.safeParse({ ...valid, hireDate: "2026-06-16" }))).toContain("hireDate");
    expect(EmployeeInput.safeParse({ ...valid, hireDate: "2026-06-15" }).success).toBe(true);
  });

  it("rejects malformed and impossible dates", () => {
    expect(EmployeeInput.safeParse({ ...valid, hireDate: "15/06/2024" }).success).toBe(false);
    expect(EmployeeInput.safeParse({ ...valid, hireDate: "2024-02-30" }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(EmployeeInput.safeParse({}).success).toBe(false);
  });
});

describe("checkSalary", () => {
  it("converts a valid amount to minor units", () => {
    expect(checkSalary(72000.5, "DE")).toEqual({ ok: true, minor: 7_200_050 });
    expect(checkSalary(6_500_000, "JP")).toEqual({ ok: true, minor: 6_500_000 });
  });

  it("explains too many decimals for the currency", () => {
    expect(checkSalary(1.5, "JP")).toEqual({ ok: false, message: "Salary must have at most 0 decimal places" });
    expect(checkSalary(1.005, "US")).toEqual({ ok: false, message: "Salary must have at most 2 decimal places" });
  });

  it("explains an amount above the cap", () => {
    expect(checkSalary(10_000_001, "US")).toEqual({ ok: false, message: "Salary exceeds the maximum allowed amount" });
  });
});

describe("EmployeeInput messages", () => {
  const messageFor = (patch: object, field: string) => {
    const result = EmployeeInput.safeParse({ ...valid, ...patch });
    return result.error?.issues.find((i) => i.path.join(".") === field)?.message;
  };

  it("says 'Required' for every missing field", () => {
    const result = EmployeeInput.safeParse({});
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toHaveLength(7);
    expect(new Set(messages)).toEqual(new Set(["Required"]));
  });

  it("explains each rule in plain language", () => {
    expect(messageFor({ fullName: "A" }, "fullName")).toBe("Full name must be 2–120 characters");
    expect(messageFor({ email: "nope" }, "email")).toBe("Enter a valid email address");
    expect(messageFor({ countryCode: "XX" }, "countryCode")).toBe("Select a supported country");
    expect(messageFor({ salary: Number.NaN }, "salary")).toBe("Enter a valid amount");
    expect(messageFor({ salary: 0 }, "salary")).toBe("Salary must be greater than zero");
    expect(messageFor({ hireDate: "15/06/2024" }, "hireDate")).toBe("Enter a valid date (YYYY-MM-DD)");
    expect(messageFor({ hireDate: "2024-02-30" }, "hireDate")).toBe("Enter a valid date (YYYY-MM-DD)");
    expect(messageFor({ hireDate: "2026-06-16" }, "hireDate")).toBe("Hire date cannot be in the future");
  });
});

describe("EmployeeUpdate", () => {
  it("accepts an empty patch", () => {
    expect(EmployeeUpdate.parse({})).toEqual({});
  });

  it("accepts a partial patch without touching other fields", () => {
    expect(EmployeeUpdate.parse({ jobTitle: "Staff Engineer" })).toEqual({ jobTitle: "Staff Engineer" });
  });

  it("still validates the fields that are present", () => {
    expect(EmployeeUpdate.safeParse({ email: "bad" }).success).toBe(false);
    expect(EmployeeUpdate.safeParse({ hireDate: "2030-01-01" }).success).toBe(false);
  });

  it("converts salary to minor units when the country is given", () => {
    expect(EmployeeUpdate.parse({ salary: 100, countryCode: "US" })).toEqual({
      countryCode: "US",
      salaryMinor: 10000,
    });
  });

  it("requires the country when a salary is given", () => {
    const result = EmployeeUpdate.safeParse({ salary: 100 });
    expect(issuePaths(result)).toContain("countryCode");
  });

  it("requires the salary when a country is given, so the currency is never reinterpreted", () => {
    const result = EmployeeUpdate.safeParse({ countryCode: "US" });
    expect(issuePaths(result)).toContain("salary");
  });
});

describe("ListEmployeesQuery", () => {
  it("applies defaults", () => {
    expect(ListEmployeesQuery.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      sort: { field: "fullName", direction: "asc" },
    });
  });

  it("coerces numeric strings from the URL", () => {
    const parsed = ListEmployeesQuery.parse({ page: "3", pageSize: "50" });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(50);
  });

  it("clamps pageSize above the maximum", () => {
    expect(ListEmployeesQuery.parse({ pageSize: "500" }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("clamps page and pageSize below 1", () => {
    const parsed = ListEmployeesQuery.parse({ page: "0", pageSize: "-5" });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(1);
  });

  it("rejects non-numeric paging values", () => {
    expect(ListEmployeesQuery.safeParse({ page: "abc" }).success).toBe(false);
    expect(ListEmployeesQuery.safeParse({ pageSize: "1.5" }).success).toBe(false);
  });

  it("treats empty filters as absent and trims search", () => {
    const parsed = ListEmployeesQuery.parse({ search: "  ada ", country: "", department: "", jobTitle: "" });
    expect(parsed.search).toBe("ada");
    expect(parsed.country).toBeUndefined();
    expect(parsed.department).toBeUndefined();
    expect(parsed.jobTitle).toBeUndefined();
  });

  it("keeps supplied filters", () => {
    const parsed = ListEmployeesQuery.parse({ country: "DE", department: "Sales", jobTitle: "Account Executive" });
    expect(parsed).toMatchObject({ country: "DE", department: "Sales", jobTitle: "Account Executive" });
  });

  it("rejects an unsupported country filter", () => {
    expect(ListEmployeesQuery.safeParse({ country: "XX" }).success).toBe(false);
  });

  it.each(["fullName", "hireDate", "salaryUsd", "createdAt"])("accepts sort field %s", (field) => {
    expect(ListEmployeesQuery.parse({ sort: `${field}:asc` }).sort).toEqual({ field, direction: "asc" });
  });

  it("defaults the sort direction to ascending", () => {
    expect(ListEmployeesQuery.parse({ sort: "fullName" }).sort).toEqual({ field: "fullName", direction: "asc" });
  });

  it("rejects sort fields outside the whitelist", () => {
    expect(ListEmployeesQuery.safeParse({ sort: "password:asc" }).success).toBe(false);
    expect(ListEmployeesQuery.safeParse({ sort: "fullName; DROP TABLE employees:asc" }).success).toBe(false);
  });

  it("rejects an unknown sort direction", () => {
    expect(ListEmployeesQuery.safeParse({ sort: "fullName:sideways" }).success).toBe(false);
  });
});
