import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Services } from "@/server/container";
import { createFakeServices, get, idContext, send } from "../../support/api-harness";
import { fixtureId } from "../../support/fixtures";

const harness = vi.hoisted(() => ({ services: undefined as Services | undefined }));
vi.mock("@/server/container", () => ({ getServices: () => harness.services }));

import { DELETE, GET as getOne, PATCH } from "@/app/api/employees/[id]/route";
import { GET as list, POST } from "@/app/api/employees/route";

const validBody = {
  fullName: "Mia Novak",
  email: "mia@acme.com",
  jobTitle: "Designer",
  department: "Product",
  countryCode: "DE",
  salary: 72000,
  hireDate: "2026-01-12",
};

beforeEach(() => {
  harness.services = createFakeServices();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/employees", () => {
  it("returns a page of employees with pagination metadata", async () => {
    const response = await list(get("/api/employees?page=2&pageSize=5&sort=fullName:asc"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.page).toEqual({ page: 2, pageSize: 5, total: 12, totalPages: 3 });
    expect(body.data).toHaveLength(5);
    expect(body.data[0]).toMatchObject({
      fullName: expect.any(String),
      salary: { currency: expect.any(String), formatted: expect.any(String) },
      salaryUsd: { currency: "USD" },
    });
  });

  it("applies search and filters", async () => {
    const body = await (await list(get("/api/employees?search=acme.jp&country=JP"))).json();
    expect(body.data.map((e: { countryCode: string }) => e.countryCode)).toEqual(["JP", "JP"]);
  });

  it("clamps pageSize to 100", async () => {
    const body = await (await list(get("/api/employees?pageSize=1000"))).json();
    expect(body.page.pageSize).toBe(100);
  });

  it("returns 400 in the standard error shape for invalid parameters", async () => {
    const response = await list(get("/api/employees?page=abc&sort=password:asc"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "VALIDATION_ERROR", message: expect.any(String) });
    expect(body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(["page", "sort"]);
  });
});

describe("POST /api/employees", () => {
  it("creates an employee, returns 201 and invalidates the insights cache", async () => {
    const response = await POST(send("POST", "/api/employees", validBody));
    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data).toMatchObject({ fullName: "Mia Novak", salary: { amountMinor: 7_200_000, currency: "EUR" } });
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("insights", { expire: 0 });

    const fetched = await getOne(get(`/api/employees/${data.id}`), idContext(data.id));
    expect(fetched.status).toBe(200);
  });

  it("returns 400 with field details and does not invalidate the cache", async () => {
    const response = await POST(send("POST", "/api/employees", { ...validBody, email: "nope", hireDate: "2099-01-01" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(["email", "hireDate"]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const response = await POST(send("POST", "/api/employees", "{not json"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 for a duplicate email", async () => {
    const response = await POST(send("POST", "/api/employees", { ...validBody, email: "alice@acme.com" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("DUPLICATE_EMAIL");
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("GET /api/employees/:id", () => {
  it("returns the employee", async () => {
    const response = await getOne(get(`/api/employees/${fixtureId(1)}`), idContext(fixtureId(1)));
    expect(response.status).toBe(200);
    expect((await response.json()).data.fullName).toBe("Alice Smith");
  });

  it("returns 404 for an unknown id", async () => {
    const response = await getOne(get("/api/employees/x"), idContext(fixtureId(99)));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Employee not found" } });
  });

  it("returns 404, not 500, for an id that is not a UUID", async () => {
    const response = await getOne(get("/api/employees/abc"), idContext("abc"));
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/employees/:id", () => {
  it("updates the employee and invalidates the insights cache", async () => {
    const response = await PATCH(send("PATCH", "/api/employees/x", { jobTitle: "Staff Engineer" }), idContext(fixtureId(1)));
    expect(response.status).toBe(200);
    expect((await response.json()).data.jobTitle).toBe("Staff Engineer");
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("insights", { expire: 0 });
  });

  it("returns 404 for an unknown employee without invalidating", async () => {
    const response = await PATCH(send("PATCH", "/api/employees/x", { jobTitle: "X" }), idContext(fixtureId(99)));
    expect(response.status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("returns 400 when salary and country are not sent together", async () => {
    const response = await PATCH(send("PATCH", "/api/employees/x", { countryCode: "JP" }), idContext(fixtureId(1)));
    expect(response.status).toBe(400);
  });

  it("returns 409 when the email belongs to someone else", async () => {
    const response = await PATCH(send("PATCH", "/api/employees/x", { email: "bob@acme.com" }), idContext(fixtureId(1)));
    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/employees/:id", () => {
  it("returns 204 with no body and invalidates the insights cache", async () => {
    const response = await DELETE(send("DELETE", "/api/employees/x"), idContext(fixtureId(1)));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("insights", { expire: 0 });
    expect((await getOne(get("/x"), idContext(fixtureId(1)))).status).toBe(404);
  });

  it("returns 404 for an unknown employee without invalidating", async () => {
    const response = await DELETE(send("DELETE", "/api/employees/x"), idContext(fixtureId(99)));
    expect(response.status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("unexpected failures", () => {
  it("return a generic 500 and log the cause server-side", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    harness.services!.employees.list = () => Promise.reject(new Error("relation employees does not exist"));

    const response = await list(get("/api/employees"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
