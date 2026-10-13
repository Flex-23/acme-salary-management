import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";
import { PROXY_MATCHER_SOURCE } from "@/server/http/basic-auth";

const request = (authorization?: string) =>
  ({ headers: new Headers(authorization ? { authorization } : {}) }) as unknown as Parameters<typeof proxy>[0];
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it("uses the matcher that the unit tests cover", () => {
    expect(config.matcher).toEqual([PROXY_MATCHER_SOURCE]);
  });

  it("does nothing when the protection variables are not set", () => {
    vi.stubEnv("BASIC_AUTH_USER", "");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "");
    expect(proxy(request()).headers.get("x-proxy")).toBe("continue");
  });

  it("asks for credentials when they are set and the request has none", () => {
    vi.stubEnv("BASIC_AUTH_USER", "demo");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "pw");
    const response = proxy(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
  });

  it("lets a request with the right credentials continue", () => {
    vi.stubEnv("BASIC_AUTH_USER", "demo");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "pw");
    expect(proxy(request(basic("demo", "pw"))).headers.get("x-proxy")).toBe("continue");
  });

  it("rejects wrong credentials", () => {
    vi.stubEnv("BASIC_AUTH_USER", "demo");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "pw");
    expect(proxy(request(basic("demo", "nope"))).status).toBe(401);
  });

  it("refuses everything when only one variable is set", () => {
    vi.stubEnv("BASIC_AUTH_USER", "demo");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "");
    expect(proxy(request(basic("demo", "pw"))).status).toBe(503);
  });
});
