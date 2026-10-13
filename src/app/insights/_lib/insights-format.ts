import type { DistributionBandDto, PayStatsDto } from "@/server/services/insights-service";

const trim = (value: number) => String(Number(value.toFixed(1)));

/** 9_500_000 (cents) -> "$95k"; 120_000_000 -> "$1.2M". For axis ticks and band labels, not for exact figures. */
export function compactUsd(minor: number): string {
  const dollars = minor / 100;
  if (dollars >= 1_000_000) return `$${trim(dollars / 1_000_000)}M`;
  if (dollars >= 1_000) return `$${trim(dollars / 1_000)}k`;
  return `$${trim(dollars)}`;
}

export function bandLabel(fromMinor: number, toMinor: number | null): string {
  return toMinor === null ? `${compactUsd(fromMinor)}+` : `${compactUsd(fromMinor)}–${compactUsd(toMinor)}`;
}

export type ComparisonPoint = {
  name: string;
  headcount: number;
  /** Whole dollars, for the chart's scale. */
  median: number;
  average: number;
  /** Exact formatted amounts, for tooltips and screen readers. */
  medianLabel: string;
  averageLabel: string;
};

/** Chart points for "median vs average pay per group", highest median first. */
export function comparisonData(rows: { label: string; headcount: number; usd: PayStatsDto }[]): ComparisonPoint[] {
  return rows
    .map(({ label, headcount, usd }) => ({
      name: label,
      headcount,
      median: usd.median.amountMinor / 100,
      average: usd.avg.amountMinor / 100,
      medianLabel: usd.median.formatted,
      averageLabel: usd.avg.formatted,
    }))
    .sort((a, b) => b.median - a.median);
}

export type DistributionPoint = { label: string; range: string; count: number };

export function distributionData(bands: DistributionBandDto[]): DistributionPoint[] {
  return bands.map(({ from, to, count }) => ({
    label: to === null ? bandLabel(from.amountMinor, null) : compactUsd(from.amountMinor),
    range: to === null ? `${from.formatted} and above` : `${from.formatted} – ${to.formatted}`,
    count,
  }));
}
