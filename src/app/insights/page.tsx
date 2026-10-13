import type { Metadata } from "next";
import { Suspense } from "react";
import { FX_RATES_AS_OF } from "@/server/domain/countries";
import { KpiSection } from "./_components/kpi-section";
import { KpiSkeleton } from "./_components/skeletons";

export const metadata: Metadata = { title: "Insights" };

// The shell is static. Each section below reads the (cached) insight data at request time,
// so each one streams in behind its own Suspense boundary with a matching skeleton.
export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">How does the organisation pay people?</p>
        <p className="text-xs text-muted-foreground">USD figures use fixed reference rates as of {FX_RATES_AS_OF}.</p>
      </div>
      <Suspense fallback={<KpiSkeleton />}>
        <KpiSection />
      </Suspense>
    </div>
  );
}
