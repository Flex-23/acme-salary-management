import { z } from "zod";
import { getCountry, isSupportedCountry } from "./countries";
import { toMinor, toUsdMinor } from "./money";

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
/** Guard against data-entry errors: the largest salary accepted, in whole USD. */
export const MAX_SALARY_USD = 10_000_000;
const MAX_SALARY_USD_MINOR = MAX_SALARY_USD * 100;

export const SORT_FIELDS = ["fullName", "hireDate", "salaryUsd", "createdAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";
export const DEFAULT_SORT: { field: SortField; direction: SortDirection } = { field: "fullName", direction: "asc" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const REQUIRED = "Required";
const NAME_LENGTH = "Full name must be 2–120 characters";
const salaryType = { error: (issue: { input?: unknown }) => (issue.input === undefined ? REQUIRED : "Enter a valid amount") };

function makeFields(today: string) {
  return {
    fullName: z.string(REQUIRED).trim().min(2, NAME_LENGTH).max(120, NAME_LENGTH),
    email: z.string(REQUIRED).trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    jobTitle: z.string(REQUIRED).trim().min(1, REQUIRED).max(120, "Job title is too long"),
    department: z.string(REQUIRED).trim().min(1, REQUIRED).max(120, "Department is too long"),
    countryCode: z.string(REQUIRED).refine(isSupportedCountry, "Select a supported country"),
    salary: z.number(salaryType).positive("Salary must be greater than zero"),
    hireDate: z
      .string(REQUIRED)
      .refine(isCalendarDate, { error: "Enter a valid date (YYYY-MM-DD)", abort: true })
      .refine((date) => date <= today, "Hire date cannot be in the future"),
  };
}

type Ctx = z.RefinementCtx;

export type SalaryCheck = { ok: true; minor: number } | { ok: false; message: string };

/** Converts a salary in major units to minor units, enforcing the currency's decimals and the cap. */
export function checkSalary(salary: number, countryCode: string): SalaryCheck {
  const country = getCountry(countryCode);
  let minor: number;
  try {
    minor = toMinor(salary, country.currencyExponent);
  } catch {
    return { ok: false, message: `Salary must have at most ${country.currencyExponent} decimal places` };
  }
  if (toUsdMinor(minor, country) > MAX_SALARY_USD_MINOR) {
    return { ok: false, message: "Salary exceeds the maximum allowed amount" };
  }
  return { ok: true, minor };
}

function salaryToMinor(salary: number, countryCode: string, ctx: Ctx): number | typeof z.NEVER {
  const check = checkSalary(salary, countryCode);
  if (check.ok) return check.minor;
  ctx.issues.push({ code: "custom", message: check.message, input: salary, path: ["salary"] });
  return z.NEVER;
}

export function makeEmployeeSchemas({ today }: { today: string }) {
  const fields = makeFields(today);

  const EmployeeInput = z.object(fields).transform(({ salary, ...rest }, ctx) => {
    const salaryMinor = salaryToMinor(salary, rest.countryCode, ctx);
    return { ...rest, salaryMinor };
  });

  const EmployeeUpdate = z
    .object(fields)
    .partial()
    .transform(({ salary, ...rest }, ctx) => {
      const { countryCode } = rest;
      if (salary === undefined && countryCode === undefined) return rest;
      if (salary === undefined || countryCode === undefined) {
        const missing = salary === undefined ? "salary" : "countryCode";
        ctx.issues.push({
          code: "custom",
          message: "salary and countryCode must be sent together",
          input: rest,
          path: [missing],
        });
        return z.NEVER;
      }
      return { ...rest, salaryMinor: salaryToMinor(salary, countryCode, ctx) };
    });

  return { EmployeeInput, EmployeeUpdate };
}

export type EmployeeInputData = z.output<ReturnType<typeof makeEmployeeSchemas>["EmployeeInput"]>;
export type EmployeeUpdateData = z.output<ReturnType<typeof makeEmployeeSchemas>["EmployeeUpdate"]>;

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

function pagingInt(fallback: number, max: number) {
  return z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .default(fallback)
      .transform((n) => Math.min(Math.max(n, 1), max)),
  );
}

const optionalText = z.preprocess(blankToUndefined, z.string().trim().min(1).max(120).optional());

const sortParam = z
  .string()
  .default(`${DEFAULT_SORT.field}:${DEFAULT_SORT.direction}`)
  .transform((raw, ctx) => {
    const [field, direction = "asc", ...extra] = raw.split(":");
    const validField = SORT_FIELDS.find((f) => f === field);
    const validDirection = direction === "asc" || direction === "desc" ? direction : undefined;
    if (!validField || !validDirection || extra.length > 0) {
      ctx.issues.push({
        code: "custom",
        message: `Sort must be one of ${SORT_FIELDS.join(", ")} with :asc or :desc`,
        input: raw,
      });
      return z.NEVER;
    }
    return { field: validField, direction: validDirection } satisfies {
      field: SortField;
      direction: SortDirection;
    };
  });

export const ListEmployeesQuery = z.object({
  page: pagingInt(1, Number.MAX_SAFE_INTEGER),
  pageSize: pagingInt(DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  search: z.preprocess(blankToUndefined, z.string().trim().min(1).max(100).optional()),
  country: z.preprocess(
    blankToUndefined,
    z.string().refine(isSupportedCountry, "Unsupported country").optional(),
  ),
  department: optionalText,
  jobTitle: optionalText,
  sort: sortParam,
});

export type ListEmployeesQueryData = z.output<typeof ListEmployeesQuery>;
