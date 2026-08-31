import type { Campaign } from "@prisma/client";

export function serializeCampaign(campaign: Campaign | null) {
  if (!campaign) return null;
  return {
    id: campaign.id,
    organisationId: campaign.organisationId,
    contractId: campaign.contractId,
    bookingId: campaign.bookingId,
    name: campaign.name,
    status: campaign.status,
    currentStage: campaign.currentStage,
    clientVisible: campaign.clientVisible,
  };
}
