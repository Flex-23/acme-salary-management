import type { Metadata } from "next";
import { Suspense } from "react";
import { EmployeesContent } from "./_components/employees-content";
import { EmployeesSkeleton } from "./_components/employees-skeleton";

export const metadata: Metadata = { title: "Employees" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The shell (title) is static. Reading searchParams and the database is request-time work,
// so it streams in behind a Suspense boundary with a table-shaped skeleton.
export default function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground">Search, filter and maintain salary records.</p>
      </div>
      <Suspense fallback={<EmployeesSkeleton />}>
        <EmployeesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
