import { describe, expect, it } from "vitest";
import { ListEmployeesQuery } from "@/server/domain/employee";
import { clearFilters, hasActiveFilters, hrefFor, updateParams } from "@/app/employees/_lib/url-state";

const defaults = ListEmployeesQuery.parse({});

describe("hrefFor", () => {
  it("omits everything that equals the default", () => {
    expect(hrefFor("/employees", defaults)).toBe("/employees");
  });

  it("writes only the non-default values", () => {
    const params = { ...defaults, page: 3, pageSize: 50, search: "ann", country: "DE", sort: { field: "salaryUsd", direction: "desc" } } as const;
    expect(hrefFor("/employees", params)).toBe("/employees?search=ann&country=DE&page=3&pageSize=50&sort=salaryUsd%3Adesc");
  });

  it("encodes special characters", () => {
    expect(hrefFor("/employees", { ...defaults, search: "o'brien & co" })).toBe("/employees?search=o%27brien+%26+co");
  });

  it("produces URLs that parse back to the same parameters", () => {
    const params = ListEmployeesQuery.parse({ search: "x y", jobTitle: "Senior Software Engineer", department: "Sales", sort: "hireDate:desc", pageSize: "100", page: "2" });
    const query = Object.fromEntries(new URL(hrefFor("/employees", params), "http://localhost").searchParams);
    expect(ListEmployeesQuery.parse(query)).toEqual(params);
  });
});

describe("updateParams", () => {
  const base = { ...defaults, page: 4, pageSize: 50 };

  it("goes back to page 1 when search, a filter, the page size or the sort changes", () => {
    expect(updateParams(base, { search: "x" }).page).toBe(1);
    expect(updateParams(base, { country: "US" }).page).toBe(1);
    expect(updateParams(base, { department: "Sales" }).page).toBe(1);
    expect(updateParams(base, { jobTitle: "Recruiter" }).page).toBe(1);
    expect(updateParams(base, { pageSize: 100 }).page).toBe(1);
    expect(updateParams(base, { sort: { field: "hireDate", direction: "asc" } }).page).toBe(1);
  });

  it("keeps the other parameters when the page changes", () => {
    expect(updateParams({ ...base, search: "x" }, { page: 5 })).toEqual({ ...base, search: "x", page: 5 });
  });

  it("clears a value with undefined", () => {
    expect(updateParams({ ...base, country: "US" }, { country: undefined }).country).toBeUndefined();
  });
});

describe("filters", () => {
  const filtered = { ...defaults, search: "x", country: "US", department: "Sales", jobTitle: "Recruiter", page: 3, pageSize: 50 };

  it("detects active filters, ignoring paging and sorting", () => {
    expect(hasActiveFilters(defaults)).toBe(false);
    expect(hasActiveFilters({ ...defaults, pageSize: 100, page: 2 })).toBe(false);
    expect(hasActiveFilters({ ...defaults, search: "x" })).toBe(true);
    expect(hasActiveFilters({ ...defaults, jobTitle: "Recruiter" })).toBe(true);
  });

  it("clears search and filters but keeps the page size and sort", () => {
    const sorted = { ...filtered, sort: { field: "hireDate", direction: "desc" } } as const;
    expect(clearFilters(sorted)).toEqual({ ...defaults, pageSize: 50, sort: sorted.sort });
  });
});
