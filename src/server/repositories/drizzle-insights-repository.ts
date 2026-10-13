import "server-only";
import { asc, eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "../db/database";
import { countries, employees } from "../db/schema";
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
} from "./insights-repository";

const TOP_BAND_INDEX = DISTRIBUTION_TOP_USD_MINOR / DISTRIBUTION_BAND_USD_MINOR;

/** Salary in USD minor units, unrounded: salary_minor / 10^exponent * rate * 100. */
const usdExpr = sql`(${employees.salaryMinor}::numeric * ${countries.usdPerUnit} * 100
  / power(10::numeric, ${countries.currencyExponent}::numeric))`;
const localExpr = sql`${employees.salaryMinor}::numeric`;

const asNumber = (expr: SQL) => sql<number>`${expr}`.mapWith(Number);
const asNullableNumber = (expr: SQL) => sql<number | null>`${expr}`.mapWith(Number);

/** Rounding happens on numeric (half away from zero), never on double precision. */
const rounded = (expr: SQL) => asNumber(sql`round((${expr})::numeric)`);
// percentile_cont works on double precision: exact for salaries up to 2^53 minor units.
const median = (value: SQL) => sql`percentile_cont(0.5) within group (order by (${value})::double precision)`;

function statsColumns(value: SQL) {
  return {
    min: rounded(sql`min(${value})`),
    max: rounded(sql`max(${value})`),
    avg: rounded(sql`avg(${value})`),
    median: rounded(median(value)),
  };
}

const headcount = asNumber(sql`count(*)`);

function toPayStats({ min, max, avg, median }: PayStats): PayStats {
  return { min, max, avg, median };
}

export class DrizzleInsightsRepository implements InsightsRepository {
  constructor(private readonly db: Database) {}

  async summary(): Promise<Summary> {
    const [row] = await this.db
      .select({
        headcount,
        total: asNumber(sql`coalesce(round(sum(${usdExpr})), 0)`),
        avg: asNullableNumber(sql`round(avg(${usdExpr}))`),
        median: asNullableNumber(sql`round((${median(usdExpr)})::numeric)`),
      })
      .from(employees)
      .innerJoin(countries, eq(employees.countryCode, countries.code));
    return {
      headcount: row?.headcount ?? 0,
      totalPayrollUsdMinor: row?.total ?? 0,
      avgUsdMinor: row?.avg ?? null,
      medianUsdMinor: row?.median ?? null,
    };
  }

  async byCountry(): Promise<CountryInsight[]> {
    const local = statsColumns(localExpr);
    const usd = statsColumns(usdExpr);
    const rows = await this.db
      .select({
        countryCode: countries.code,
        countryName: countries.name,
        currency: countries.currency,
        headcount,
        localMin: local.min,
        localMax: local.max,
        localAvg: local.avg,
        localMedian: local.median,
        usdMin: usd.min,
        usdMax: usd.max,
        usdAvg: usd.avg,
        usdMedian: usd.median,
      })
      .from(employees)
      .innerJoin(countries, eq(employees.countryCode, countries.code))
      .groupBy(countries.code, countries.name, countries.currency)
      .orderBy(asc(countries.name));

    return rows.map((r) => ({
      countryCode: r.countryCode,
      countryName: r.countryName,
      currency: r.currency,
      headcount: r.headcount,
      local: toPayStats({ min: r.localMin, max: r.localMax, avg: r.localAvg, median: r.localMedian }),
      usd: toPayStats({ min: r.usdMin, max: r.usdMax, avg: r.usdAvg, median: r.usdMedian }),
    }));
  }

  async byJobTitle(countryCode: string): Promise<JobTitleInsight[]> {
    const local = statsColumns(localExpr);
    const usd = statsColumns(usdExpr);
    const rows = await this.db
      .select({
        jobTitle: employees.jobTitle,
        headcount,
        localMin: local.min,
        localMax: local.max,
        localAvg: local.avg,
        localMedian: local.median,
        usdMin: usd.min,
        usdMax: usd.max,
        usdAvg: usd.avg,
        usdMedian: usd.median,
      })
      .from(employees)
      .innerJoin(countries, eq(employees.countryCode, countries.code))
      .where(eq(employees.countryCode, countryCode))
      .groupBy(employees.jobTitle)
      .orderBy(asc(employees.jobTitle));

    return rows.map((r) => ({
      jobTitle: r.jobTitle,
      headcount: r.headcount,
      local: toPayStats({ min: r.localMin, max: r.localMax, avg: r.localAvg, median: r.localMedian }),
      usd: toPayStats({ min: r.usdMin, max: r.usdMax, avg: r.usdAvg, median: r.usdMedian }),
    }));
  }

  async byDepartment(): Promise<DepartmentInsight[]> {
    const usd = statsColumns(usdExpr);
    const rows = await this.db
      .select({ department: employees.department, headcount, ...usd })
      .from(employees)
      .innerJoin(countries, eq(employees.countryCode, countries.code))
      .groupBy(employees.department)
      .orderBy(asc(employees.department));

    return rows.map(({ department, headcount: count, ...stats }) => ({
      department,
      headcount: count,
      usd: toPayStats(stats),
    }));
  }

  async distribution(countryCode?: string): Promise<DistributionBand[]> {
    // The width and top index are code constants, inlined so SELECT and GROUP BY share one expression.
    // Everything from the top salary up lands in the last band index, which is rendered open-ended.
    const width = sql.raw(String(DISTRIBUTION_BAND_USD_MINOR));
    const topIndex = sql.raw(String(TOP_BAND_INDEX));
    const band = sql`least(floor(${usdExpr} / ${width}), ${topIndex})`;
    const rows = await this.db
      .select({ band: asNumber(band), count: headcount })
      .from(employees)
      .innerJoin(countries, eq(employees.countryCode, countries.code))
      .where(countryCode ? eq(employees.countryCode, countryCode) : undefined)
      .groupBy(band)
      .orderBy(asc(band));

    return fillEmptyBands(rows);
  }
}

function fillEmptyBands(rows: { band: number; count: number }[]): DistributionBand[] {
  const first = rows[0]?.band;
  const last = rows[rows.length - 1]?.band;
  if (first === undefined || last === undefined) return [];

  const counts = new Map(rows.map((r) => [r.band, r.count]));
  const bands: DistributionBand[] = [];
  for (let index = first; index <= last; index++) {
    bands.push({
      fromUsdMinor: index * DISTRIBUTION_BAND_USD_MINOR,
      toUsdMinor: index === TOP_BAND_INDEX ? null : (index + 1) * DISTRIBUTION_BAND_USD_MINOR,
      count: counts.get(index) ?? 0,
    });
  }
  return bands;
}
