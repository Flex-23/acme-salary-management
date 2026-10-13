/**
 * The table's columns in display order. Shared by the table and its loading skeleton so they always match.
 * `responsive` hides a column on narrower screens; the email is shown under the name instead.
 */
export const COLUMN_DEFS = [
  { id: "fullName", label: "Name" },
  { id: "email", label: "Email", responsive: "hidden lg:table-cell" },
  { id: "jobTitle", label: "Job title" },
  { id: "department", label: "Department", responsive: "hidden xl:table-cell" },
  { id: "countryCode", label: "Country" },
  { id: "salaryUsd", label: "Salary" },
  { id: "hireDate", label: "Hired" },
] as const;

export type ColumnId = (typeof COLUMN_DEFS)[number]["id"];

const RESPONSIVE: Record<string, string | undefined> = Object.fromEntries(
  COLUMN_DEFS.map((column) => [column.id, "responsive" in column ? column.responsive : undefined]),
);

/** Tailwind classes that hide the column on narrow screens (empty for always-visible columns). */
export const responsiveClass = (columnId: string): string | undefined => RESPONSIVE[columnId];

export const labelOf = (id: ColumnId): string => COLUMN_DEFS.find((column) => column.id === id)?.label ?? id;
