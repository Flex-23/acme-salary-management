import { NextResponse, type NextRequest } from "next/server";
import { guardRequest } from "@/server/http/basic-auth";

/**
 * Demo access protection (Basic Auth), active only when BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are set.
 * Not user authentication: see docs/DECISIONS.md, ADR 22. In Next.js 16 this file is `proxy.ts`
 * (it was `middleware.ts` before) and runs on the Node.js runtime.
 */
export function proxy(request: NextRequest) {
  const outcome = guardRequest(request.headers.get("authorization"), process.env);
  return outcome.action === "allow" ? NextResponse.next() : outcome.response;
}

// Next.js needs the matcher as a literal it can analyse at build time; a test pins it to PROXY_MATCHER_SOURCE.
export const config = {
  matcher: ["/((?!api/health$|_next/static|_next/image|favicon\\.ico$).*)"],
};
