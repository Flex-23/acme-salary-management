import { beforeEach, describe, expect, it } from "vitest";
import { ListEmployeesQuery, type ListEmployeesQueryData } from "@/server/domain/employee";
import { getCountry } from "@/server/domain/countries";
import { DuplicateEmailError } from "@/server/domain/errors";
import { toUsdMinor } from "@/server/domain/money";
import type { Employee } from "@/server/domain/types";
import type { EmployeeRepository } from "@/server/repositories/employee-repository";
import { FIXTURE_EMPLOYEES, fixtureId } from "./fixtures";

export type EmployeeRepositoryFactory = (seed: Employee[]) => Promise<EmployeeRepository>;

const query = (params: Record<string, string> = {}): ListEmployeesQueryData =>
  ListEmployeesQuery.parse(params);

const usd = (e: Employee) => toUsdMinor(e.salaryMinor, getCountry(e.countryCode));
const byId = (a: Employee, b: Employee) => a.id.localeCompare(b.id);
const ids = (employees: Employee[]) => employees.map((e) => e.id);

/** Behaviour every EmployeeRepository implementation (real or fake) must satisfy. */
export function describeEmployeeRepository(name: string, createRepository: EmployeeRepositoryFactory) {
  describe(`${name} (EmployeeRepository contract)`, () => {
    let repo: EmployeeRepository;

    beforeEach(async () => {
      repo = await createRepository(FIXTURE_EMPLOYEES);
    });

    const listIds = async (params: Record<string, string> = {}) =>
      (await repo.list(query({ pageSize: "100", ...params }))).rows.map((r) => r.id);

    describe("list", () => {
      it("returns the total and, by default, orders by name", async () => {
        const result = await repo.list(query({ pageSize: "100" }));
        const byName = [...FIXTURE_EMPLOYEES].sort((a, b) => a.fullName.localeCompare(b.fullName));
        expect(result.total).toBe(12);
        expect(result.rows.map((r) => r.id)).toEqual(ids(byName));
      });

      it("orders by created date with id as tiebreaker when rows share a timestamp", async () => {
        const newestFirst = [...FIXTURE_EMPLOYEES].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || byId(a, b),
        );
        expect(await listIds({ sort: "createdAt:desc" })).toEqual(ids(newestFirst));
      });

      it("includes currency and the USD-normalised salary", async () => {
        const { rows } = await repo.list(query({ search: "tanaka" }));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ currency: "JPY", salaryMinor: 7_000_000, salaryUsdMinor: 4_690_000 });
      });

      it("pages without gaps or overlaps even when sort values tie", async () => {
        const seen: string[] = [];
        for (const page of ["1", "2", "3"]) seen.push(...(await listIds({ page, pageSize: "5" })));
        expect(seen).toHaveLength(12);
        expect(new Set(seen).size).toBe(12);
      });

      it("returns the remaining rows on the last page and none beyond it", async () => {
        expect(await listIds({ page: "3", pageSize: "5" })).toHaveLength(2);
        const beyond = await repo.list(query({ page: "9", pageSize: "5" }));
        expect(beyond.rows).toEqual([]);
        expect(beyond.total).toBe(12);
      });

      it("searches names case-insensitively by substring", async () => {
        expect(await listIds({ search: "ALI" })).toEqual([fixtureId(1)]);
      });

      it("searches emails by substring", async () => {
        expect(await listIds({ search: "acme.jp", sort: "fullName:asc" })).toEqual([fixtureId(8), fixtureId(9)]);
      });

      it("treats LIKE wildcards in the search term literally", async () => {
        expect(await listIds({ search: "%" })).toEqual([]);
        expect(await listIds({ search: "_" })).toEqual([]);
      });

      it("finds names containing wildcard characters when searched literally", async () => {
        const created = await repo.create({
          fullName: "Pat 50% Off",
          email: "pat@acme.com",
          jobTitle: "Analyst",
          department: "Finance",
          countryCode: "US",
          salaryMinor: 5_000_000,
          hireDate: "2025-01-06",
        });
        expect(await listIds({ search: "50%" })).toEqual([created.id]);
        expect(await listIds({ search: "5%f" })).toEqual([]);
        expect(await listIds({ search: "Pat_50" })).toEqual([]);
      });

      it("filters by country, department and job title", async () => {
        expect(await listIds({ country: "JP", sort: "fullName:asc" })).toEqual([fixtureId(8), fixtureId(9)]);
        expect(await listIds({ department: "Product", sort: "fullName:asc" })).toEqual([fixtureId(3), fixtureId(10)]);
        expect(await listIds({ jobTitle: "Sales Rep", sort: "fullName:asc" })).toEqual([
          fixtureId(6),
          fixtureId(9),
          fixtureId(11),
        ]);
      });

      it("combines search with filters", async () => {
        expect(await listIds({ search: "acme.com", country: "US", jobTitle: "Product Manager" })).toEqual([
          fixtureId(3),
        ]);
        expect(await listIds({ search: "acme.com", country: "DE" })).toEqual([]);
      });

      it("reports the filtered total, not the page size", async () => {
        const result = await repo.list(query({ country: "US", pageSize: "2" }));
        expect(result.total).toBe(4);
        expect(result.rows).toHaveLength(2);
      });

      it("sorts by USD-normalised salary across currencies", async () => {
        const expected = [...FIXTURE_EMPLOYEES].sort((a, b) => usd(b) - usd(a) || byId(a, b));
        expect(await listIds({ sort: "salaryUsd:desc" })).toEqual(ids(expected));
      });

      it("sorts by name in both directions", async () => {
        const names = ids([...FIXTURE_EMPLOYEES].sort((a, b) => a.fullName.localeCompare(b.fullName)));
        expect(await listIds({ sort: "fullName:asc" })).toEqual(names);
        expect(await listIds({ sort: "fullName:desc" })).toEqual([...names].reverse());
      });

      it("sorts names case-insensitively and by code point, not by locale", async () => {
        const names = ["zane Quick", "Alan Ng", "bob Ray", "Carl Dow", "Ann Lee", "Anna Roy"];
        for (const [index, fullName] of names.entries()) {
          await repo.create({
            fullName,
            email: `sort${index}@acme.com`,
            jobTitle: "Analyst",
            department: "Finance",
            countryCode: "FR",
            salaryMinor: 5_000_000,
            hireDate: "2025-01-06",
          });
        }
        const sorted = (await repo.list(query({ country: "FR", sort: "fullName:asc" }))).rows;
        // "Ann Lee" before "Anna Roy": the space sorts before letters (a locale collation would not).
        expect(sorted.map((r) => r.fullName)).toEqual([
          "Alan Ng",
          "Ann Lee",
          "Anna Roy",
          "bob Ray",
          "Carl Dow",
          "zane Quick",
        ]);
      });

      it("sorts by hire date", async () => {
        const dates = [...FIXTURE_EMPLOYEES].sort((a, b) => a.hireDate.localeCompare(b.hireDate));
        expect(await listIds({ sort: "hireDate:asc" })).toEqual(ids(dates));
      });

      it("returns nothing for filters that match no one", async () => {
        expect(await repo.list(query({ country: "FR" }))).toEqual({ rows: [], total: 0 });
      });
    });

    describe("filterOptions", () => {
      it("returns the distinct countries, departments and job titles in use, sorted", async () => {
        const distinct = (values: string[]) => [...new Set(values)].sort();
        expect(await repo.filterOptions()).toEqual({
          countries: distinct(FIXTURE_EMPLOYEES.map((e) => e.countryCode)),
          departments: ["Engineering", "Product", "Sales"],
          jobTitles: ["Product Manager", "Sales Rep", "Software Engineer"],
        });
      });

      it("is empty when there are no employees", async () => {
        const empty = await createRepository([]);
        expect(await empty.filterOptions()).toEqual({ countries: [], departments: [], jobTitles: [] });
      });
    });

    describe("findById", () => {
      it("returns the employee", async () => {
        expect(await repo.findById(fixtureId(2))).toEqual(FIXTURE_EMPLOYEES[1]);
      });

      it("returns null when there is no such employee", async () => {
        expect(await repo.findById(fixtureId(99))).toBeNull();
      });
    });

    describe("create", () => {
      const input = {
        fullName: "Mia Novak",
        email: "mia@acme.com",
        jobTitle: "Designer",
        department: "Product",
        countryCode: "FR",
        salaryMinor: 6_000_000,
        hireDate: "2025-01-06",
      };

      it("persists the employee and assigns an id and timestamps", async () => {
        const created = await repo.create(input);
        expect(created).toMatchObject(input);
        expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(created.createdAt).toBeInstanceOf(Date);
        expect(await repo.findById(created.id)).toEqual(created);
      });

      it("rejects a duplicate email", async () => {
        await expect(repo.create({ ...input, email: "alice@acme.com" })).rejects.toBeInstanceOf(DuplicateEmailError);
      });
    });

    describe("update", () => {
      it("changes only the given fields and refreshes updatedAt", async () => {
        const before = FIXTURE_EMPLOYEES[0]!;
        const updated = await repo.update(before.id, { jobTitle: "Staff Engineer" });
        expect(updated).toMatchObject({ ...before, jobTitle: "Staff Engineer", updatedAt: expect.any(Date) });
        expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
        expect(updated!.createdAt).toEqual(before.createdAt);
        expect(await repo.findById(before.id)).toEqual(updated);
      });

      it("updates salary and country together", async () => {
        const updated = await repo.update(fixtureId(1), { countryCode: "JP", salaryMinor: 9_000_000 });
        expect(updated).toMatchObject({ countryCode: "JP", salaryMinor: 9_000_000 });
      });

      it("returns the unchanged employee for an empty patch", async () => {
        expect(await repo.update(fixtureId(1), {})).toEqual(FIXTURE_EMPLOYEES[0]);
      });

      it("returns null when there is no such employee", async () => {
        expect(await repo.update(fixtureId(99), { jobTitle: "X" })).toBeNull();
      });

      it("rejects an email that belongs to someone else", async () => {
        await expect(repo.update(fixtureId(1), { email: "bob@acme.com" })).rejects.toBeInstanceOf(
          DuplicateEmailError,
        );
      });

      it("allows keeping one's own email", async () => {
        const updated = await repo.update(fixtureId(1), { email: "alice@acme.com" });
        expect(updated?.email).toBe("alice@acme.com");
      });
    });

    describe("delete", () => {
      it("removes the employee and reports it", async () => {
        expect(await repo.delete(fixtureId(1))).toBe(true);
        expect(await repo.findById(fixtureId(1))).toBeNull();
        expect((await repo.list(query())).total).toBe(11);
      });

      it("reports false when there is no such employee", async () => {
        expect(await repo.delete(fixtureId(99))).toBe(false);
      });
    });
  });
}
