"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DistributionPoint } from "../_lib/insights-format";
import { AXIS_TICK, CHART_COLORS } from "./chart-theme";

type TooltipProps = { active?: boolean; payload?: { payload: DistributionPoint }[] };

function DistributionTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{point.range}</p>
      <p className="tabular-nums">
        {point.count.toLocaleString("en-US")} {point.count === 1 ? "employee" : "employees"}
      </p>
    </div>
  );
}

type Props = { title: string; description: string; data: DistributionPoint[] };

/** Number of employees per annual-salary band (USD). Bars are labelled with the band's lower edge. */
export function DistributionChart({ title, description, data }: Props) {
  return (
    <figure className="w-full" aria-label={title}>
      <p className="sr-only">
        {description} The exact figures are in the table below.
      </p>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 32, left: 8 }} barCategoryGap="12%" title={title} desc={description}>
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            interval={0}
            label={{ value: "Annual salary band (USD, from)", position: "insideBottom", offset: -20, fill: CHART_COLORS.axis, fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tick={AXIS_TICK}
            width={56}
            tickFormatter={(count: number) => count.toLocaleString("en-US")}
            label={{ value: "Employees", angle: -90, position: "insideLeft", fill: CHART_COLORS.axis, fontSize: 12 }}
          />
          <Tooltip content={<DistributionTooltip />} cursor={{ fill: CHART_COLORS.cursor }} />
          <Bar dataKey="count" name="Employees" fill={CHART_COLORS.count} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
