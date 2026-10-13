import { optionalCountryParam } from "@/server/services/insights-service";
import { cachedDistribution } from "../../_lib/cache";
import { apiRoute } from "../../_lib/route";

export const GET = apiRoute(async (request: Request) => {
  const country = optionalCountryParam(new URL(request.url).searchParams.get("country"));
  return Response.json({ data: await cachedDistribution(country) });
});
