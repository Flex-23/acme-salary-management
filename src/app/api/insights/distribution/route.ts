import { handleErrors } from "@/server/http/errors";
import { optionalCountryParam } from "@/server/services/insights-service";
import { cachedDistribution } from "../../_lib/cache";

export const GET = handleErrors(async (request: Request) => {
  const country = optionalCountryParam(new URL(request.url).searchParams.get("country"));
  return Response.json({ data: await cachedDistribution(country) });
});
