import type { Prisma, WorkOrder } from "@prisma/client";
import { appendHistory } from "./history";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Marks a work order completed (history entry + client-visible completion event), unless it already is. */
export async function markWorkOrderCompleted(
  tx: Prisma.TransactionClient,
  workOrder: WorkOrder,
  note: string | null,
  at: Date,
) {
  if (workOrder.status === "completed") return;

  await tx.workOrder.update({
    where: { id: workOrder.id },
    data: {
      status: "completed",
      history: appendHistory(workOrder.history, { at: at.toISOString(), actor: "fitter", action: "completed", note }),
    },
  });

  await tx.serviceEvent.create({
    data: {
      organisationId: workOrder.organisationId,
      contractId: workOrder.contractId,
      campaignId: workOrder.campaignId,
      workOrderId: workOrder.id,
      at,
      type: `${workOrder.type}_completed`,
      title: `${capitalize(workOrder.type)} completed`,
      clientVisible: true,
      clientSummary: `${capitalize(workOrder.type)} has been completed.`,
    },
  });
}
