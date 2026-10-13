"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FilterOptions } from "@/server/repositories/employee-repository";
import type { EmployeeDto } from "@/server/services/dto";
import type { EmployeePage } from "@/server/services/employee-service";
import { hasActiveFilters, type TableParams } from "../_lib/url-state";
import { useTableNavigation } from "../_lib/use-table-navigation";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { EmployeesTable } from "./employees-table";
import { TablePagination } from "./table-pagination";
import { TableToolbar } from "./table-toolbar";

type Props = {
  rows: EmployeeDto[];
  page: EmployeePage["page"];
  params: TableParams;
  filterOptions: FilterOptions;
  /** The URL contained values that could not be used, so the defaults are shown. */
  ignoredInvalidParams: boolean;
};

export function EmployeesView({ rows, page, params, filterOptions, ignoredInvalidParams }: Props) {
  const navigation = useTableNavigation(params);
  // `employee` stays set while the dialog animates closed, so the form never flashes into "create" mode.
  const [form, setForm] = useState<{ open: boolean; employee: EmployeeDto | null }>({ open: false, employee: null });

  const emptyState = hasActiveFilters(params) ? (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <p className="font-medium">No employees match your search</p>
      <p className="text-sm text-muted-foreground">Try a different name or remove some filters.</p>
      <Button variant="outline" onClick={navigation.clear}>
        Clear filters
      </Button>
    </div>
  ) : (
    <p className="p-10 text-center text-sm text-muted-foreground">There are no employees yet.</p>
  );

  return (
    <div className="space-y-4">
      {ignoredInvalidParams && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Some options in the address were not valid and were ignored.
        </p>
      )}
      <TableToolbar
        params={params}
        filterOptions={filterOptions}
        onChange={(patch, options) => navigation.update(patch, options)}
        onClear={navigation.clear}
        actions={<Button onClick={() => setForm({ open: true, employee: null })}>Add employee</Button>}
      />
      <div aria-busy={navigation.isPending} className={cn("space-y-4 transition-opacity", navigation.isPending && "opacity-60")}>
        <EmployeesTable
          rows={rows}
          sort={params.sort}
          onSortChange={(sort) => navigation.update({ sort })}
          onEdit={(employee) => setForm({ open: true, employee })}
          onDelete={() => undefined}
          emptyState={emptyState}
        />
        <TablePagination
          page={page}
          onPageChange={(next) => navigation.update({ page: next })}
          onPageSizeChange={(pageSize) => navigation.update({ pageSize })}
        />
      </div>
      <EmployeeFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        employee={form.employee}
        filterOptions={filterOptions}
        onSaved={navigation.refresh}
      />
    </div>
  );
}
