import { getCountry, isSupportedCountry } from "@/server/domain/countries";
import { checkSalary, makeEmployeeSchemas } from "@/server/domain/employee";
import { fromMinor } from "@/server/domain/money";
import type { EmployeeDto } from "@/server/services/dto";
import type { ApiError } from "./employees-api";

/** What the form holds. The salary is in major units of the chosen country's currency. */
export type FormValues = {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  salary: number | undefined;
  hireDate: string;
};

export type FieldName = keyof FormValues;

const FIELD_NAMES: readonly FieldName[] = ["fullName", "email", "jobTitle", "department", "countryCode", "salary", "hireDate"];

export const EMPTY_VALUES: FormValues = {
  fullName: "",
  email: "",
  jobTitle: "",
  department: "",
  countryCode: "",
  salary: undefined,
  hireDate: "",
};

export function valuesFromEmployee(employee: EmployeeDto): FormValues {
  const { currencyExponent } = getCountry(employee.countryCode);
  return {
    fullName: employee.fullName,
    email: employee.email,
    jobTitle: employee.jobTitle,
    department: employee.department,
    countryCode: employee.countryCode,
    salary: fromMinor(employee.salary.amountMinor, currencyExponent),
    hireDate: employee.hireDate,
  };
}

export type EmployeeRequestBody = FormValues;

/**
 * The request body for both create and edit. It always includes every field, in particular
 * salary and countryCode together: the API rejects one without the other, because a salary
 * only has a meaning in the currency of its country.
 */
export function toRequestBody(values: FormValues): EmployeeRequestBody {
  const { fullName, email, jobTitle, department, countryCode, salary, hireDate } = values;
  return { fullName, email, jobTitle, department, countryCode, salary, hireDate };
}

/** Currency and decimals help text for the salary field. */
export function salaryHint(countryCode: string): { currency: string | undefined; hint: string } {
  if (!isSupportedCountry(countryCode)) return { currency: undefined, hint: "Choose a country first" };
  const { currency, currencyExponent } = getCountry(countryCode);
  return {
    currency,
    hint: currencyExponent === 0 ? "Whole numbers only (no decimals)" : `Up to ${currencyExponent} decimal places`,
  };
}

/** Validates with the very schema the API uses, so the form and the server never disagree. One message per field. */
export function validateEmployeeForm(values: FormValues, today: string): { name: FieldName; message: string }[] {
  const result = makeEmployeeSchemas({ today }).EmployeeInput.safeParse(values);
  if (result.success) return [];

  const byField = new Map<FieldName, string>();
  for (const issue of result.error.issues) {
    const name = String(issue.path[0]);
    if (isFieldName(name) && !byField.has(name)) byField.set(name, issue.message);
  }
  // The salary's currency rules only run once every other field is valid; check them early so the
  // user hears about too many decimals as soon as they leave the field.
  const { salary, countryCode } = values;
  if (!byField.has("salary") && !byField.has("countryCode") && salary !== undefined) {
    const check = checkSalary(salary, countryCode);
    if (!check.ok) byField.set("salary", check.message);
  }
  return [...byField].map(([name, message]) => ({ name, message }));
}

export type ServerFormErrors = {
  fields: { name: FieldName; message: string }[];
  formMessage?: string;
};

const isFieldName = (path: string): path is FieldName => (FIELD_NAMES as readonly string[]).includes(path);

/** Turns an API error into messages for specific fields, plus one general message if needed. */
export function mapServerError(error: ApiError): ServerFormErrors {
  if (error.code === "DUPLICATE_EMAIL") {
    return { fields: [{ name: "email", message: "Another employee already uses this email" }] };
  }
  if (error.code === "NOT_FOUND") {
    return { fields: [], formMessage: "This employee no longer exists. Refresh the list and try again." };
  }
  if (error.code === "VALIDATION_ERROR") {
    const fields: ServerFormErrors["fields"] = [];
    const general: string[] = [];
    for (const { path, message } of error.details ?? []) {
      if (isFieldName(path)) fields.push({ name: path, message });
      else general.push(message);
    }
    if (fields.length === 0 && general.length === 0) general.push(error.message);
    return general.length > 0 ? { fields, formMessage: general.join("; ") } : { fields };
  }
  return { fields: [], formMessage: "Something went wrong on the server. Please try again." };
}
