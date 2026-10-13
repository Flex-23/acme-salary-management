import { describe, expect, it } from "vitest";
import { formatDate, rangeLabel } from "@/app/employees/_lib/format";

describe("rangeLabel", () => {
  it("shows the first page", () => {
    expect(rangeLabel({ page: 1, pageSize: 25, total: 10_000 })).toBe("Showing 1–25 of 10,000");
  });

  it("shows a middle page", () => {
    expect(rangeLabel({ page: 3, pageSize: 50, total: 10_000 })).toBe("Showing 101–150 of 10,000");
  });

  it("stops at the total on the last, partial page", () => {
    expect(rangeLabel({ page: 400, pageSize: 25, total: 9_990 })).toBe("Showing 9,976–9,990 of 9,990");
  });

  it("handles a single result and no results", () => {
    expect(rangeLabel({ page: 1, pageSize: 25, total: 1 })).toBe("Showing 1–1 of 1");
    expect(rangeLabel({ page: 1, pageSize: 25, total: 0 })).toBe("No results");
  });
});

describe("formatDate", () => {
  it("formats an ISO date without shifting it across time zones", () => {
    expect(formatDate("2024-03-01")).toBe("1 Mar 2024");
    expect(formatDate("2026-01-31")).toBe("31 Jan 2026");
  });
});
