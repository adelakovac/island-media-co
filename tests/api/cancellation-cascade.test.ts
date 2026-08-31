import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/reset-db";
import { makeRequest, routeParams } from "../helpers/request";
import { POST as contractAction } from "@/app/api/client/contracts/[id]/actions/route";
import { POST as createWorkOrder } from "@/app/api/management/work-orders/route";
import { PATCH as decideClientRequest } from "@/app/api/management/client-requests/[id]/route";
import { GET as getClientContract } from "@/app/api/client/contracts/[id]/route";
import { GET as getFitterWorkOrders } from "@/app/api/mobile/work-orders/route";
import { POST as updateWorkOrderStatus } from "@/app/api/mobile/work-orders/[id]/status/route";
import { GET as getProduct } from "@/app/api/products/[id]/route";

const MANAGER_ID = "user-manager-01";
const CLIENT_ID = "user-client-silverline";
const FITTER_ID = "user-fitter-01";
const ORG_ID = "org-silverline";

async function createAcceptedContractWithWorkOrder(id: string) {
  await prisma.contract.create({
    data: {
      id,
      organisationId: ORG_ID,
      status: "issued",
      version: 1,
      startDate: new Date("2027-08-01"),
      endDate: new Date("2027-11-01"),
      currency: "GBP",
      total: 3600,
      issuedAt: new Date("2027-01-15T09:00:00Z"),
      history: JSON.stringify([{ at: "2027-01-15T09:00:00Z", actor: "manager", action: "issued", note: null }]),
      items: {
        create: [
          {
            id: `${id}-item-1`,
            productId: "product-hub-door",
            assetId: "asset-door-b",
            quantity: 1,
            unitRate: 1200,
            rateUnit: "month",
            lineTotal: 3600,
          },
        ],
      },
    },
  });

  const acceptResponse = await contractAction(
    makeRequest(`/api/client/contracts/${id}/actions`, {
      method: "POST",
      userId: CLIENT_ID,
      idempotencyKey: `${id}-accept-key`,
      body: { action: "accept", note: null },
    }),
    routeParams({ id }),
  );
  expect(acceptResponse.status).toBe(200);

  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { contractId: id } });

  const workOrderResponse = await createWorkOrder(
    makeRequest("/api/management/work-orders", {
      method: "POST",
      userId: MANAGER_ID,
      idempotencyKey: `${id}-work-order-key`,
      body: {
        campaignId: campaign.id,
        contractId: id,
        type: "installation",
        assignedUserId: FITTER_ID,
        assetId: "asset-door-b",
        scheduledStart: "2027-08-05T09:00:00Z",
        scheduledEnd: "2027-08-05T11:00:00Z",
        locationLabel: "Hub door B",
        instructions: "Fit printed panel set.",
      },
    }),
  );
  expect(workOrderResponse.status).toBe(201);
  const workOrder = await workOrderResponse.json();
  expect(workOrder.status).toBe("assigned");

  return { campaignId: campaign.id, workOrderId: workOrder.id };
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("acknowledging a cancellation request cascades through the whole contract", () => {
  it("cancels the contract, campaign and work orders, and frees the booked asset", async () => {
    const contractId = "cascade-contract-approve";
    const { campaignId, workOrderId } = await createAcceptedContractWithWorkOrder(contractId);

    // Before cancelling: the asset is genuinely unavailable for its booked dates.
    const beforeAvailability = await getProduct(
      makeRequest(`/api/products/product-hub-door?startDate=2027-08-01&endDate=2027-11-01`),
      routeParams({ id: "product-hub-door" }),
    );
    const beforeBody = await beforeAvailability.json();
    const doorBBefore = beforeBody.assetOptions.find((a: { id: string }) => a.id === "asset-door-b");
    expect(doorBBefore.availability.state).toBe("unavailable");

    // Client requests cancellation.
    const requestResponse = await contractAction(
      makeRequest(`/api/client/contracts/${contractId}/actions`, {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: `${contractId}-cancel-request-key`,
        body: { action: "request_cancellation", note: "Campaign no longer needed." },
      }),
      routeParams({ id: contractId }),
    );
    expect(requestResponse.status).toBe(200);
    const afterRequest = await requestResponse.json();
    expect(afterRequest.status).toBe("accepted"); // request_cancellation never changes contract.status itself
    const clientRequest = afterRequest.clientRequests.find((r: { type: string }) => r.type === "cancellation");
    expect(clientRequest.status).toBe("submitted");

    // Manager acknowledges (approves) the cancellation.
    const decisionResponse = await decideClientRequest(
      makeRequest(`/api/management/client-requests/${clientRequest.id}`, {
        method: "PATCH",
        userId: MANAGER_ID,
        body: { action: "acknowledge", note: "Approved, no early termination fee." },
      }),
      routeParams({ id: clientRequest.id }),
    );
    expect(decisionResponse.status).toBe(200);
    expect((await decisionResponse.json()).status).toBe("resolved");

    // 1. The contract itself is cancelled.
    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
    expect(contract.status).toBe("cancelled");

    // 2. The campaign reflects the cancellation.
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.status).toBe("cancelled");
    expect(campaign.currentStage).toBe("cancelled");

    // 3. The in-flight work order is cancelled, with a history entry explaining why.
    const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    expect(workOrder.status).toBe("cancelled");
    const history = JSON.parse(workOrder.history) as Array<{ action: string; note: string | null }>;
    expect(history.some((entry) => entry.action === "cancelled" && entry.note?.includes("early termination"))).toBe(
      true,
    );

    // 4. The booking that was holding the asset is no longer confirmed.
    const bookings = await prisma.booking.findMany({ where: { assetId: "asset-door-b" } });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].status).toBe("cancelled");

    // 5. The asset is available again in the catalogue for those same dates.
    const afterAvailability = await getProduct(
      makeRequest(`/api/products/product-hub-door?startDate=2027-08-01&endDate=2027-11-01`),
      routeParams({ id: "product-hub-door" }),
    );
    const afterBody = await afterAvailability.json();
    const doorBAfter = afterBody.assetOptions.find((a: { id: string }) => a.id === "asset-door-b");
    expect(doorBAfter.availability.state).not.toBe("unavailable");

    // 6. The fitter no longer sees the job as active - it's excluded from their default list logic
    // (still returned so it isn't silently lost, but the client is expected to bucket it separately).
    const fitterListResponse = await getFitterWorkOrders(makeRequest("/api/mobile/work-orders", { userId: FITTER_ID }));
    const fitterList = (await fitterListResponse.json()).items as Array<{ id: string; status: string }>;
    const fitterJob = fitterList.find((job) => job.id === workOrderId);
    expect(fitterJob?.status).toBe("cancelled");

    // The fitter can no longer advance a cancelled job.
    const advanceResponse = await updateWorkOrderStatus(
      makeRequest(`/api/mobile/work-orders/${workOrderId}/status`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: `${workOrderId}-advance-after-cancel`,
        body: { status: "travelling", note: null },
      }),
      routeParams({ id: workOrderId }),
    );
    expect(advanceResponse.status).toBe(409);

    // 7. The client sees the cancellation reflected on their own contract/campaign view.
    const clientViewResponse = await getClientContract(
      makeRequest(`/api/client/contracts/${contractId}`, { userId: CLIENT_ID }),
      routeParams({ id: contractId }),
    );
    const clientView = await clientViewResponse.json();
    expect(clientView.status).toBe("cancelled");
    expect(clientView.campaign.status).toBe("cancelled");
    expect(
      clientView.serviceEvents.some((event: { type: string; clientVisible: boolean }) => event.type === "contract_cancelled"),
    ).toBe(true);
    expect(clientView.clientRequests.find((r: { type: string }) => r.type === "cancellation").status).toBe("resolved");
  });

  it("declining a cancellation request leaves the contract, campaign, work order and booking untouched", async () => {
    const contractId = "cascade-contract-decline";
    const { campaignId, workOrderId } = await createAcceptedContractWithWorkOrder(contractId);

    const requestResponse = await contractAction(
      makeRequest(`/api/client/contracts/${contractId}/actions`, {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: `${contractId}-cancel-request-key`,
        body: { action: "request_cancellation", note: "Might not need this anymore." },
      }),
      routeParams({ id: contractId }),
    );
    const afterRequest = await requestResponse.json();
    const clientRequest = afterRequest.clientRequests.find((r: { type: string }) => r.type === "cancellation");

    const decisionResponse = await decideClientRequest(
      makeRequest(`/api/management/client-requests/${clientRequest.id}`, {
        method: "PATCH",
        userId: MANAGER_ID,
        body: { action: "decline", note: "Contract has 3 months remaining; cancellation fee would apply." },
      }),
      routeParams({ id: clientRequest.id }),
    );
    expect(decisionResponse.status).toBe(200);
    expect((await decisionResponse.json()).status).toBe("declined");

    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
    expect(contract.status).toBe("accepted");

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.status).toBe("active");

    const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    expect(workOrder.status).toBe("assigned");

    const bookings = await prisma.booking.findMany({ where: { assetId: "asset-door-b" } });
    expect(bookings[0].status).toBe("confirmed");
  });

  it("acknowledging a cancellation twice is a no-op the second time (request is already resolved)", async () => {
    const contractId = "cascade-contract-double-ack";
    await createAcceptedContractWithWorkOrder(contractId);

    const requestResponse = await contractAction(
      makeRequest(`/api/client/contracts/${contractId}/actions`, {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: `${contractId}-cancel-request-key`,
        body: { action: "request_cancellation", note: "No longer needed." },
      }),
      routeParams({ id: contractId }),
    );
    const clientRequest = (await requestResponse.json()).clientRequests.find(
      (r: { type: string }) => r.type === "cancellation",
    );

    const first = await decideClientRequest(
      makeRequest(`/api/management/client-requests/${clientRequest.id}`, {
        method: "PATCH",
        userId: MANAGER_ID,
        body: { action: "acknowledge", note: "Approved." },
      }),
      routeParams({ id: clientRequest.id }),
    );
    expect(first.status).toBe(200);

    const second = await decideClientRequest(
      makeRequest(`/api/management/client-requests/${clientRequest.id}`, {
        method: "PATCH",
        userId: MANAGER_ID,
        body: { action: "acknowledge", note: "Approved again?" },
      }),
      routeParams({ id: clientRequest.id }),
    );
    expect(second.status).toBe(409); // the client request itself is already resolved
  });
});
