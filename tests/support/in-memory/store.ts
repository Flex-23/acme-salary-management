import type { Employee } from "@/server/domain/types";

/** Shared state so the in-memory employee and insights fakes see the same data. */
export class InMemoryStore {
  employees: Employee[];

  constructor(seed: readonly Employee[] = []) {
    this.employees = seed.map((e) => ({ ...e }));
  }
}
