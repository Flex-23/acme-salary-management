/**
 * Post-deploy smoke test: a handful of requests that tell you whether a deployment works.
 *
 *   npm run smoke -- --url https://your-app.vercel.app --user demo --password '...'
 *   npm run smoke -- --url http://localhost:3000 --open      # a target without access protection
 *
 * Credentials can also come from BASIC_AUTH_USER / BASIC_AUTH_PASSWORD. It only reads (GET requests),
 * so it is safe to run against a deployment with real data. Exit code 1 if anything fails.
 */
import { basicAuthHeader, credentialsFrom } from "./lib/http-auth";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};
const OPEN = argv.includes("--open");
const BASE_URL = (flag("url") ?? process.env.BASE_URL ?? "").replace(/\/$/, "");
const TIMEOUT_MS = 30_000;

if (!BASE_URL) {
  console.error("Usage: npm run smoke -- --url <deployed url> [--user u --password p | --open]");
  process.exit(2);
}

const credentials = credentialsFrom(argv, process.env);
if (!OPEN && !credentials) {
  console.error("This target should be protected: pass --user and --password (or BASIC_AUTH_USER/BASIC_AUTH_PASSWORD), or --open for an unprotected one.");
  process.exit(2);
}

const authorized: Record<string, string> = credentials ? { authorization: basicAuthHeader(credentials.user, credentials.password) } : {};

async function get(path: string, headers: Record<string, string> = {}, redirect: RequestRedirect = "follow") {
  const started = performance.now();
  const response = await fetch(`${BASE_URL}${path}`, { headers, redirect, signal: AbortSignal.timeout(TIMEOUT_MS) });
  return { response, ms: Math.round(performance.now() - started) };
}

type Check = { name: string; run: () => Promise<string> };

const expectStatus = (actual: number, expected: number) => {
  if (actual !== expected) throw new Error(`expected HTTP ${expected}, got ${actual}`);
};

const checks: Check[] = [
  {
    name: "health check answers without credentials and the database is up",
    run: async () => {
      const { response, ms } = await get("/api/health");
      expectStatus(response.status, 200);
      const body = (await response.json()) as { status?: string; database?: string };
      if (body.status !== "ok" || body.database !== "up") throw new Error(`unexpected body ${JSON.stringify(body)}`);
      return `${ms} ms`;
    },
  },
  {
    name: OPEN ? "the API is open (no access protection configured)" : "a request without credentials is refused with 401 and a Basic challenge",
    run: async () => {
      const { response } = await get("/api/employees?pageSize=1");
      if (OPEN) {
        expectStatus(response.status, 200);
        return "200";
      }
      expectStatus(response.status, 401);
      if (!response.headers.get("www-authenticate")?.toLowerCase().startsWith("basic")) throw new Error("missing WWW-Authenticate: Basic");
      const body = (await response.json()) as { error?: { code?: string } };
      if (body.error?.code !== "UNAUTHORIZED") throw new Error(`unexpected body ${JSON.stringify(body)}`);
      return "401";
    },
  },
  {
    name: "wrong credentials are refused too",
    run: async () => {
      if (OPEN) return "skipped (open target)";
      const { response } = await get("/api/employees?pageSize=1", { authorization: basicAuthHeader("nobody", "wrong") });
      expectStatus(response.status, 401);
      return "401";
    },
  },
  {
    name: "the employees list returns a page of data",
    run: async () => {
      const { response, ms } = await get("/api/employees?pageSize=5", authorized);
      expectStatus(response.status, 200);
      const body = (await response.json()) as { data?: { fullName?: string; salary?: { formatted?: string } }[]; page?: { total?: number; pageSize?: number } };
      if (!body.data?.length || !body.data[0]?.fullName || !body.data[0]?.salary?.formatted) throw new Error("no employees in the response");
      if (!body.page?.total || body.page.pageSize !== 5) throw new Error(`unexpected page info ${JSON.stringify(body.page)}`);
      return `${body.page.total.toLocaleString("en-US")} employees, ${ms} ms`;
    },
  },
  {
    name: "an insight endpoint returns figures",
    run: async () => {
      const { response, ms } = await get("/api/insights/summary", authorized);
      expectStatus(response.status, 200);
      const { data } = (await response.json()) as { data?: { headcount?: number; totalPayroll?: { formatted?: string } } };
      if (!data?.headcount || !data.totalPayroll?.formatted) throw new Error("no headcount or payroll in the summary");
      return `${data.headcount.toLocaleString("en-US")} employees, payroll ${data.totalPayroll.formatted}, ${ms} ms`;
    },
  },
  {
    name: "the root page redirects to /employees and the pages render",
    run: async () => {
      const root = await get("/", authorized, "manual");
      if (![307, 308].includes(root.response.status) || !root.response.headers.get("location")?.endsWith("/employees")) {
        throw new Error(`expected a redirect to /employees, got ${root.response.status} ${root.response.headers.get("location") ?? ""}`);
      }
      const employees = await get("/employees", authorized);
      expectStatus(employees.response.status, 200);
      if (!(await employees.response.text()).includes("Employees")) throw new Error("the /employees page has no content");
      const insights = await get("/insights", authorized);
      expectStatus(insights.response.status, 200);
      return `/employees ${employees.ms} ms, /insights ${insights.ms} ms`;
    },
  },
];

async function main() {
  console.log(`Smoke test of ${BASE_URL}${OPEN ? " (open target)" : ""}\n`);
  let failures = 0;
  for (const check of checks) {
    try {
      console.log(`PASS  ${check.name}  (${await check.run()})`);
    } catch (error) {
      failures += 1;
      console.log(`FAIL  ${check.name}\n      ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
