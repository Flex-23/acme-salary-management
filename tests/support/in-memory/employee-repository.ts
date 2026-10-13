import { randomUUID } from "node:crypto";
import { getCountry } from "@/server/domain/countries";
import type { EmployeeInputData, EmployeeUpdateData, ListEmployeesQueryData } from "@/server/domain/employee";
import { DuplicateEmailError } from "@/server/domain/errors";
import { toUsdMinor } from "@/server/domain/money";
import type { Employee, EmployeeListItem } from "@/server/domain/types";
import type { EmployeeRepository, FilterOptions, ListResult } from "@/server/repositories/employee-repository";
import type { InMemoryStore } from "./store";

type Query = ListEmployeesQueryData;

function matches(e: Employee, q: Query): boolean {
  const term = q.search?.toLowerCase();
  if (term && !e.fullName.toLowerCase().includes(term) && !e.email.toLowerCase().includes(term)) return false;
  if (q.country && e.countryCode !== q.country) return false;
  if (q.department && e.department !== q.department) return false;
  if (q.jobTitle && e.jobTitle !== q.jobTitle) return false;
  return true;
}

function sortValue(e: EmployeeListItem, field: Query["sort"]["field"]): string | number {
  switch (field) {
    case "fullName":
      return e.fullName.toLowerCase();
    case "hireDate":
      return e.hireDate;
    case "salaryUsd":
      return e.salaryUsdMinor;
    case "createdAt":
      return e.createdAt.getTime();
  }
}

function compare(a: EmployeeListItem, b: EmployeeListItem, sort: Query["sort"]): number {
  const left = sortValue(a, sort.field);
  const right = sortValue(b, sort.field);
  const order = left < right ? -1 : left > right ? 1 : 0;
  const directed = sort.direction === "asc" ? order : -order;
  return directed || a.id.localeCompare(b.id);
}

function toListItem(e: Employee): EmployeeListItem {
  const country = getCountry(e.countryCode);
  return { ...e, currency: country.currency, salaryUsdMinor: toUsdMinor(e.salaryMinor, country) };
}

export class InMemoryEmployeeRepository implements EmployeeRepository {
  constructor(private readonly store: InMemoryStore) {}

  async list(query: Query): Promise<ListResult> {
    const items = this.store.employees.filter((e) => matches(e, query)).map(toListItem);
    items.sort((a, b) => compare(a, b, query.sort));
    const start = (query.page - 1) * query.pageSize;
    return { rows: items.slice(start, start + query.pageSize), total: items.length };
  }

  async filterOptions(): Promise<FilterOptions> {
    const distinct = (pick: (e: Employee) => string) => [...new Set(this.store.employees.map(pick))].sort();
    return {
      countries: distinct((e) => e.countryCode),
      departments: distinct((e) => e.department),
      jobTitles: distinct((e) => e.jobTitle),
    };
  }

  async findById(id: string): Promise<Employee | null> {
    const found = this.store.employees.find((e) => e.id === id);
    return found ? { ...found } : null;
  }

  async create(input: EmployeeInputData): Promise<Employee> {
    this.assertEmailFree(input.email);
    const now = new Date();
    const employee: Employee = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.store.employees.push(employee);
    return { ...employee };
  }

  async update(id: string, patch: EmployeeUpdateData): Promise<Employee | null> {
    const index = this.store.employees.findIndex((e) => e.id === id);
    const current = this.store.employees[index];
    if (!current) return null;
    if (Object.keys(patch).length === 0) return { ...current };
    if (patch.email !== undefined) this.assertEmailFree(patch.email, id);

    const updated: Employee = { ...current, ...patch, updatedAt: new Date() };
    this.store.employees[index] = updated;
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const before = this.store.employees.length;
    this.store.employees = this.store.employees.filter((e) => e.id !== id);
    return this.store.employees.length < before;
  }

  private assertEmailFree(email: string, exceptId?: string): void {
    if (this.store.employees.some((e) => e.email === email && e.id !== exceptId)) {
      throw new DuplicateEmailError(email);
    }
  }
}
