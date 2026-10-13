"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { clearFilters, hrefFor, updateParams, type TableParams } from "./url-state";

/**
 * Moves the table to a new state by changing the URL. The server re-renders with the new
 * query, so sorting, paging and filtering are always server-side and shareable.
 */
export function useTableNavigation(params: TableParams) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const go = (next: TableParams) => {
    startTransition(() => router.replace(hrefFor(pathname, next), { scroll: false }));
  };

  return {
    /** True while the server is producing the next view. */
    isPending,
    update: (patch: Partial<TableParams>) => go(updateParams(params, patch)),
    clear: () => go(clearFilters(params)),
    /** Re-fetches the current view, for example after a create, edit or delete. */
    refresh: () => startTransition(() => router.refresh()),
  };
}
