import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListEmployeesQuery } from "@/server/domain/employee";
import { DuplicateEmailError, NotFoundError, ValidationError } from "@/server/domain/errors";
import type { EmployeeRepository } from "@/server/repositories/employee-repository";
import { EmployeeService } from "@/server/services/employee-service";
import { FIXTURE_EMPLOYEES, fixtureId } from "../../support/fixtures";
import { InMemoryEmployeeRepository } from "../../support/in-memory/employee-repository";
import { InMemoryStore } from "../../support/in-memory/store";

const TODAY = "2026-06-15";

const validBody = {
  fullName: "Mia Novak",
  email: "Mia@Acme.com",
  jobTitle: "Designer",
  department: "Product",
  countryCode: "DE",
  salary: 72000.5,
  hireDate: "2026-01-12",
};

const catchError = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: unknown) => error);

describe("EmployeeService", () => {
  let repo: EmployeeRepository;
  let service: EmployeeService;

  beforeEach(() => {
    repo = new InMemoryEmployeeRepository(new InMemoryStore(FIXTURE_EMPLOYEES));
    service = new EmployeeService(repo, { today: () => TODAY });
  });

  describe("list", () => {
    it("returns DTOs with formatted local and USD salaries and page metadata", async () => {
      const result = await service.list({ search: "tanaka" });
      expect(result.page).toEqual({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
      expect(result.data[0]).toMatchObject({
        id: fixtureId(8),
        fullName: "Hiro Tanaka",
        salary: { amountMinor: 7_000_000, currency: "JPY", formatted: "¥7,000,000" },
        salaryUsd: { amountMinor: 4_690_000, currency: "USD", formatted: "$46,900.00" },
      });
      expect(typeof result.data[0]?.createdAt).toBe("string");
    });

    it("computes the number of pages from the filtered total", async () => {
      const result = await service.list({ pageSize: "5" });
      expect(result.page).toEqual({ page: 1, pageSize: 5, total: 12, totalPages: 3 });
    });

    it("reports zero pages for an empty result", async () => {
      const result = await service.list({ country: "FR" });
      expect(result).toEqual({ data: [], page: { page: 1, pageSize: 25, total: 0, totalPages: 0 } });
    });

    it("clamps an oversized page size", async () => {
      expect((await service.list({ pageSize: "500" })).page.pageSize).toBe(100);
    });

    it("lists from an already-parsed query without parsing again", async () => {
      const query = ListEmployeesQuery.parse({ country: "JP", sort: "salaryUsd:desc" });
      const result = await service.listByQuery(query);
      expect(result.data.map((e) => e.id)).toEqual([fixtureId(8), fixtureId(9)]);
      expect(result.page).toEqual({ page: 1, pageSize: 25, total: 2, totalPages: 1 });
    });

    it("rejects an invalid query with field details", async () => {
      const error = await catchError(service.list({ page: "abc", sort: "password:asc" }));
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details.map((d) => d.path).sort()).toEqual(["page", "sort"]);
    });
  });

  describe("get", () => {
    it("returns the employee as a DTO", async () => {
      expect(await service.get(fixtureId(1))).toMatchObject({ id: fixtureId(1), fullName: "Alice Smith" });
    });

    it("throws NotFoundError for an unknown id", async () => {
      expect(await catchError(service.get(fixtureId(99)))).toBeInstanceOf(NotFoundError);
    });

    it("treats a non-UUID id as not found without querying the repository", async () => {
      const findById = vi.spyOn(repo, "findById");
      expect(await catchError(service.get("not-a-uuid"))).toBeInstanceOf(NotFoundError);
      expect(findById).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("validates, converts salary to minor units and normalises the email", async () => {
      const created = await service.create(validBody);
      expect(created).toMatchObject({
        email: "mia@acme.com",
        salary: { amountMinor: 7_200_050, currency: "EUR" },
        salaryUsd: { amountMinor: 7_776_054 },
      });
      expect(await service.get(created.id)).toEqual(created);
    });

    it("rejects an invalid body with one detail per bad field", async () => {
      const error = await catchError(service.create({ ...validBody, email: "nope", salary: -5 }));
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details.map((d) => d.path).sort()).toEqual(["email", "salary"]);
    });

    it("uses the clock for the 'not in the future' rule", async () => {
      expect(await catchError(service.create({ ...validBody, hireDate: "2026-06-16" }))).toBeInstanceOf(ValidationError);
      const created = await service.create({ ...validBody, hireDate: TODAY });
      expect(created.hireDate).toBe(TODAY);
    });

    it("rejects bodies that are not objects", async () => {
      for (const body of [null, "text", 42, undefined]) {
        expect(await catchError(service.create(body))).toBeInstanceOf(ValidationError);
      }
    });

    it("rejects a duplicate email", async () => {
      const error = await catchError(service.create({ ...validBody, email: "ALICE@acme.com" }));
      expect(error).toBeInstanceOf(DuplicateEmailError);
    });
  });

  describe("update", () => {
    it("applies a partial update", async () => {
      const updated = await service.update(fixtureId(1), { jobTitle: "Staff Engineer" });
      expect(updated).toMatchObject({ id: fixtureId(1), jobTitle: "Staff Engineer", fullName: "Alice Smith" });
    });

    it("updates salary together with country", async () => {
      const updated = await service.update(fixtureId(1), { salary: 5_000_000, countryCode: "JP" });
      expect(updated.salary).toMatchObject({ amountMinor: 5_000_000, currency: "JPY" });
    });

    it("rejects salary without country and country without salary", async () => {
      expect(await catchError(service.update(fixtureId(1), { salary: 100 }))).toBeInstanceOf(ValidationError);
      expect(await catchError(service.update(fixtureId(1), { countryCode: "JP" }))).toBeInstanceOf(ValidationError);
    });

    it("throws NotFoundError for an unknown or non-UUID id", async () => {
      expect(await catchError(service.update(fixtureId(99), { jobTitle: "X" }))).toBeInstanceOf(NotFoundError);
      expect(await catchError(service.update("1; drop table", { jobTitle: "X" }))).toBeInstanceOf(NotFoundError);
    });

    it("checks the id before validating the body", async () => {
      expect(await catchError(service.update("not-a-uuid", { email: "bad" }))).toBeInstanceOf(NotFoundError);
    });

    it("rejects an invalid patch", async () => {
      expect(await catchError(service.update(fixtureId(1), { hireDate: "2030-01-01" }))).toBeInstanceOf(ValidationError);
    });

    it("rejects an email that belongs to someone else", async () => {
      expect(await catchError(service.update(fixtureId(1), { email: "bob@acme.com" }))).toBeInstanceOf(DuplicateEmailError);
    });
  });

  describe("delete", () => {
    it("removes the employee", async () => {
      await service.delete(fixtureId(1));
      expect(await catchError(service.get(fixtureId(1)))).toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for an unknown or non-UUID id", async () => {
      expect(await catchError(service.delete(fixtureId(99)))).toBeInstanceOf(NotFoundError);
      const remove = vi.spyOn(repo, "delete");
      expect(await catchError(service.delete("abc"))).toBeInstanceOf(NotFoundError);
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe("filterOptions", () => {
    it("returns the distinct filter values", async () => {
      const options = await service.filterOptions();
      expect(options.countries).toEqual(["DE", "GB", "JP", "US"]);
      expect(options.departments).toEqual(["Engineering", "Product", "Sales"]);
    });
  });
});
