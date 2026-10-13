import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import { employees } from "@/server/db/schema";
import { generateEmployees } from "@/server/db/seed/generate";
import { MAX_BATCH_SIZE, writeEmployees } from "@/server/db/seed/write";
import { createTestDb } from "../support/test-db";

const database = createTestDb();

afterAll(async () => {
  await (await database).client.close();
});

const rowCount = async () => {
  const { db } = await database;
  const [row] = await db.select({ total: count() }).from(employees);
  return row?.total ?? 0;
};

describe("writeEmployees", () => {
  beforeEach(async () => {
    const { db } = await database;
    await db.delete(employees);
  });

  it("inserts every generated employee with its id and created_at", async () => {
    const { db } = await database;
    const rows = generateEmployees({ count: 50, seed: 1 });
    await writeEmployees(db, rows);

    expect(await rowCount()).toBe(50);
    const [first] = rows;
    const stored = await db.select().from(employees);
    expect(stored.find((e) => e.id === first!.id)).toEqual(first);
  });

  it("is idempotent: running twice leaves the same rows", async () => {
    const { db } = await database;
    const rows = generateEmployees({ count: 50, seed: 1 });
    await writeEmployees(db, rows);
    await writeEmployees(db, rows);
    expect(await rowCount()).toBe(50);
  });

  it("replaces whatever was there before", async () => {
    const { db } = await database;
    await writeEmployees(db, generateEmployees({ count: 30, seed: 1 }));
    await writeEmployees(db, generateEmployees({ count: 10, seed: 2 }));
    expect(await rowCount()).toBe(10);
  });

  it("inserts in batches and reports progress after each one", async () => {
    const { db } = await database;
    const progress: number[] = [];
    await writeEmployees(db, generateEmployees({ count: 50, seed: 1 }), {
      batchSize: 20,
      onProgress: (inserted) => progress.push(inserted),
    });
    expect(progress).toEqual([20, 40, 50]);
  });

  it("rolls everything back when a batch fails, keeping the previous data", async () => {
    const { db } = await database;
    await writeEmployees(db, generateEmployees({ count: 5, seed: 1 }));

    const rows = generateEmployees({ count: 50, seed: 2 });
    rows[45] = { ...rows[45]!, email: rows[0]!.email };
    await expect(writeEmployees(db, rows, { batchSize: 20 })).rejects.toThrow();

    expect(await rowCount()).toBe(5);
  });

  it("rejects a batch size that would exceed the Postgres parameter limit", async () => {
    const { db } = await database;
    await expect(writeEmployees(db, [], { batchSize: MAX_BATCH_SIZE + 1 })).rejects.toThrow("batchSize");
    await expect(writeEmployees(db, [], { batchSize: 0 })).rejects.toThrow("batchSize");
  });

  it("writes the full default dataset in batches of 1,000", async () => {
    const { db } = await database;
    const progress: number[] = [];
    await writeEmployees(db, generateEmployees({}), { onProgress: (inserted) => progress.push(inserted) });
    expect(await rowCount()).toBe(10_000);
    expect(progress).toHaveLength(10);
  });

  it("handles an empty list by clearing the table", async () => {
    const { db } = await database;
    await writeEmployees(db, generateEmployees({ count: 5, seed: 1 }));
    await writeEmployees(db, []);
    expect(await rowCount()).toBe(0);
  });
});
