import { afterEach, describe, expect, it } from "vitest";
import { requireEnv } from "@/server/db/env";

const NAME = "SALARY_TEST_ENV_VALUE";

afterEach(() => {
  delete process.env[NAME];
});

describe("requireEnv", () => {
  it("returns the value of a set variable", () => {
    process.env[NAME] = "postgres://example";
    expect(requireEnv(NAME)).toBe("postgres://example");
  });

  it("names the missing variable in the error", () => {
    expect(() => requireEnv(NAME)).toThrow(NAME);
  });

  it("treats an empty value as missing", () => {
    process.env[NAME] = "";
    expect(() => requireEnv(NAME)).toThrow(NAME);
  });
});
