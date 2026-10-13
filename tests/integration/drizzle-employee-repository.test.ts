import { afterAll } from "vitest";
import { employees } from "@/server/db/schema";
import { DrizzleEmployeeRepository } from "@/server/repositories/drizzle-employee-repository";
import { describeEmployeeRepository } from "../support/employee-repository.contract";
import { createTestDb } from "../support/test-db";

// One database for the whole file (migrations are the slow part); each test reseeds it.
const database = createTestDb();

afterAll(async () => {
  await (await database).client.close();
});

describeEmployeeRepository("DrizzleEmployeeRepository", async (seed) => {
  const { db } = await database;
  await db.delete(employees);
  if (seed.length > 0) await db.insert(employees).values(seed);
  return new DrizzleEmployeeRepository(db);
});
