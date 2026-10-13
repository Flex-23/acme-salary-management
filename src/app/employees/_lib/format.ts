const numbers = new Intl.NumberFormat("en-US");
const dates = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function rangeLabel({ page, pageSize, total }: { page: number; pageSize: number; total: number }): string {
  if (total === 0) return "No results";
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `Showing ${numbers.format(first)}–${numbers.format(last)} of ${numbers.format(total)}`;
}

/** "2024-03-01" -> "1 Mar 2024". Dates are calendar dates, so no time zone shifting. */
export function formatDate(isoDate: string): string {
  return dates.format(new Date(`${isoDate}T00:00:00Z`));
}
