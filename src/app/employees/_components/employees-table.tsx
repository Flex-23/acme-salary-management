"use client";

import { functionalUpdate, useTable } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SORT_FIELDS, type SortField } from "@/server/domain/employee";
import type { EmployeeDto } from "@/server/services/dto";
import type { TableParams } from "../_lib/url-state";
import { columns, features } from "./columns";

type Sort = TableParams["sort"];

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

function isSortField(id: string): id is SortField {
  return (SORT_FIELDS as readonly string[]).includes(id);
}

type Props = {
  rows: EmployeeDto[];
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  onEdit: (employee: EmployeeDto) => void;
  onDelete: (employee: EmployeeDto) => void;
  /** Rendered in place of the rows when there are none. */
  emptyState: ReactNode;
};

export function EmployeesTable({ rows, sort, onSortChange, onEdit, onDelete, emptyState }: Props) {
  const sorting = useMemo(() => [{ id: sort.field, desc: sort.direction === "desc" }], [sort.field, sort.direction]);

  const table = useTable({
    features,
    columns,
    data: rows,
    manualSorting: true,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)[0];
      if (next && isSortField(next.id)) onSortChange({ field: next.id, direction: next.desc ? "desc" : "asc" });
    },
  });

  return (
    <div className="rounded-lg border bg-background">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const alignRight = header.column.id === "salaryUsd";
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={header.column.getCanSort() ? (sorted ? ARIA_SORT[sorted] : "none") : undefined}
                    className={alignRight ? "text-right" : undefined}
                  >
                    {header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={alignRight ? "-mr-2.5 ml-auto" : "-ml-2.5"}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                        {sorted === "asc" ? (
                          <ArrowUpIcon aria-hidden />
                        ) : sorted === "desc" ? (
                          <ArrowDownIcon aria-hidden />
                        ) : (
                          <ChevronsUpDownIcon aria-hidden className="text-muted-foreground" />
                        )}
                      </Button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
              <TableHead className="w-20">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length + 1} className="p-0">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${row.original.fullName}`}
                      title="Edit"
                      onClick={() => onEdit(row.original)}
                    >
                      <PencilIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label={`Delete ${row.original.fullName}`}
                      title="Delete"
                      onClick={() => onDelete(row.original)}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
