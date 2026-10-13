export const DEFAULT_POOL_SIZE = 5;
export const MAX_POOL_SIZE = 20;

/**
 * The size of the connection pool, which is also the number of queries in flight at once
 * (see limit-concurrency.ts). Optional `DATABASE_POOL_SIZE`; a bad value is an error, not a guess.
 */
export function parsePoolSize(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_POOL_SIZE;
  const size = Number(raw);
  if (!/^\d+$/.test(raw.trim()) || size < 1 || size > MAX_POOL_SIZE) {
    throw new Error(`DATABASE_POOL_SIZE must be a whole number from 1 to ${MAX_POOL_SIZE} (got "${raw}")`);
  }
  return size;
}
