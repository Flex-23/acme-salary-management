import { connection } from "next/server";
import { cachedDistribution, cachedFilterOptions } from "@/app/api/_lib/cache";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COUNTRIES, getCountry } from "@/server/domain/countries";
import { distributionData } from "../_lib/insights-format";
import { DISTRIBUTION_COUNTRY_PARAM, resolveDistributionCountry } from "../_lib/insights-params";
import { firstParam, type RawSearchParams } from "../_lib/search-params";
import { CountrySelect } from "./country-select";
import { DistributionChart } from "./distribution-chart";
import { EmptySection } from "./section";

/** Number of employees per annual-salary band in USD, for everyone or for one country (chosen in the URL). */
export async function DistributionSection({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection();
  const [params, filters] = await Promise.all([searchParams, cachedFilterOptions()]);
  const requested = resolveDistributionCountry(firstParam(params, DISTRIBUTION_COUNTRY_PARAM));
  const country = requested && filters.countries.includes(requested) ? requested : undefined;

  const bands = await cachedDistribution(country);
  const options = COUNTRIES.filter((c) => filters.countries.includes(c.code)).map((c) => ({ value: c.code, label: c.name }));
  const scope = country ? getCountry(country).name : "all countries";
  const points = distributionData(bands);
  const total = bands.reduce((sum, band) => sum + band.count, 0);
  const busiest = points.reduce((best, point) => (point.count > best.count ? point : best), points[0] ?? { label: "", range: "", count: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CountrySelect
          param={DISTRIBUTION_COUNTRY_PARAM}
          label="Country"
          value={country}
          options={options}
          allLabel="All countries"
        />
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString("en-US")} employees in {scope}. Bands are 20,000 USD wide; 300,000 USD and above is one band.
        </p>
      </div>

      {points.length === 0 ? (
        <EmptySection>There are no employees in {scope}.</EmptySection>
      ) : (
        <>
          <DistributionChart
            title={`Number of employees by annual salary band, ${scope}`}
            description={`${total} employees in ${points.length} bands. The most common band is ${busiest.range}, with ${busiest.count} employees.`}
            data={points}
          />
          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              View the exact figures as a table
            </summary>
            <div className="max-h-96 overflow-auto border-t [&_[data-slot=table-container]]:overflow-visible">
              <Table>
                <caption className="sr-only">Employees per annual salary band in USD, {scope}</caption>
                <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
                  <TableRow>
                    <TableHead>Annual salary band (USD)</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {points.map((point) => (
                    <TableRow key={point.range}>
                      <TableCell>{point.range}</TableCell>
                      <TableCell className="text-right tabular-nums">{point.count.toLocaleString("en-US")}</TableCell>
                      <TableCell className="text-right tabular-nums">{((point.count / total) * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
