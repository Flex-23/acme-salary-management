import { describe, expect, it } from "vitest";
import { getCountry } from "@/server/domain/countries";
import { formatMoney, fromMinor, toMinor, toUsdMinor } from "@/server/domain/money";

describe("toMinor", () => {
  it("converts whole and fractional amounts", () => {
    expect(toMinor(1234.56, 2)).toBe(123456);
    expect(toMinor(50000, 2)).toBe(5000000);
  });

  it("does not drift on classic float traps", () => {
    expect(toMinor(19.99, 2)).toBe(1999);
    expect(toMinor(1.15, 2)).toBe(115);
    expect(toMinor(0.29, 2)).toBe(29);
  });

  it("handles zero-decimal currencies", () => {
    expect(toMinor(6500000, 0)).toBe(6500000);
  });

  it("rejects more decimals than the currency allows", () => {
    expect(() => toMinor(1.005, 2)).toThrow(RangeError);
    expect(() => toMinor(1.5, 0)).toThrow(RangeError);
  });

  it("rejects non-finite and exponent-notation input", () => {
    expect(() => toMinor(Number.NaN, 2)).toThrow(RangeError);
    expect(() => toMinor(Number.POSITIVE_INFINITY, 2)).toThrow(RangeError);
    expect(() => toMinor(1e21, 2)).toThrow(RangeError);
  });
});

describe("fromMinor", () => {
  it("is the inverse of toMinor", () => {
    expect(fromMinor(123456, 2)).toBe(1234.56);
    expect(fromMinor(6500000, 0)).toBe(6500000);
  });

  it("rejects non-integer minor values", () => {
    expect(() => fromMinor(1.5, 2)).toThrow(RangeError);
  });
});

describe("toUsdMinor", () => {
  it("returns the same amount for USD", () => {
    expect(toUsdMinor(1234567, getCountry("US"))).toBe(1234567);
  });

  it("converts using the fixed rate", () => {
    // 100.00 GBP * 1.27 = 127.00 USD
    expect(toUsdMinor(10000, getCountry("GB"))).toBe(12700);
  });

  it("converts zero-decimal currencies into cents", () => {
    // 1,000,000 JPY * 0.0067 = 6,700.00 USD
    expect(toUsdMinor(1_000_000, getCountry("JP"))).toBe(670000);
  });

  it("rounds half to even", () => {
    const rate = (usdPerUnit: string) => ({ ...getCountry("US"), usdPerUnit });
    // 0.5 cent -> 0 (even), 1.5 -> 2, 2.5 -> 2, 3.5 -> 4
    expect(toUsdMinor(1, rate("0.5"))).toBe(0);
    expect(toUsdMinor(3, rate("0.5"))).toBe(2);
    expect(toUsdMinor(5, rate("0.5"))).toBe(2);
    expect(toUsdMinor(7, rate("0.5"))).toBe(4);
  });

  it("converts zero to zero", () => {
    expect(toUsdMinor(0, getCountry("JP"))).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats a USD amount for en-US", () => {
    expect(formatMoney(123456, "USD", "en-US")).toBe("$1,234.56");
  });

  it("formats JPY without decimals", () => {
    expect(formatMoney(6500000, "JPY", "en-US")).toBe("¥6,500,000");
  });
});
