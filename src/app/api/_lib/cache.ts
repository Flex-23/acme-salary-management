import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { getServices } from "@/server/container";

/** Tags every cached read that is derived from employee data. */
export const INSIGHTS_TAG = "insights";

// `use cache` keys on the (serializable) arguments, so each country gets its own entry.
// Reads are cached for up to a minute and are expired immediately by `invalidateInsights()`.

export async function cachedSummary() {
  "use cache";
  cacheLife("minutes");
  cacheTag(INSIGHTS_TAG);
  return getServices().insights.summary();
}

export async function cachedByCountry() {
  "use cache";
  cacheLife("minutes");
  cacheTag(INSIGHTS_TAG);
  return getServices().insights.byCountry();
}

export async function cachedByJobTitle(country: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(INSIGHTS_TAG);
  return getServices().insights.byJobTitle(country);
}

export async function cachedByDepartment() {
  "use cache";
  cacheLife("minutes");
  cacheTag(INSIGHTS_TAG);
  return getServices().insights.byDepartment();
}

export async function cachedDistribution(country: string | undefined) {
  "use cache";
  cacheLife("minutes");
  cacheTag(INSIGHTS_TAG);
  return getServices().insights.distribution(country);
}

export async function cachedFilterOptions() {
  "use cache";
  cacheLife("minutes");
  cacheTag(INSIGHTS_TAG);
  return getServices().employees.filterOptions();
}

/**
 * Call after any employee mutation. `updateTag` is Server-Action-only, so route handlers use
 * `revalidateTag` with `expire: 0`: the next read waits for fresh data instead of serving stale.
 */
export function invalidateInsights(): void {
  revalidateTag(INSIGHTS_TAG, { expire: 0 });
}
