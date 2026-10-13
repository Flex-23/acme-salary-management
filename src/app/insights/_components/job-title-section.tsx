import { connection } from "next/server";
import { cachedByJobTitle, cachedFilterOptions } from "@/app/api/_lib/cache";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COUNTRIES, getCountry } from "@/server/domain/countries";
import { resolveTitleCountry, TITLE_COUNTRY_PARAM } from "../_lib/insights-params";
import { firstParam, type RawSearchParams } from "../_lib/search-params";
import { CountrySelect } from "./country-select";
import { EmptySection } from "./section";
import { LocalWithUsd } from "./stats-cells";

/** Pay per job title within one country (chosen in the URL), in that country's currency. */
export async function JobTitleSection({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection();
  const [params, filters] = await Promise.all([searchParams, cachedFilterOptions()]);
  const country = resolveTitleCountry(firstParam(params, TITLE_COUNTRY_PARAM), filters.countries);
  if (!country) return <EmptySection>There are no employees yet.</EmptySection>;

  const titles = await cachedByJobTitle(country);
  const { name, currency } = getCountry(country);
  const options = COUNTRIES.filter((c) => filters.countries.includes(c.code)).map((c) => ({ value: c.code, label: c.name }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CountrySelect param={TITLE_COUNTRY_PARAM} label="Country" value={country} options={options} />
        <p className="text-xs text-muted-foreground">
          {titles.length} job titles in {name}. Amounts in {currency}
          {currency === "USD" ? "" : ", with the USD equivalent underneath"}.
        </p>
      </div>
      {/* The table's own wrapper also scrolls, which would stop the header sticking; this div is the only scroller. */}
      <div className="max-h-[32rem] overflow-auto rounded-md border [&_[data-slot=table-container]]:overflow-visible">
        <Table>
          <caption className="sr-only">
            Pay by job title in {name}, in {currency}
          </caption>
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead>Job title</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead className="text-right">Lowest</TableHead>
              <TableHead className="text-right">Median</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-right">Highest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {titles.map((title) => (
              <TableRow key={title.jobTitle}>
                <TableCell className="font-medium whitespace-normal">{title.jobTitle}</TableCell>
                <TableCell className="text-right tabular-nums">{title.headcount.toLocaleString("en-US")}</TableCell>
                <TableCell>
                  <LocalWithUsd local={title.local.min} usd={title.usd.min} />
                </TableCell>
                <TableCell>
                  <LocalWithUsd local={title.local.median} usd={title.usd.median} />
                </TableCell>
                <TableCell>
                  <LocalWithUsd local={title.local.avg} usd={title.usd.avg} />
                </TableCell>
                <TableCell>
                  <LocalWithUsd local={title.local.max} usd={title.usd.max} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
