import { ApiError } from "./http";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a required `?startDate=`/`?endDate=` query param (format: date) into a UTC-midnight Date. */
export function requireDateParam(value: string | null, name: string): Date {
  if (!value) {
    throw new ApiError("VALIDATION_ERROR", `${name} is required.`);
  }
  if (!DATE_ONLY.test(value)) {
    throw new ApiError("VALIDATION_ERROR", `${name} must be an ISO date (YYYY-MM-DD).`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("VALIDATION_ERROR", `${name} is not a valid date.`);
  }
  return date;
}

export function requireDateRange(startValue: string | null, endValue: string | null) {
  const startDate = requireDateParam(startValue, "startDate");
  const endDate = requireDateParam(endValue, "endDate");
  if (endDate <= startDate) {
    throw new ApiError("VALIDATION_ERROR", "endDate must be after startDate.");
  }
  return { startDate, endDate };
}
