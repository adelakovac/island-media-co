import { describe, expect, it } from "vitest";
import {
  assetAvailability,
  capacityPoolAvailability,
  peakConcurrentUsage,
  type AssetForAvailability,
  type CapacityPoolForAvailability,
} from "@/lib/availability";
import { now } from "@/lib/fixture-clock";

const NOW = now(); // fixed at 2027-01-15T09:00:00Z

function d(value: string): Date {
  return new Date(value);
}

function baseAsset(overrides: Partial<AssetForAvailability> = {}): AssetForAvailability {
  return {
    status: "active",
    verifiedAt: NOW,
    note: null,
    bookings: [],
    holds: [],
    outages: [],
    ...overrides,
  };
}

function basePool(overrides: Partial<CapacityPoolForAvailability> = {}): CapacityPoolForAvailability {
  return {
    capacity: 2,
    status: "active",
    verifiedAt: NOW,
    bookings: [],
    holds: [],
    ...overrides,
  };
}

describe("check 1: overlapping exclusive-asset bookings are rejected", () => {
  const asset = baseAsset({
    bookings: [{ startDate: d("2027-02-01"), endDate: d("2027-03-01"), status: "confirmed" }],
  });

  it("is unavailable when the requested dates overlap a confirmed booking", () => {
    const result = assetAvailability(asset, d("2027-02-15"), d("2027-02-20"));
    expect(result.state).toBe("unavailable");
    expect(result.reason).toMatch(/already booked/i);
  });

  it("is available immediately after the booking ends (half-open interval)", () => {
    const result = assetAvailability(asset, d("2027-03-01"), d("2027-03-10"));
    expect(result.state).toBe("available");
  });

  it("ignores a booking that isn't confirmed (e.g. cancelled)", () => {
    const cancelled = baseAsset({
      bookings: [{ startDate: d("2027-02-01"), endDate: d("2027-03-01"), status: "cancelled" }],
    });
    const result = assetAvailability(cancelled, d("2027-02-15"), d("2027-02-20"));
    expect(result.state).toBe("available");
  });
});

describe("check 2: an expired hold does not block availability", () => {
  it("is available when the only overlapping hold already expired", () => {
    const asset = baseAsset({
      holds: [
        {
          startDate: d("2027-02-01"),
          endDate: d("2027-02-28"),
          status: "active",
          expiresAt: d("2027-01-10T00:00:00Z"), // before fixtureClock (2027-01-15)
        },
      ],
    });
    const result = assetAvailability(asset, d("2027-02-10"), d("2027-02-15"));
    expect(result.state).toBe("available");
  });
});

describe("check 3: an active (non-expired) hold blocks availability", () => {
  it("is unavailable while a hold with a future expiry overlaps the requested dates", () => {
    const asset = baseAsset({
      holds: [
        {
          startDate: d("2027-02-01"),
          endDate: d("2027-02-28"),
          status: "active",
          expiresAt: d("2027-01-20T00:00:00Z"), // after fixtureClock (2027-01-15)
        },
      ],
    });
    const result = assetAvailability(asset, d("2027-02-10"), d("2027-02-15"));
    expect(result.state).toBe("unavailable");
    expect(result.reason).toMatch(/on hold/i);
  });

  it("recognises the exact boundary: expiresAt strictly after now still blocks", () => {
    const asset = baseAsset({
      holds: [
        {
          startDate: d("2027-02-01"),
          endDate: d("2027-02-28"),
          status: "active",
          expiresAt: new Date(NOW.getTime() + 1), // 1ms after fixtureClock
        },
      ],
    });
    expect(assetAvailability(asset, d("2027-02-10"), d("2027-02-15")).state).toBe("unavailable");
  });
});

