import type { Country } from "./countries";

const USD_EXPONENT = 2;

/** Converts a major-unit amount (e.g. 19.99) to integer minor units without float drift. */
export function toMinor(major: number, exponent: number): number {
  if (!Number.isFinite(major)) throw new RangeError("Amount must be a finite number");
  const text = major.toString();
  if (/e/i.test(text)) throw new RangeError(`Amount out of range: ${text}`);

  const [whole = "", fraction = ""] = text.split(".");
  if (fraction.length > exponent) {
    throw new RangeError(`Amount has more than ${exponent} decimal places: ${text}`);
  }
  return Number(whole + fraction.padEnd(exponent, "0"));
}

export function fromMinor(minor: number, exponent: number): number {
  if (!Number.isInteger(minor)) throw new RangeError("Minor amount must be an integer");
  return minor / 10 ** exponent;
}

/** Converts local minor units to USD cents using the country's fixed rate, rounding half to even. */
export function toUsdMinor(minor: number, country: Pick<Country, "currencyExponent" | "usdPerUnit">): number {
  const [whole = "0", fraction = ""] = country.usdPerUnit.split(".");
  const rate = BigInt(whole + fraction);
  const numerator = BigInt(minor) * rate * 10n ** BigInt(USD_EXPONENT);
  const denominator = 10n ** BigInt(country.currencyExponent + fraction.length);
  return Number(divideHalfEven(numerator, denominator));
}

function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const doubled = remainder * 2n;
  if (doubled > denominator) return quotient + 1n;
  if (doubled < denominator) return quotient;
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(fromMinor(minor, exponent));
}
