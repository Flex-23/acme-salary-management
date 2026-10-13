/**
 * Load test for the API and the two pages, using autocannon.
 *
 *   npm run build && npm start            # in one terminal: a PRODUCTION build
 *   npm run loadtest                      # in another
 *
 * Options (flags or environment variables):
 *   --base-url <url>      BASE_URL        default http://localhost:3000
 *   --duration <seconds>  DURATION        default 10 (per scenario)
 *   --only <text>                         run only scenarios whose name contains the text
 *   --json <file>                         also write the raw results as JSON
 *   --cache-probe                         also time a cache miss against cache hits (creates and removes one test employee)
 *
 * Pass criterion: no 5xx responses, no connection errors, no timeouts. Never point this at production data
 * you care about: the cache probe writes one row (and deletes it again).
 */
import { writeFileSync } from "node:fs";
import autocannon from "autocannon";
import { formatReport, summarize, verdict, type ScenarioResult } from "./lib/load-stats";

type Scenario = { name: string; requests: { method?: "GET"; path: string }[]; connections: number };

function option(name: string, env: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return (index >= 0 ? process.argv[index + 1] : undefined) ?? process.env[env] ?? fallback;
}

const BASE_URL = option("base-url", "BASE_URL", "http://localhost:3000").replace(/\/$/, "");
const DURATION = Number(option("duration", "DURATION", "10"));
const ONLY = option("only", "ONLY", "");
const JSON_FILE = option("json", "JSON_FILE", "");
const CACHE_PROBE = process.argv.includes("--cache-probe");

const LOW = 10;
const HIGH = 50; // above the pool size (5), so the in-app query limiter is exercised

