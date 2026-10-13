import { z } from "zod";
import { getCountry, isSupportedCountry } from "./countries";
import { toMinor, toUsdMinor } from "./money";

export const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
/** Guard against data-entry errors: the largest salary accepted, in whole USD. */
export const MAX_SALARY_USD = 10_000_000;
const MAX_SALARY_USD_MINOR = MAX_SALARY_USD * 100;

export const SORT_FIELDS = ["fullName", "hireDate", "salaryUsd", "createdAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function makeFields(today: string) {
  return {
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    jobTitle: z.string().trim().min(1).max(120),
    department: z.string().trim().min(1).max(120),
    countryCode: z.string().refine(isSupportedCountry, "Unsupported country"),
    salary: z.number().positive(),
    hireDate: z
      .string()
      .regex(ISO_DATE, "Expected YYYY-MM-DD")
      .refine(isRealDate, "Invalid date")
      .refine((date) => date <= today, "Hire date cannot be in the future"),
  };
}

type Ctx = z.RefinementCtx;

function salaryToMinor(salary: number, countryCode: string, ctx: Ctx): number | typeof z.NEVER {
  const country = getCountry(countryCode);
  const fail = (message: string) => {
    ctx.issues.push({ code: "custom", message, input: salary, path: ["salary"] });
    return z.NEVER;
  };

  let minor: number;
  try {
    minor = toMinor(salary, country.currencyExponent);
  } catch {
    return fail(`Salary must have at most ${country.currencyExponent} decimal places`);
  }
  if (toUsdMinor(minor, country) > MAX_SALARY_USD_MINOR) {
    return fail("Salary exceeds the maximum allowed amount");
  }
  return minor;
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
  .default("fullName:asc")
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
