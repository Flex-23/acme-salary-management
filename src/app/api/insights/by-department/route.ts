import { handleErrors } from "@/server/http/errors";
import { cachedByDepartment } from "../../_lib/cache";

export const GET = handleErrors(async () => Response.json({ data: await cachedByDepartment() }));
