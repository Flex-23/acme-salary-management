"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { clearFilters, hrefFor, updateParams, type TableParams } from "./url-state";

type Options = {
  /** Typing in the search box would otherwise add a history entry per pause, so it replaces the current one. */
  replace?: boolean;
};

/**
 * Moves the table to a new state by changing the URL. The server re-renders with the new
 * query, so sorting, paging and filtering are always server-side and shareable. Each change is
 * a history entry, so the browser's back button steps through them.
 */
export function useTableNavigation(params: TableParams) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const go = (next: TableParams, { replace = false }: Options = {}) => {
    const href = hrefFor(pathname, next);
    startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
  };

  return {
    /** True while the server is producing the next view. */
    isPending,
    update: (patch: Partial<TableParams>, options?: Options) => go(updateParams(params, patch), options),
    clear: () => go(clearFilters(params)),
    /** Re-fetches the current view, for example after a create, edit or delete. */
    refresh: () => startTransition(() => router.refresh()),
  };
}
