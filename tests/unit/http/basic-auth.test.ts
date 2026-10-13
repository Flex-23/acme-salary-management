import { describe, expect, it } from "vitest";
import {
  basicAuthConfigFrom,
  checkCredentials,
  guardRequest,
  PROXY_MATCHER_SOURCE,
  type BasicAuthConfig,
} from "@/server/http/basic-auth";

const config: BasicAuthConfig = { user: "demo", password: "s3cret:pass word" };
const header = (user: string, password: string, scheme = "Basic") =>
  `${scheme} ${Buffer.from(`${user}:${password}`, "utf8").toString("base64")}`;

describe("basicAuthConfigFrom", () => {
  it("is off when neither variable is set, so local development and tests are unaffected", () => {
    expect(basicAuthConfigFrom({})).toEqual({ status: "off" });
    expect(basicAuthConfigFrom({ BASIC_AUTH_USER: "", BASIC_AUTH_PASSWORD: "" })).toEqual({ status: "off" });
  });

  it("is on when both are set", () => {
    expect(basicAuthConfigFrom({ BASIC_AUTH_USER: "demo", BASIC_AUTH_PASSWORD: "pw" })).toEqual({
      status: "on",
      config: { user: "demo", password: "pw" },
    });
  });

  it("is misconfigured, not silently open, when only one of them is set", () => {
    expect(basicAuthConfigFrom({ BASIC_AUTH_USER: "demo" })).toEqual({ status: "misconfigured" });
    expect(basicAuthConfigFrom({ BASIC_AUTH_PASSWORD: "pw" })).toEqual({ status: "misconfigured" });
    expect(basicAuthConfigFrom({ BASIC_AUTH_USER: "demo", BASIC_AUTH_PASSWORD: "" })).toEqual({ status: "misconfigured" });
  });
});

describe("checkCredentials", () => {
  it("accepts the right user and password", () => {
    expect(checkCredentials(header("demo", "s3cret:pass word"), config)).toBe(true);
  });

  it("accepts a password that contains colons and spaces, and non-ASCII text", () => {
    const unicode = { user: "démo", password: "pässwörd:ü 😀" };
    expect(checkCredentials(header(unicode.user, unicode.password), unicode)).toBe(true);
  });

  it("accepts the scheme in any case", () => {
    expect(checkCredentials(header("demo", "s3cret:pass word", "basic"), config)).toBe(true);
    expect(checkCredentials(header("demo", "s3cret:pass word", "BASIC"), config)).toBe(true);
  });

  it("rejects a wrong user, a wrong password, and both", () => {
    expect(checkCredentials(header("other", "s3cret:pass word"), config)).toBe(false);
    expect(checkCredentials(header("demo", "wrong"), config)).toBe(false);
    expect(checkCredentials(header("other", "wrong"), config)).toBe(false);
  });

  it("does not treat a prefix, a suffix or a different case as a match", () => {
    expect(checkCredentials(header("demo", "s3cret"), config)).toBe(false);
    expect(checkCredentials(header("demo", "s3cret:pass word!"), config)).toBe(false);
    expect(checkCredentials(header("DEMO", "s3cret:pass word"), config)).toBe(false);
    expect(checkCredentials(header("demo ", "s3cret:pass word"), config)).toBe(false);
  });

  it("rejects missing, empty and malformed headers without throwing", () => {
    for (const bad of [null, "", "Basic", "Basic ", "Basic !!!not-base64!!!", "Bearer abc", "Basic YWJj", `Basic ${"A".repeat(100_000)}`]) {
      expect(checkCredentials(bad, config), String(bad).slice(0, 20)).toBe(false);
    }
  });

  it("rejects credentials without a colon", () => {
    expect(checkCredentials(`Basic ${Buffer.from("demo").toString("base64")}`, config)).toBe(false);
  });

  it("rejects an empty user and password even if they happened to be configured empty", () => {
    expect(checkCredentials(header("", ""), { user: "", password: "" })).toBe(false);
  });
});

describe("guardRequest", () => {
  const env = { BASIC_AUTH_USER: "demo", BASIC_AUTH_PASSWORD: "pw" };

  it("lets everything through when protection is off", () => {
    expect(guardRequest(null, {})).toEqual({ action: "allow" });
  });

  it("lets a request with the right credentials through", () => {
    expect(guardRequest(header("demo", "pw"), env)).toEqual({ action: "allow" });
  });

  it("answers 401 with a browser prompt and the standard error shape, without credentials", async () => {
    const outcome = guardRequest(null, env);
    expect(outcome.action).toBe("deny");
    if (outcome.action !== "deny") return;
    expect(outcome.response.status).toBe(401);
    expect(outcome.response.headers.get("www-authenticate")).toBe('Basic realm="ACME Salary Management", charset="UTF-8"');
    expect(outcome.response.headers.get("cache-control")).toBe("no-store");
    expect(await outcome.response.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
  });

  it("answers 401 for wrong credentials, and never reveals which part was wrong", async () => {
    const wrongUser = guardRequest(header("x", "pw"), env);
    const wrongPassword = guardRequest(header("demo", "x"), env);
    for (const outcome of [wrongUser, wrongPassword]) {
      expect(outcome.action).toBe("deny");
      if (outcome.action === "deny") expect(await outcome.response.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    }
  });

  it("refuses everything with a 503 when protection is half configured, rather than leaving the app open", async () => {
    const outcome = guardRequest(header("demo", "pw"), { BASIC_AUTH_USER: "demo" });
    expect(outcome.action).toBe("deny");
    if (outcome.action !== "deny") return;
    expect(outcome.response.status).toBe(503);
    expect(await outcome.response.json()).toEqual({ error: { code: "ACCESS_PROTECTION_MISCONFIGURED", message: "Access protection is not configured correctly" } });
  });
});

describe("proxy matcher", () => {
  // Next.js compiles the matcher with path-to-regexp; for this pattern it is the same as this regular expression.
  const matches = (path: string) => new RegExp(`^${PROXY_MATCHER_SOURCE}$`).test(path);

  it("covers pages and the API", () => {
    for (const path of ["/", "/employees", "/insights", "/api/employees", "/api/employees/abc", "/api/insights/summary", "/api/meta/filters"]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it("leaves only the health check and the static assets open", () => {
    for (const path of ["/api/health", "/_next/static/chunks/app.js", "/_next/image", "/favicon.ico"]) {
      expect(matches(path), path).toBe(false);
    }
  });

  it("does not open look-alikes of the health check", () => {
    for (const path of ["/api/health/", "/api/health/extra", "/api/healthz", "/api/health.json", "/api/healthcheck/x"]) {
      expect(matches(path), path).toBe(true); // still protected
    }
  });
});
