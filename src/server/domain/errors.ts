export type ValidationIssue = { path: string; message: string };

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly details: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class DuplicateEmailError extends Error {
  constructor(readonly email: string) {
    super(`An employee with email ${email} already exists`);
    this.name = "DuplicateEmailError";
  }
}
