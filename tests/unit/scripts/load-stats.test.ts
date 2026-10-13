import { describe, expect, it } from "vitest";
import { formatReport, percentile, summarize, verdict, type ScenarioResult } from "../../../scripts/lib/load-stats";

describe("percentile (nearest rank)", () => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100

  it("returns the value at the given rank", () => {
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
    expect(percentile(values, 100)).toBe(100);
  });

  it("does not need sorted input and does not modify it", () => {
    const input = [30, 10, 20];
    expect(percentile(input, 50)).toBe(20);
    expect(input).toEqual([30, 10, 20]);
  });

  it("handles one value and no values", () => {
    expect(percentile([7], 99)).toBe(7);
    expect(percentile([], 50)).toBe(0);
  });
});

describe("summarize", () => {
  it("reports count, mean and the percentiles", () => {
    const stats = summarize([10, 20, 30, 40]);
    expect(stats).toEqual({ count: 4, mean: 25, p50: 20, p95: 40, p99: 40, max: 40 });
  });

  it("is all zeros for no samples", () => {
    expect(summarize([])).toEqual({ count: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 });
  });
});

const result = (overrides: Partial<ScenarioResult> = {}): ScenarioResult => ({
  name: "list",
  connections: 10,
  durationSeconds: 10,
  requests: 1000,
  requestsPerSecond: 100,
  latency: { count: 1000, mean: 40, p50: 35, p95: 80, p99: 120, max: 300 },
  status2xx: 1000,
  status4xx: 0,
  status5xx: 0,
  errors: 0,
  timeouts: 0,
  ...overrides,
});

describe("verdict", () => {
  it("passes with only successful responses", () => {
    expect(verdict([result(), result({ name: "get" })])).toEqual({ passed: true, problems: [] });
  });

  it("fails on any 5xx, naming the scenario", () => {
    const outcome = verdict([result(), result({ name: "search", status5xx: 2 })]);
    expect(outcome.passed).toBe(false);
    expect(outcome.problems).toEqual(["search: 2 responses with a 5xx status"]);
  });

  it("fails on connection errors and timeouts", () => {
    const outcome = verdict([result({ errors: 1, timeouts: 3 })]);
    expect(outcome.problems).toEqual(["list: 1 connection errors", "list: 3 timeouts"]);
  });

  it("does not count 4xx as a failure (invalid input is answered with 400 on purpose)", () => {
    expect(verdict([result({ status4xx: 500 })]).passed).toBe(true);
  });

  it("fails when a scenario got no response at all", () => {
    expect(verdict([result({ requests: 0, status2xx: 0 })]).problems).toEqual(["list: no responses"]);
  });
});

describe("formatReport", () => {
  it("prints one row per scenario with throughput and latency percentiles", () => {
    const text = formatReport([result(), result({ name: "search", connections: 50, requestsPerSecond: 250.4 })]);
    const lines = text.split("\n");
    expect(lines[0]).toContain("scenario");
    expect(lines[0]).toContain("req/s");
    expect(lines[0]).toContain("p95");
    expect(text).toContain("search");
    expect(text).toContain("250");
    expect(lines.length).toBe(4); // header, rule, two rows
  });
});
