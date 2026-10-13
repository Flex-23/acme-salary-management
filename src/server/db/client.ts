import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const POOL_SIZE = 5;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Supabase pooler runs in transaction mode, which does not support prepared statements.
  const client = postgres(url, { prepare: false, max: POOL_SIZE });
  return drizzle(client, { schema });
}

export type AppDb = ReturnType<typeof createDb>;

// One client per process; the global survives hot module reloads in development.
const globalForDb = globalThis as typeof globalThis & { __salaryDb?: AppDb };

export function getDb(): AppDb {
  globalForDb.__salaryDb ??= createDb();
  return globalForDb.__salaryDb;
}
