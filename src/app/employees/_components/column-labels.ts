/**
 * The table's columns in display order. Shared by the table and its loading skeleton so they always match.
 *
 * - `responsive` hides a column on narrower screens (the email then shows under the name).
 * - `wrap` lets long text (job titles, country names) break onto two lines instead of widening the
 *   table; the other columns stay on one line.
 */
export const COLUMN_DEFS = [
  { id: "fullName", label: "Name" },
  { id: "email", label: "Email", responsive: "hidden xl:table-cell" },
  { id: "jobTitle", label: "Job title", wrap: true },
  { id: "department", label: "Department", responsive: "hidden lg:table-cell", wrap: true },
  { id: "countryCode", label: "Country", wrap: true },
  { id: "salaryUsd", label: "Salary" },
  { id: "hireDate", label: "Hired" },
] as const;

export type ColumnId = (typeof COLUMN_DEFS)[number]["id"];

type Def = (typeof COLUMN_DEFS)[number];

const cellClasses = (column: Def): string | undefined =>
  [("responsive" in column && column.responsive) || "", ("wrap" in column && column.wrap && "whitespace-normal") || ""]
    .filter(Boolean)
    .join(" ") || undefined;

const CLASSES: Record<string, string | undefined> = Object.fromEntries(COLUMN_DEFS.map((column) => [column.id, cellClasses(column)]));

/** Tailwind classes for a column's header and cells: responsive visibility and text wrapping. */
export const columnClass = (columnId: string): string | undefined => CLASSES[columnId];

export const labelOf = (id: ColumnId): string => COLUMN_DEFS.find((column) => column.id === id)?.label ?? id;
