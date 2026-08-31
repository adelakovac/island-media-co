import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/reset-db";
import { makeRequest, routeParams } from "../helpers/request";
import { GET as searchProducts } from "@/app/api/products/route";
import { GET as getProduct } from "@/app/api/products/[id]/route";
import { GET as clientSummary } from "@/app/api/client/summary/route";
import { POST as createBookingRequest } from "@/app/api/booking-requests/route";

// org-silverline is seeded with zero contracts - the "new client, nothing signed
// yet" case Scenario A describes.
const NO_CONTRACT_CLIENT = "user-client-silverline";
const NO_CONTRACT_ORG = "org-silverline";

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("check 5: a client account with no contracts can still use the catalogue", () => {
  it("the product catalogue is browsable with no session at all (public visitor)", async () => {
    const response = await searchProducts(
      makeRequest("/api/products?startDate=2027-08-01&endDate=2027-11-01"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("a no-contract client can browse the catalogue the same as anyone else", async () => {
    const response = await searchProducts(
      makeRequest("/api/products?startDate=2027-08-01&endDate=2027-11-01", { userId: NO_CONTRACT_CLIENT }),
    );
    expect(response.status).toBe(200);
  });

  it("a no-contract client can open a product detail page", async () => {
    const response = await getProduct(
      makeRequest("/api/products/product-hub-door?startDate=2027-08-01&endDate=2027-11-01", {
        userId: NO_CONTRACT_CLIENT,
      }),
      routeParams({ id: "product-hub-door" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assetOptions.length).toBeGreaterThan(0);
  });

  it("the account summary is a useful empty state, not broken or an error", async () => {
    const response = await clientSummary(makeRequest("/api/client/summary", { userId: NO_CONTRACT_CLIENT }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.organisation.contractCount).toBe(0);
    expect(body.contracts).toEqual([]);
    expect(body.attentionItems).toEqual([]);
  });

  it("a no-contract client can still submit a non-binding booking request", async () => {
    const response = await createBookingRequest(
      makeRequest("/api/booking-requests", {
        method: "POST",
        userId: NO_CONTRACT_CLIENT,
        idempotencyKey: "test-no-contract-request-1",
        body: {
          productId: "product-hub-door",
          requestedAssetId: "asset-door-a",
          startDate: "2027-08-01",
          endDate: "2027-11-01",
          budget: 1400,
          objective: "First-ever campaign for this client",
          notes: null,
        },
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.organisationId).toBe(NO_CONTRACT_ORG);
    expect(body.status).toBe("submitted");
  });
});
