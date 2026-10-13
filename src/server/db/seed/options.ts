import { DEFAULT_COUNT, DEFAULT_SEED } from "./generate";

const MAX_COUNT = 1_000_000;

export type SeedOptions = { count: number; seed: number };

function readInteger(flag: string, raw: string | undefined, min: number, max: number): number {
  const value = Number(raw);
  if (raw === undefined || raw.trim() === "" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${flag} must be an integer between ${min} and ${max}`);
  }
  return value;
}

/** Parses CLI arguments (`--count`, `--seed`, `--force`) and applies the production guard. */
export function parseSeedOptions(argv: readonly string[], nodeEnv: string | undefined): SeedOptions {
  let count = DEFAULT_COUNT;
  let seed = DEFAULT_SEED;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const [flag = "", inlineValue] = (argv[i] ?? "").split("=");
    const value = () => inlineValue ?? argv[++i];
    if (flag === "--count") count = readInteger("--count", value(), 1, MAX_COUNT);
    else if (flag === "--seed") seed = readInteger("--seed", value(), 0, Number.MAX_SAFE_INTEGER);
    else if (flag === "--force") force = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }

  if (nodeEnv === "production" && !force) {
    throw new Error("Refusing to seed with NODE_ENV=production. Pass --force to override.");
  }
  return { count, seed };
}
