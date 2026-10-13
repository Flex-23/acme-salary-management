import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";

const MIGRATIONS_FOLDER = "./src/server/db/migrations";

/** An in-process Postgres with the real migrations applied. No Docker, no network. */
export async function createTestDb() {
  const client = new PGlite({ extensions: { pg_trgm } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, client };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];
