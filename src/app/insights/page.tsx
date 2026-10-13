import type { Metadata } from "next";
import { Suspense } from "react";
import { FX_RATES_AS_OF } from "@/server/domain/countries";
import { CountrySection } from "./_components/country-section";
import { DepartmentSection } from "./_components/department-section";
import { KpiSection } from "./_components/kpi-section";
import { InsightSection } from "./_components/section";
import { KpiSkeleton, SectionBodySkeleton } from "./_components/skeletons";

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

      <InsightSection id="by-country" title="Pay by country" question="Where do we pay the most?">
        <Suspense fallback={<SectionBodySkeleton label="pay by country" chartHeight={620} rows={10} />}>
          <CountrySection />
        </Suspense>
      </InsightSection>

      <InsightSection id="by-department" title="Pay by department" question="Which departments cost the most per person?">
        <Suspense fallback={<SectionBodySkeleton label="pay by department" chartHeight={620} rows={10} />}>
          <DepartmentSection />
        </Suspense>
      </InsightSection>
    </div>
  );
}
