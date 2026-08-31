import { now } from "./fixture-clock";

// Assumption (confirmed with user): in addition to an explicit fixture
// `note`, an asset/pool whose verifiedAt is more than 90 days old (relative
// to the fixture clock) also surfaces as confirmation_required rather than
// a flat available/unavailable. At the current fixture clock this separates
// asset-door-b (~106 days stale, also has a note) and asset-ev-screen-02
// (~136 days stale) from every other verifiedAt in the fixtures (<15 days).
const STALE_VERIFICATION_MS = 90 * 24 * 60 * 60 * 1000;

export type AvailabilityState = "available" | "unavailable" | "confirmation_required";

export interface AvailabilitySummary {
  state: AvailabilityState;
  reason: string;
  calculatedAt: string;
  availableAssetCount: number | null;
  availableCapacity: number | null;
  totalCapacity: number | null;
  freshestVerificationAt: string | null;
}

/** [aStart, aEnd) intersects [bStart, bEnd) under the fixtures' half-open date interval convention. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isStale(verifiedAt: Date | null): boolean {
  if (!verifiedAt) return true;
  return now().getTime() - verifiedAt.getTime() > STALE_VERIFICATION_MS;
}

/** Peak concurrent unit usage of `intervals` restricted to their overlap with [queryStart, queryEnd). */
export function peakConcurrentUsage(
  intervals: Array<{ start: Date; end: Date; units: number }>,
  queryStart: Date,
  queryEnd: Date,
): number {
  const events: Array<{ time: number; delta: number; isEnd: boolean }> = [];
  for (const interval of intervals) {
    if (!overlaps(interval.start, interval.end, queryStart, queryEnd)) continue;
    const clippedStart = interval.start < queryStart ? queryStart : interval.start;
    const clippedEnd = interval.end > queryEnd ? queryEnd : interval.end;
    events.push({ time: clippedStart.getTime(), delta: interval.units, isEnd: false });
    events.push({ time: clippedEnd.getTime(), delta: -interval.units, isEnd: true });
  }
  // Process "end" events before "start" events at the same instant so a
  // booking ending exactly when another starts does not double-count.
  events.sort((a, b) => a.time - b.time || (a.isEnd === b.isEnd ? 0 : a.isEnd ? -1 : 1));

  let running = 0;
  let peak = 0;
  for (const event of events) {
    running += event.delta;
    if (running > peak) peak = running;
  }
  return peak;
}

export interface AssetForAvailability {
  status: string;
  verifiedAt: Date | null;
  note: string | null;
  bookings: Array<{ startDate: Date; endDate: Date; status: string }>;
  holds: Array<{ startDate: Date; endDate: Date; status: string; expiresAt: Date }>;
  outages: Array<{ startDate: Date; endDate: Date; status: string }>;
}

export function assetAvailability(
  asset: AssetForAvailability,
  queryStart: Date,
  queryEnd: Date,
): AvailabilitySummary {
  const calculatedAt = now().toISOString();
  const freshestVerificationAt = asset.verifiedAt ? asset.verifiedAt.toISOString() : null;

  const unavailable = (reason: string): AvailabilitySummary => ({
    state: "unavailable",
    reason,
    calculatedAt,
    availableAssetCount: 0,
    availableCapacity: null,
    totalCapacity: null,
    freshestVerificationAt,
  });

  if (asset.status !== "active") {
    return unavailable(`Asset status is ${asset.status}.`);
  }

  const hasOutage = asset.outages.some(
    (o) => o.status === "confirmed" && overlaps(o.startDate, o.endDate, queryStart, queryEnd),
  );
  if (hasOutage) return unavailable("Asset has a scheduled outage during the requested dates.");

  const hasBooking = asset.bookings.some(
    (b) => b.status === "confirmed" && overlaps(b.startDate, b.endDate, queryStart, queryEnd),
  );
  if (hasBooking) return unavailable("Asset is already booked for the requested dates.");

  const hasActiveHold = asset.holds.some(
    (h) => h.status === "active" && h.expiresAt > now() && overlaps(h.startDate, h.endDate, queryStart, queryEnd),
  );
  if (hasActiveHold) return unavailable("Asset is on hold for another enquiry during the requested dates.");

  if (asset.note) {
    return {
      state: "confirmation_required",
      reason: asset.note,
      calculatedAt,
      availableAssetCount: 1,
      availableCapacity: null,
      totalCapacity: null,
      freshestVerificationAt,
    };
  }

  if (isStale(asset.verifiedAt)) {
    return {
      state: "confirmation_required",
      reason: "Verification is more than 90 days old; owner confirmation recommended.",
      calculatedAt,
      availableAssetCount: 1,
      availableCapacity: null,
      totalCapacity: null,
      freshestVerificationAt,
    };
  }

  return {
    state: "available",
    reason: "Asset is free for the requested dates.",
    calculatedAt,
    availableAssetCount: 1,
    availableCapacity: null,
    totalCapacity: null,
    freshestVerificationAt,
  };
}

