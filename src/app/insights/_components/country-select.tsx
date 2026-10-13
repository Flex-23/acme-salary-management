"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hrefWithParam } from "../_lib/insights-params";

const ALL = "__all__";

type Props = {
  /** The URL parameter that holds the choice. */
  param: string;
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  /** When set, adds a first entry that clears the choice ("All countries"). */
  allLabel?: string;
};

/** A country dropdown whose value lives in the URL (other parameters are kept), so the view is shareable. */
export function CountrySelect({ param, label, value, options, allLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [pending, startTransition] = useTransition();
  const labelId = useId();

  const items = allLabel ? [{ value: ALL, label: allLabel }, ...options] : options;

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <span id={labelId} className="text-sm text-muted-foreground">
        {label}
      </span>
      <Select
        items={items}
        value={value ?? (allLabel ? ALL : null)}
        onValueChange={(next) => {
          const chosen = !next || next === ALL ? undefined : next;
          startTransition(() => router.push(hrefWithParam(pathname, query, param, chosen), { scroll: false }));
        }}
      >
        <SelectTrigger aria-labelledby={labelId} className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
