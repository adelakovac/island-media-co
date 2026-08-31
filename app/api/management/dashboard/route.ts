import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { now } from "@/lib/fixture-clock";
import { WORK_ORDER_INCLUDE, serializeWorkOrder } from "@/lib/work-orders";

export async function GET(request: NextRequest) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "manager") {
      throw new ApiError("FORBIDDEN", "Only manager users may view the management dashboard.");
    }

    const [
      bookingRequestsSubmitted,
      bookingRequestsInformationRequired,
      bookingRequestsApproved,
      contractsIssued,
      contractsChangeRequested,
      workOrdersAssigned,
      clientRequestsSubmitted,
      attentionBookingRequests,
      attentionContracts,
      attentionClientRequests,
      attentionCampaigns,
      upcomingWorkOrders,
    ] = await Promise.all([
      prisma.bookingRequest.count({ where: { status: "submitted" } }),
      prisma.bookingRequest.count({ where: { status: "information_required" } }),
      prisma.bookingRequest.count({ where: { status: "approved", draftContractId: null } }),
      prisma.contract.count({ where: { status: "issued" } }),
      prisma.contract.count({ where: { status: "change_requested" } }),
      prisma.workOrder.count({ where: { status: "assigned" } }),
      prisma.clientRequest.count({ where: { status: "submitted" } }),
      prisma.bookingRequest.findMany({
        where: { status: { in: ["submitted", "information_required"] } },
        include: { organisation: true, product: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.contract.findMany({
        where: { status: "change_requested" },
        include: { organisation: true },
      }),
      prisma.clientRequest.findMany({
        where: { status: "submitted" },
        include: { organisation: true },
      }),
      prisma.campaign.findMany({
        where: { currentStage: "awaiting_installation", workOrders: { none: {} } },
        include: { organisation: true },
      }),
      prisma.workOrder.findMany({
        where: { scheduledStart: { gte: now() }, status: { notIn: ["cancelled"] } },
        include: WORK_ORDER_INCLUDE,
        orderBy: { scheduledStart: "asc" },
        take: 10,
      }),
    ]);

    const attentionItems = [
      ...attentionBookingRequests.map((request) => ({
        type: "booking_request",
        id: request.id,
        organisationName: request.organisation.name,
        productName: request.product.name,
        status: request.status,
        message:
          request.status === "submitted"
            ? "New booking request awaiting review."
            : "Booking request is waiting on client-supplied information.",
      })),
      ...attentionContracts.map((contract) => ({
        type: "contract_change_requested",
        id: contract.id,
        organisationName: contract.organisation.name,
        message: "Client has requested changes to this contract.",
      })),
      ...attentionClientRequests.map((clientRequest) => ({
        type: "client_request",
        id: clientRequest.id,
        contractId: clientRequest.contractId,
        organisationName: clientRequest.organisation.name,
        requestType: clientRequest.type,
        message: clientRequest.summary,
      })),
      ...attentionCampaigns.map((campaign) => ({
        type: "campaign_needs_work_order",
        id: campaign.id,
        contractId: campaign.contractId,
        organisationName: campaign.organisation.name,
        message: "Contract accepted — no work order has been created yet.",
      })),
    ];

    return NextResponse.json({
      attentionItems,
      counts: {
        bookingRequestsSubmitted,
        bookingRequestsInformationRequired,
        bookingRequestsApproved,
        contractsIssued,
        contractsChangeRequested,
        workOrdersAssigned,
        clientRequestsSubmitted,
      },
      upcomingWorkOrders: upcomingWorkOrders.map(serializeWorkOrder),
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
