import { defineConfig } from "drizzle-kit";
import { requireEnv } from "./src/server/db/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dbCredentials: { url: requireEnv("DIRECT_URL") },
});
