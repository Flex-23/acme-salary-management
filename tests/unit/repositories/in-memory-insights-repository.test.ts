import { InMemoryInsightsRepository } from "../../support/in-memory/insights-repository";
import { InMemoryStore } from "../../support/in-memory/store";
import { describeInsightsRepository } from "../../support/insights-repository.contract";

describeInsightsRepository(
  "InMemoryInsightsRepository",
  async (seed) => new InMemoryInsightsRepository(new InMemoryStore(seed)),
);
