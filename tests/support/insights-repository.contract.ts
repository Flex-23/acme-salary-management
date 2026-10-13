import { beforeEach, describe, expect, it } from "vitest";
import { COUNTRIES, getCountry } from "@/server/domain/countries";
import { histogram, summarize } from "@/server/domain/insights";
import { toUsdMinor } from "@/server/domain/money";
import type { Employee } from "@/server/domain/types";
import {
  DISTRIBUTION_BAND_USD_MINOR,
  DISTRIBUTION_TOP_USD_MINOR,
  type InsightsRepository,
  type PayStats,
} from "@/server/repositories/insights-repository";
import { FIXTURE_EMPLOYEES } from "./fixtures";

export type InsightsRepositoryFactory = (seed: Employee[]) => Promise<InsightsRepository>;

const usd = (e: Employee) => toUsdMinor(e.salaryMinor, getCountry(e.countryCode));
const local = (e: Employee) => e.salaryMinor;

/** Pay stats expressed the way repositories return them: integers in minor units. */
function payStats(values: number[]): PayStats {
  const s = summarize(values)!;
  return { min: s.min, max: s.max, avg: Math.round(s.mean), median: Math.round(s.median) };
}

function groupBy(employees: Employee[], key: (e: Employee) => string): Map<string, Employee[]> {
  const groups = new Map<string, Employee[]>();
  for (const e of employees) groups.set(key(e), [...(groups.get(key(e)) ?? []), e]);
  return groups;
}

