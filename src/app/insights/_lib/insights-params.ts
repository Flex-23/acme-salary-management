import { isSupportedCountry } from "@/server/domain/countries";

/** Both selected countries live in the URL, so a view can be shared or bookmarked. */
export const TITLE_COUNTRY_PARAM = "titleCountry";
export const DISTRIBUTION_COUNTRY_PARAM = "distributionCountry";

const DEFAULT_TITLE_COUNTRY = "US";

/** The country for "pay by job title": the requested one if it has employees, else the US, else the first with any. */
export function resolveTitleCountry(requested: string | undefined, available: readonly string[]): string | undefined {
  if (requested && available.includes(requested)) return requested;
  return available.includes(DEFAULT_TITLE_COUNTRY) ? DEFAULT_TITLE_COUNTRY : available[0];
}

/** The country filter for the distribution; undefined means all countries. */
export function resolveDistributionCountry(requested: string | undefined): string | undefined {
  return requested && isSupportedCountry(requested) ? requested : undefined;
}

/** The URL for the current query with one parameter set (or removed, when the value is undefined). */
export function hrefWithParam(pathname: string, currentQuery: string, name: string, value: string | undefined): string {
  const query = new URLSearchParams(currentQuery);
  if (value === undefined) query.delete(name);
  else query.set(name, value);
  const text = query.toString();
  return text ? `${pathname}?${text}` : pathname;
}
