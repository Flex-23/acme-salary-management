import { redirect } from "next/navigation";
import { cachedFilterOptions } from "@/app/api/_lib/cache";
import { getServices } from "@/server/container";
import { ListEmployeesQuery } from "@/server/domain/employee";
import { hrefFor } from "../_lib/url-state";
import { EmployeesView } from "./employees-view";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValues(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

/** Server Component: reads the URL, queries the service directly (no HTTP hop) and hands plain data to the client view. */
export async function EmployeesContent({ searchParams }: { searchParams: SearchParams }) {
  const parsed = ListEmployeesQuery.safeParse(firstValues(await searchParams));
  // A hand-edited or outdated URL falls back to the defaults instead of breaking the page.
  const params = parsed.success ? parsed.data : ListEmployeesQuery.parse({});

  const [result, filterOptions] = await Promise.all([getServices().employees.listByQuery(params), cachedFilterOptions()]);

  // The last row of the last page was deleted, or the URL points past the end: show the real last page.
  if (result.data.length === 0 && result.page.total > 0 && params.page > 1) {
    redirect(hrefFor("/employees", { ...params, page: result.page.totalPages }));
  }

  return (
    <EmployeesView
      rows={result.data}
      page={result.page}
      params={params}
      filterOptions={filterOptions}
      ignoredInvalidParams={!parsed.success}
    />
  );
}
