import { describe, expect, it } from "vitest";
import { basicAuthHeader, credentialsFrom } from "../../../scripts/lib/http-auth";
import { checkCredentials } from "@/server/http/basic-auth";

describe("basicAuthHeader", () => {
  it("builds the standard Basic header", () => {
    expect(basicAuthHeader("demo", "pw")).toBe("Basic ZGVtbzpwdw==");
  });

  it("is accepted by the server-side check, including odd passwords", () => {
    const password = "pa:ss wörd 😀";
    expect(checkCredentials(basicAuthHeader("démo", password), { user: "démo", password })).toBe(true);
  });
});

describe("credentialsFrom", () => {
  it("prefers the flags over the environment", () => {
    expect(credentialsFrom(["--user", "a", "--password", "b"], { BASIC_AUTH_USER: "x", BASIC_AUTH_PASSWORD: "y" })).toEqual({ user: "a", password: "b" });
  });

  it("falls back to the environment", () => {
    expect(credentialsFrom([], { BASIC_AUTH_USER: "x", BASIC_AUTH_PASSWORD: "y" })).toEqual({ user: "x", password: "y" });
  });

  it("returns nothing when no credentials are given", () => {
    expect(credentialsFrom([], {})).toBeUndefined();
  });

  it("refuses half a credential", () => {
    expect(() => credentialsFrom(["--user", "a"], {})).toThrow("both a user and a password");
  });
});
