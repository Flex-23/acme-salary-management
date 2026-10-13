/**
 * One palette for every chart, so the same thing always has the same colour.
 * Blue (median) and amber (average) are distinguishable for the common kinds of colour blindness
 * and both reach 3:1 against the white card background. Plain hex values: SVG attributes do not
 * reliably resolve CSS variables.
 */
export const CHART_COLORS = {
  median: "#2563eb",
  average: "#d97706",
  count: "#2563eb",
  grid: "#e5e5e5",
  axis: "#525252",
  cursor: "#f4f4f5",
} as const;

export const AXIS_TICK = { fill: CHART_COLORS.axis, fontSize: 12 } as const;
