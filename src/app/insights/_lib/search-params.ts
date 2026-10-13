export type RawSearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter (the URL may repeat it). */
export function firstParam(params: RawSearchParams, name: string): string | undefined {
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}
