import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmployee, deleteEmployee, updateEmployee } from "@/app/employees/_lib/employees-api";

const body = {
  fullName: "Mia Novak",
  email: "mia@acme.com",
  jobTitle: "Designer",
  department: "Product",
  countryCode: "DE",
  salary: 72000,
  hireDate: "2024-01-12",
};

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createEmployee", () => {
  it("POSTs the body as JSON and returns the created employee", async () => {
    const fetchMock = stubFetch(Response.json({ data: { id: "1" } }, { status: 201 }));
    const result = await createEmployee(body);

    expect(fetchMock).toHaveBeenCalledWith("/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(result).toEqual({ ok: true, data: { id: "1" } });
  });

  it("returns the API error as-is", async () => {
    stubFetch(Response.json({ error: { code: "DUPLICATE_EMAIL", message: "exists" } }, { status: 409 }));
    expect(await createEmployee(body)).toEqual({ ok: false, error: { code: "DUPLICATE_EMAIL", message: "exists" } });
  });

  it("reports a network failure", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await createEmployee(body)).toEqual({
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Could not reach the server" },
    });
  });

  it("treats an unreadable error response as an unexpected failure", async () => {
    stubFetch(new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await createEmployee(body)).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Unexpected response from the server" },
    });
  });
});

describe("updateEmployee", () => {
  it("PATCHes the employee's URL", async () => {
    const fetchMock = stubFetch(Response.json({ data: { id: "1" } }));
    await updateEmployee("1", body);
    expect(fetchMock).toHaveBeenCalledWith("/api/employees/1", expect.objectContaining({ method: "PATCH", body: JSON.stringify(body) }));
  });
});

describe("deleteEmployee", () => {
  it("DELETEs and succeeds on 204 with no body", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    expect(await deleteEmployee("1")).toEqual({ ok: true, data: undefined });
    expect(fetchMock).toHaveBeenCalledWith("/api/employees/1", { method: "DELETE" });
  });

  it("returns a 404 as an error", async () => {
    stubFetch(Response.json({ error: { code: "NOT_FOUND", message: "Employee not found" } }, { status: 404 }));
    expect(await deleteEmployee("1")).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Employee not found" } });
  });

  it("encodes the id in the URL", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    await deleteEmployee("a/b");
    expect(fetchMock).toHaveBeenCalledWith("/api/employees/a%2Fb", { method: "DELETE" });
  });
});
