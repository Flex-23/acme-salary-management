import { connection } from "next/server";
import { cachedByCountry } from "@/app/api/_lib/cache";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { comparisonData } from "../_lib/insights-format";
import { ComparisonChart } from "./comparison-chart";
import { EmptySection } from "./section";
import { Amount, LocalWithUsd } from "./stats-cells";

/** Median and average pay per country (chart in USD so countries compare; table in local currency). */
export async function CountrySection() {
  await connection();
  const countries = await cachedByCountry();
  if (countries.length === 0) return <EmptySection>There are no employees yet.</EmptySection>;

  const points = comparisonData(countries.map(({ countryName, headcount, usd }) => ({ label: countryName, headcount, usd })));

  return (
    <div className="space-y-4">
      <ComparisonChart
        title="Median and average annual salary by country, in USD"
        description={`Compares ${countries.length} countries. Highest median: ${points[0]?.name} at ${points[0]?.medianLabel}.`}
        data={points}
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <caption className="sr-only">Pay by country in local currency, with USD equivalents</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead className="text-right">Median</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-right">Lowest</TableHead>
              <TableHead className="text-right">Highest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {countries.map((country) => (
              <TableRow key={country.countryCode}>
                <TableCell className="font-medium">
                  {country.countryName} <span className="text-xs font-normal text-muted-foreground">{country.currency}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{country.headcount.toLocaleString("en-US")}</TableCell>
                <TableCell>
                  <LocalWithUsd local={country.local.median} usd={country.usd.median} />
                </TableCell>
                <TableCell>
                  <LocalWithUsd local={country.local.avg} usd={country.usd.avg} />
                </TableCell>
                <TableCell>
                  <Amount money={country.local.min} />
                </TableCell>
                <TableCell>
                  <Amount money={country.local.max} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
