import { getServices } from "@/server/container";
import { readJsonBody } from "@/server/http/errors";
import { invalidateInsights } from "../../_lib/cache";
import { apiRoute } from "../../_lib/route";

type Context = { params: Promise<{ id: string }> };

export const GET = apiRoute(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  return Response.json({ data: await getServices().employees.get(id) });
});

export const PATCH = apiRoute(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const updated = await getServices().employees.update(id, await readJsonBody(request));
  invalidateInsights();
  return Response.json({ data: updated });
});

export const DELETE = apiRoute(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  await getServices().employees.delete(id);
  invalidateInsights();
  return new Response(null, { status: 204 });
});
