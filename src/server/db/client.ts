import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "./env";
import { limitConcurrency } from "./limit-concurrency";
import { parsePoolSize } from "./pool-size";
import * as schema from "./schema";

const CONNECT_TIMEOUT_SECONDS = 10;
const IDLE_TIMEOUT_SECONDS = 20;

function createDb() {
  const poolSize = parsePoolSize(process.env.DATABASE_POOL_SIZE);
  // Supabase pooler runs in transaction mode, which does not support prepared statements.
  const connection = postgres(requireEnv("DATABASE_URL"), {
    prepare: false,
    max: poolSize,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    idle_timeout: IDLE_TIMEOUT_SECONDS,
  });
  // Never let postgres.js queue queries on a connection: through the transaction pooler that hangs.
  const client = limitConcurrency(connection, poolSize);
  return drizzle(client, { schema });
}

export type AppDb = ReturnType<typeof createDb>;

// One client per process; the global survives hot module reloads in development.
const globalForDb = globalThis as typeof globalThis & { __salaryDb?: AppDb };

export function getDb(): AppDb {
  globalForDb.__salaryDb ??= createDb();
  return globalForDb.__salaryDb;
}
