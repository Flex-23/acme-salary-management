import { afterEach, describe, expect, it, vi } from "vitest";
import { DuplicateEmailError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { handleErrors, readJsonBody, toErrorResponse } from "@/server/http/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

const bodyOf = (response: Response) => response.json() as Promise<unknown>;

describe("toErrorResponse", () => {
  it("maps ValidationError to 400 with details", async () => {
    const response = toErrorResponse(new ValidationError("Invalid employee", [{ path: "email", message: "Invalid email" }]));
    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid employee",
        details: [{ path: "email", message: "Invalid email" }],
      },
    });
  });

  it("omits details when there are none", async () => {
    const response = toErrorResponse(new ValidationError("Bad"));
    expect(await bodyOf(response)).toEqual({ error: { code: "VALIDATION_ERROR", message: "Bad" } });
  });

  it("maps NotFoundError to 404", async () => {
    const response = toErrorResponse(new NotFoundError("Employee"));
    expect(response.status).toBe(404);
    expect(await bodyOf(response)).toEqual({ error: { code: "NOT_FOUND", message: "Employee not found" } });
  });

  it("maps DuplicateEmailError to 409", async () => {
    const response = toErrorResponse(new DuplicateEmailError("a@acme.com"));
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toEqual({
      error: {
        code: "DUPLICATE_EMAIL",
        message: "An employee with email a@acme.com already exists",
      },
    });
  });

  it("maps unexpected errors to a generic 500 that leaks nothing", async () => {
    const secret = new Error('relation "employees" does not exist: select * from employees where password = $1');
    const response = toErrorResponse(secret);
    expect(response.status).toBe(500);
    const text = JSON.stringify(await bodyOf(response));
    expect(JSON.parse(text)).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
    expect(text).not.toContain("select");
    expect(text).not.toContain("stack");
  });

  it("returns JSON", () => {
    expect(toErrorResponse(new Error("x")).headers.get("content-type")).toContain("application/json");
  });
});

describe("handleErrors", () => {
  it("passes the handler's response and arguments through", async () => {
    const handler = handleErrors(async (request: Request, context: { id: string }) =>
      Response.json({ url: request.url, id: context.id }),
    );
    const response = await handler(new Request("http://localhost/x"), { id: "7" });
    expect(await bodyOf(response)).toEqual({ url: "http://localhost/x", id: "7" });
  });

  it("converts thrown typed errors into error responses", async () => {
    const handler = handleErrors(async () => {
      throw new NotFoundError("Employee");
    });
    expect((await handler()).status).toBe(404);
  });

  it("logs unexpected errors on the server and hides them from the client", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("connection refused 10.0.0.5:5432");
    const handler = handleErrors(async () => {
      throw failure;
    });

    const response = await handler();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await bodyOf(response))).not.toContain("10.0.0.5");
    expect(log).toHaveBeenCalledWith("Unhandled API error", failure);
  });

  it("does not log expected errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await handleErrors(async () => {
      throw new ValidationError("Bad");
    })();
    expect(log).not.toHaveBeenCalled();
  });
});

describe("readJsonBody", () => {
  it("parses a JSON body", async () => {
    const request = new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(await readJsonBody(request)).toEqual({ a: 1 });
  });

  it("throws ValidationError for malformed or empty bodies", async () => {
    for (const body of ["{nope", ""]) {
      const request = new Request("http://localhost/x", { method: "POST", body });
      await expect(readJsonBody(request)).rejects.toBeInstanceOf(ValidationError);
    }
  });
});
