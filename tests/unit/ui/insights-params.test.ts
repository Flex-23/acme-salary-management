import { describe, expect, it } from "vitest";
import { hrefWithParam, resolveDistributionCountry, resolveTitleCountry } from "@/app/insights/_lib/insights-params";

describe("resolveTitleCountry", () => {
  const available = ["DE", "JP", "US"];

  it("uses the requested country when it has employees", () => {
    expect(resolveTitleCountry("JP", available)).toBe("JP");
  });

  it("defaults to the United States", () => {
    expect(resolveTitleCountry(undefined, available)).toBe("US");
  });

  it("falls back to the first available country when the US has no employees", () => {
    expect(resolveTitleCountry(undefined, ["DE", "JP"])).toBe("DE");
  });

  it("ignores unknown, unsupported or empty values instead of failing", () => {
    expect(resolveTitleCountry("XX", available)).toBe("US");
    expect(resolveTitleCountry("jp", available)).toBe("US");
    expect(resolveTitleCountry("", available)).toBe("US");
    expect(resolveTitleCountry("FR", available)).toBe("US"); // supported, but nobody works there
  });

  it("has no country when there are no employees at all", () => {
    expect(resolveTitleCountry("US", [])).toBeUndefined();
  });
});

describe("resolveDistributionCountry", () => {
  it("means 'all countries' unless a supported country is given", () => {
    expect(resolveDistributionCountry(undefined)).toBeUndefined();
    expect(resolveDistributionCountry("")).toBeUndefined();
    expect(resolveDistributionCountry("XX")).toBeUndefined();
    expect(resolveDistributionCountry("DE")).toBe("DE");
  });
});

describe("hrefWithParam", () => {
  it("sets one parameter and keeps the others", () => {
    expect(hrefWithParam("/insights", "titleCountry=DE", "distributionCountry", "JP")).toBe(
      "/insights?titleCountry=DE&distributionCountry=JP",
    );
  });

  it("replaces an existing value", () => {
    expect(hrefWithParam("/insights", "titleCountry=DE", "titleCountry", "JP")).toBe("/insights?titleCountry=JP");
  });

  it("removes the parameter when the value is undefined, and the whole query when nothing is left", () => {
    expect(hrefWithParam("/insights", "titleCountry=DE&distributionCountry=JP", "titleCountry", undefined)).toBe(
      "/insights?distributionCountry=JP",
    );
    expect(hrefWithParam("/insights", "distributionCountry=JP", "distributionCountry", undefined)).toBe("/insights");
  });
});
