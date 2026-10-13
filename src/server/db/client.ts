import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "./env";
import * as schema from "./schema";

const POOL_SIZE = 5;
const CONNECT_TIMEOUT_SECONDS = 10;
const IDLE_TIMEOUT_SECONDS = 20;

function createDb() {
  // Supabase pooler runs in transaction mode, which does not support prepared statements.
  const client = postgres(requireEnv("DATABASE_URL"), {
    prepare: false,
    max: POOL_SIZE,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    idle_timeout: IDLE_TIMEOUT_SECONDS,
  });
  return drizzle(client, { schema });
}

export type AppDb = ReturnType<typeof createDb>;

// One client per process; the global survives hot module reloads in development.
const globalForDb = globalThis as typeof globalThis & { __salaryDb?: AppDb };

export function getDb(): AppDb {
  globalForDb.__salaryDb ??= createDb();
  return globalForDb.__salaryDb;
}
