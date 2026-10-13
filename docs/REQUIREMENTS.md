# Requirements — ACME Salary Management

## Goal and persona
A web app for ACME's **HR Manager** (single persona) to manage salary records for
**10,000 employees in multiple countries**, replacing an Excel workbook.

## Problem
Excel cannot be searched, filtered or aggregated reliably at this size, is easy to corrupt,
and makes questions like "what do we pay Engineers in Germany?" slow to answer. The HR Manager
needs one place to maintain salary records and see how the organisation pays people.

## In scope (user stories)
- **Manage employees.** As HR, I can create, view, edit and delete an employee record.
  *Done when:* required fields are validated, duplicate emails are rejected, hire date is not
  in the future, salary is > 0, and changes show up immediately.
- **Search, filter, sort.** As HR, I can find employees by name/email and filter by country,
  department and job title, and sort by full name, hire date, salary (USD-normalised) or created date.
  *Done when:* it is server-side, paginated (max 100 per page) and filters survive a page reload (URL).
- **Insights by country.** Headcount and min / max / average / median pay per country,
  in local currency and USD.
- **Insights by job title.** Same statistics per job title within a chosen country.
- **Insights by department.** Same statistics per department.
- **Distribution.** A salary-band histogram (USD), optionally for one country.
- **Summary KPIs.** Headcount, total payroll (USD), average and median salary.

## Assumptions
- Salary is **annual gross**, stored as an **integer in minor units** (e.g. cents) in local currency.
- Currency is **derived from the employee's country** (one currency per country).
- Cross-country comparison uses **fixed, dated reference FX rates** (illustrative, not live).
- One role: HR Manager.
- Salary is capped at 10,000,000 USD (after conversion) as a guard against data-entry errors,
  not a business rule.

## Out of scope (this version)
- Authentication / roles — single trusted persona; deployment access is controlled outside the app.
- Taxes and net pay — only gross salary is needed to answer the pay questions.
- Salary history / audit trail — adds a data model and UI without a stated need.
- Excel/CSV import — data is seeded; migration of the real workbook is a separate task.
- Live FX rates — fixed rates keep results reproducible and avoid an external dependency.
- Multi-tenancy — one organisation.
- E2E browser tests — covered by unit and integration tests at this stage.

## Non-functional requirements
- **Performance:** p95 API latency < 300 ms for list and insight endpoints at 10k rows
  (verified with a load test); insights are cached and invalidated on mutation.
- **Limits:** `pageSize` max 100; all query params validated and clamped.
- **Resilience:** consistent error shape, no stack traces or SQL leaked, health endpoint
  checks the DB, UI has loading, empty and error states.
- **Security:** Row Level Security enabled on all tables (no policies) so Supabase's public
  REST API is blocked; DB access is server-side only; no secrets in `NEXT_PUBLIC_*`.
