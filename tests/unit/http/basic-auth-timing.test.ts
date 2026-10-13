import { beforeEach, describe, expect, it, vi } from "vitest";

const spy = vi.hoisted(() => ({ calls: [] as { a: number; b: number }[] }));

vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:crypto")>();
  return {
    ...original,
    timingSafeEqual: (a: Uint8Array, b: Uint8Array) => {
      spy.calls.push({ a: a.byteLength, b: b.byteLength });
      return original.timingSafeEqual(a, b);
    },
  };
});

import { checkCredentials } from "@/server/http/basic-auth";

const header = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
const config = { user: "demo", password: "a-much-longer-password-than-the-user-name" };

describe("constant-time comparison", () => {
  beforeEach(() => {
    spy.calls.length = 0;
  });

  it("compares fixed-size digests, so the lengths of the secrets are not revealed", () => {
    checkCredentials(header("d", "x"), config);
    checkCredentials(header("demo-with-a-very-long-user-name-indeed", "short"), config);
    expect(spy.calls.length).toBe(4);
    for (const call of spy.calls) expect(call).toEqual({ a: 32, b: 32 });
  });

  it("always compares both user and password, even when the user is already wrong", () => {
    expect(checkCredentials(header("wrong", config.password), config)).toBe(false);
    expect(spy.calls.length).toBe(2);
  });

  it("does not compare anything for a malformed header (nothing secret is involved)", () => {
    expect(checkCredentials("Basic", config)).toBe(false);
    expect(spy.calls.length).toBe(0);
  });
});
