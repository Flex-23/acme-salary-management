import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COLUMN_DEFS, columnClass } from "./column-labels";

const ROWS = 10;

/** Same columns as the real table, so nothing jumps when the data arrives. */
export function EmployeesSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading employees">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMN_DEFS.map(({ id, label }) => (
                <TableHead key={id} className={columnClass(id)}>
                  {label}
                </TableHead>
              ))}
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: ROWS }, (_, row) => (
              <TableRow key={row}>
                {COLUMN_DEFS.map(({ id }) => (
                  <TableCell key={id} className={columnClass(id)}>
                    <Skeleton className="h-4 w-full max-w-36" />
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
