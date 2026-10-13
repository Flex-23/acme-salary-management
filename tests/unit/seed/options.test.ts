import { describe, expect, it } from "vitest";
import { DEFAULT_COUNT, DEFAULT_SEED } from "@/server/db/seed/generate";
import { parseSeedOptions } from "@/server/db/seed/options";

describe("parseSeedOptions", () => {
  it("uses the defaults when no arguments are given", () => {
    expect(parseSeedOptions([], undefined)).toEqual({ count: DEFAULT_COUNT, seed: DEFAULT_SEED });
  });

  it("reads --count and --seed in both forms", () => {
    expect(parseSeedOptions(["--count=50", "--seed", "9"], "development")).toEqual({ count: 50, seed: 9 });
  });

  it("rejects a count that is not a positive integer", () => {
    for (const bad of ["0", "-5", "1.5", "abc", ""]) {
      expect(() => parseSeedOptions([`--count=${bad}`], undefined)).toThrow("--count");
    }
  });

  it("rejects an unreasonably large count", () => {
    expect(() => parseSeedOptions(["--count=5000000"], undefined)).toThrow("--count");
  });

  it("rejects unknown arguments", () => {
    expect(() => parseSeedOptions(["--wat"], undefined)).toThrow("--wat");
  });

  it("refuses to run in production without --force", () => {
    expect(() => parseSeedOptions([], "production")).toThrow("--force");
  });

  it("runs in production when --force is passed", () => {
    expect(parseSeedOptions(["--force"], "production")).toEqual({ count: DEFAULT_COUNT, seed: DEFAULT_SEED });
  });
});
