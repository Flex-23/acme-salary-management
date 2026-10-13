import { connection } from "next/server";
import { cachedByDepartment } from "@/app/api/_lib/cache";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { comparisonData } from "../_lib/insights-format";
import { ComparisonChart } from "./comparison-chart";
import { EmptySection } from "./section";
import { Amount } from "./stats-cells";

/** Median and average pay per department. Departments span countries, so everything is in USD. */
export async function DepartmentSection() {
  await connection();
  const departments = await cachedByDepartment();
  if (departments.length === 0) return <EmptySection>There are no employees yet.</EmptySection>;

  const points = comparisonData(departments.map(({ department, headcount, usd }) => ({ label: department, headcount, usd })));

  return (
    <div className="space-y-4">
      <ComparisonChart
        title="Median and average annual salary by department, in USD"
        description={`Compares ${departments.length} departments. Highest median: ${points[0]?.name} at ${points[0]?.medianLabel}.`}
        data={points}
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <caption className="sr-only">Pay by department in USD</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead className="text-right">Lowest</TableHead>
              <TableHead className="text-right">Median</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-right">Highest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map(({ department, headcount, usd }) => (
              <TableRow key={department}>
                <TableCell className="font-medium">{department}</TableCell>
                <TableCell className="text-right tabular-nums">{headcount.toLocaleString("en-US")}</TableCell>
                <TableCell>
                  <Amount money={usd.min} />
                </TableCell>
                <TableCell>
                  <Amount money={usd.median} />
                </TableCell>
                <TableCell>
                  <Amount money={usd.avg} />
                </TableCell>
                <TableCell>
                  <Amount money={usd.max} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
