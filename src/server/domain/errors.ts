export class DuplicateEmailError extends Error {
  constructor(readonly email: string) {
    super(`An employee with email ${email} already exists`);
    this.name = "DuplicateEmailError";
  }
}
