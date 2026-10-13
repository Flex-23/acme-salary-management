import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/server/domain/errors";
import { InsightsService } from "@/server/services/insights-service";
import { FIXTURE_EMPLOYEES } from "../../support/fixtures";
import { InMemoryInsightsRepository } from "../../support/in-memory/insights-repository";
import { InMemoryStore } from "../../support/in-memory/store";

const catchError = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: unknown) => error);

describe("InsightsService", () => {
  let service: InsightsService;

  beforeEach(() => {
    service = new InsightsService(new InMemoryInsightsRepository(new InMemoryStore(FIXTURE_EMPLOYEES)));
  });

  it("summarises headcount and USD pay with formatted values", async () => {
    const summary = await service.summary();
    expect(summary.headcount).toBe(12);
    expect(summary.totalPayroll).toMatchObject({ currency: "USD", amountMinor: 112_900_000 });
    expect(summary.totalPayroll.formatted).toBe("$1,129,000.00");
    expect(summary.average?.currency).toBe("USD");
    expect(summary.median?.currency).toBe("USD");
  });

  it("reports empty-safe averages as null", async () => {
    const empty = new InsightsService(new InMemoryInsightsRepository(new InMemoryStore([])));
    expect(await empty.summary()).toEqual({ headcount: 0, totalPayroll: expect.objectContaining({ amountMinor: 0 }), average: null, median: null });
  });

  it("returns per-country stats in both local currency and USD", async () => {
    const countries = await service.byCountry();
    const japan = countries.find((c) => c.countryCode === "JP");
    expect(japan).toMatchObject({
      countryName: "Japan",
      currency: "JPY",
      headcount: 2,
      local: { min: { amountMinor: 5_000_000, currency: "JPY", formatted: "¥5,000,000" } },
      usd: { min: { amountMinor: 3_350_000, currency: "USD", formatted: "$33,500.00" } },
    });
  });

  it("returns per-job-title stats for a country, in that country's currency", async () => {
    const titles = await service.byJobTitle("GB");
    expect(titles.map((t) => t.jobTitle)).toEqual(["Sales Rep", "Software Engineer"]);
    expect(titles[1]?.local.max).toMatchObject({ amountMinor: 9_000_000, currency: "GBP" });
  });

  it("requires a supported country for job-title stats", async () => {
    for (const country of ["", "XX", "us"]) {
      const error = await catchError(service.byJobTitle(country));
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details[0]?.path).toBe("country");
    }
  });

  it("returns per-department stats in USD only", async () => {
    const departments = await service.byDepartment();
    expect(departments.map((d) => d.department)).toEqual(["Engineering", "Product", "Sales"]);
    expect(departments[0]?.usd.avg.currency).toBe("USD");
  });

  it("returns the distribution with formatted band edges", async () => {
    const bands = await service.distribution();
    expect(bands.reduce((sum, b) => sum + b.count, 0)).toBe(12);
    expect(bands[0]?.from).toMatchObject({ currency: "USD" });
    expect(bands[0]?.to?.amountMinor).toBeGreaterThan(bands[0]!.from.amountMinor);
  });

  it("describes the open-ended top band with a null upper edge", async () => {
    const [first] = FIXTURE_EMPLOYEES;
    const outlier = [{ ...first!, countryCode: "US", salaryMinor: 500_000_000 }];
    const service = new InsightsService(new InMemoryInsightsRepository(new InMemoryStore(outlier)));
    const bands = await service.distribution();
    expect(bands).toEqual([
      { from: { amountMinor: 30_000_000, currency: "USD", formatted: "$300,000.00" }, to: null, count: 1 },
    ]);
  });

  it("limits the distribution to one country and validates it", async () => {
    const bands = await service.distribution("JP");
    expect(bands.reduce((sum, b) => sum + b.count, 0)).toBe(2);
    expect(await catchError(service.distribution("XX"))).toBeInstanceOf(ValidationError);
  });
});
