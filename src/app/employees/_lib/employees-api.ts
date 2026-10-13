import type { EmployeeDto } from "@/server/services/dto";
import type { EmployeeRequestBody } from "./employee-form";

export type ApiError = {
  code: string;
  message: string;
  details?: { path: string; message: string }[];
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const failure = (code: string, message: string): ApiResult<never> => ({ ok: false, error: { code, message } });

function isApiError(payload: unknown): payload is { error: ApiError } {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return false;
  const { error } = payload;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

/** The single write path: every mutation goes through the same /api routes that invalidate the cache. */
async function call<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return failure("NETWORK_ERROR", "Could not reach the server");
  }

  if (response.status === 204) return { ok: true, data: undefined as T };

  const payload: unknown = await response.json().catch(() => undefined);
  if (response.ok && typeof payload === "object" && payload !== null && "data" in payload) {
    return { ok: true, data: payload.data as T };
  }
  if (!response.ok && isApiError(payload)) return { ok: false, error: payload.error };
  return failure("INTERNAL_ERROR", "Unexpected response from the server");
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const employeeUrl = (id: string) => `/api/employees/${encodeURIComponent(id)}`;

export const createEmployee = (body: EmployeeRequestBody) => call<EmployeeDto>("/api/employees", json("POST", body));

export const updateEmployee = (id: string, body: EmployeeRequestBody) => call<EmployeeDto>(employeeUrl(id), json("PATCH", body));

export const deleteEmployee = (id: string) => call<void>(employeeUrl(id), { method: "DELETE" });
