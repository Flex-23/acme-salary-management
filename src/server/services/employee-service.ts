import type { z } from "zod";
import { ListEmployeesQuery, makeEmployeeSchemas } from "../domain/employee";
import { NotFoundError, ValidationError } from "../domain/errors";
import type { EmployeeRepository, FilterOptions } from "../repositories/employee-repository";
import type { Clock } from "./clock";
import { toEmployeeDto, type EmployeeDto } from "./dto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PageInfo = { page: number; pageSize: number; total: number; totalPages: number };
export type EmployeePage = { data: EmployeeDto[]; page: PageInfo };

/** Parses untrusted input with a zod schema, turning failures into a ValidationError with per-field details. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown, message: string): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw new ValidationError(message, details);
}

export class EmployeeService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
  ) {}

  async list(rawQuery: Record<string, string | undefined>): Promise<EmployeePage> {
    const query = parseOrThrow(ListEmployeesQuery, rawQuery, "Invalid query parameters");
    const { rows, total } = await this.employees.list(query);
    return {
      data: rows.map(toEmployeeDto),
      page: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  filterOptions(): Promise<FilterOptions> {
    return this.employees.filterOptions();
  }

  async get(id: string): Promise<EmployeeDto> {
    const employee = isUuid(id) ? await this.employees.findById(id) : null;
    if (!employee) throw new NotFoundError("Employee");
    return toEmployeeDto(employee);
  }

  async create(body: unknown): Promise<EmployeeDto> {
    const input = parseOrThrow(this.schemas().EmployeeInput, body, "Invalid employee");
    return toEmployeeDto(await this.employees.create(input));
  }

  async update(id: string, body: unknown): Promise<EmployeeDto> {
    if (!isUuid(id)) throw new NotFoundError("Employee");
    const patch = parseOrThrow(this.schemas().EmployeeUpdate, body, "Invalid employee update");
    const updated = await this.employees.update(id, patch);
    if (!updated) throw new NotFoundError("Employee");
    return toEmployeeDto(updated);
  }

  async delete(id: string): Promise<void> {
    const deleted = isUuid(id) && (await this.employees.delete(id));
    if (!deleted) throw new NotFoundError("Employee");
  }

  /** Built per call so "today" always comes from the clock. */
  private schemas() {
    return makeEmployeeSchemas({ today: this.clock.today() });
  }
}

function isUuid(value: string): boolean {
  return UUID.test(value);
}
