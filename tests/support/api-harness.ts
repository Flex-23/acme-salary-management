import type { Services } from "@/server/container";
import { EmployeeService } from "@/server/services/employee-service";
import { InsightsService } from "@/server/services/insights-service";
import { FIXTURE_EMPLOYEES } from "./fixtures";
import { InMemoryEmployeeRepository } from "./in-memory/employee-repository";
import { InMemoryInsightsRepository } from "./in-memory/insights-repository";
import { InMemoryStore } from "./in-memory/store";

export const TEST_TODAY = "2026-06-15";

/** Services backed by in-memory fakes, so route handlers can be tested without a database. */
export function createFakeServices(): Services {
  const store = new InMemoryStore(FIXTURE_EMPLOYEES);
  return {
    employees: new EmployeeService(new InMemoryEmployeeRepository(store), { today: () => TEST_TODAY }),
    insights: new InsightsService(new InMemoryInsightsRepository(store)),
  };
}

export const get = (path: string) => new Request(`http://localhost${path}`);

export const send = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

export const idContext = (id: string) => ({ params: Promise.resolve({ id }) });
