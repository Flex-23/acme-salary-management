import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Services } from "@/server/container";
import { createFakeServices, get } from "../../support/api-harness";

const harness = vi.hoisted(() => ({ services: undefined as Services | undefined }));
vi.mock("@/server/container", () => ({ getServices: () => harness.services }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }));

import { GET as byCountry } from "@/app/api/insights/by-country/route";
import { GET as byDepartment } from "@/app/api/insights/by-department/route";
import { GET as byJobTitle } from "@/app/api/insights/by-job-title/route";
import { GET as distribution } from "@/app/api/insights/distribution/route";
import { GET as summary } from "@/app/api/insights/summary/route";
import { GET as filters } from "@/app/api/meta/filters/route";

beforeEach(() => {
  harness.services = createFakeServices();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/insights/summary", () => {
  it("returns headcount and USD pay figures", async () => {
    const response = await summary();
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.headcount).toBe(12);
    expect(data.totalPayroll).toEqual({ amountMinor: 112_900_000, currency: "USD", formatted: "$1,129,000.00" });
  });

  it("is cached with the insights tag and an explicit lifetime, and never invalidates", async () => {
    await summary();
    expect(cacheTag).toHaveBeenCalledWith("insights");
    expect(cacheLife).toHaveBeenCalledWith("minutes");
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("GET /api/insights/by-country", () => {
  it("returns local and USD statistics per country", async () => {
    const { data } = await (await byCountry()).json();
    expect(data.map((c: { countryCode: string }) => c.countryCode)).toEqual(["DE", "JP", "GB", "US"]);
    expect(data[1]).toMatchObject({
      currency: "JPY",
      headcount: 2,
      local: { max: { currency: "JPY", amountMinor: 7_000_000 } },
      usd: { max: { currency: "USD", amountMinor: 4_690_000 } },
    });
  });
});

describe("GET /api/insights/by-job-title", () => {
  it("returns statistics per job title within a country", async () => {
    const response = await byJobTitle(get("/api/insights/by-job-title?country=US"));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.map((t: { jobTitle: string }) => t.jobTitle)).toEqual(["Product Manager", "Software Engineer"]);
  });

  it("requires the country parameter", async () => {
    const response = await byJobTitle(get("/api/insights/by-job-title"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details[0].path).toBe("country");
  });

  it("rejects an unsupported country", async () => {
    expect((await byJobTitle(get("/api/insights/by-job-title?country=XX"))).status).toBe(400);
  });
});

describe("GET /api/insights/by-department", () => {
  it("returns USD statistics per department", async () => {
    const { data } = await (await byDepartment()).json();
    expect(data.map((d: { department: string }) => d.department)).toEqual(["Engineering", "Product", "Sales"]);
  });
});

describe("GET /api/insights/distribution", () => {
  it("returns salary bands for the whole organisation", async () => {
    const { data } = await (await distribution(get("/api/insights/distribution"))).json();
    expect(data.reduce((sum: number, band: { count: number }) => sum + band.count, 0)).toBe(12);
  });

  it("can be limited to one country, and an empty country means all", async () => {
    const japan = await (await distribution(get("/api/insights/distribution?country=JP"))).json();
    expect(japan.data.reduce((sum: number, band: { count: number }) => sum + band.count, 0)).toBe(2);
    const all = await (await distribution(get("/api/insights/distribution?country="))).json();
    expect(all.data.reduce((sum: number, band: { count: number }) => sum + band.count, 0)).toBe(12);
  });

  it("rejects an unsupported country", async () => {
    expect((await distribution(get("/api/insights/distribution?country=ZZ"))).status).toBe(400);
  });
});

describe("GET /api/meta/filters", () => {
  it("returns the distinct countries, departments and job titles", async () => {
    const response = await filters();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      countries: ["DE", "GB", "JP", "US"],
      departments: ["Engineering", "Product", "Sales"],
      jobTitles: ["Product Manager", "Sales Rep", "Software Engineer"],
    });
    expect(cacheTag).toHaveBeenCalledWith("insights");
  });
});
