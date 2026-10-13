/**
 * Proves the server-side statement timeout against the real database, through the same
 * transaction pooler and the same concurrency limiter the app uses.
 *
 *   npm run check:timeout
 *
 * It checks that:
 *  1. the app role (DATABASE_URL) has a 15 s statement_timeout, also through the transaction pooler;
 *  2. the admin role (DIRECT_URL, used by migrations and the seed) does not;
 *  3. queries that run longer than the timeout fail with SQLSTATE 57014 instead of hanging;
 *  4. every failed query frees its slot in the limiter, so more slow queries than the pool size all finish;
 *  5. the pool still answers normally afterwards.
 */
import postgres from "postgres";
import { requireEnv } from "../src/server/db/env";
import { limitConcurrency } from "../src/server/db/limit-concurrency";

const POOL_SIZE = 5;
const SLOW_QUERIES = POOL_SIZE + 1; // one more than the pool, so the last must wait for a freed slot
const SLEEP_SECONDS = 40; // far beyond the 15 s timeout

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures += 1;
};

const timeoutOf = async (sql: postgres.Sql) => {
  const [row] = await sql`select current_setting('statement_timeout') as value, current_user as role`;
  return { value: String(row?.value), role: String(row?.role) };
};

async function main() {
  const admin = postgres(requireEnv("DIRECT_URL"), { max: 1, prepare: false, connect_timeout: 15 });
  const raw = postgres(requireEnv("DATABASE_URL"), { max: POOL_SIZE, prepare: false, connect_timeout: 15 });
  const app = limitConcurrency(raw, POOL_SIZE);

  try {
    const appSetting = await timeoutOf(raw);
    check("app role has a 15 s statement_timeout through the transaction pooler", appSetting.value === "15s", `${appSetting.role}: ${appSetting.value}`);

    const adminSetting = await timeoutOf(admin);
    check("migrations and seed (admin role) are not affected by it", adminSetting.value !== "15s", `${adminSetting.role}: ${adminSetting.value}`);

    const denied = await raw`truncate table employees`.then(
      () => false,
      (error: { code?: string }) => error.code === "42501",
    );
    check("the app role cannot truncate the table (least privilege)", denied);

    console.log(`\nRunning ${SLOW_QUERIES} queries of pg_sleep(${SLEEP_SECONDS}) on a pool of ${POOL_SIZE}; this takes about 30 s...`);
    const started = Date.now();
    const outcomes = await Promise.all(
      Array.from({ length: SLOW_QUERIES }, () =>
        Promise.resolve(app.unsafe(`select pg_sleep(${SLEEP_SECONDS})`)).then(
          () => ({ ok: true as const, code: "" }),
          (error: { code?: string }) => ({ ok: false as const, code: error.code ?? "?" }),
        ),
      ),
    );
    const seconds = (Date.now() - started) / 1000;

    check("every slow query was cancelled by the server (SQLSTATE 57014), none hung", outcomes.every((o) => !o.ok && o.code === "57014"), outcomes.map((o) => o.code).join(","));
    check("all of them finished, including the one that had to wait for a slot", outcomes.length === SLOW_QUERIES, `${seconds.toFixed(1)} s in total`);
    check("slots were freed one wave at a time (about two timeouts, not forty seconds each)", seconds > 25 && seconds < 40, `${seconds.toFixed(1)} s`);

    const next = Date.now();
    const [row] = await app.unsafe("select count(*)::int as n from employees");
    check("the next normal query succeeds immediately", Number(row?.n) > 0 && Date.now() - next < 5000, `${Date.now() - next} ms`);
  } finally {
    await Promise.all([admin.end({ timeout: 2 }), raw.end({ timeout: 2 })]);
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
