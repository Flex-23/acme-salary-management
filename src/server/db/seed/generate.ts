import { en, Faker } from "@faker-js/faker";
import { getCountry } from "../../domain/countries";
import type { Employee } from "../../domain/types";
import { COUNTRY_PROFILES, DEPARTMENTS, LEVELS, SALARY_SPREAD } from "./catalog";

export const DEFAULT_SEED = 20_260_101;
export const DEFAULT_COUNT = 10_000;
/**
 * Hire dates are relative to this fixed date, not to "now", so every run produces identical data.
 * It is in the past, so generated hire dates are never in the future.
 */
export const SEED_REFERENCE_DATE = "2026-10-01";

const HIRE_WINDOW_DAYS = 12 * 365;
const EMAIL_DOMAIN = "acme.com";
const WORKDAY_START_HOUR_UTC = 8;
const SECONDS_BETWEEN_SAME_DAY_HIRES = 37;

export type GenerateOptions = {
  count?: number;
  seed?: number;
};

type Weighted<T> = { weight: number; value: T };

const weighted = <T extends { weight: number }>(items: readonly T[]): Weighted<T>[] =>
  items.map((value) => ({ weight: value.weight, value }));

const DEPARTMENT_CHOICES = weighted(DEPARTMENTS);
const LEVEL_CHOICES = weighted(LEVELS);
const COUNTRY_CHOICES = weighted(COUNTRY_PROFILES);

function asciiSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function daysBefore(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Whole-unit steps so salaries look like real offers: 100 units, or 10,000 for zero-decimal currencies. */
function roundedMinor(usd: number, countryCode: string): number {
  const country = getCountry(countryCode);
  const local = usd / Number(country.usdPerUnit);
  const step = country.currencyExponent === 0 ? 10_000 : 100;
  return Math.round(local / step) * step * 10 ** country.currencyExponent;
}

/** Generates a deterministic, realistic workforce. Pure: no database, no clock. */
export function generateEmployees({ count = DEFAULT_COUNT, seed = DEFAULT_SEED }: GenerateOptions): Employee[] {
  const faker = new Faker({ locale: [en] });
  faker.seed(seed);

  const usedEmails = new Set<string>();
  const hiresPerDay = new Map<string, number>();

  const uniqueEmail = (first: string, last: string): string => {
    const base = `${asciiSlug(first) || "user"}.${asciiSlug(last) || "name"}`;
    let candidate = `${base}@${EMAIL_DOMAIN}`;
    for (let suffix = 2; usedEmails.has(candidate); suffix++) candidate = `${base}${suffix}@${EMAIL_DOMAIN}`;
    usedEmails.add(candidate);
    return candidate;
  };

  /** Created when the person was hired; same-day hires get distinct, increasing timestamps. */
  const createdAtFor = (hireDate: string): Date => {
    const sameDayBefore = hiresPerDay.get(hireDate) ?? 0;
    hiresPerDay.set(hireDate, sameDayBefore + 1);
    const jitter = faker.number.int({ min: 0, max: SECONDS_BETWEEN_SAME_DAY_HIRES - 1 });
    const seconds = sameDayBefore * SECONDS_BETWEEN_SAME_DAY_HIRES + jitter;
    const start = new Date(`${hireDate}T${String(WORKDAY_START_HOUR_UTC).padStart(2, "0")}:00:00Z`);
    return new Date(start.getTime() + seconds * 1000);
  };

  return Array.from({ length: count }, (): Employee => {
    const profile = faker.helpers.weightedArrayElement(COUNTRY_CHOICES);
    const department = faker.helpers.weightedArrayElement(DEPARTMENT_CHOICES);
    const role = faker.helpers.arrayElement(department.roles);
    const level = faker.helpers.weightedArrayElement(LEVEL_CHOICES);

    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const spread = 1 + SALARY_SPREAD * (faker.number.float({ min: 0, max: 1 }) * 2 - 1);
    const usd = role.baseUsd * level.multiplier * profile.costFactor * spread;
    const hireDate = daysBefore(SEED_REFERENCE_DATE, faker.number.int({ min: 0, max: HIRE_WINDOW_DAYS }));
    const createdAt = createdAtFor(hireDate);

    return {
      id: faker.string.uuid(),
      fullName: `${firstName} ${lastName}`,
      email: uniqueEmail(firstName, lastName),
      jobTitle: level.prefix ? `${level.prefix} ${role.title}` : role.title,
      department: department.name,
      countryCode: profile.code,
      salaryMinor: roundedMinor(usd, profile.code),
      hireDate,
      createdAt,
      updatedAt: createdAt,
    };
  });
}
