import { DuplicateEmailError, NotFoundError, ValidationError } from "../domain/errors";

type ErrorBody = { error: { code: string; message: string; details?: unknown } };

function errorResponse(status: number, body: ErrorBody): Response {
  return Response.json(body, { status });
}

/** Maps an error to the API's error shape. Unexpected errors never expose their message, stack or SQL. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    const { message, details } = error;
    return errorResponse(400, {
      error: { code: "VALIDATION_ERROR", message, ...(details.length > 0 && { details }) },
    });
  }
  if (error instanceof NotFoundError) {
    return errorResponse(404, { error: { code: "NOT_FOUND", message: error.message } });
  }
  if (error instanceof DuplicateEmailError) {
    return errorResponse(409, { error: { code: "DUPLICATE_EMAIL", message: error.message } });
  }
  return errorResponse(500, { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}

function isExpected(error: unknown): boolean {
  return (
    error instanceof ValidationError || error instanceof NotFoundError || error instanceof DuplicateEmailError
  );
}

export type HandleErrorsOptions = {
  /** Called first with every caught error; throw from it to let a framework-owned error escape. */
  rethrow?: (error: unknown) => void;
};

/** Wraps a route handler so thrown errors become error responses; unexpected ones are logged server-side. */
export function handleErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
  { rethrow }: HandleErrorsOptions = {},
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      rethrow?.(error);
      if (!isExpected(error)) console.error("Unhandled API error", error);
      return toErrorResponse(error);
    }
  };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}
