import type { Metadata } from "next";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
      <p className="text-sm text-muted-foreground">Pay statistics by country, job title and department are coming next.</p>
    </div>
  );
}
