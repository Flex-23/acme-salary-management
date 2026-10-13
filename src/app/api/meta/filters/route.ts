import { handleErrors } from "@/server/http/errors";
import { cachedFilterOptions } from "../../_lib/cache";

export const GET = handleErrors(async () => Response.json({ data: await cachedFilterOptions() }));
