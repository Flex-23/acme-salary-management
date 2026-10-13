"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { COUNTRIES } from "@/server/domain/countries";
import type { FilterOptions } from "@/server/repositories/employee-repository";
import { hasActiveFilters, type TableParams } from "../_lib/url-state";
import { FilterSelect } from "./filter-select";
import { SearchInput } from "./search-input";

const countryName = (code: string) => COUNTRIES.find((country) => country.code === code)?.name ?? code;
const asOption = (value: string) => ({ value, label: value });

type Props = {
  params: TableParams;
  filterOptions: FilterOptions;
  onChange: (patch: Partial<TableParams>, options?: { replace?: boolean }) => void;
  onClear: () => void;
  /** Right-aligned actions, such as "Add employee". */
  actions?: ReactNode;
};

export function TableToolbar({ params, filterOptions, onChange, onClear, actions }: Props) {
  return (
    <div role="search" className="flex flex-wrap items-center gap-2">
      <SearchInput value={params.search ?? ""} onSearch={(search) => onChange({ search: search || undefined }, { replace: true })} />
      <FilterSelect
        label="Filter by country"
        allLabel="All countries"
        value={params.country}
        options={filterOptions.countries.map((code) => ({ value: code, label: countryName(code) }))}
        onChange={(country) => onChange({ country })}
      />
      <FilterSelect
        label="Filter by department"
        allLabel="All departments"
        value={params.department}
        options={filterOptions.departments.map(asOption)}
        onChange={(department) => onChange({ department })}
      />
      <FilterSelect
        label="Filter by job title"
        allLabel="All job titles"
        value={params.jobTitle}
        options={filterOptions.jobTitles.map(asOption)}
        onChange={(jobTitle) => onChange({ jobTitle })}
      />
      {hasActiveFilters(params) && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
}