/** Behaviour every InsightsRepository implementation (real or fake) must satisfy. */
export function describeInsightsRepository(name: string, createRepository: InsightsRepositoryFactory) {
  describe(`${name} (InsightsRepository contract)`, () => {
    let repo: InsightsRepository;

    beforeEach(async () => {
      repo = await createRepository(FIXTURE_EMPLOYEES);
    });

    describe("summary", () => {
      it("reports headcount, total payroll, average and median in USD", async () => {
        const values = FIXTURE_EMPLOYEES.map(usd);
        const stats = payStats(values);
        expect(await repo.summary()).toEqual({
          headcount: 12,
          totalPayrollUsdMinor: values.reduce((a, b) => a + b, 0),
          avgUsdMinor: stats.avg,
          medianUsdMinor: stats.median,
        });
      });

      it("is empty-safe", async () => {
        const empty = await createRepository([]);
        expect(await empty.summary()).toEqual({
          headcount: 0,
          totalPayrollUsdMinor: 0,
          avgUsdMinor: null,
          medianUsdMinor: null,
        });
      });
    });

    describe("byCountry", () => {
      it("returns local and USD stats for each country that has employees, ordered by name", async () => {
        const groups = groupBy(FIXTURE_EMPLOYEES, (e) => e.countryCode);
        const expected = [...groups.entries()]
          .map(([code, members]) => {
            const country = COUNTRIES.find((c) => c.code === code)!;
            return {
              countryCode: code,
              countryName: country.name,
              currency: country.currency,
              headcount: members.length,
              local: payStats(members.map(local)),
              usd: payStats(members.map(usd)),
            };
          })
          .sort((a, b) => a.countryName.localeCompare(b.countryName));

        const result = await repo.byCountry();
        expect(result).toEqual(expected);
        expect(result.map((r) => r.countryCode)).toEqual(["DE", "JP", "GB", "US"]);
      });

      it("returns an empty list when there are no employees", async () => {
        expect(await (await createRepository([])).byCountry()).toEqual([]);
      });
    });

    describe("byJobTitle", () => {
      it("returns stats per job title within the country, ordered by title", async () => {
        const inUs = FIXTURE_EMPLOYEES.filter((e) => e.countryCode === "US");
        const expected = [...groupBy(inUs, (e) => e.jobTitle).entries()]
          .map(([jobTitle, members]) => ({
            jobTitle,
            headcount: members.length,
            local: payStats(members.map(local)),
            usd: payStats(members.map(usd)),
          }))
          .sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));

        const result = await repo.byJobTitle("US");
        expect(result).toEqual(expected);
        expect(result.map((r) => r.jobTitle)).toEqual(["Product Manager", "Software Engineer"]);
      });

      it("never mixes in other countries", async () => {
        const [sales] = await repo.byJobTitle("JP").then((rows) => rows.filter((r) => r.jobTitle === "Sales Rep"));
        expect(sales).toMatchObject({ headcount: 1, local: { min: 5_000_000, max: 5_000_000 } });
      });

      it("returns an empty list for a country without employees", async () => {
        expect(await repo.byJobTitle("FR")).toEqual([]);
      });
    });

    describe("byDepartment", () => {
      it("returns USD stats per department, ordered by name", async () => {
        const expected = [...groupBy(FIXTURE_EMPLOYEES, (e) => e.department).entries()]
          .map(([department, members]) => ({
            department,
            headcount: members.length,
            usd: payStats(members.map(usd)),
          }))
          .sort((a, b) => a.department.localeCompare(b.department));

        const result = await repo.byDepartment();
        expect(result).toEqual(expected);
        expect(result.map((r) => r.department)).toEqual(["Engineering", "Product", "Sales"]);
      });
    });

    describe("distribution", () => {
      const toBands = (employees: Employee[]) =>
        histogram(employees.map(usd), DISTRIBUTION_BAND_USD_MINOR, DISTRIBUTION_TOP_USD_MINOR).map((band) => ({
          fromUsdMinor: band.from,
          toUsdMinor: band.to,
          count: band.count,
        }));

      it("buckets USD salaries into fixed bands, including empty bands in between", async () => {
        const result = await repo.distribution();
        expect(result).toEqual(toBands(FIXTURE_EMPLOYEES));
        expect(result.reduce((sum, b) => sum + b.count, 0)).toBe(12);
      });

      it("fills the gaps between populated bands with empty ones", async () => {
        const [first, second] = FIXTURE_EMPLOYEES.filter((e) => e.countryCode === "US");
        const sparse = [
          { ...first!, salaryMinor: 5_000_000 },
          { ...second!, salaryMinor: 13_000_000 },
        ];
        const result = await (await createRepository(sparse)).distribution();
        expect(result.map((b) => b.count)).toEqual([1, 0, 0, 0, 1]);
        expect(result[1]).toEqual({ fromUsdMinor: 6_000_000, toUsdMinor: 8_000_000, count: 0 });
      });

      it("puts salaries from 300,000 USD up into one open-ended band, so an outlier adds no empty bars", async () => {
        const [first, second] = FIXTURE_EMPLOYEES.filter((e) => e.countryCode === "US");
        const withOutlier = [
          { ...first!, salaryMinor: 5_000_000 },
          { ...second!, salaryMinor: 500_000_000 }, // 5,000,000 USD
        ];
        const result = await (await createRepository(withOutlier)).distribution();
        expect(result).toHaveLength(14); // 40k-60k up to the open-ended band: not hundreds
        expect(result[0]).toEqual({ fromUsdMinor: 4_000_000, toUsdMinor: 6_000_000, count: 1 });
        expect(result[result.length - 2]).toMatchObject({ fromUsdMinor: 28_000_000, toUsdMinor: 30_000_000, count: 0 });
        expect(result[result.length - 1]).toEqual({ fromUsdMinor: 30_000_000, toUsdMinor: null, count: 1 });
      });

      it("has no open-ended band when nobody earns 300,000 USD or more", async () => {
        const result = await repo.distribution();
        expect(result.every((band) => band.toUsdMinor !== null)).toBe(true);
      });

      it("can be limited to one country", async () => {
        const japan = FIXTURE_EMPLOYEES.filter((e) => e.countryCode === "JP");
        expect(await repo.distribution("JP")).toEqual(toBands(japan));
      });

      it("returns no bands when nobody matches", async () => {
        expect(await repo.distribution("FR")).toEqual([]);
      });
    });
  });
}
