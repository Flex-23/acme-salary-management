import { sql } from "drizzle-orm";
import type { Database } from "./database";

/**
 * Runs a trivial query with a deadline. Never throws: any failure, including missing
 * configuration, means "unhealthy". The cause is logged server-side only.
 */
export async function checkDatabase(getDatabase: () => Database, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer within ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    await Promise.race([getDatabase().execute(sql`select 1`), deadline]);
    return true;
  } catch (error) {
    console.error("Database health check failed", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
