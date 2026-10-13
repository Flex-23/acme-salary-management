import { describe, expect, it } from "vitest";
import { limitConcurrency } from "@/server/db/limit-concurrency";

/** A stand-in for a postgres.js client: `unsafe` returns something awaitable that also has `.values()`. */
function fakeClient(work: (query: string) => Promise<unknown>) {
  let running = 0;
  let peak = 0;
  const started: string[] = [];

  const run = async (query: string) => {
    running += 1;
    peak = Math.max(peak, running);
    started.push(query);
    try {
      return await work(query);
    } finally {
      running -= 1;
    }
  };

  const client = {
    unsafe: (query: string) => {
      const promise = run(query);
      return Object.assign(promise, { values: () => promise.then((rows) => ({ values: rows })) });
    },
    other: "untouched",
  };
  return { client, stats: () => ({ peak, running, started }) };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

describe("limitConcurrency", () => {
  it("never runs more queries at once than the limit, and still runs them all", async () => {
    const { client, stats } = fakeClient(async (query) => {
      await tick();
      return query.toUpperCase();
    });
    const limited = limitConcurrency(client as never, 3) as unknown as typeof client;

    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => limited.unsafe(`q${i}`)));

    expect(results).toEqual(Array.from({ length: 10 }, (_, i) => `Q${i}`));
    expect(stats().peak).toBe(3);
  });

  it("starts queued queries in the order they were issued", async () => {
    const { client, stats } = fakeClient(tick);
    const limited = limitConcurrency(client as never, 1) as unknown as typeof client;

    await Promise.all(["a", "b", "c", "d"].map((q) => limited.unsafe(q)));

    expect(stats().started).toEqual(["a", "b", "c", "d"]);
  });

  it("supports .values() and counts it against the limit", async () => {
    const { client, stats } = fakeClient(async () => {
      await tick();
      return [[1]];
    });
    const limited = limitConcurrency(client as never, 2) as unknown as typeof client;

    const results = await Promise.all(Array.from({ length: 6 }, () => limited.unsafe("select 1").values()));

    expect(results[0]).toEqual({ values: [[1]] });
    expect(stats().peak).toBe(2);
  });

  it("frees the slot when a query fails, and passes the error on", async () => {
    const { client } = fakeClient(async (query) => {
      await tick();
      if (query === "bad") throw new Error("boom");
      return "fine";
    });
    const limited = limitConcurrency(client as never, 1) as unknown as typeof client;

    const [failed, next] = await Promise.allSettled([limited.unsafe("bad"), limited.unsafe("good")]);

    expect(failed).toMatchObject({ status: "rejected", reason: expect.objectContaining({ message: "boom" }) });
    expect(next).toEqual({ status: "fulfilled", value: "fine" });
  });

  it("leaves everything except unsafe untouched", () => {
    const { client } = fakeClient(tick);
    const limited = limitConcurrency(client as never, 2) as unknown as typeof client;
    expect(limited.other).toBe("untouched");
  });

  it("rejects a limit below one", () => {
    const { client } = fakeClient(tick);
    expect(() => limitConcurrency(client as never, 0)).toThrow(RangeError);
  });
});
