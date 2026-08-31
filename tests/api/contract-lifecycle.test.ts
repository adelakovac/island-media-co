import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/reset-db";
import { makeRequest, routeParams } from "../helpers/request";
import { POST as issueContract } from "@/app/api/management/contracts/[id]/issue/route";
import { POST as contractAction } from "@/app/api/client/contracts/[id]/actions/route";

const MANAGER_ID = "user-manager-01";
const CLIENT_ID = "user-client-silverline";
const ORG_ID = "org-silverline";

async function createDraftContract(id: string) {
  await prisma.contract.create({
    data: {
      id,
      organisationId: ORG_ID,
      status: "draft",
      version: 1,
      startDate: new Date("2027-08-01"),
      endDate: new Date("2027-11-01"),
      currency: "GBP",
      total: 3600,
      history: JSON.stringify([{ at: "2027-01-15T09:00:00Z", actor: "manager", action: "draft_created", note: null }]),
      items: {
        create: [
          {
            id: `${id}-item-1`,
            productId: "product-hub-door",
            assetId: "asset-door-a",
            quantity: 1,
            unitRate: 1200,
            rateUnit: "month",
            lineTotal: 3600,
          },
        ],
      },
    },
  });
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("check 6: contract issue -> client accept / change-request lifecycle", () => {
  it("issuing a draft contract creates a campaign awaiting acceptance", async () => {
    await createDraftContract("test-contract-issue-1");

    const response = await issueContract(
      makeRequest("/api/management/contracts/test-contract-issue-1/issue", {
        method: "POST",
        userId: MANAGER_ID,
        idempotencyKey: "test-issue-key-1",
        body: {},
      }),
      routeParams({ id: "test-contract-issue-1" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("issued");

    const campaign = await prisma.campaign.findUnique({ where: { contractId: "test-contract-issue-1" } });
    expect(campaign).not.toBeNull();
    expect(campaign?.status).toBe("awaiting_contract_acceptance");
  });

  it("a client cannot accept a contract that hasn't been issued yet", async () => {
    await createDraftContract("test-contract-early-accept");

    const response = await contractAction(
      makeRequest("/api/client/contracts/test-contract-early-accept/actions", {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: "test-early-accept-key",
        body: { action: "accept", note: null },
      }),
      routeParams({ id: "test-contract-early-accept" }),
    );
    expect(response.status).toBe(409); // INVENTORY_CONFLICT - not awaiting acceptance
    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: "test-contract-early-accept" } });
    expect(contract.status).toBe("draft"); // untouched
  });

  it("accepting an issued contract activates the campaign and creates a confirmed booking", async () => {
    await createDraftContract("test-contract-accept-1");
    await issueContract(
      makeRequest("/api/management/contracts/test-contract-accept-1/issue", {
        method: "POST",
        userId: MANAGER_ID,
        idempotencyKey: "test-issue-for-accept",
        body: {},
      }),
      routeParams({ id: "test-contract-accept-1" }),
    );

    const response = await contractAction(
      makeRequest("/api/client/contracts/test-contract-accept-1/actions", {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: "test-accept-key-1",
        body: { action: "accept", note: "Looks good." },
      }),
      routeParams({ id: "test-contract-accept-1" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("accepted");

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { contractId: "test-contract-accept-1" } });
    expect(campaign.status).toBe("active");
    expect(campaign.bookingId).not.toBeNull();

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: campaign.bookingId! } });
    expect(booking.status).toBe("confirmed");
    expect(booking.assetId).toBe("asset-door-a");

    const events = await prisma.serviceEvent.findMany({ where: { contractId: "test-contract-accept-1" } });
    expect(events.some((event) => event.type === "contract_accepted" && event.clientVisible)).toBe(true);
  });

  it("a client cannot silently rewrite an issued contract - accepting twice fails the second time", async () => {
    await createDraftContract("test-contract-double-accept");
    await issueContract(
      makeRequest("/api/management/contracts/test-contract-double-accept/issue", {
        method: "POST",
        userId: MANAGER_ID,
        idempotencyKey: "test-issue-for-double-accept",
        body: {},
      }),
      routeParams({ id: "test-contract-double-accept" }),
    );
    await contractAction(
      makeRequest("/api/client/contracts/test-contract-double-accept/actions", {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: "test-double-accept-1",
        body: { action: "accept", note: null },
      }),
      routeParams({ id: "test-contract-double-accept" }),
    );

    const second = await contractAction(
      makeRequest("/api/client/contracts/test-contract-double-accept/actions", {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: "test-double-accept-2", // a genuinely new attempt, not a replay
        body: { action: "accept", note: null },
      }),
      routeParams({ id: "test-contract-double-accept" }),
    );
    expect(second.status).toBe(409);
  });

  it("requesting changes moves the contract to change_requested and creates a pending ClientRequest", async () => {
    await createDraftContract("test-contract-changes-1");
    await issueContract(
      makeRequest("/api/management/contracts/test-contract-changes-1/issue", {
        method: "POST",
        userId: MANAGER_ID,
        idempotencyKey: "test-issue-for-changes",
        body: {},
      }),
      routeParams({ id: "test-contract-changes-1" }),
    );

    const response = await contractAction(
      makeRequest("/api/client/contracts/test-contract-changes-1/actions", {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: "test-changes-key-1",
        body: { action: "request_changes", note: "Please extend by a month." },
      }),
      routeParams({ id: "test-contract-changes-1" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("change_requested");

    const clientRequests = await prisma.clientRequest.findMany({ where: { contractId: "test-contract-changes-1" } });
    expect(clientRequests).toHaveLength(1);
    expect(clientRequests[0]).toMatchObject({ type: "contract_change", status: "submitted" });

    // The contract itself is not deleted or corrupted - the change stays pending, not applied.
    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: "test-contract-changes-1" } });
    expect(contract.total).toBe(3600); // unchanged
  });
});
