import "server-only";
import { getDb } from "./db/client";
import { DrizzleEmployeeRepository } from "./repositories/drizzle-employee-repository";
import { DrizzleInsightsRepository } from "./repositories/drizzle-insights-repository";
import { systemClock } from "./services/clock";
import { EmployeeService } from "./services/employee-service";
import { InsightsService } from "./services/insights-service";

export type Services = {
  employees: EmployeeService;
  insights: InsightsService;
};

let services: Services | undefined;

/** Composition root: wires services to the real database. Created lazily, once per process. */
export function getServices(): Services {
  if (!services) {
    const db = getDb();
    services = {
      employees: new EmployeeService(new DrizzleEmployeeRepository(db), systemClock),
      insights: new InsightsService(new DrizzleInsightsRepository(db)),
    };
  }
  return services;
}
