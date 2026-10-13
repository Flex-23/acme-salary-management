import { getTableColumns, sql } from "drizzle-orm";
import type { Employee } from "../../domain/types";
import type { Database } from "../database";
import { employees } from "../schema";

const DEFAULT_BATCH_SIZE = 1_000;
const MAX_PARAMETERS_PER_STATEMENT = 65_535;
const PARAMETERS_PER_ROW = Object.keys(getTableColumns(employees)).length;

/** Largest batch that stays under Postgres' bind-parameter limit. */
export const MAX_BATCH_SIZE = Math.floor(MAX_PARAMETERS_PER_STATEMENT / PARAMETERS_PER_ROW);

export type WriteOptions = {
  batchSize?: number;
  /** Called after each batch with the number of rows inserted so far. */
  onProgress?: (inserted: number, total: number) => void;
};

/**
 * Replaces the employees table with the given rows. Everything happens in one transaction,
 * so a failure leaves the previous data untouched.
 */
export async function writeEmployees(
  db: Database,
  rows: readonly Employee[],
  { batchSize = DEFAULT_BATCH_SIZE, onProgress }: WriteOptions = {},
): Promise<void> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new RangeError(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}`);
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`truncate table ${employees}`);
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      await tx.insert(employees).values(batch);
      onProgress?.(start + batch.length, rows.length);
    }
  });
}
