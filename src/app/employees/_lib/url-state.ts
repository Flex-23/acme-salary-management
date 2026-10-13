import { DEFAULT_PAGE_SIZE, DEFAULT_SORT, type ListEmployeesQueryData } from "@/server/domain/employee";

/** The table's whole state: it lives in the URL, so every view is shareable. */
export type TableParams = ListEmployeesQueryData;

const FILTER_KEYS = ["search", "country", "department", "jobTitle"] as const;

/** Builds the URL for the given state, leaving out everything that equals the default. */
export function hrefFor(pathname: string, params: TableParams): string {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  if (params.page !== 1) query.set("page", String(params.page));
  if (params.pageSize !== DEFAULT_PAGE_SIZE) query.set("pageSize", String(params.pageSize));
  const { field, direction } = params.sort;
  if (field !== DEFAULT_SORT.field || direction !== DEFAULT_SORT.direction) query.set("sort", `${field}:${direction}`);

  const text = query.toString();
  return text ? `${pathname}?${text}` : pathname;
}

/** Applies a change; anything other than a plain page change returns to the first page. */
export function updateParams(current: TableParams, patch: Partial<TableParams>): TableParams {
  const next = { ...current, ...patch };
  return "page" in patch ? next : { ...next, page: 1 };
}

export function hasActiveFilters(params: TableParams): boolean {
  return FILTER_KEYS.some((key) => Boolean(params[key]));
}

/** Removes search and filters; the page size and sort stay as the user set them. */
export function clearFilters(params: TableParams): TableParams {
  return { ...params, search: undefined, country: undefined, department: undefined, jobTitle: undefined, page: 1 };
}
