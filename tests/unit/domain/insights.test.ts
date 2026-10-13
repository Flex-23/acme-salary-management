import { describe, expect, it } from "vitest";
import { histogram, max, mean, median, min, summarize } from "@/server/domain/insights";

describe("min / max / mean", () => {
  it("return null for empty input", () => {
    expect(min([])).toBeNull();
    expect(max([])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("handle a single value", () => {
    expect(min([7])).toBe(7);
    expect(max([7])).toBe(7);
    expect(mean([7])).toBe(7);
  });

  it("compute over several values", () => {
    expect(min([5, 1, 9])).toBe(1);
    expect(max([5, 1, 9])).toBe(9);
    expect(mean([1, 2, 6])).toBe(3);
  });
});

describe("median", () => {
  it("returns null for empty input", () => {
    expect(median([])).toBeNull();
  });

  it("returns the middle value for an odd count", () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it("averages the two middle values for an even count", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("does not mutate its input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("summarize", () => {
  it("returns null for empty input", () => {
    expect(summarize([])).toBeNull();
  });

  it("returns all statistics together", () => {
    expect(summarize([10, 20, 60])).toEqual({
      count: 3,
      min: 10,
      max: 60,
      mean: 30,
      median: 20,
    });
  });
});

describe("histogram", () => {
  it("returns no buckets for empty input", () => {
    expect(histogram([], 100)).toEqual([]);
  });

  it("groups values into half-open bands, including empty ones between", () => {
    expect(histogram([0, 99, 100, 350], 100)).toEqual([
      { from: 0, to: 100, count: 2 },
      { from: 100, to: 200, count: 1 },
      { from: 200, to: 300, count: 0 },
      { from: 300, to: 400, count: 1 },
    ]);
  });

  it("starts at the band containing the smallest value", () => {
    expect(histogram([250, 260], 100)).toEqual([{ from: 200, to: 300, count: 2 }]);
  });

  it("rejects a non-positive band width", () => {
    expect(() => histogram([1], 0)).toThrow(RangeError);
  });
});
