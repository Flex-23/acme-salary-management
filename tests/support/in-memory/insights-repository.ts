import { COUNTRIES, getCountry } from "@/server/domain/countries";
import { histogram, median, summarize } from "@/server/domain/insights";
import { toUsdMinor } from "@/server/domain/money";
import type { Employee } from "@/server/domain/types";
import {
  DISTRIBUTION_BAND_USD_MINOR,
  DISTRIBUTION_TOP_USD_MINOR,
  type CountryInsight,
  type DepartmentInsight,
  type DistributionBand,
  type InsightsRepository,
  type JobTitleInsight,
  type PayStats,
  type Summary,
} from "@/server/repositories/insights-repository";
import type { InMemoryStore } from "./store";

const usd = (e: Employee) => toUsdMinor(e.salaryMinor, getCountry(e.countryCode));
const local = (e: Employee) => e.salaryMinor;
const byText = (a: string, b: string) => a.localeCompare(b);

function payStats(values: number[]): PayStats {
  const s = summarize(values)!;
  return { min: s.min, max: s.max, avg: Math.round(s.mean), median: Math.round(s.median) };
}

function groupBy(employees: Employee[], key: (e: Employee) => string): [string, Employee[]][] {
  const groups = new Map<string, Employee[]>();
  for (const e of employees) groups.set(key(e), [...(groups.get(key(e)) ?? []), e]);
  return [...groups.entries()];
}

export class InMemoryInsightsRepository implements InsightsRepository {
  constructor(private readonly store: InMemoryStore) {}

  async summary(): Promise<Summary> {
    const values = this.store.employees.map(usd);
    const stats = summarize(values);
    return {
      headcount: values.length,
      totalPayrollUsdMinor: values.reduce((sum, v) => sum + v, 0),
      avgUsdMinor: stats ? Math.round(stats.mean) : null,
      medianUsdMinor: stats ? Math.round(median(values)!) : null,
    };
  }

  async byCountry(): Promise<CountryInsight[]> {
    return groupBy(this.store.employees, (e) => e.countryCode)
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
      .sort((a, b) => byText(a.countryName, b.countryName));
  }

  async byJobTitle(countryCode: string): Promise<JobTitleInsight[]> {
    const inCountry = this.store.employees.filter((e) => e.countryCode === countryCode);
    return groupBy(inCountry, (e) => e.jobTitle)
      .map(([jobTitle, members]) => ({
        jobTitle,
        headcount: members.length,
        local: payStats(members.map(local)),
        usd: payStats(members.map(usd)),
      }))
      .sort((a, b) => byText(a.jobTitle, b.jobTitle));
  }

  async byDepartment(): Promise<DepartmentInsight[]> {
    return groupBy(this.store.employees, (e) => e.department)
      .map(([department, members]) => ({
        department,
        headcount: members.length,
        usd: payStats(members.map(usd)),
      }))
      .sort((a, b) => byText(a.department, b.department));
  }

  async distribution(countryCode?: string): Promise<DistributionBand[]> {
    const employees = countryCode
      ? this.store.employees.filter((e) => e.countryCode === countryCode)
      : this.store.employees;
    return histogram(employees.map(usd), DISTRIBUTION_BAND_USD_MINOR, DISTRIBUTION_TOP_USD_MINOR).map((band) => ({
      fromUsdMinor: band.from,
      toUsdMinor: band.to,
      count: band.count,
    }));
  }
}
