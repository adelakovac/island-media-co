export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toDateTimeInputValue(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function formatDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function formatDateTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** UTC calendar-day comparison, matching this app's timezone convention. */
export function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