describe("check 4: capacity-pool peak-concurrency math", () => {
  it("peakConcurrentUsage takes the true concurrent peak, not the sum of all intervals", () => {
    // Three 1-unit bookings that are sequential (half-open, back-to-back) - never
    // more than 1 unit in use at any instant, even though they sum to 3.
    const intervals = [
      { start: d("2027-02-01"), end: d("2027-02-05"), units: 1 },
      { start: d("2027-02-05"), end: d("2027-02-10"), units: 1 },
      { start: d("2027-02-10"), end: d("2027-02-15"), units: 1 },
    ];
    const peak = peakConcurrentUsage(intervals, d("2027-02-01"), d("2027-02-15"));
    expect(peak).toBe(1);
  });

  it("peakConcurrentUsage correctly finds a genuine overlap", () => {
    const intervals = [
      { start: d("2027-02-01"), end: d("2027-02-10"), units: 1 },
      { start: d("2027-02-05"), end: d("2027-02-15"), units: 1 },
    ];
    // Both intervals cover 2027-02-05 to 2027-02-10 - peak should be 2 there.
    const peak = peakConcurrentUsage(intervals, d("2027-02-01"), d("2027-02-15"));
    expect(peak).toBe(2);
  });

  it("capacityPoolAvailability stays available when bookings are sequential, not concurrent", () => {
    const pool = basePool({
      capacity: 2,
      bookings: [
        { startDate: d("2027-02-01"), endDate: d("2027-02-05"), status: "confirmed", capacityUnits: 1 },
        { startDate: d("2027-02-05"), endDate: d("2027-02-10"), status: "confirmed", capacityUnits: 1 },
        { startDate: d("2027-02-10"), endDate: d("2027-02-15"), status: "confirmed", capacityUnits: 1 },
      ],
    });
    const result = capacityPoolAvailability(pool, d("2027-02-01"), d("2027-02-15"));
    expect(result.state).toBe("available");
    expect(result.availableCapacity).toBe(1); // capacity 2 - true peak 1
  });

  it("capacityPoolAvailability is unavailable once genuinely-overlapping usage reaches capacity", () => {
    const pool = basePool({
      capacity: 2,
      bookings: [
        { startDate: d("2027-02-01"), endDate: d("2027-02-10"), status: "confirmed", capacityUnits: 1 },
        { startDate: d("2027-02-05"), endDate: d("2027-02-15"), status: "confirmed", capacityUnits: 1 },
      ],
      holds: [
        {
          startDate: d("2027-02-06"),
          endDate: d("2027-02-08"),
          status: "active",
          expiresAt: d("2027-01-20"),
          capacityUnits: 1,
        },
      ],
    });
    // 2027-02-06 to 2027-02-08: both bookings (2) plus the active hold (1) = 3 > capacity 2.
    const result = capacityPoolAvailability(pool, d("2027-02-01"), d("2027-02-15"));
    expect(result.state).toBe("unavailable");
    expect(result.availableCapacity).toBe(0);
  });

  it("an expired hold does not count toward capacity-pool usage", () => {
    const pool = basePool({
      capacity: 1,
      holds: [
        {
          startDate: d("2027-02-01"),
          endDate: d("2027-02-10"),
          status: "active",
          expiresAt: d("2027-01-10"), // expired relative to fixtureClock
          capacityUnits: 1,
        },
      ],
    });
    const result = capacityPoolAvailability(pool, d("2027-02-01"), d("2027-02-05"));
    expect(result.state).toBe("available");
    expect(result.availableCapacity).toBe(1);
  });
});

describe("check 5: stale verification or a noted asset triggers confirmation_required", () => {
  it("flags a stale verification (>90 days old relative to the fixture clock)", () => {
    const asset = baseAsset({ verifiedAt: d("2026-01-01") }); // ~1 year before fixtureClock
    const result = assetAvailability(asset, d("2027-02-01"), d("2027-02-10"));
    expect(result.state).toBe("confirmation_required");
    expect(result.reason).toMatch(/90 days/i);
  });

  it("does not flag a fresh verification", () => {
    const asset = baseAsset({ verifiedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000) }); // 5 days old
    const result = assetAvailability(asset, d("2027-02-01"), d("2027-02-10"));
    expect(result.state).toBe("available");
  });

  it("flags an asset carrying an explicit note, even with fresh verification", () => {
    const asset = baseAsset({ note: "Owner confirmation required before booking." });
    const result = assetAvailability(asset, d("2027-02-01"), d("2027-02-10"));
    expect(result.state).toBe("confirmation_required");
    expect(result.reason).toBe("Owner confirmation required before booking.");
  });

  it("also flags stale verification on a capacity pool", () => {
    const pool = basePool({ verifiedAt: d("2026-01-01") });
    const result = capacityPoolAvailability(pool, d("2027-02-01"), d("2027-02-10"));
    expect(result.state).toBe("confirmation_required");
  });
});
