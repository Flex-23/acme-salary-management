import { handleErrors } from "@/server/http/errors";
import { cachedByCountry } from "../../_lib/cache";

export const GET = handleErrors(async () => Response.json({ data: await cachedByCountry() }));
