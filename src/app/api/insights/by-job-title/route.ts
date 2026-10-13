import { requireCountryParam } from "@/server/services/insights-service";
import { cachedByJobTitle } from "../../_lib/cache";
import { apiRoute } from "../../_lib/route";

export const GET = apiRoute(async (request: Request) => {
  const country = requireCountryParam(new URL(request.url).searchParams.get("country"));
  return Response.json({ data: await cachedByJobTitle(country) });
});
