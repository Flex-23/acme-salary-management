import type { EmployeeInputData, EmployeeUpdateData, ListEmployeesQueryData } from "../domain/employee";
import type { Employee, EmployeeListItem } from "../domain/types";

export type ListResult = { rows: EmployeeListItem[]; total: number };

export interface EmployeeRepository {
  list(query: ListEmployeesQueryData): Promise<ListResult>;
  findById(id: string): Promise<Employee | null>;
  /** @throws DuplicateEmailError when the email is already used */
  create(input: EmployeeInputData): Promise<Employee>;
  /** @throws DuplicateEmailError when the email is already used */
  update(id: string, patch: EmployeeUpdateData): Promise<Employee | null>;
  delete(id: string): Promise<boolean>;
}
