"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/server/domain/employee";
import type { PageInfo } from "@/server/services/employee-service";
import { rangeLabel } from "../_lib/format";

const toItem = (size: number) => ({ value: String(size), label: String(size) });

/** The standard sizes, plus the current one if the URL asked for something else (for example 10). */
function pageSizeItems(current: number) {
  const sizes: number[] = [...PAGE_SIZE_OPTIONS];
  if (!sizes.includes(current)) sizes.push(current);
  return sizes.sort((a, b) => a - b).map(toItem);
}

type Props = {
  page: PageInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function TablePagination({ page, onPageChange, onPageSizeChange }: Props) {
  const lastPage = Math.max(page.totalPages, 1);
  const sizeItems = pageSizeItems(page.pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p aria-live="polite" className="text-muted-foreground">
        {rangeLabel(page)}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span id="page-size-label" className="text-muted-foreground">
            Rows per page
          </span>
          <Select
            items={sizeItems}
            value={String(page.pageSize)}
            onValueChange={(value) => value && onPageSizeChange(Number(value))}
          >
            <SelectTrigger size="sm" aria-labelledby="page-size-label" className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <nav aria-label="Pagination" className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)}>
            <ChevronLeftIcon aria-hidden />
            Previous
          </Button>
          <span className="min-w-24 text-center tabular-nums text-muted-foreground">
            Page {page.page} of {lastPage}
          </span>
          <Button variant="outline" size="sm" disabled={page.page >= lastPage} onClick={() => onPageChange(page.page + 1)}>
            Next
            <ChevronRightIcon aria-hidden />
          </Button>
        </nav>
      </div>
    </div>
  );
}
