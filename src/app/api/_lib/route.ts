import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { handleErrors } from "@/server/http/errors";

/**
 * Wraps an API route handler:
 * - `connection()` makes the route run at request time, so the build never queries the database;
 * - errors become the standard error response, except Next.js's own control-flow errors
 *   (for example the prerender bail-out), which must reach the framework.
 */
export function apiRoute<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return handleErrors(
    async (...args: Args) => {
      await connection();
      return handler(...args);
    },
    { rethrow: unstable_rethrow },
  );
}
