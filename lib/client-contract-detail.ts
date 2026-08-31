import type { Contract, ContractItem } from "@prisma/client";
import { prisma } from "./prisma";
import { serializeContract, enrichContractItems, serializeProofRecord, serializeClientRequest } from "./contracts";
import { serializeCampaign } from "./campaigns";
import { serializeServiceEvent } from "./service-events";

export async function buildClientContractDetail(contract: Contract & { items: ContractItem[] }) {
  const [campaign, serviceEvents, proofRecords, clientRequests, items] = await Promise.all([
    prisma.campaign.findUnique({ where: { contractId: contract.id } }),
    prisma.serviceEvent.findMany({
      where: { contractId: contract.id, clientVisible: true },
      orderBy: { at: "asc" },
    }),
    prisma.proofRecord.findMany({
      where: { workOrder: { contractId: contract.id } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.clientRequest.findMany({
      where: { contractId: contract.id },
      orderBy: { createdAt: "asc" },
    }),
    enrichContractItems(contract.items),
  ]);

  return {
    ...serializeContract(contract),
    items,
    campaign: serializeCampaign(campaign),
    serviceEvents: serviceEvents.map(serializeServiceEvent),
    proofRecords: proofRecords.map(serializeProofRecord),
    clientRequests: clientRequests.map(serializeClientRequest),
  };
}
