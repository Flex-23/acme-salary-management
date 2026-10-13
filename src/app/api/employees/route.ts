import { getServices } from "@/server/container";
import { readJsonBody } from "@/server/http/errors";
import { apiRoute } from "../_lib/route";
import { invalidateInsights } from "../_lib/cache";

export const GET = apiRoute(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getServices().employees.list(query));
});

export const POST = apiRoute(async (request: Request) => {
  const created = await getServices().employees.create(await readJsonBody(request));
  invalidateInsights();
  return Response.json({ data: created }, { status: 201 });
});
