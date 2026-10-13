export type Summary = {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
};

/** `to` is null for the open-ended top band. */
export type Band = { from: number; to: number | null; count: number };

export function min(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => Math.min(a, b));
}

export function max(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => Math.max(a, b));
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] as number;
  if (sorted.length % 2 === 1) return upper;
  return ((sorted[middle - 1] as number) + upper) / 2;
}

export function summarize(values: readonly number[]): Summary | null {
  if (values.length === 0) return null;
  return {
    count: values.length,
    min: min(values) as number,
    max: max(values) as number,
    mean: mean(values) as number,
    median: median(values) as number,
  };
}

/**
 * Buckets values into half-open bands [from, to) of the given width, with no gaps.
 * With a cap, every value at or above it falls into one final open-ended band (`to: null`), so a
 * single outlier cannot produce hundreds of empty bands. The cap must be a multiple of the width.
 */
export function histogram(values: readonly number[], width: number, cap?: number): Band[] {
  if (!(width > 0)) throw new RangeError("Band width must be positive");
  if (cap !== undefined && (cap <= 0 || cap % width !== 0)) {
    throw new RangeError("The cap must be a positive multiple of the band width");
  }
  const lowest = min(values);
  const highest = max(values);
  if (lowest === null || highest === null) return [];

  const capIndex = cap === undefined ? Infinity : cap / width;
  const indexOf = (value: number) => Math.min(Math.floor(value / width), capIndex);
  const first = indexOf(lowest);
  const last = indexOf(highest);

  const bands: Band[] = [];
  for (let i = first; i <= last; i++) {
    bands.push({ from: i * width, to: i === capIndex ? null : (i + 1) * width, count: 0 });
  }
  for (const value of values) {
    const band = bands[indexOf(value) - first] as Band;
    band.count += 1;
  }
  return bands;
}
