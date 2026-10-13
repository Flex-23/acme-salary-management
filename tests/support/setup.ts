import { vi } from "vitest";

// Next.js cache and request APIs only work inside a Next.js request, so tests replace them.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
