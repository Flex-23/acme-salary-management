import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const countries = pgTable(
  "countries",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    currencyExponent: smallint("currency_exponent").notNull(),
    usdPerUnit: numeric("usd_per_unit", { precision: 18, scale: 8 }).notNull(),
  },
  (t) => [
    check("countries_code_format", sql`${t.code} ~ '^[A-Z]{2}$'`),
    check("countries_exponent_range", sql`${t.currencyExponent} between 0 and 4`),
    check("countries_rate_positive", sql`${t.usdPerUnit} > 0`),
  ],
).enableRLS();

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull().unique(),
    jobTitle: text("job_title").notNull(),
    department: text("department").notNull(),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.code),
    salaryMinor: bigint("salary_minor", { mode: "number" }).notNull(),
    hireDate: date("hire_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("employees_salary_positive", sql`${t.salaryMinor} > 0`),
    check("employees_email_lowercase", sql`${t.email} = lower(${t.email})`),
    index("employees_country_idx").on(t.countryCode),
    index("employees_country_job_title_idx").on(t.countryCode, t.jobTitle),
    index("employees_department_idx").on(t.department),
    // Serves "sort by hire date" in both directions, with id as the stable tiebreaker.
    index("employees_hire_date_idx").on(t.hireDate, t.id),
    // Serves the default list order; must match the ORDER BY in the employee repository.
    index("employees_full_name_sort_idx").on(sql`lower(${t.fullName}) collate "C"`, t.id),
    index("employees_full_name_trgm_idx").using("gin", sql`${t.fullName} gin_trgm_ops`),
    index("employees_email_trgm_idx").using("gin", sql`${t.email} gin_trgm_ops`),
  ],
).enableRLS();
