import { cachedSummary } from "../../_lib/cache";
import { apiRoute } from "../../_lib/route";

export const GET = apiRoute(async () => Response.json({ data: await cachedSummary() }));
