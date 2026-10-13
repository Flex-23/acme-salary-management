import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the four KPI cards. */
export function KpiSkeleton() {
  return (
    <div role="status" aria-label="Loading key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-lg border bg-background p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a section body: an optional chart followed by table rows. */
export function SectionBodySkeleton({ label, chartHeight = 0, rows = 6 }: { label: string; chartHeight?: number; rows?: number }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} className="space-y-4">
      {chartHeight > 0 && <Skeleton style={{ height: chartHeight }} className="w-full" />}
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
