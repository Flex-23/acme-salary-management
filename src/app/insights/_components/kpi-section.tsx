import { connection } from "next/server";
import { cachedSummary } from "@/app/api/_lib/cache";
import type { MoneyDto } from "@/server/services/dto";

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

const show = (money: MoneyDto | null) => money?.formatted ?? "–";

export async function KpiSection() {
  await connection();
  const summary = await cachedSummary();

  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
      <Kpi label="Employees" value={summary.headcount.toLocaleString("en-US")} />
      <Kpi label="Total annual payroll" value={show(summary.totalPayroll)} note="Gross, in USD" />
      <Kpi label="Average salary" value={show(summary.average)} note="Per employee, in USD" />
      <Kpi label="Median salary" value={show(summary.median)} note="Half earn more, half less" />
    </dl>
  );
}
