import type { Prisma } from "@prisma/client";

export const WORK_ORDER_INCLUDE = {
  proofRecords: { select: { id: true } },
} satisfies Prisma.WorkOrderInclude;

type WorkOrderWithProof = Prisma.WorkOrderGetPayload<{ include: typeof WORK_ORDER_INCLUDE }>;

/** Serializes to the openapi WorkOrder schema. `internalNotes` is deliberately omitted - it is not part of that schema. */
export function serializeWorkOrder(workOrder: WorkOrderWithProof) {
  return {
    id: workOrder.id,
    campaignId: workOrder.campaignId,
    contractId: workOrder.contractId,
    organisationId: workOrder.organisationId,
    type: workOrder.type,
    status: workOrder.status,
    assignedUserId: workOrder.assignedUserId,
    assetId: workOrder.assetId,
    scheduledStart: workOrder.scheduledStart.toISOString(),
    scheduledEnd: workOrder.scheduledEnd.toISOString(),
    locationLabel: workOrder.locationLabel,
    instructions: workOrder.instructions,
    completionNote: workOrder.completionNote,
    proofRecordIds: workOrder.proofRecords.map((proof) => proof.id),
    history: JSON.parse(workOrder.history),
  };
}
