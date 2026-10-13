import { getDb } from "@/server/db/client";
import { checkDatabase } from "@/server/db/health";
import { handleErrors } from "@/server/http/errors";

const HEALTH_TIMEOUT_MS = 2000;

export const GET = handleErrors(async () => {
  if (await checkDatabase(getDb, HEALTH_TIMEOUT_MS)) {
    return Response.json({ status: "ok", database: "up" });
  }
  return Response.json(
    { error: { code: "DATABASE_UNAVAILABLE", message: "The database is not reachable" } },
    { status: 503 },
  );
});
