import { describe, expect, it } from "vitest";
import { makeEmployeeSchemas } from "@/server/domain/employee";
import type { EmployeeDto } from "@/server/services/dto";
import {
  EMPTY_VALUES,
  mapServerError,
  salaryHint,
  toRequestBody,
  validateEmployeeForm,
  valuesFromEmployee,
  type FormValues,
} from "@/app/employees/_lib/employee-form";

const employee: EmployeeDto = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Mia Novak",
  email: "mia@acme.com",
  jobTitle: "Designer",
  department: "Product",
  countryCode: "DE",
  salary: { amountMinor: 7_200_050, currency: "EUR", formatted: "€72,000.50" },
  salaryUsd: { amountMinor: 7_776_054, currency: "USD", formatted: "$77,760.54" },
  hireDate: "2024-01-12",
  createdAt: "2024-01-12T08:00:00.000Z",
  updatedAt: "2024-01-12T08:00:00.000Z",
};

describe("valuesFromEmployee", () => {
  it("shows the salary in major units of the employee's currency", () => {
    expect(valuesFromEmployee(employee)).toEqual({
      fullName: "Mia Novak",
      email: "mia@acme.com",
      jobTitle: "Designer",
      department: "Product",
      countryCode: "DE",
      salary: 72000.5,
      hireDate: "2024-01-12",
    });
  });

  it("uses whole units for a zero-decimal currency", () => {
    const yen = { ...employee, countryCode: "JP", salary: { amountMinor: 6_500_000, currency: "JPY", formatted: "¥6,500,000" } };
    expect(valuesFromEmployee(yen).salary).toBe(6_500_000);
  });
});

describe("toRequestBody", () => {
  const values: FormValues = { ...valuesFromEmployee(employee), fullName: "  Mia Novak  " };

  it("always carries salary and countryCode together (edit and create alike)", () => {
    const body = toRequestBody(values);
    expect(body).toMatchObject({ salary: 72000.5, countryCode: "DE" });
    expect(Object.keys(body).sort()).toEqual(
      ["countryCode", "department", "email", "fullName", "hireDate", "jobTitle", "salary"],
    );
  });

  it("passes the values on as typed, for the server to validate again", () => {
    expect(toRequestBody(values).fullName).toBe("  Mia Novak  ");
  });
});

describe("salaryHint", () => {
  it("names the currency and its decimals", () => {
    expect(salaryHint("DE")).toEqual({ currency: "EUR", hint: "Up to 2 decimal places" });
    expect(salaryHint("JP")).toEqual({ currency: "JPY", hint: "Whole numbers only (no decimals)" });
  });

  it("is empty until a country is chosen", () => {
    expect(salaryHint("")).toEqual({ currency: undefined, hint: "Choose a country first" });
  });
});

describe("form values and the shared schema", () => {
  const { EmployeeInput } = makeEmployeeSchemas({ today: "2026-06-15" });

  it("start empty and invalid", () => {
    expect(EmployeeInput.safeParse(EMPTY_VALUES).success).toBe(false);
  });

  it("round-trip an existing employee into a valid form", () => {
    expect(EmployeeInput.safeParse(valuesFromEmployee(employee)).success).toBe(true);
  });
});

describe("validateEmployeeForm", () => {
  const TODAY = "2026-06-15";
  const valid = valuesFromEmployee(employee);
  const errorsFor = (patch: Partial<FormValues>) =>
    Object.fromEntries(validateEmployeeForm({ ...valid, ...patch }, TODAY).map((e) => [e.name, e.message]));

  it("accepts a complete, valid employee", () => {
    expect(validateEmployeeForm(valid, TODAY)).toEqual([]);
  });

  it("uses the shared schema's messages, one per field", () => {
    expect(errorsFor({ email: "nope", fullName: "A" })).toEqual({
      email: "Enter a valid email address",
      fullName: "Full name must be 2–120 characters",
    });
  });

  it("asks for everything on an empty form", () => {
    const errors = validateEmployeeForm(EMPTY_VALUES, TODAY);
    expect(errors.map((e) => e.name).sort()).toEqual(
      ["countryCode", "department", "email", "fullName", "hireDate", "jobTitle", "salary"],
    );
    expect(errors.find((e) => e.name === "salary")?.message).toBe("Required");
  });

  it("respects the currency's decimals", () => {
    expect(errorsFor({ countryCode: "JP", salary: 6_500_000.5 }).salary).toBe("Salary must have at most 0 decimal places");
    expect(errorsFor({ countryCode: "DE", salary: 72000.555 }).salary).toBe("Salary must have at most 2 decimal places");
    expect(errorsFor({ countryCode: "JP", salary: 6_500_000 }).salary).toBeUndefined();
  });

  it("reports a salary problem even while other fields are still empty", () => {
    const errors = validateEmployeeForm({ ...EMPTY_VALUES, countryCode: "JP", salary: 5_000_000.5 }, TODAY);
    expect(errors.find((e) => e.name === "salary")?.message).toBe("Salary must have at most 0 decimal places");
    expect(errors.find((e) => e.name === "fullName")).toBeDefined();
  });

  it("does not double up when the schema already reported the salary", () => {
    const errors = validateEmployeeForm({ ...EMPTY_VALUES, countryCode: "JP", salary: -1 }, TODAY);
    expect(errors.filter((e) => e.name === "salary")).toHaveLength(1);
  });

  it("rejects a hire date after today and a salary that is not a number", () => {
    expect(errorsFor({ hireDate: "2026-06-16" }).hireDate).toBe("Hire date cannot be in the future");
    expect(errorsFor({ salary: Number.NaN }).salary).toBe("Enter a valid amount");
  });
});

describe("mapServerError", () => {
  it("maps 400 details onto form fields", () => {
    const result = mapServerError({
      code: "VALIDATION_ERROR",
      message: "Invalid employee",
      details: [
        { path: "email", message: "Enter a valid email address" },
        { path: "salary", message: "Salary must be greater than zero" },
      ],
    });
    expect(result).toEqual({
      fields: [
        { name: "email", message: "Enter a valid email address" },
        { name: "salary", message: "Salary must be greater than zero" },
      ],
    });
  });

  it("reports details for unknown fields at form level", () => {
    const result = mapServerError({
      code: "VALIDATION_ERROR",
      message: "Invalid employee",
      details: [{ path: "", message: "Invalid input" }],
    });
    expect(result).toEqual({ fields: [], formMessage: "Invalid input" });
  });

  it("falls back to the error message when a 400 has no details", () => {
    expect(mapServerError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON" })).toEqual({
      fields: [],
      formMessage: "Request body must be valid JSON",
    });
  });

  it("maps a duplicate email onto the email field", () => {
    expect(mapServerError({ code: "DUPLICATE_EMAIL", message: "exists" })).toEqual({
      fields: [{ name: "email", message: "Another employee already uses this email" }],
    });
  });

  it("maps not-found to a form message", () => {
    expect(mapServerError({ code: "NOT_FOUND", message: "Employee not found" })).toEqual({
      fields: [],
      formMessage: "This employee no longer exists. Refresh the list and try again.",
    });
  });

  it("hides the details of anything else", () => {
    expect(mapServerError({ code: "INTERNAL_ERROR", message: "Something went wrong" })).toEqual({
      fields: [],
      formMessage: "Something went wrong on the server. Please try again.",
    });
  });
});
