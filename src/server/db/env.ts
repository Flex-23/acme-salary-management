import { loadEnvConfig } from "@next/env";

let loaded = false;

/**
 * Reads a required environment variable, loading `.env*` files the way Next.js does.
 * Works outside Next (drizzle-kit, the seed script) as well as inside it.
 */
export function requireEnv(name: string): string {
  if (!loaded) {
    loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
    loaded = true;
  }
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}