async function pickEmployeeIds(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/api/employees?pageSize=100&page=7`);
  const body = (await response.json()) as { data: { id: string }[] };
  return body.data.map((employee) => employee.id);
}

function buildScenarios(ids: string[]): Scenario[] {
  const get = (path: string) => ({ path });
  const byId = ids.slice(0, 40).map((id) => get(`/api/employees/${id}`));

  const list = get("/api/employees");
  const searchFilterSort = [
    get("/api/employees?search=smith&country=US&sort=salaryUsd:desc&pageSize=50"),
    get("/api/employees?search=ann&department=Engineering&sort=hireDate:desc"),
    get("/api/employees?country=IN&jobTitle=Senior+Software+Engineer&sort=salaryUsd:asc"),
  ];
  const deepPage = [get("/api/employees?page=399&pageSize=25"), get("/api/employees?page=190&pageSize=50&sort=salaryUsd:desc"), get("/api/employees?page=95&pageSize=100&sort=hireDate:asc")];
  const insights = {
    summary: get("/api/insights/summary"),
    byCountry: get("/api/insights/by-country"),
    byJobTitle: get("/api/insights/by-job-title?country=US"),
    byDepartment: get("/api/insights/by-department"),
    distribution: get("/api/insights/distribution"),
    filters: get("/api/meta/filters"),
  };
  const pages = [get("/employees"), get("/insights")];

  // Realistic traffic for one HR user's session, weighted towards browsing the list.
  const mixed = [
    list, list, ...searchFilterSort, ...deepPage.slice(0, 1), ...byId.slice(0, 4),
    insights.summary, insights.byCountry, insights.byJobTitle, insights.byDepartment, insights.distribution, insights.filters,
    get("/employees?search=ann&country=DE"), get("/insights"), get("/api/health"),
  ];

  // Bad input must be answered with a 4xx, never a 5xx.
  const hostile = [
    "/api/employees?page=-1", "/api/employees?page=abc", "/api/employees?pageSize=1000000", "/api/employees?pageSize=0",
    "/api/employees?page=9007199254740991", "/api/employees?sort=password:asc", "/api/employees?sort=fullName:sideways",
    "/api/employees?search=%00", "/api/employees?search=%25%25%25", "/api/employees?search=%27%3B%20drop%20table%20employees%3B--",
    `/api/employees?search=${"x".repeat(4000)}`, "/api/employees?department=%00", "/api/employees?jobTitle=%00", "/api/employees?country=ZZ",
    "/api/employees/not-a-uuid", "/api/employees/00000000-0000-0000-0000-000000000000", "/api/employees/%00",
    "/api/insights/by-job-title", "/api/insights/by-job-title?country=XX", "/api/insights/by-job-title?country=%00",
    "/api/insights/distribution?country=%00", "/api/insights/distribution?country=zz",
  ].map(get);

  return [
    { name: "list: default", requests: [list], connections: LOW },
    { name: "list: default", requests: [list], connections: HIGH },
    { name: "list: search + filter + sort", requests: searchFilterSort, connections: LOW },
    { name: "list: search + filter + sort", requests: searchFilterSort, connections: HIGH },
    { name: "list: deep page", requests: deepPage, connections: LOW },
    { name: "get by id", requests: byId, connections: LOW },
    { name: "get by id", requests: byId, connections: HIGH },
    { name: "insights: summary", requests: [insights.summary], connections: LOW },
    { name: "insights: by country", requests: [insights.byCountry], connections: LOW },
    { name: "insights: by country", requests: [insights.byCountry], connections: HIGH },
    { name: "insights: by job title", requests: [insights.byJobTitle], connections: LOW },
    { name: "insights: by department", requests: [insights.byDepartment], connections: LOW },
    { name: "insights: distribution", requests: [insights.distribution], connections: LOW },
    { name: "meta: filters", requests: [insights.filters], connections: LOW },
    { name: "page: /employees and /insights", requests: pages, connections: LOW },
    { name: "mixed browsing session", requests: mixed, connections: LOW },
    { name: "mixed browsing session", requests: mixed, connections: HIGH },
    { name: "hostile input (4xx expected)", requests: hostile, connections: LOW },
  ];
}

async function run(scenario: Scenario): Promise<ScenarioResult> {
  const samples: number[] = [];
  const result = await new Promise<autocannon.Result>((resolve, reject) => {
    const instance = autocannon(
      {
        url: BASE_URL,
        connections: scenario.connections,
        duration: DURATION,
        timeout: 30,
        requests: scenario.requests.map((request) => ({ method: "GET", path: request.path })),
      },
      (error, finished) => (error ? reject(error) : resolve(finished)),
    );
    // autocannon only keeps a coarse histogram; record every response time to get an exact p95.
    instance.on("response", (_client, _status, _bytes, responseTime) => samples.push(responseTime));
  });

  return {
    name: scenario.name,
    connections: scenario.connections,
    durationSeconds: DURATION,
    requests: result.requests.total,
    requestsPerSecond: result.requests.average,
    latency: summarize(samples),
    status2xx: result["2xx"],
    status4xx: result["4xx"],
    status5xx: result["5xx"],
    errors: result.errors,
    timeouts: result.timeouts,
  };
}

/** One cache miss (right after a write invalidated the tag) against repeated hits, for one insight endpoint. */
async function probeCache(): Promise<void> {
  const time = async (path: string) => {
    const started = performance.now();
    const response = await fetch(`${BASE_URL}${path}`);
    await response.arrayBuffer();
    return { ms: performance.now() - started, status: response.status };
  };
  const body = {
    fullName: "Load Test Probe",
    email: `loadtest.${Date.now()}@acme.com`,
    jobTitle: "Probe",
    department: "Engineering",
    countryCode: "US",
    salary: 100000,
    hireDate: "2025-01-06",
  };
  const created = await fetch(`${BASE_URL}/api/employees`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const id = ((await created.json()) as { data: { id: string } }).data.id;
  try {
    console.log("\nCache probe (the create above invalidated the 'insights' tag):");
    for (const path of ["/api/insights/summary", "/api/insights/by-country", "/api/insights/by-department", "/api/insights/distribution"]) {
      const miss = await time(path);
      const hits: number[] = [];
      for (let i = 0; i < 20; i++) hits.push((await time(path)).ms);
      const stats = summarize(hits);
      console.log(`  ${path.padEnd(32)} miss ${miss.ms.toFixed(0).padStart(5)} ms   hit p50 ${stats.p50.toFixed(0).padStart(4)} ms  p95 ${stats.p95.toFixed(0).padStart(4)} ms`);
    }
  } finally {
    await fetch(`${BASE_URL}/api/employees/${id}`, { method: "DELETE" });
  }
}

async function main() {
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => undefined);
  if (!health?.ok) throw new Error(`The server at ${BASE_URL} is not healthy. Start a production build first: npm run build && npm start`);
  console.log(`Target ${BASE_URL}, ${DURATION} s per scenario, pool size 5 (high-concurrency runs use ${HIGH} connections)\n`);

  const ids = await pickEmployeeIds();
  const scenarios = buildScenarios(ids).filter((scenario) => scenario.name.includes(ONLY));
  const results: ScenarioResult[] = [];

  // One warm-up pass so the first scenario does not pay for the JIT and cold caches.
  await fetch(`${BASE_URL}/api/employees`).then((r) => r.arrayBuffer());

  for (const scenario of scenarios) {
    process.stdout.write(`running ${scenario.name} (${scenario.connections} connections)... `);
    const result = await run(scenario);
    results.push(result);
    console.log(`${Math.round(result.requestsPerSecond)} req/s, p95 ${Math.round(result.latency.p95)} ms, 5xx ${result.status5xx}`);
  }

  console.log(`\n${formatReport(results)}\n`);
  if (CACHE_PROBE) await probeCache();
  if (JSON_FILE) writeFileSync(JSON_FILE, JSON.stringify(results, null, 2));

  const outcome = verdict(results);
  console.log(outcome.passed ? "\nPASS: no 5xx responses, no connection errors, no timeouts" : `\nFAIL\n  ${outcome.problems.join("\n  ")}`);
  process.exit(outcome.passed ? 0 : 1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
