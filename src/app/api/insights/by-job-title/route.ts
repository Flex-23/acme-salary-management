import { handleErrors } from "@/server/http/errors";
import { requireCountryParam } from "@/server/services/insights-service";
import { cachedByJobTitle } from "../../_lib/cache";

export const GET = handleErrors(async (request: Request) => {
  const country = requireCountryParam(new URL(request.url).searchParams.get("country"));
  return Response.json({ data: await cachedByJobTitle(country) });
});
