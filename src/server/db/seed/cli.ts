import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "../env";
import * as schema from "../schema";
import { generateEmployees } from "./generate";
import { parseSeedOptions } from "./options";
import { writeEmployees } from "./write";

async function main() {
  const { count, seed } = parseSeedOptions(process.argv.slice(2), process.env.NODE_ENV);
  const started = performance.now();

  // Migrations and seeding use the session pooler (DIRECT_URL), not the app's transaction pooler.
  const client = postgres(requireEnv("DIRECT_URL"), { max: 1, connect_timeout: 10 });
  try {
    const rows = generateEmployees({ count, seed });
    console.log(`Generated ${rows.length} employees (seed ${seed}). Writing...`);

    await writeEmployees(drizzle(client, { schema }), rows, {
      onProgress: (inserted, total) => console.log(`  inserted ${inserted}/${total}`),
    });

    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`Done: ${rows.length} employees in ${seconds}s`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
