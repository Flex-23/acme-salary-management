/** All money values are integers in minor units (rounded half away from zero in SQL). */
export type PayStats = { min: number; max: number; avg: number; median: number };

export type Summary = {
  headcount: number;
  totalPayrollUsdMinor: number;
  avgUsdMinor: number | null;
  medianUsdMinor: number | null;
};

export type CountryInsight = {
  countryCode: string;
  countryName: string;
  currency: string;
  headcount: number;
  local: PayStats;
  usd: PayStats;
};

export type JobTitleInsight = {
  jobTitle: string;
  headcount: number;
  local: PayStats;
  usd: PayStats;
};

/** Departments span countries, so only USD-normalised pay is meaningful. */
export type DepartmentInsight = {
  department: string;
  headcount: number;
  usd: PayStats;
};

export type DistributionBand = { fromUsdMinor: number; toUsdMinor: number; count: number };

/** Width of each distribution band: 20,000 USD. */
export const DISTRIBUTION_BAND_USD_MINOR = 2_000_000;

export interface InsightsRepository {
  summary(): Promise<Summary>;
  byCountry(): Promise<CountryInsight[]>;
  byJobTitle(countryCode: string): Promise<JobTitleInsight[]>;
  byDepartment(): Promise<DepartmentInsight[]>;
  distribution(countryCode?: string): Promise<DistributionBand[]>;
}
