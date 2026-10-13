export type Country = {
  code: string;
  name: string;
  currency: string;
  currencyExponent: number;
  /** Fixed reference rate as a decimal string, to avoid float drift (illustrative, 2026-01-01). */
  usdPerUnit: string;
};

export const FX_RATES_AS_OF = "2026-01-01";

export const COUNTRIES: readonly Country[] = [
  { code: "US", name: "United States", currency: "USD", currencyExponent: 2, usdPerUnit: "1" },
  { code: "GB", name: "United Kingdom", currency: "GBP", currencyExponent: 2, usdPerUnit: "1.27" },
  { code: "IN", name: "India", currency: "INR", currencyExponent: 2, usdPerUnit: "0.012" },
  { code: "DE", name: "Germany", currency: "EUR", currencyExponent: 2, usdPerUnit: "1.08" },
  { code: "FR", name: "France", currency: "EUR", currencyExponent: 2, usdPerUnit: "1.08" },
  { code: "CA", name: "Canada", currency: "CAD", currencyExponent: 2, usdPerUnit: "0.73" },
  { code: "AU", name: "Australia", currency: "AUD", currencyExponent: 2, usdPerUnit: "0.65" },
  { code: "SG", name: "Singapore", currency: "SGD", currencyExponent: 2, usdPerUnit: "0.74" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", currencyExponent: 2, usdPerUnit: "0.2723" },
  { code: "JP", name: "Japan", currency: "JPY", currencyExponent: 0, usdPerUnit: "0.0067" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function isSupportedCountry(code: string): boolean {
  return BY_CODE.has(code);
}

export function getCountry(code: string): Country {
  const country = BY_CODE.get(code);
  if (!country) throw new RangeError(`Unsupported country: ${code}`);
  return country;
}
