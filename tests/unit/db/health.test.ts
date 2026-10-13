import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/db/database";
import { checkDatabase } from "@/server/db/health";

afterEach(() => {
  vi.restoreAllMocks();
});

const dbWith = (execute: () => Promise<unknown>) => ({ execute }) as unknown as Database;

describe("checkDatabase", () => {
  it("is healthy when the trivial query succeeds", async () => {
    expect(await checkDatabase(() => dbWith(async () => [{ ok: 1 }]), 1000)).toBe(true);
  });

  it("is unhealthy, and logs the cause, when the query fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("connection refused");
    expect(await checkDatabase(() => dbWith(() => Promise.reject(failure)), 1000)).toBe(false);
    expect(log).toHaveBeenCalledWith("Database health check failed", failure);
  });

  it("is unhealthy when the client cannot even be created", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const missingConfig = () => {
      throw new Error("DATABASE_URL is not set");
    };
    expect(await checkDatabase(missingConfig, 1000)).toBe(false);
  });

  it("is unhealthy when the query does not answer within the timeout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const hangs = () => new Promise<never>(() => undefined);
    const started = Date.now();
    expect(await checkDatabase(() => dbWith(hangs), 50)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
