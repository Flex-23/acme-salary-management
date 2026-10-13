import { getCountry } from "../domain/countries";
import { formatMoney, toUsdMinor } from "../domain/money";
import type { Employee } from "../domain/types";

const LOCALE = "en-US";

export type MoneyDto = {
  amountMinor: number;
  currency: string;
  formatted: string;
};

export type EmployeeDto = {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  /** Salary in the employee's local currency. */
  salary: MoneyDto;
  /** The same salary converted at the fixed reference rate. */
  salaryUsd: MoneyDto;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
};

export function toMoney(amountMinor: number, currency: string): MoneyDto {
  return { amountMinor, currency, formatted: formatMoney(amountMinor, currency, LOCALE) };
}

export function toEmployeeDto(employee: Employee): EmployeeDto {
  const country = getCountry(employee.countryCode);
  return {
    id: employee.id,
    fullName: employee.fullName,
    email: employee.email,
    jobTitle: employee.jobTitle,
    department: employee.department,
    countryCode: employee.countryCode,
    salary: toMoney(employee.salaryMinor, country.currency),
    salaryUsd: toMoney(toUsdMinor(employee.salaryMinor, country), "USD"),
    hireDate: employee.hireDate,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
