import { getServices } from "@/server/container";
import { handleErrors, readJsonBody } from "@/server/http/errors";
import { invalidateInsights } from "../../_lib/cache";

type Context = { params: Promise<{ id: string }> };

export const GET = handleErrors(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  return Response.json({ data: await getServices().employees.get(id) });
});

export const PATCH = handleErrors(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const updated = await getServices().employees.update(id, await readJsonBody(request));
  invalidateInsights();
  return Response.json({ data: updated });
});

export const DELETE = handleErrors(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  await getServices().employees.delete(id);
  invalidateInsights();
  return new Response(null, { status: 204 });
});
