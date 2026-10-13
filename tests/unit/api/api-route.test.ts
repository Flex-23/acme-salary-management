import { redirect } from "next/navigation";
import { connection } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/server/domain/errors";
import { apiRoute } from "@/app/api/_lib/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("apiRoute", () => {
  it("waits for a real request before running the handler, so nothing is prerendered", async () => {
    const order: string[] = [];
    vi.mocked(connection).mockImplementationOnce(async () => void order.push("connection"));
    const route = apiRoute(async () => {
      order.push("handler");
      return Response.json({ ok: true });
    });

    expect((await route()).status).toBe(200);
    expect(order).toEqual(["connection", "handler"]);
  });

  it("converts application errors into error responses", async () => {
    const route = apiRoute(async () => {
      throw new NotFoundError("Employee");
    });
    expect((await route()).status).toBe(404);
  });

  it("lets Next.js control-flow errors through instead of turning them into a 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const route = apiRoute(async () => redirect("/elsewhere"));

    await expect(route()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(log).not.toHaveBeenCalled();
  });
});
