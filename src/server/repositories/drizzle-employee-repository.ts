import "server-only";
import { and, asc, desc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { countries, employees } from "../db/schema";
import type { Database } from "../db/database";
import type { EmployeeInputData, EmployeeUpdateData, ListEmployeesQueryData } from "../domain/employee";
import { DuplicateEmailError } from "../domain/errors";
import { toUsdMinor } from "../domain/money";
import type { Employee, EmployeeListItem } from "../domain/types";
import type { EmployeeRepository, FilterOptions, ListResult } from "./employee-repository";

const UNIQUE_VIOLATION = "23505";

/** Salary in USD minor units, unrounded, so cross-currency sorting is exact. */
const salaryUsdExpr = sql`(${employees.salaryMinor}::numeric * ${countries.usdPerUnit} * 100
  / power(10::numeric, ${countries.currencyExponent}::numeric))`;

/**
 * Case-insensitive name order that does not depend on the database's locale: the "C" collation
 * compares code points, so PGlite and Supabase order names identically.
 */
const fullNameSortExpr = sql`lower(${employees.fullName}) collate "C"`;

const sortExpressions = {
  fullName: fullNameSortExpr,
  hireDate: employees.hireDate,
  salaryUsd: salaryUsdExpr,
  createdAt: employees.createdAt,
} as const;

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}

function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

function buildFilters(query: ListEmployeesQueryData): SQL | undefined {
  const pattern = query.search ? `%${escapeLike(query.search)}%` : undefined;
  return and(
    pattern ? or(ilike(employees.fullName, pattern), ilike(employees.email, pattern)) : undefined,
    query.country ? eq(employees.countryCode, query.country) : undefined,
    query.department ? eq(employees.department, query.department) : undefined,
    query.jobTitle ? eq(employees.jobTitle, query.jobTitle) : undefined,
  );
}

export class DrizzleEmployeeRepository implements EmployeeRepository {
  constructor(private readonly db: Database) {}

  async list(query: ListEmployeesQueryData): Promise<ListResult> {
    const where = buildFilters(query);
    const direction = query.sort.direction === "asc" ? asc : desc;

    const rowsQuery = this.db
      .select({
        ...getTableColumns(employees),
        currency: countries.currency,
        currencyExponent: countries.currencyExponent,
        usdPerUnit: countries.usdPerUnit,
      })
      .from(employees)
      .innerJoin(countries, eq(employees.countryCode, countries.code))
      .where(where)
      .orderBy(direction(sortExpressions[query.sort.field]), asc(employees.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    const totalQuery = this.db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(employees)
      .where(where);

    const [rows, [totals]] = await Promise.all([rowsQuery, totalQuery]);
    const items = rows.map(({ currencyExponent, usdPerUnit, ...employee }): EmployeeListItem => ({
      ...employee,
      salaryUsdMinor: toUsdMinor(employee.salaryMinor, { currencyExponent, usdPerUnit }),
    }));
    return { rows: items, total: totals?.total ?? 0 };
  }

  async filterOptions(): Promise<FilterOptions> {
    const distinct = async (column: PgColumn) => {
      const rows = await this.db
        .select({ value: sql<string>`${column}` })
        .from(employees)
        .groupBy(column)
        .orderBy(sql`${column} collate "C"`);
      return rows.map((row) => row.value);
    };
    const [countries, departments, jobTitles] = await Promise.all([
      distinct(employees.countryCode),
      distinct(employees.department),
      distinct(employees.jobTitle),
    ]);
    return { countries, departments, jobTitles };
  }

  async findById(id: string): Promise<Employee | null> {
    const [found] = await this.db.select().from(employees).where(eq(employees.id, id));
    return found ?? null;
  }

  async create(input: EmployeeInputData): Promise<Employee> {
    try {
      const [created] = await this.db.insert(employees).values(input).returning();
      return created as Employee;
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateEmailError(input.email) : error;
    }
  }

  async update(id: string, patch: EmployeeUpdateData): Promise<Employee | null> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    try {
      const [updated] = await this.db
        .update(employees)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(eq(employees.id, id))
        .returning();
      return updated ?? null;
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateEmailError(patch.email ?? "") : error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(employees).where(eq(employees.id, id)).returning({ id: employees.id });
    return deleted.length > 0;
  }
}
