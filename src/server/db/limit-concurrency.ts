import type postgres from "postgres";

type Sql = postgres.Sql;

/**
 * Wraps a postgres.js client so that at most `limit` queries are in flight; the rest wait here,
 * in order, instead of queueing on a database connection.
 *
 * Why: through Supabase's transaction pooler, postgres.js hangs (and can return crossed results)
 * when more long queries are issued at once than there are connections, because it queues them on
 * a connection and sends them back to back. Keeping the queue in the application avoids that.
 * Set `limit` to the pool size (`max`).
 *
 * Only `unsafe` is wrapped: that is the one entry point Drizzle uses for queries.
 */
export function limitConcurrency(client: Sql, limit: number): Sql {
  if (!(limit >= 1)) throw new RangeError("The concurrency limit must be at least 1");

  let running = 0;
  const waiting: Array<() => void> = [];

  const acquire = (): Promise<void> => {
    if (running < limit) {
      running += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(resolve));
  };

  const release = (): void => {
    const next = waiting.shift();
    if (next) next(); // hand the slot straight to the next waiter
    else running -= 1;
  };

  const run = async <T>(execute: () => PromiseLike<T>): Promise<T> => {
    await acquire();
    try {
      return await execute();
    } finally {
      release();
    }
  };

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "unsafe") return Reflect.get(target, property, receiver);

      return (...args: Parameters<Sql["unsafe"]>) => {
        const start = () => target.unsafe(...args);
        // Drizzle only awaits the query or asks for `.values()`; both run through the limiter.
        return {
          values: () => run(() => start().values()),
          then: (onFulfilled: never, onRejected: never) => run(start).then(onFulfilled, onRejected),
        };
      };
    },
  });
}
