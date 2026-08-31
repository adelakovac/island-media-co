import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/reset-db";
import { makeRequest, routeParams } from "../helpers/request";
import { POST as createBookingRequest } from "@/app/api/booking-requests/route";
import { PATCH as decideBookingRequest } from "@/app/api/management/booking-requests/[id]/route";
import { POST as createContract } from "@/app/api/management/contracts/route";
import { POST as issueContract } from "@/app/api/management/contracts/[id]/issue/route";
import { POST as contractAction } from "@/app/api/client/contracts/[id]/actions/route";
import { POST as createWorkOrder } from "@/app/api/management/work-orders/route";
import { POST as uploadProof } from "@/app/api/mobile/work-orders/[id]/proof/route";
import { GET as getClientContract } from "@/app/api/client/contracts/[id]/route";
import { GET as getClientSummary } from "@/app/api/client/summary/route";

const CLIENT_ID = "user-client-silverline"; // org-silverline: zero contracts to start
const MANAGER_ID = "user-manager-01";
const FITTER_ID = "user-fitter-01";

beforeEach(async () => {
  await resetDatabase(prisma);
});

/**
 * check 10: one important connected UI journey, driven end-to-end through the
 * same route handlers each interface calls - client discovery, management
 * decisioning, contract issue/acceptance, field work, and the client seeing
 * the result. Mirrors the manual Chrome walkthrough used to build this flow
 * (a zero-contract client -> approved request -> issued & accepted contract
 * -> assigned & completed work order -> proof visible back in the client's
 * own contract view).
 */
describe("check 10: connected journey - request to completed, proof visible to the client", () => {
  it("flows a booking request all the way through to completed work with client-visible proof", async () => {
    // 1. Client submits a non-binding booking request.
    const requestResponse = await createBookingRequest(
      makeRequest("/api/booking-requests", {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: "journey-request-key-1",
        body: {
          productId: "product-hub-door",
          requestedAssetId: "asset-door-a",
          startDate: "2027-08-01",
          endDate: "2027-11-01",
          budget: 1400,
          objective: "Autumn class sign-up campaign",
          notes: null,
        },
      }),
    );
    expect(requestResponse.status).toBe(201);
    const bookingRequest = await requestResponse.json();
    expect(bookingRequest.status).toBe("submitted");

    // 2. Manager approves it, allocating the requested asset.
    const approveResponse = await decideBookingRequest(
      makeRequest(`/api/management/booking-requests/${bookingRequest.id}`, {
        method: "PATCH",
        userId: MANAGER_ID,
        body: { action: "approve", note: null, selectedAssetId: "asset-door-a" },
      }),
      routeParams({ id: bookingRequest.id }),
    );
    expect(approveResponse.status).toBe(200);
    expect((await approveResponse.json()).status).toBe("approved");

    // 3. Manager drafts a contract from the approved request.
    const contractResponse = await createContract(
      makeRequest("/api/management/contracts", {
        method: "POST",
        userId: MANAGER_ID,
        idempotencyKey: "journey-contract-key-1",
        body: {
          organisationId: "org-silverline",
          bookingRequestId: bookingRequest.id,
          startDate: "2027-08-01",
          endDate: "2027-11-01",
          items: [
            {
              id: "journey-contract-item-1",
              productId: "product-hub-door",
              assetId: "asset-door-a",
              capacityPoolId: null,
              quantity: 1,
              unitRate: 1200,
              rateUnit: "month",
              lineTotal: 3600,
            },
          ],
          total: 3600,
        },
      }),
    );
    expect(contractResponse.status).toBe(201);
    const contract = await contractResponse.json();
    expect(contract.status).toBe("draft");

    // 4. Manager issues the contract.
    const issueResponse = await issueContract(
      makeRequest(`/api/management/contracts/${contract.id}/issue`, {
        method: "POST",
        userId: MANAGER_ID,
        idempotencyKey: "journey-issue-key-1",
        body: {},
      }),
      routeParams({ id: contract.id }),
    );
    expect(issueResponse.status).toBe(200);
    expect((await issueResponse.json()).status).toBe("issued");

    // 5. Client accepts - this should activate the campaign and confirm a booking.
    const acceptResponse = await contractAction(
      makeRequest(`/api/client/contracts/${contract.id}/actions`, {
        method: "POST",
        userId: CLIENT_ID,
        idempotencyKey: "journey-accept-key-1",
        body: { action: "accept", note: null },
      }),
      routeParams({ id: contract.id }),
    );
    expect(acceptResponse.status).toBe(200);
    expect((await acceptResponse.json()).status).toBe("accepted");

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { contractId: contract.id } });
    expect(campaign.status).toBe("active");

    // 6. Manager schedules installation work for the now-active campaign.
    const workOrderResponse = await createWorkOrder(
      makeRequest("/api/management/work-orders", {
        method: "POST",
        userId: MANAGER_ID,
        idempotencyKey: "journey-work-order-key-1",
        body: {
          campaignId: campaign.id,
          contractId: contract.id,
          type: "installation",
          assignedUserId: FITTER_ID,
          assetId: "asset-door-a",
          scheduledStart: "2027-08-05T09:00:00Z",
          scheduledEnd: "2027-08-05T11:00:00Z",
          locationLabel: "Hub door A",
          instructions: "Fit printed panel set.",
        },
      }),
    );
    expect(workOrderResponse.status).toBe(201);
    const workOrder = await workOrderResponse.json();
    expect(workOrder.status).toBe("assigned");

    // 7. Fitter completes the job with proof - this is the only path to "completed" (check 8).
    const formData = new FormData();
    formData.append("file", new File(["binary"], "installed-panel.jpg", { type: "image/jpeg" }));
    formData.append("completionNote", "Panel installed and photographed.");
    const proofResponse = await uploadProof(
      makeRequest(`/api/mobile/work-orders/${workOrder.id}/proof`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "journey-proof-key-1",
        body: formData,
      }),
      routeParams({ id: workOrder.id }),
    );
    expect(proofResponse.status).toBe(201);

    // 8. The client sees the completed work and proof in their own contract view.
    const clientViewResponse = await getClientContract(
      makeRequest(`/api/client/contracts/${contract.id}`, { userId: CLIENT_ID }),
      routeParams({ id: contract.id }),
    );
    expect(clientViewResponse.status).toBe(200);
    const clientView = await clientViewResponse.json();
    expect(clientView.status).toBe("accepted");
    expect(clientView.proofRecords).toHaveLength(1);
    expect(clientView.proofRecords[0].fileName).toBe("installed-panel.jpg");
    expect(clientView.serviceEvents.some((event: { type: string }) => event.type === "installation_completed")).toBe(
      true,
    );

    // 9. The client's own account summary reflects the same contract - the whole
    // point of Scenario A/B/C/D being *connected*, not disconnected screens.
    const summaryResponse = await getClientSummary(makeRequest("/api/client/summary", { userId: CLIENT_ID }));
    const summary = await summaryResponse.json();
    expect(summary.organisation.contractCount).toBe(1);
    expect(summary.contracts.map((c: { id: string }) => c.id)).toContain(contract.id);
  });
});
