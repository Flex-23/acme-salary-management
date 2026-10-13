import type { MoneyDto } from "@/server/services/dto";

/** An amount in the local currency with its USD equivalent underneath (omitted when the local currency is USD). */
export function LocalWithUsd({ local, usd }: { local: MoneyDto; usd: MoneyDto }) {
  return (
    <div className="text-right tabular-nums">
      <div>{local.formatted}</div>
      {local.currency !== usd.currency && <div className="text-xs text-muted-foreground">≈ {usd.formatted}</div>}
    </div>
  );
}

export function Amount({ money }: { money: MoneyDto }) {
  return <div className="text-right tabular-nums">{money.formatted}</div>;
}
