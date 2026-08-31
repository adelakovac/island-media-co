import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/reset-db";
import { makeRequest, routeParams } from "../helpers/request";
import { POST as createBookingRequest } from "@/app/api/booking-requests/route";
import { POST as contractAction } from "@/app/api/client/contracts/[id]/actions/route";

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("check 6: Idempotency-Key replay returns the original record, not a duplicate", () => {
  // BookingRequest uses its own natural-key idempotency mechanism (a unique
  // column), separate from the generic IdempotencyRecord cache used elsewhere.
  it("submitting a booking request twice with the same key returns the same record", async () => {
    const body = {
      productId: "product-hub-door",
      requestedAssetId: "asset-door-a",
      startDate: "2027-08-01",
      endDate: "2027-11-01",
      budget: 1400,
      objective: "Autumn campaign",
      notes: null,
    };

    const first = await createBookingRequest(
      makeRequest("/api/booking-requests", {
        method: "POST",
        userId: "user-client-silverline",
        idempotencyKey: "test-key-repeat-001",
        body,
      }),
    );
    expect(first.status).toBe(201);
    const firstBody = await first.json();

    const second = await createBookingRequest(
      makeRequest("/api/booking-requests", {
        method: "POST",
        userId: "user-client-silverline",
        idempotencyKey: "test-key-repeat-001",
        body,
      }),
    );
    expect(second.status).toBe(200); // replay, not a fresh create
    const secondBody = await second.json();

    expect(secondBody.id).toBe(firstBody.id);

    const rows = await prisma.bookingRequest.findMany({ where: { idempotencyKey: "test-key-repeat-001" } });
    expect(rows).toHaveLength(1);
  });

  it("a different key creates a genuinely new record", async () => {
    const body = {
      productId: "product-hub-door",
      requestedAssetId: "asset-door-a",
      startDate: "2027-08-01",
      endDate: "2027-11-01",
      budget: 1400,
      objective: "Autumn campaign",
      notes: null,
    };

    const first = await createBookingRequest(
      makeRequest("/api/booking-requests", { method: "POST", userId: "user-client-silverline", idempotencyKey: "test-key-a-00001", body }),
    );
    const second = await createBookingRequest(
      makeRequest("/api/booking-requests", { method: "POST", userId: "user-client-silverline", idempotencyKey: "test-key-b-00001", body }),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.id).not.toBe(secondBody.id);

    const rows = await prisma.bookingRequest.findMany({
      where: { idempotencyKey: { in: ["test-key-a-00001", "test-key-b-00001"] } },
    });
    expect(rows).toHaveLength(2);
  });

  // Everywhere else (contract actions, contract issue, work-order status, etc.) shares
  // the generic IdempotencyRecord cache keyed by (key, scope) via withIdempotency().
  it("replays a cached response for the generic IdempotencyRecord mechanism too", async () => {
    const first = await contractAction(
      makeRequest("/api/client/contracts/contract-001/actions", {
        method: "POST",
        userId: "user-client-lighthouse",
        idempotencyKey: "test-key-action-001",
        body: { action: "request_changes", note: "Please extend the end date." },
      }),
      routeParams({ id: "contract-001" }),
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.status).toBe("change_requested");

    const second = await contractAction(
      makeRequest("/api/client/contracts/contract-001/actions", {
        method: "POST",
        userId: "user-client-lighthouse",
        idempotencyKey: "test-key-action-001",
        body: { action: "request_changes", note: "Please extend the end date." },
      }),
      routeParams({ id: "contract-001" }),
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody).toEqual(firstBody);

    // The mutation should only have run once: exactly one ClientRequest, one history entry appended.
    const clientRequests = await prisma.clientRequest.findMany({ where: { contractId: "contract-001" } });
    expect(clientRequests).toHaveLength(1);

    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: "contract-001" } });
    const history = JSON.parse(contract.history) as Array<{ action: string }>;
    expect(history.filter((entry) => entry.action === "change_requested")).toHaveLength(1);
  });
});
