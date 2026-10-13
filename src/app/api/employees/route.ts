import { getServices } from "@/server/container";
import { handleErrors, readJsonBody } from "@/server/http/errors";
import { invalidateInsights } from "../_lib/cache";

export const GET = handleErrors(async (request: Request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await getServices().employees.list(query));
});

export const POST = handleErrors(async (request: Request) => {
  const created = await getServices().employees.create(await readJsonBody(request));
  invalidateInsights();
  return Response.json({ data: created }, { status: 201 });
});
