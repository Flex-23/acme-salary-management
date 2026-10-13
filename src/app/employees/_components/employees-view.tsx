"use client";

import { cn } from "@/lib/utils";
import type { EmployeeDto } from "@/server/services/dto";
import type { EmployeePage } from "@/server/services/employee-service";
import type { FilterOptions } from "@/server/repositories/employee-repository";
import { useTableNavigation } from "../_lib/use-table-navigation";
import type { TableParams } from "../_lib/url-state";
import { EmployeesTable } from "./employees-table";
import { TablePagination } from "./table-pagination";

type Props = {
  rows: EmployeeDto[];
  page: EmployeePage["page"];
  params: TableParams;
  filterOptions: FilterOptions;
  /** The URL contained values that could not be used, so the defaults are shown. */
  ignoredInvalidParams: boolean;
};

export function EmployeesView({ rows, page, params, ignoredInvalidParams }: Props) {
  const navigation = useTableNavigation(params);

  return (
    <div className="space-y-4">
      {ignoredInvalidParams && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Some options in the address were not valid and were ignored.
        </p>
      )}
      <div aria-busy={navigation.isPending} className={cn("space-y-4 transition-opacity", navigation.isPending && "opacity-60")}>
        <EmployeesTable
          rows={rows}
          sort={params.sort}
          onSortChange={(sort) => navigation.update({ sort })}
          onEdit={() => undefined}
          onDelete={() => undefined}
          emptyState={<p className="p-8 text-center text-sm text-muted-foreground">No employees to show.</p>}
        />
        <TablePagination
          page={page}
          onPageChange={(next) => navigation.update({ page: next })}
          onPageSizeChange={(pageSize) => navigation.update({ pageSize })}
        />
      </div>
    </div>
  );
}
