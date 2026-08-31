import { NextResponse } from "next/server";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVENTORY_CONFLICT"
  | "SERVICE_UNAVAILABLE";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVENTORY_CONFLICT: 409,
  SERVICE_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  code: ErrorCode;
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function errorResponse(error: ApiError) {
  return NextResponse.json(
    { code: error.code, message: error.message, details: error.details ?? null },
    { status: STATUS_BY_CODE[error.code] },
  );
}

export function jsonError(code: ErrorCode, message: string, details?: Record<string, unknown>) {
  return errorResponse(new ApiError(code, message, details));
}
