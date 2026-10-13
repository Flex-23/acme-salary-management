import { describe, expect, it } from "vitest";
import { DEFAULT_POOL_SIZE, MAX_POOL_SIZE, parsePoolSize } from "@/server/db/pool-size";

describe("parsePoolSize", () => {
  it("defaults to a small pool when nothing is configured", () => {
    expect(parsePoolSize(undefined)).toBe(DEFAULT_POOL_SIZE);
    expect(parsePoolSize("")).toBe(DEFAULT_POOL_SIZE);
    expect(DEFAULT_POOL_SIZE).toBe(5);
  });

  it("accepts a whole number within the allowed range", () => {
    expect(parsePoolSize("1")).toBe(1);
    expect(parsePoolSize("12")).toBe(12);
    expect(parsePoolSize(String(MAX_POOL_SIZE))).toBe(MAX_POOL_SIZE);
  });

  it("refuses anything else, naming the setting, instead of silently picking a value", () => {
    for (const bad of ["0", "-3", "2.5", "abc", "1e3", String(MAX_POOL_SIZE + 1)]) {
      expect(() => parsePoolSize(bad), bad).toThrow("DATABASE_POOL_SIZE");
    }
  });
});
