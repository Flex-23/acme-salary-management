import { createColumnHelper, rowSortingFeature, tableFeatures } from "@tanstack/react-table";
import { getCountry } from "@/server/domain/countries";
import type { EmployeeDto } from "@/server/services/dto";
import { formatDate } from "../_lib/format";
import { labelOf } from "./column-labels";

// Sorting happens on the server (the URL is the source of truth), so the table only needs the sorting feature.
export const features = tableFeatures({ rowSortingFeature });

const column = createColumnHelper<typeof features, EmployeeDto>();

/** Only name, hire date and USD-normalised salary can be sorted: those are the sort fields the API accepts. */
export const columns = column.columns([
  column.accessor("fullName", {
    id: "fullName",
    header: labelOf("fullName"),
    cell: (info) => (
      <>
        <span className="font-medium">{info.getValue()}</span>
        {/* The email column is hidden on narrower screens, so it moves under the name there. */}
        <span className="block text-xs text-muted-foreground xl:hidden">{info.row.original.email}</span>
      </>
    ),
  }),
  column.accessor("email", {
    header: labelOf("email"),
    enableSorting: false,
    cell: (info) => (
      <span className="block max-w-56 truncate text-muted-foreground" title={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
  column.accessor("jobTitle", { header: labelOf("jobTitle"), enableSorting: false }),
  column.accessor("department", { header: labelOf("department"), enableSorting: false }),
  column.accessor("countryCode", {
    header: labelOf("countryCode"),
    enableSorting: false,
    cell: (info) => getCountry(info.getValue()).name,
  }),
  column.accessor((row) => row.salaryUsd.amountMinor, {
    id: "salaryUsd",
    header: labelOf("salaryUsd"),
    sortDescFirst: false, // numbers default to descending first; every column starts ascending
    cell: (info) => {
      const { salary, salaryUsd } = info.row.original;
      return (
        <div className="text-right tabular-nums">
          <div>{salary.formatted}</div>
          {salary.currency !== salaryUsd.currency && (
            <div className="text-xs text-muted-foreground">≈ {salaryUsd.formatted}</div>
          )}
        </div>
      );
    },
  }),
  column.accessor("hireDate", {
    id: "hireDate",
    header: labelOf("hireDate"),
    cell: (info) => <span className="whitespace-nowrap">{formatDate(info.getValue())}</span>,
  }),
]);
