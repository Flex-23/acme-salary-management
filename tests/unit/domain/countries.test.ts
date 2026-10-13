import { describe, expect, it } from "vitest";
import { COUNTRIES, getCountry, isSupportedCountry } from "@/server/domain/countries";

describe("countries", () => {
  it("supports between 8 and 10 countries", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(8);
    expect(COUNTRIES.length).toBeLessThanOrEqual(10);
  });

  it("has unique ISO alpha-2 codes", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("uses zero decimals for JPY and two for USD", () => {
    expect(getCountry("JP").currencyExponent).toBe(0);
    expect(getCountry("US").currencyExponent).toBe(2);
  });

  it("uses USD at a rate of exactly 1 for the US", () => {
    expect(getCountry("US").usdPerUnit).toBe("1");
  });

  it("recognises supported and unsupported codes", () => {
    expect(isSupportedCountry("DE")).toBe(true);
    expect(isSupportedCountry("XX")).toBe(false);
    expect(isSupportedCountry("de")).toBe(false);
  });
});
