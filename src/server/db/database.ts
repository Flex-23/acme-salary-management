import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Any Drizzle Postgres database (postgres.js in production, PGlite in tests). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
