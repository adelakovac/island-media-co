import type { Contract, ContractItem } from "@prisma/client";
import { prisma } from "./prisma";
import { serializeContract, enrichContractItems, serializeProofRecord, serializeClientRequest } from "./contracts";
import { serializeCampaign } from "./campaigns";
import { serializeServiceEvent } from "./service-events";

export async function buildManagementContractDetail(contract: Contract & { items: ContractItem[] }) {
  const [organisation, campaign, workOrders, serviceEvents, clientRequests, items] = await Promise.all([
    prisma.organisation.findUniqueOrThrow({ where: { id: contract.organisationId } }),
    prisma.campaign.findUnique({ where: { contractId: contract.id } }),
    prisma.workOrder.findMany({
      where: { contractId: contract.id },
      include: { assignedUser: true, asset: true, proofRecords: true },
      orderBy: { scheduledStart: "asc" },
    }),
    // Managers see every service event, not only the client-visible subset.
    prisma.serviceEvent.findMany({ where: { contractId: contract.id }, orderBy: { at: "asc" } }),
    prisma.clientRequest.findMany({ where: { contractId: contract.id }, orderBy: { createdAt: "asc" } }),
    enrichContractItems(contract.items),
  ]);

  return {
    ...serializeContract(contract),
    items,
    organisationName: organisation.name,
    campaign: serializeCampaign(campaign),
    workOrders: workOrders.map((workOrder) => ({
      id: workOrder.id,
      campaignId: workOrder.campaignId,
      contractId: workOrder.contractId,
      type: workOrder.type,
      status: workOrder.status,
      assignedUserId: workOrder.assignedUserId,
      assignedUserName: workOrder.assignedUser.name,
      assetId: workOrder.assetId,
      assetName: workOrder.asset.name,
      scheduledStart: workOrder.scheduledStart.toISOString(),
      scheduledEnd: workOrder.scheduledEnd.toISOString(),
      locationLabel: workOrder.locationLabel,
      instructions: workOrder.instructions,
      internalNotes: workOrder.internalNotes,
      completionNote: workOrder.completionNote,
      proofRecords: workOrder.proofRecords.map(serializeProofRecord),
      history: JSON.parse(workOrder.history),
    })),
    serviceEvents: serviceEvents.map(serializeServiceEvent),
    clientRequests: clientRequests.map(serializeClientRequest),
  };
}
