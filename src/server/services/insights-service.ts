import { getCountry, isSupportedCountry } from "../domain/countries";
import { ValidationError } from "../domain/errors";
import type {
  InsightsRepository,
  PayStats,
} from "../repositories/insights-repository";
import { toMoney, type MoneyDto } from "./dto";

export type PayStatsDto = { min: MoneyDto; max: MoneyDto; avg: MoneyDto; median: MoneyDto };

export type SummaryDto = {
  headcount: number;
  totalPayroll: MoneyDto;
  average: MoneyDto | null;
  median: MoneyDto | null;
};

export type CountryInsightDto = {
  countryCode: string;
  countryName: string;
  currency: string;
  headcount: number;
  local: PayStatsDto;
  usd: PayStatsDto;
};

export type JobTitleInsightDto = {
  jobTitle: string;
  headcount: number;
  local: PayStatsDto;
  usd: PayStatsDto;
};

export type DepartmentInsightDto = { department: string; headcount: number; usd: PayStatsDto };

export type DistributionBandDto = { from: MoneyDto; to: MoneyDto; count: number };

const USD = "USD";

function toStatsDto(stats: PayStats, currency: string): PayStatsDto {
  return {
    min: toMoney(stats.min, currency),
    max: toMoney(stats.max, currency),
    avg: toMoney(stats.avg, currency),
    median: toMoney(stats.median, currency),
  };
}

function requireCountry(code: string): string {
  if (!isSupportedCountry(code)) {
    throw new ValidationError("Invalid country", [
      { path: "country", message: "Must be a supported ISO country code, for example US" },
    ]);
  }
  return code;
}

/** Turns repository figures into API-ready DTOs with formatted local and USD values. */
export class InsightsService {
  constructor(private readonly insights: InsightsRepository) {}

  async summary(): Promise<SummaryDto> {
    const summary = await this.insights.summary();
    return {
      headcount: summary.headcount,
      totalPayroll: toMoney(summary.totalPayrollUsdMinor, USD),
      average: summary.avgUsdMinor === null ? null : toMoney(summary.avgUsdMinor, USD),
      median: summary.medianUsdMinor === null ? null : toMoney(summary.medianUsdMinor, USD),
    };
  }

  async byCountry(): Promise<CountryInsightDto[]> {
    const rows = await this.insights.byCountry();
    return rows.map((row) => ({
      countryCode: row.countryCode,
      countryName: row.countryName,
      currency: row.currency,
      headcount: row.headcount,
      local: toStatsDto(row.local, row.currency),
      usd: toStatsDto(row.usd, USD),
    }));
  }

  async byJobTitle(countryCode: string): Promise<JobTitleInsightDto[]> {
    const { currency } = getCountry(requireCountry(countryCode));
    const rows = await this.insights.byJobTitle(countryCode);
    return rows.map((row) => ({
      jobTitle: row.jobTitle,
      headcount: row.headcount,
      local: toStatsDto(row.local, currency),
      usd: toStatsDto(row.usd, USD),
    }));
  }

  async byDepartment(): Promise<DepartmentInsightDto[]> {
    const rows = await this.insights.byDepartment();
    return rows.map((row) => ({
      department: row.department,
      headcount: row.headcount,
      usd: toStatsDto(row.usd, USD),
    }));
  }

  async distribution(countryCode?: string): Promise<DistributionBandDto[]> {
    if (countryCode !== undefined) requireCountry(countryCode);
    const bands = await this.insights.distribution(countryCode);
    return bands.map((band) => ({
      from: toMoney(band.fromUsdMinor, USD),
      to: toMoney(band.toUsdMinor, USD),
      count: band.count,
    }));
  }
}
