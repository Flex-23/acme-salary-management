import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Demo access protection: HTTP Basic Auth in front of the whole app, switched on by two environment
 * variables. It is NOT user authentication (there are no accounts, roles or sessions; ADR 22). It only
 * keeps a public demo deployment from being browsed and edited by anyone who finds the URL.
 */

export type BasicAuthConfig = { user: string; password: string };

export type BasicAuthSetting =
  | { status: "off" }
  | { status: "on"; config: BasicAuthConfig }
  | { status: "misconfigured" };

export type GuardOutcome = { action: "allow" } | { action: "deny"; response: Response };

type Env = Record<string, string | undefined>;

/**
 * Paths the proxy runs on: everything except the health check (for uptime monitors) and Next.js's
 * static assets (JavaScript, CSS and images, which hold no data). Must be a constant for Next.js.
 */
export const PROXY_MATCHER_SOURCE = "/((?!api/health$|_next/static|_next/image|favicon\\.ico$).*)";

const REALM = "ACME Salary Management";

/** Both variables set means on, neither means off. Only one is a mistake, and the app must not end up open by accident. */
export function basicAuthConfigFrom(env: Env): BasicAuthSetting {
  const user = env.BASIC_AUTH_USER ?? "";
  const password = env.BASIC_AUTH_PASSWORD ?? "";
  if (user === "" && password === "") return { status: "off" };
  if (user === "" || password === "") return { status: "misconfigured" };
  return { status: "on", config: { user, password } };
}

/** Compares two strings in constant time, whatever their lengths, by comparing fixed-size digests. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Reads `user:password` out of an `Authorization: Basic ...` header. The password may itself contain colons. */
function parseBasicHeader(header: string | null): { user: string; password: string } | null {
  const match = /^basic +([A-Za-z0-9+/=_-]+)$/i.exec(header?.trim() ?? "");
  if (!match?.[1]) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon < 0) return null;
  return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
}

export function checkCredentials(header: string | null, config: BasicAuthConfig): boolean {
  const given = parseBasicHeader(header);
  if (!given || given.user === "" || given.password === "") return false;
  // Both comparisons always run (no early exit), so timing does not reveal which one failed.
  const userMatches = sameSecret(given.user, config.user);
  const passwordMatches = sameSecret(given.password, config.password);
  return userMatches && passwordMatches;
}

const deny = (status: number, code: string, message: string, headers: Record<string, string> = {}): GuardOutcome => ({
  action: "deny",
  response: Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store", ...headers } }),
});

/** Decides whether a request may proceed. The same message is used for every failure: it never says what was wrong. */
export function guardRequest(authorization: string | null, env: Env): GuardOutcome {
  const setting = basicAuthConfigFrom(env);
  if (setting.status === "off") return { action: "allow" };
  if (setting.status === "misconfigured") {
    return deny(503, "ACCESS_PROTECTION_MISCONFIGURED", "Access protection is not configured correctly");
  }
  if (checkCredentials(authorization, setting.config)) return { action: "allow" };
  return deny(401, "UNAUTHORIZED", "Authentication required", {
    "www-authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
  });
}
