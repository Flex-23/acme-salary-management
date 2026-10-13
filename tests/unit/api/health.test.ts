import { afterEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ execute: undefined as undefined | (() => Promise<unknown>) }));
vi.mock("@/server/db/client", () => ({ getDb: () => ({ execute: harness.execute }) }));

import { GET } from "@/app/api/health/route";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("returns 200 when the database answers", async () => {
    harness.execute = async () => [{ ok: 1 }];
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "up" });
  });

  it("returns 503 in the standard error shape, without details, when the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    harness.execute = () => Promise.reject(new Error("password authentication failed for user postgres"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "DATABASE_UNAVAILABLE", message: "The database is not reachable" },
    });
  });
});
