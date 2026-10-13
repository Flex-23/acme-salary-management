import { describe, expect, it } from "vitest";
import type { DistributionBandDto, PayStatsDto } from "@/server/services/insights-service";
import { toMoney } from "@/server/services/dto";
import { bandLabel, comparisonData, compactUsd, distributionData } from "@/app/insights/_lib/insights-format";

const usd = (dollars: number) => toMoney(Math.round(dollars * 100), "USD");

describe("compactUsd", () => {
  it("abbreviates thousands and millions", () => {
    expect(compactUsd(95_000_00)).toBe("$95k");
    expect(compactUsd(12_500_00)).toBe("$12.5k");
    expect(compactUsd(300_000_00)).toBe("$300k");
    expect(compactUsd(1_200_000_00)).toBe("$1.2M");
    expect(compactUsd(2_000_000_00)).toBe("$2M");
  });

  it("keeps small amounts exact", () => {
    expect(compactUsd(0)).toBe("$0");
    expect(compactUsd(950_00)).toBe("$950");
  });
});

describe("bandLabel", () => {
  it("shows a closed band as a range", () => {
    expect(bandLabel(40_000_00, 60_000_00)).toBe("$40k–$60k");
  });

  it("shows the open-ended band with a plus", () => {
    expect(bandLabel(300_000_00, null)).toBe("$300k+");
  });
});

describe("comparisonData", () => {
  const stats = (median: number, average: number): PayStatsDto => ({
    min: usd(1),
    max: usd(2),
    avg: usd(average),
    median: usd(median),
  });

  it("turns rows into chart points in whole dollars, highest median first, keeping exact labels", () => {
    const points = comparisonData([
      { label: "Sales", headcount: 3, usd: stats(60_000, 62_500.5) },
      { label: "Engineering", headcount: 5, usd: stats(110_000, 112_345.67) },
    ]);
    expect(points).toEqual([
      {
        name: "Engineering",
        headcount: 5,
        median: 110_000,
        average: 112_345.67,
        medianLabel: "$110,000.00",
        averageLabel: "$112,345.67",
      },
      { name: "Sales", headcount: 3, median: 60_000, average: 62_500.5, medianLabel: "$60,000.00", averageLabel: "$62,500.50" },
    ]);
  });

  it("returns nothing for no rows", () => {
    expect(comparisonData([])).toEqual([]);
  });
});

describe("distributionData", () => {
  const bands: DistributionBandDto[] = [
    { from: usd(0), to: usd(20_000), count: 614 },
    { from: usd(20_000), to: usd(40_000), count: 0 },
    { from: usd(300_000), to: null, count: 2 },
  ];

  it("labels each bar with its lower edge and describes the exact range", () => {
    expect(distributionData(bands)).toEqual([
      { label: "$0", range: "$0.00 – $20,000.00", count: 614 },
      { label: "$20k", range: "$20,000.00 – $40,000.00", count: 0 },
      { label: "$300k+", range: "$300,000.00 and above", count: 2 },
    ]);
  });
});
