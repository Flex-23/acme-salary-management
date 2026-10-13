import type { Employee } from "@/server/domain/types";

const T1 = new Date("2024-01-01T10:00:00.000Z");
const T2 = new Date("2024-02-01T10:00:00.000Z");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Seed = [
  n: number,
  name: string,
  email: string,
  jobTitle: string,
  department: string,
  country: string,
  salaryMinor: number,
  hireDate: string,
];

// Salaries are chosen so every USD conversion is exact (no rounding ties).
const SEEDS: Seed[] = [
  [1, "Alice Smith", "alice@acme.com", "Software Engineer", "Engineering", "US", 12_000_000, "2020-01-15"],
  [2, "Bob Jones", "bob@acme.com", "Software Engineer", "Engineering", "US", 10_000_000, "2021-03-01"],
  [3, "Carol White", "carol@acme.com", "Product Manager", "Product", "US", 15_000_000, "2019-06-10"],
  [4, "Dan Brown", "dan@acme.com", "Software Engineer", "Engineering", "US", 14_000_000, "2022-09-01"],
  [5, "Eve Taylor", "eve@acme.co.uk", "Software Engineer", "Engineering", "GB", 8_000_000, "2020-05-05"],
  [6, "Frank Hall", "frank@acme.co.uk", "Sales Rep", "Sales", "GB", 5_000_000, "2023-01-09"],
  [7, "Grace Lee", "grace@acme.co.uk", "Software Engineer", "Engineering", "GB", 9_000_000, "2018-11-20"],
  [8, "Hiro Tanaka", "hiro@acme.jp", "Software Engineer", "Engineering", "JP", 7_000_000, "2021-04-01"],
  [9, "Ichiro Sato", "ichiro@acme.jp", "Sales Rep", "Sales", "JP", 5_000_000, "2022-02-14"],
  [10, "Jana Mueller", "jana@acme.de", "Product Manager", "Product", "DE", 9_500_000, "2020-08-17"],
  [11, "Karl Weber", "karl@acme.de", "Sales Rep", "Sales", "DE", 6_000_000, "2023-06-05"],
  [12, "Lena Fischer", "lena@acme.de", "Software Engineer", "Engineering", "DE", 8_500_000, "2019-12-02"],
];

/** Twelve employees in four countries; rows 1-6 share one created_at and 7-12 another. */
export const FIXTURE_EMPLOYEES: Employee[] = SEEDS.map(
  ([n, fullName, email, jobTitle, department, countryCode, salaryMinor, hireDate]) => ({
    id: id(n),
    fullName,
    email,
    jobTitle,
    department,
    countryCode,
    salaryMinor,
    hireDate,
    createdAt: n <= 6 ? T1 : T2,
    updatedAt: n <= 6 ? T1 : T2,
  }),
);

export const fixtureId = id;
