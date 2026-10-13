"use client";

import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

type Option = { value: string; label: string };

type Props = {
  label: string;
  allLabel: string;
  value: string | undefined;
  options: Option[];
  onChange: (value: string | undefined) => void;
};

/** A "filter by X" dropdown whose first entry clears the filter. */
export function FilterSelect({ label, allLabel, value, options, onChange }: Props) {
  const labelId = useId();
  const items = [{ value: ALL, label: allLabel }, ...options];
  // A value from the URL that is not in the list (for example a job title nobody has any more) must still be visible.
  if (value && !options.some((option) => option.value === value)) items.push({ value, label: value });

  return (
    <div>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <Select
        items={items}
        value={value ?? ALL}
        onValueChange={(next) => onChange(!next || next === ALL ? undefined : next)}
      >
        <SelectTrigger aria-labelledby={labelId} className="w-44 max-w-full">
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
