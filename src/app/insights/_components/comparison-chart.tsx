"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactUsd, type ComparisonPoint } from "../_lib/insights-format";
import { AXIS_TICK, CHART_COLORS } from "./chart-theme";

const ROW_HEIGHT = 56;
const CHROME_HEIGHT = 96;

type TooltipProps = { active?: boolean; payload?: { payload: ComparisonPoint }[] };

function ComparisonTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{point.name}</p>
      <p className="text-xs text-muted-foreground">{point.headcount.toLocaleString("en-US")} employees</p>
      <p className="mt-1.5 flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: CHART_COLORS.median }} />
        Median <span className="ml-auto pl-4 font-medium tabular-nums">{point.medianLabel}</span>
      </p>
      <p className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: CHART_COLORS.average }} />
        Average <span className="ml-auto pl-4 font-medium tabular-nums">{point.averageLabel}</span>
      </p>
    </div>
  );
}

type Props = {
  /** Names the chart for assistive technology; also shown in the SVG's <title>. */
  title: string;
  description: string;
  data: ComparisonPoint[];
};

/** Horizontal grouped bars: median and average annual salary in USD per group. */
export function ComparisonChart({ title, description, data }: Props) {
  return (
    <figure className="w-full" aria-label={title}>
      <p className="sr-only">
        {description} The exact figures are in the table below.
      </p>
      <ResponsiveContainer width="100%" height={data.length * ROW_HEIGHT + CHROME_HEIGHT}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 28, left: 8 }} barGap={2} title={title} desc={description}>
          <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickFormatter={(dollars: number) => compactUsd(dollars * 100)}
            label={{ value: "Annual salary (USD)", position: "insideBottom", offset: -16, fill: CHART_COLORS.axis, fontSize: 12 }}
          />
          <YAxis type="category" dataKey="name" width={136} tick={AXIS_TICK} interval={0} />
          <Tooltip content={<ComparisonTooltip />} cursor={{ fill: CHART_COLORS.cursor }} />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="square"
            itemSorter={(item) => (item.value === "Median" ? 0 : 1)}
            formatter={(name: string) => <span style={{ color: CHART_COLORS.axis }}>{name}</span>}
          />
          <Bar dataKey="median" name="Median" fill={CHART_COLORS.median} radius={[0, 3, 3, 0]} isAnimationActive={false} />
          <Bar dataKey="average" name="Average" fill={CHART_COLORS.average} radius={[0, 3, 3, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