/** Rolls up per-asset AvailabilitySummary values into one product-level summary. */
export function rollupExclusiveAssetAvailability(assetSummaries: AvailabilitySummary[]): AvailabilitySummary {
  const calculatedAt = now().toISOString();
  const availableAssetCount = assetSummaries.filter((s) => s.state !== "unavailable").length;
  const freshestVerificationAt =
    assetSummaries
      .map((s) => s.freshestVerificationAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;

  const base = { calculatedAt, availableAssetCount, availableCapacity: null, totalCapacity: null, freshestVerificationAt };

  const clean = assetSummaries.find((s) => s.state === "available");
  if (clean) {
    return { ...base, state: "available", reason: "At least one asset is free for the requested dates." };
  }

  const needsConfirmation = assetSummaries.find((s) => s.state === "confirmation_required");
  if (needsConfirmation) {
    return { ...base, state: "confirmation_required", reason: needsConfirmation.reason };
  }

  return { ...base, availableAssetCount: 0, state: "unavailable", reason: "No asset is free for the requested dates." };
}

export interface CapacityPoolForAvailability {
  capacity: number;
  status: string;
  verifiedAt: Date | null;
  bookings: Array<{ startDate: Date; endDate: Date; status: string; capacityUnits: number | null }>;
  holds: Array<{ startDate: Date; endDate: Date; status: string; expiresAt: Date; capacityUnits: number | null }>;
}

export function capacityPoolAvailability(
  pool: CapacityPoolForAvailability,
  queryStart: Date,
  queryEnd: Date,
): AvailabilitySummary {
  const calculatedAt = now().toISOString();
  const freshestVerificationAt = pool.verifiedAt ? pool.verifiedAt.toISOString() : null;

  if (pool.status !== "active") {
    return {
      state: "unavailable",
      reason: `Capacity pool status is ${pool.status}.`,
      calculatedAt,
      availableAssetCount: null,
      availableCapacity: 0,
      totalCapacity: pool.capacity,
      freshestVerificationAt,
    };
  }

  const intervals = [
    ...pool.bookings
      .filter((b) => b.status === "confirmed")
      .map((b) => ({ start: b.startDate, end: b.endDate, units: b.capacityUnits ?? 1 })),
    ...pool.holds
      .filter((h) => h.status === "active" && h.expiresAt > now())
      .map((h) => ({ start: h.startDate, end: h.endDate, units: h.capacityUnits ?? 1 })),
  ];
  const used = peakConcurrentUsage(intervals, queryStart, queryEnd);
  const availableCapacity = Math.max(pool.capacity - used, 0);

  if (availableCapacity <= 0) {
    return {
      state: "unavailable",
      reason: "No remaining capacity for the requested dates.",
      calculatedAt,
      availableAssetCount: null,
      availableCapacity: 0,
      totalCapacity: pool.capacity,
      freshestVerificationAt,
    };
  }

  if (isStale(pool.verifiedAt)) {
    return {
      state: "confirmation_required",
      reason: "Verification is more than 90 days old; owner confirmation recommended.",
      calculatedAt,
      availableAssetCount: null,
      availableCapacity,
      totalCapacity: pool.capacity,
      freshestVerificationAt,
    };
  }

  return {
    state: "available",
    reason: "Capacity remains for the requested dates.",
    calculatedAt,
    availableAssetCount: null,
    availableCapacity,
    totalCapacity: pool.capacity,
    freshestVerificationAt,
  };
}
