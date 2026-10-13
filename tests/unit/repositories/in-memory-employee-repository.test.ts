import { describeEmployeeRepository } from "../../support/employee-repository.contract";
import { InMemoryEmployeeRepository } from "../../support/in-memory/employee-repository";
import { InMemoryStore } from "../../support/in-memory/store";

describeEmployeeRepository(
  "InMemoryEmployeeRepository",
  async (seed) => new InMemoryEmployeeRepository(new InMemoryStore(seed)),
);
