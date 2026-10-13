export type Employee = {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  salaryMinor: number;
  /** ISO date, YYYY-MM-DD */
  hireDate: string;
  createdAt: Date;
  updatedAt: Date;
};

/** An employee as shown in lists: includes the currency and the USD-normalised salary. */
export type EmployeeListItem = Employee & {
  currency: string;
  salaryUsdMinor: number;
};
