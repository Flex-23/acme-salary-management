export type LatencyStats = { count: number; mean: number; p50: number; p95: number; p99: number; max: number };

export type ScenarioResult = {
  name: string;
  connections: number;
  durationSeconds: number;
  requests: number;
  requestsPerSecond: number;
  latency: LatencyStats;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  errors: number;
  timeouts: number;
};

/** Nearest-rank percentile: the smallest value that at least p % of the samples do not exceed. */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] as number;
}

export function summarize(samples: readonly number[]): LatencyStats {
  if (samples.length === 0) return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sum = samples.reduce((total, value) => total + value, 0);
  return {
    count: samples.length,
    mean: sum / samples.length,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    max: Math.max(...samples),
  };
}

/** The pass criterion: no 5xx, no connection errors, no timeouts. A 4xx is a correct answer to bad input. */
export function verdict(results: readonly ScenarioResult[]): { passed: boolean; problems: string[] } {
  const problems: string[] = [];
  for (const r of results) {
    if (r.requests === 0 || r.status2xx + r.status4xx + r.status5xx === 0) problems.push(`${r.name}: no responses`);
    if (r.status5xx > 0) problems.push(`${r.name}: ${r.status5xx} responses with a 5xx status`);
    if (r.errors > 0) problems.push(`${r.name}: ${r.errors} connection errors`);
    if (r.timeouts > 0) problems.push(`${r.name}: ${r.timeouts} timeouts`);
  }
  return { passed: problems.length === 0, problems };
}

const COLUMNS: { title: string; width: number; align: "left" | "right"; value: (r: ScenarioResult) => string }[] = [
  { title: "scenario", width: 34, align: "left", value: (r) => r.name },
  { title: "conns", width: 5, align: "right", value: (r) => String(r.connections) },
  { title: "req/s", width: 8, align: "right", value: (r) => Math.round(r.requestsPerSecond).toLocaleString("en-US") },
  { title: "p50 ms", width: 7, align: "right", value: (r) => Math.round(r.latency.p50).toString() },
  { title: "p95 ms", width: 7, align: "right", value: (r) => Math.round(r.latency.p95).toString() },
  { title: "p99 ms", width: 7, align: "right", value: (r) => Math.round(r.latency.p99).toString() },
  { title: "max ms", width: 7, align: "right", value: (r) => Math.round(r.latency.max).toString() },
  { title: "2xx", width: 8, align: "right", value: (r) => r.status2xx.toLocaleString("en-US") },
  { title: "4xx", width: 6, align: "right", value: (r) => r.status4xx.toLocaleString("en-US") },
  { title: "5xx", width: 5, align: "right", value: (r) => String(r.status5xx) },
  { title: "err", width: 4, align: "right", value: (r) => String(r.errors + r.timeouts) },
];

const pad = (text: string, width: number, align: "left" | "right") => (align === "left" ? text.padEnd(width) : text.padStart(width));

/** A plain-text table, also valid inside a Markdown code block. */
export function formatReport(results: readonly ScenarioResult[]): string {
  const header = COLUMNS.map((c) => pad(c.title, c.width, c.align)).join("  ");
  const rule = COLUMNS.map((c) => "-".repeat(c.width)).join("  ");
  const rows = results.map((r) => COLUMNS.map((c) => pad(c.value(r), c.width, c.align)).join("  "));
  return [header, rule, ...rows].join("\n");
}
