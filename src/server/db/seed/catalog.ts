export type Role = {
  title: string;
  /** Annual gross salary in USD for a mid-level hire in the baseline country (US). */
  baseUsd: number;
};

export type Department = {
  name: string;
  /** Relative share of the workforce. */
  weight: number;
  roles: readonly Role[];
};

export type Level = {
  /** Prefix for the job title; empty for the mid level. */
  prefix: string;
  multiplier: number;
  weight: number;
};

export const DEPARTMENTS: readonly Department[] = [
  {
    name: "Engineering",
    weight: 34,
    roles: [
      { title: "Software Engineer", baseUsd: 115_000 },
      { title: "QA Engineer", baseUsd: 85_000 },
      { title: "DevOps Engineer", baseUsd: 120_000 },
      { title: "Data Engineer", baseUsd: 118_000 },
    ],
  },
  {
    name: "Product",
    weight: 8,
    roles: [
      { title: "Product Manager", baseUsd: 125_000 },
      { title: "Business Analyst", baseUsd: 90_000 },
    ],
  },
  {
    name: "Design",
    weight: 5,
    roles: [
      { title: "Product Designer", baseUsd: 100_000 },
      { title: "UX Researcher", baseUsd: 95_000 },
    ],
  },
  {
    name: "Sales",
    weight: 15,
    roles: [
      { title: "Account Executive", baseUsd: 85_000 },
      { title: "Sales Development Rep", baseUsd: 60_000 },
    ],
  },
  {
    name: "Marketing",
    weight: 7,
    roles: [
      { title: "Marketing Specialist", baseUsd: 72_000 },
      { title: "Content Strategist", baseUsd: 70_000 },
    ],
  },
  {
    name: "Finance",
    weight: 6,
    roles: [
      { title: "Financial Analyst", baseUsd: 82_000 },
      { title: "Accountant", baseUsd: 70_000 },
    ],
  },
  {
    name: "Human Resources",
    weight: 4,
    roles: [
      { title: "HR Generalist", baseUsd: 68_000 },
      { title: "Recruiter", baseUsd: 66_000 },
    ],
  },
  {
    name: "Operations",
    weight: 8,
    roles: [
      { title: "Operations Analyst", baseUsd: 74_000 },
      { title: "Logistics Coordinator", baseUsd: 58_000 },
    ],
  },
  {
    name: "Customer Support",
    weight: 10,
    roles: [
      { title: "Support Specialist", baseUsd: 48_000 },
      { title: "Customer Success Manager", baseUsd: 78_000 },
    ],
  },
  {
    name: "Legal",
    weight: 3,
    roles: [
      { title: "Legal Counsel", baseUsd: 135_000 },
      { title: "Compliance Officer", baseUsd: 95_000 },
    ],
  },
];

export const LEVELS: readonly Level[] = [
  { prefix: "Junior", multiplier: 0.72, weight: 25 },
  { prefix: "", multiplier: 1, weight: 35 },
  { prefix: "Senior", multiplier: 1.35, weight: 28 },
  { prefix: "Lead", multiplier: 1.7, weight: 12 },
];

export type CountryProfile = {
  code: string;
  /** Relative share of the workforce. */
  weight: number;
  /** Pay level relative to the US, in USD terms. */
  costFactor: number;
};

export const COUNTRY_PROFILES: readonly CountryProfile[] = [
  { code: "US", weight: 28, costFactor: 1 },
  { code: "IN", weight: 22, costFactor: 0.28 },
  { code: "GB", weight: 12, costFactor: 0.75 },
  { code: "DE", weight: 10, costFactor: 0.85 },
  { code: "FR", weight: 6, costFactor: 0.75 },
  { code: "CA", weight: 6, costFactor: 0.85 },
  { code: "JP", weight: 5, costFactor: 0.7 },
  { code: "AU", weight: 4, costFactor: 0.9 },
  { code: "SG", weight: 4, costFactor: 0.9 },
  { code: "AE", weight: 3, costFactor: 0.8 },
];

/** Individual pay varies by up to this fraction around the computed base. */
export const SALARY_SPREAD = 0.1;
