/** Errors an admin operation can raise. Messages are safe to show to staff. */
export type AdminErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "conflict"
  | "precondition"
  | "unavailable";

export class AdminError extends Error {
  readonly code: AdminErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: AdminErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AdminError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function isAdminError(error: unknown): error is AdminError {
  return error instanceof AdminError || (typeof error === "object" && error !== null && (error as { name?: string }).name === "AdminError");
}

export const httpStatusFor: Record<AdminErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 422,
  conflict: 409,
  precondition: 412,
  unavailable: 503,
};
